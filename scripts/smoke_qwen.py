import json
import os
import subprocess
import time
from pathlib import Path
root = Path(__file__).resolve().parents[1]
log = (root/'docs/evidence/packaged-qwen.log').open('w',encoding='utf-8')
env = {**os.environ,'PATH':os.path.join(os.environ['SystemRoot'],'System32'),'PYTHONPATH':'','PYTHONUTF8':'1',
       'HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1'}
process = subprocess.Popen([os.environ.get('SPEECH_QWEN_EXE', str(root/'build/components/speech-qwen/speech-qwen.exe'))],stdin=subprocess.PIPE,stdout=subprocess.PIPE,
                           stderr=log,text=True,encoding='utf-8',env=env,creationflags=0x08000000)
started = time.perf_counter()
try:
    payload={'kind':'qwen','directory':os.environ.get('SPEECH_QWEN_MODEL', str(Path(os.environ['LOCALAPPDATA'])/'speech-practice/models/qwen')),
             'output':str(root/'docs/evidence/高模式录音.wav'),'text':'Every meaningful change begins with a small decision.',
             'voice':'Ryan','options':{'speed':1,'style':'Speak warmly and calmly.'}}
    process.stdin.write(json.dumps(payload)+'\n'); process.stdin.flush()
    line=process.stdout.readline()
    if not line: raise RuntimeError('Qwen packaged worker stopped. See packaged-qwen.log')
    result=json.loads(line)
    report={'elapsed_seconds':time.perf_counter()-started,**result}
    (root/'docs/evidence/packaged-qwen.json').write_text(json.dumps(report,indent=2),'utf-8')
    print(json.dumps(report))
    if not result['ok']: raise RuntimeError(result['error'])
finally:
    process.terminate()
    process.wait(timeout=10)
    log.close()
