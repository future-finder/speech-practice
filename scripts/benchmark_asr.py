"""Private local recordings stay outside deliverables. Metrics use the saved reference,
not a human-verified ground-truth transcript. Never label these metrics ASR accuracy.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time
import psutil

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))


def run_case(args):
    import numpy as np
    import soundfile as sf
    from speech_practice.providers import WhisperProvider
    from speech_practice.text import align
    index = json.loads(Path(args.index).read_text('utf8'))
    directory = Path(args.models) / args.model
    if args.model == 'whisper':
        directory = Path(os.environ['LOCALAPPDATA']) / 'speech-practice/models/whisper'
    process = psutil.Process()
    peak = {'rss': process.memory_info().rss, 'gpu_mib': 0}
    stop = threading.Event()
    def sample():
        while not stop.wait(.25):
            peak['rss'] = max(peak['rss'], process.memory_info().rss)
            try:
                output = subprocess.check_output(['nvidia-smi','--query-gpu=memory.used','--format=csv,noheader,nounits'], creationflags=subprocess.CREATE_NO_WINDOW, text=True)
                peak['gpu_mib'] = max(peak['gpu_mib'], int(output.strip().splitlines()[0]))
            except Exception:
                pass
    thread = threading.Thread(target=sample, daemon=True); thread.start()
    started = time.perf_counter(); provider = WhisperProvider(directory, args.device)
    load = time.perf_counter() - started
    results = []
    for case in index:
        started = time.perf_counter(); transcript = provider.transcribe(Path(case['path'])).model_dump()
        elapsed = time.perf_counter() - started
        difference = align(case['reference'], transcript['text'])
        mismatch = sum(d['type'] != 'match' for d in difference)
        results.append({'case': case['name'], 'seconds': elapsed, 'duration': case['duration'], 'real_time_factor': elapsed / case['duration'],
                        'text': transcript['text'], 'uncertain': transcript['uncertain'], 'reference_mismatch_count': mismatch,
                        'reference_mismatch_rate': mismatch / max(1, len(case['reference'].split())),
                        'audio_quality': transcript['audio_quality'], 'parameters': transcript['parameters']})
    stop.set(); thread.join(timeout=2)
    output = {'model': args.model, 'device': args.device, 'load_seconds': load, 'peak_process_rss_bytes': peak['rss'],
              'peak_total_gpu_mib': peak['gpu_mib'], 'gpu_metric_notice': 'Total device allocation; includes desktop/other processes.', 'cases': results}
    Path(args.output).write_text(json.dumps(output, indent=2), 'utf8')
    print(args.model, args.device, 'completed', flush=True)


def main():
    import soundfile as sf
    import numpy as np
    from speech_practice.storage import Store
    store = Store(Path(os.environ['LOCALAPPDATA']) / 'speech-practice/practice.sqlite3')
    records = store.list('recording')
    folder = ROOT / '.local/asr-benchmark'; folder.mkdir(parents=True, exist_ok=True)
    cases = [{'name': f'human-{i+1}', 'path': r['path'], 'reference': r['spoken_text'], 'duration': r['duration']}
             for i,r in enumerate(records) if Path(r['path']).is_file()]
    if not cases:
        raise SystemExit('No actual recordings; supply a corpus before benchmarking.')
    samples, rate = sf.read(cases[0]['path'])
    for label, audio in [('derived-quiet',samples * .15), ('derived-noise', samples + np.random.default_rng(42).normal(0,.003,len(samples)))]:
        path = folder / (label+'.wav'); sf.write(path,audio,rate)
        cases.append({**cases[0],'name':label,'path':str(path)})
    index = folder / 'private-index.json'; index.write_text(json.dumps(cases),'utf8')
    evidence = ROOT / 'docs/evidence/asr-0.2'; evidence.mkdir(parents=True,exist_ok=True)
    for model, device in [('whisper','cpu'),('whisper-distil','cpu'),('whisper-turbo','cpu'),('whisper-distil','cuda'),('whisper-turbo','cuda')]:
        python = ROOT / ('.venv-qwen' if device=='cuda' else '.venv') / 'Scripts/python.exe'
        output = evidence / f'{model}-{device}.json'
        subprocess.run([str(python), __file__, '--case', '--index',str(index),'--models',str(ROOT/'.local/asr-models'),
                        '--model',model,'--device',device,'--output',str(output)],check=True)


if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--case',action='store_true')
    for k in ('index','models','model','device','output'):p.add_argument('--'+k)
    args=p.parse_args()
    run_case(args) if args.case else main()
