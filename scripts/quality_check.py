"""Small real-model content check. WER is ASR-based, not human voice preference."""
import hashlib
import json
import sys
from pathlib import Path
root = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'backend'))
from speech_practice.config import Settings
from speech_practice.jobs import WorkerBridge
from speech_practice.models import ModelManager
from speech_practice.text import align, tokens
settings=Settings()
models=ModelManager(settings)
worker=WorkerBridge(settings)
folder=root/('docs/evidence/quality-refined' if '--refined' in sys.argv else 'docs/evidence/quality')
folder.mkdir(parents=True,exist_ok=True)
texts=["Every meaningful change begins with a small decision. We choose to listen more carefully and try again after a difficult day.",
       "Progress grows through careful practice. Speak clearly, pause with purpose, and let each idea connect to the next."]
styles={'natural':'','confident':'Speak with a confident, engaging public-speaking delivery, with clear articulation and thoughtful pauses.',
        'energetic':'Speak enthusiastically and energetically, while keeping every word clear.'}
if '--refined' in sys.argv:
    styles = {'energetic': 'Deliver the supplied words as an energetic public speech, using a lively but controlled speaking voice. Read only the supplied text, without laughter, interjections, or extra words.'}
results=[]
try:
    for i,text in enumerate(texts):
        for style,instruction in styles.items():
            output=folder/f'qwen-{i}-{style}.wav'
            audio=worker.invoke({'kind':'qwen','directory':str(models.directory('qwen')),'output':str(output),'text':text,'voice':'Ryan',
                                 'options':{'speed':1,'style':instruction}})
            results.append({'text':text,'style':style,'instruction':instruction,'path':str(output),'duration':audio['duration'],
                            'sha256':hashlib.sha256(output.read_bytes()).hexdigest()})
            print(f'Generated {i} {style}',flush=True)
    for row in results:
        transcript=worker.invoke({'kind':'whisper','directory':str(models.directory('whisper')),'audio':row['path']})
        differences=align(row['text'],transcript['text'])
        row['transcript']=transcript['text']
        row['recognition_uncertain']=transcript['uncertain']
        row['asr_based_wer']=sum(d['type']!='match' for d in differences)/len(tokens(row['text']))
        row['differences']=[d for d in differences if d['type']!='match']
    (folder/'results.json').write_text(json.dumps({'seed':42,'results':results,
        'limitations':['ASR-based WER is not a human transcription or pronunciation score','Different waveforms do not prove better expressiveness','Subjective listening comparison remains unverified']},indent=2),'utf-8')
    print(json.dumps([{k:v for k,v in row.items() if k in ('style','duration','asr_based_wer')} for row in results]),flush=True)
finally:
    worker.stop()
