"""Reopen previously tested frozen data roots and verify feedback snapshots."""
import json
import os
from pathlib import Path
import subprocess
import httpx

root=Path(__file__).resolve().parents[1]
cases=[('assessment',Path(json.loads((root/'docs/evidence/packaged-smoke.json').read_text('utf8'))['data'])),
       ('recognition',root/'.local/component-test-0.2')]
results=[]
for kind,data in cases:
    env={**os.environ,'SPEECH_DATA_DIR':str(data),'PATH':os.path.join(os.environ['SystemRoot'],'System32'),
         'PYTHONPATH':'','VIRTUAL_ENV':'','HTTP_PROXY':'http://127.0.0.1:9','HTTPS_PROXY':'http://127.0.0.1:9','NO_PROXY':'127.0.0.1'}
    with (root/f'docs/evidence/asr-0.2/restart-{kind}.log').open('w',encoding='utf8') as log:
        process=subprocess.Popen([str(root/'build/runtime/speech-backend/speech-backend.exe')],stdout=subprocess.PIPE,
                                 stderr=log,text=True,encoding='utf8',env=env,creationflags=0x08000000)
        try:
            connection=json.loads(process.stdout.readline())
            with httpx.Client(base_url=f'http://127.0.0.1:{connection["port"]}/api',headers={'Authorization':'Bearer '+connection['token']},trust_env=False) as client:
                sessions=client.get('/sessions').raise_for_status().json()
                records=client.get('/sessions/'+sessions[0]['id']+'/recordings').raise_for_status().json()
                record=records[0]
                history=record['assessment_history'] if kind=='assessment' else record['recognition_history']
                assert history and history[-1]['sentence_version']==record['sentence_version']
                assert history[-1]['spoken_text']==record['spoken_text']
                if kind=='assessment':assert history[-1]['status']=='not_configured' and history[-1]['overall_score'] is None
                else:assert history[-1]['transcript']['device']=='cuda' and len(history)==2
                results.append({'kind':kind,'passed':True,'history_count':len(history),'sentence_version':record['sentence_version']})
        finally:
            subprocess.run(['taskkill','/pid',str(process.pid),'/T','/F'],capture_output=True,creationflags=0x08000000)
(root/'docs/evidence/asr-0.2/restart.json').write_text(json.dumps(results,indent=2),'utf8')
print(results)
