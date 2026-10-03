"""Long speech through the frozen API and separately installed GPU component."""
import io
import json
import os
import re
import subprocess
import time
from pathlib import Path
import httpx
import soundfile as sf

root = Path(__file__).resolve().parents[1]
data = root / '.local/component-test'
(data / 'settings.json').write_text(json.dumps({'model_dir': str(Path(os.environ['LOCALAPPDATA']) / 'speech-practice/models')}), 'utf-8')
text = re.search(r'const SAMPLE = `(.*?)`;', (root / 'src/App.tsx').read_text('utf-8'), re.S)[1]
env = {**os.environ, 'SPEECH_DATA_DIR': str(data), 'PYTHONUTF8': '1', 'PATH': os.path.join(os.environ['SystemRoot'], 'System32'),
       'PYTHONPATH': '', 'HF_HUB_OFFLINE': '1', 'TRANSFORMERS_OFFLINE': '1',
       'HTTP_PROXY': 'http://127.0.0.1:9', 'HTTPS_PROXY': 'http://127.0.0.1:9', 'NO_PROXY': '127.0.0.1'}
log = (root / 'docs/evidence/long-e2e.log').open('w', encoding='utf-8')
def start():
    process = subprocess.Popen([str(root / 'build/runtime/speech-backend/speech-backend.exe')], stdout=subprocess.PIPE,
        stderr=log, text=True, encoding='utf-8', env=env, creationflags=0x08000000)
    connection = json.loads(process.stdout.readline())
    client = httpx.Client(base_url=f"http://127.0.0.1:{connection['port']}/api", headers={'Authorization': f"Bearer {connection['token']}"}, trust_env=False, timeout=30)
    return process, client
def stop(process, client):
    client.close()
    subprocess.run(['taskkill', '/pid', str(process.pid), '/T', '/F'], capture_output=True, creationflags=0x08000000)
def call(method, path, **kwargs):
    response = client.request(method, path, **kwargs)
    response.raise_for_status()
    return response.json()
def wait(job):
    deadline = time.monotonic() + 1200
    while time.monotonic() < deadline:
        current = call('GET', '/jobs/' + job['id'])
        if current['status'] == 'completed': return current
        if current['status'] in ('failed', 'cancelled'): raise RuntimeError(current['error'] or current['status'])
        time.sleep(.5)
    raise TimeoutError('Long generation timed out')
report = {'words': len(text.split()), 'modes': [], 'limitations': ['Synthetic recording upload, not human microphone', 'Outbound HTTP proxy blocked; no physical disconnection', 'Current development Windows, not clean VM']}
process, client = start()
try:
    session = call('POST', '/sessions', json={'title': 'Long speech packaged validation', 'text': text})
    report['sentences'] = len(session['sentences'])
    for mode, voice in [('kokoro', 'af_sarah'), ('qwen', 'Ryan')]:
        call('PATCH', f"/sessions/{session['id']}/options", json={'provider': mode, 'voice': voice, 'speed': 1, 'style': ''})
        started = time.perf_counter()
        wait(call('POST', f"/sessions/{session['id']}/generate", json={}))
        elapsed = time.perf_counter() - started
        session = call('GET', '/sessions/' + session['id'])
        assert all(s['asset_id'] for s in session['sentences'])
        exported = wait(call('POST', f"/sessions/{session['id']}/export", json={'pause_ms': 300}))
        response = client.get('/assets/' + exported['result']['asset_id'] + '?download=true')
        response.raise_for_status()
        audio = sf.info(io.BytesIO(response.content))
        assert audio.samplerate == 24000 and audio.channels == 1 and audio.subtype == 'PCM_16'
        (root / f'docs/evidence/long-{mode}.wav').write_bytes(response.content)
        report['modes'].append({'mode': mode, 'generation_seconds': elapsed, 'duration': audio.duration, 'bytes': len(response.content)})
        print(json.dumps(report['modes'][-1]), flush=True)
    first = session['sentences'][0]
    response = client.get('/assets/' + first['asset_id'])
    response.raise_for_status()
    rec = call('POST', f"/sentences/{first['id']}/recordings", files={'file': ('reference.wav', response.content, 'audio/wav')})
    report['asr'] = wait(call('POST', f"/recordings/{rec['id']}/analyze"))['result']
    chosen = session['sentences'][2]['id']
    call('PATCH', f"/sessions/{session['id']}/progress", json={'sentence_id': chosen})
    stop(process, client)
    process, client = start()
    restored = call('GET', '/sessions/' + session['id'])
    assert restored['current_sentence_id'] == chosen
    assert len(call('GET', f"/sessions/{session['id']}/recordings")) == 1
    report['restart_restores_progress_and_recording'] = True
    started = time.perf_counter()
    wait(call('POST', f"/sessions/{session['id']}/generate", json={}))
    report['cached_regeneration_seconds'] = time.perf_counter() - started
    report['status'] = 'passed'
finally:
    stop(process, client)
    log.close()
    (root / 'docs/evidence/long-e2e.json').write_text(json.dumps(report, indent=2), 'utf-8')
