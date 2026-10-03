"""Validate the shipped archive and execute its installed GPU worker."""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'backend'))
from speech_practice.components import install_qwen
from speech_practice.config import Settings

started = time.perf_counter()
version = json.loads((root/'package.json').read_text('utf8'))['version']
installed = install_qwen(Settings(root / '.local' / 'component-test-0.2'), root / 'release' / f'speech-qwen-{version}-win-x64.zip')
report = {'archive_install': installed, 'install_seconds': time.perf_counter() - started}
env = {**os.environ, 'PATH': os.path.join(os.environ['SystemRoot'], 'System32'),
       'PYTHONPATH': '', 'PYTHONUTF8': '1', 'HF_HUB_OFFLINE': '1', 'TRANSFORMERS_OFFLINE': '1'}
with (root / 'docs/evidence/component-smoke.log').open('w', encoding='utf-8') as log:
    process = subprocess.Popen([str(Path(installed['path']) / 'speech-qwen.exe')], stdin=subprocess.PIPE,
        stdout=subprocess.PIPE, stderr=log, text=True, encoding='utf-8', env=env, creationflags=0x08000000)
    try:
        payload = {'kind': 'qwen', 'directory': str(Path(os.environ['LOCALAPPDATA']) / 'speech-practice/models/qwen'),
                   'output': str(root / 'docs/evidence/component-smoke.wav'),
                   'text': 'We choose to listen more carefully.', 'voice': 'Aiden',
                   'options': {'speed': 1, 'style': 'Speak clearly and confidently.'}}
        started = time.perf_counter()
        process.stdin.write(json.dumps(payload) + '\n')
        process.stdin.flush()
        line = process.stdout.readline()
        if not line:
            raise RuntimeError('Installed worker stopped; inspect component-smoke.log')
        report.update({'inference_seconds': time.perf_counter() - started, 'result': json.loads(line)})
        if not report['result']['ok']:
            raise RuntimeError(report['result']['error'])
        # Switch the SAME frozen worker from Qwen to GPU ASR; no simultaneous inference.
        requests = []
        for model in ('whisper-distil','whisper-turbo'):
            payload={'kind':'whisper','directory':str(root/'.local/asr-models'/model),'device':'cuda',
                     'audio':str(root/'docs/evidence/component-smoke.wav')}
            started=time.perf_counter()
            process.stdin.write(json.dumps(payload)+'\n');process.stdin.flush()
            response=json.loads(process.stdout.readline())
            if not response['ok']:raise RuntimeError(response['error'])
            requests.append({'model':model,'elapsed_seconds':time.perf_counter()-started,'result':response})
        report['gpu_asr_after_qwen']=requests
    finally:
        process.terminate()
        process.wait(timeout=15)
(root / 'docs/evidence/component-smoke.json').write_text(json.dumps(report, indent=2), 'utf-8')
print(json.dumps(report))
