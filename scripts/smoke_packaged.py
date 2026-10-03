"""Frozen backend end-to-end test, with Python/Node excluded from its PATH."""
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path
import httpx
root = Path(__file__).resolve().parents[1]
data = Path(tempfile.mkdtemp(prefix='speech-packaged-'))
models = Path(os.environ['LOCALAPPDATA'])/'speech-practice/models'
(data/'settings.json').write_text(json.dumps({'model_dir':str(models)}),'utf-8')
env = {**os.environ,'SPEECH_DATA_DIR':str(data),'PYTHONUTF8':'1','PATH':os.path.join(os.environ['SystemRoot'],'System32'),
       'PYTHONPATH':'','VIRTUAL_ENV':'','HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1',
       'HTTP_PROXY':'http://127.0.0.1:9','HTTPS_PROXY':'http://127.0.0.1:9','NO_PROXY':'127.0.0.1,localhost'}
log = (root/'docs/evidence/packaged-backend.log').open('w',encoding='utf-8')
process = subprocess.Popen([str(root/'build/runtime/speech-backend/speech-backend.exe')],stdout=subprocess.PIPE,stderr=log,
                           text=True,encoding='utf-8',env=env,creationflags=0x08000000)
results = []
try:
    line = process.stdout.readline()
    if not line:
        raise RuntimeError('Frozen backend failed to start. See packaged-backend.log.')
    connection = json.loads(line)
    client = httpx.Client(base_url=f"http://127.0.0.1:{connection['port']}",headers={'Authorization':f"Bearer {connection['token']}"},timeout=30,trust_env=False)
    def call(method,path,**kwargs):
        result=client.request(method,'/api'+path,**kwargs)
        result.raise_for_status()
        return result.json()
    def wait(job):
        deadline=time.monotonic()+180
        while time.monotonic()<deadline:
            current=call('GET','/jobs/'+job['id'])
            if current['status']=='completed': return current
            if current['status'] in ('failed','cancelled'): raise RuntimeError(current['error'] or current['status'])
            time.sleep(.3)
        raise TimeoutError('Frozen inference timed out')
    session=call('POST','/sessions',json={'title':'Frozen runtime verification','text':'Every meaningful change begins with a small decision. We choose to listen more carefully.'})
    wait(call('POST',f"/sessions/{session['id']}/generate",json={}))
    results.append({'step':'generate_all','status':'passed'})
    session=call('GET','/sessions/'+session['id'])
    response=client.get('/api/assets/'+session['sentences'][0]['asset_id']+'?download=true')
    assert response.content[:4]==b'RIFF'
    results.append({'step':'wav_download','status':'passed','bytes':len(response.content)})
    recording=call('POST',f"/sentences/{session['sentences'][0]['id']}/recordings",files={'file':('synthetic.wav',response.content,'audio/wav')})
    feedback=wait(call('POST',f"/recordings/{recording['id']}/analyze"))
    results.append({'step':'cpu_asr_synthetic_input','status':'passed','result':feedback['result']})
    assessed=wait(call('POST',f"/recordings/{recording['id']}/assess",json={'provider':'tencent','consent':True}))
    assert assessed['result']['status']=='not_configured' and assessed['result']['overall_score'] is None
    saved=call('GET',f"/sessions/{session['id']}/recordings")[0]
    assert len(saved['assessment_history'])==1 and saved['assessment_history'][0]['sentence_version']==recording['sentence_version']
    assert call('GET','/providers')['tencent']['mode']=='eval_mode=1 / rec_mode=1'
    results.append({'step':'tencent_disabled_history_and_contract','status':'passed','online_verified':False})
    exported=wait(call('POST',f"/sessions/{session['id']}/export",json={'pause_ms':300}))
    whole=client.get('/api/assets/'+exported['result']['asset_id']+'?download=true')
    whole.raise_for_status()
    assert whole.content[:4]==b'RIFF'
    (root/'docs/evidence/packaged-whole.wav').write_bytes(whole.content)
    part=client.get('/api/assets/'+exported['result']['asset_id'],headers={'Range':'bytes=0-11'})
    assert part.status_code==206 and len(part.content)==12
    results.append({'step':'whole_export_and_range','status':'passed','bytes':len(whole.content)})
    print(json.dumps(results,ensure_ascii=False),flush=True)
finally:
    if 'client' in locals(): client.close()
    subprocess.run(['taskkill','/pid',str(process.pid),'/T','/F'],capture_output=True,creationflags=0x08000000)
    log.close()
    (root/'docs/evidence/packaged-smoke.json').write_text(json.dumps({'data':str(data),'results':results,
        'limitations':['Not a clean Windows VM','Synthetic speech upload, not human microphone input','Outbound HTTP proxies disabled; not physical network disconnection']},indent=2),'utf-8')
