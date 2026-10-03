"""Frozen backend routes GPU ASR through an installed, capability-checked component."""
import json
import os
from pathlib import Path
import subprocess
import time
import httpx

root=Path(__file__).resolve().parents[1]
data=root/'.local/component-test-0.2'
(data/'settings.json').write_text(json.dumps({'model_dir':str(root/'.local/asr-models')}),'utf8')
env={**os.environ,'SPEECH_DATA_DIR':str(data),'PATH':os.path.join(os.environ['SystemRoot'],'System32'),
     'PYTHONPATH':'','VIRTUAL_ENV':'','HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1',
     'HTTP_PROXY':'http://127.0.0.1:9','HTTPS_PROXY':'http://127.0.0.1:9','NO_PROXY':'127.0.0.1'}
report=[]
with (root/'docs/evidence/asr-0.2/gpu-api.log').open('w',encoding='utf8') as log:
    process=subprocess.Popen([str(root/'build/runtime/speech-backend/speech-backend.exe')],stdout=subprocess.PIPE,
                             stderr=log,text=True,encoding='utf8',env=env,creationflags=0x08000000)
    try:
        connection=json.loads(process.stdout.readline())
        with httpx.Client(base_url=f'http://127.0.0.1:{connection["port"]}/api',
                          headers={'Authorization':'Bearer '+connection['token']},trust_env=False,timeout=30) as client:
            session=client.post('/sessions',json={'title':'Frozen GPU API test','text':'We choose to listen more carefully.'}).raise_for_status().json()
            record=client.post('/sentences/'+session['sentences'][0]['id']+'/recordings',
                               files={'file':('synthetic.wav',(root/'docs/evidence/component-smoke.wav').read_bytes(),'audio/wav')}).raise_for_status().json()
            for model in ('whisper-distil','whisper-turbo'):
                started=time.perf_counter()
                job=client.post('/recordings/'+record['id']+'/analyze',json={'model':model,'device':'cuda'}).raise_for_status().json()
                while time.perf_counter()-started<120:
                    state=client.get('/jobs/'+job['id']).raise_for_status().json()
                    if state['status'] not in ('queued','running'):break
                    time.sleep(.2)
                assert state['status']=='completed',state.get('error')
                assert state['result']['transcript']['device']=='cuda'
                report.append({'model':model,'passed':True,'seconds':time.perf_counter()-started,'result':state['result']})
            saved=client.get('/sessions/'+session['id']+'/recordings').raise_for_status().json()[0]
            assert len(saved['recognition_history'])==2
    finally:
        subprocess.run(['taskkill','/pid',str(process.pid),'/T','/F'],capture_output=True,creationflags=0x08000000)
(root/'docs/evidence/asr-0.2/gpu-api.json').write_text(json.dumps(report,indent=2),'utf8')
print('Frozen GPU routing and recording history passed',flush=True)
