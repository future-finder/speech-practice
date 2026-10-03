"""Real local inference benchmark. Synthetic TTS input is NOT a human microphone test."""
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path
import psutil

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from speech_practice.config import Settings
from speech_practice.models import ModelManager
from speech_practice.jobs import WorkerBridge

def main():
    settings = Settings()
    models = ModelManager(settings)
    worker = WorkerBridge(settings)
    folder = ROOT / 'docs' / 'evidence'
    folder.mkdir(parents=True, exist_ok=True)
    results = []
    text = "Every meaningful change begins with a small decision. We choose to listen more carefully and try again after a difficult day."
    kinds = ['kokoro', 'whisper'] + (['qwen'] if '--qwen' in sys.argv else [])
    try:
        for kind in kinds:
            if not models.ready(kind):
                results.append({'kind':kind,'status':'not_installed'})
                continue
            voices = ['af_sarah','am_michael'] if kind == 'kokoro' else ['Ryan','Aiden'] if kind == 'qwen' else ['']
            for voice in voices:
                styles = ['', 'Speak enthusiastically and energetically, while keeping every word clear.'] if kind == 'qwen' and voice == 'Ryan' else ['']
                for style_index, style in enumerate(styles):
                    output = folder / f'{kind}-{voice}-{style_index}.wav'
                    payload = {'kind':kind,'directory':str(models.directory(kind)),'output':str(output),'text':text,'voice':voice,'options':{'speed':1,'style':style}}
                    if kind == 'whisper':
                        payload['audio'] = str(folder / 'kokoro-af_sarah-0.wav')
                    stop = threading.Event()
                    peaks = {'rss_bytes':0,'gpu_mib':0}
                    def monitor():
                        while not stop.wait(.5):
                            try:
                                descendants = psutil.Process().children(recursive=True)
                                peaks['rss_bytes'] = max(peaks['rss_bytes'], sum(p.memory_info().rss for p in descendants if p.is_running()))
                                if kind == 'qwen':
                                    gpu = subprocess.check_output(['nvidia-smi','--query-gpu=memory.used','--format=csv,noheader,nounits'],creationflags=0x08000000)
                                    peaks['gpu_mib'] = max(peaks['gpu_mib'],int(gpu.decode().splitlines()[0]))
                            except (psutil.Error, ValueError, subprocess.SubprocessError):
                                pass
                    monitor_thread = threading.Thread(target=monitor,daemon=True)
                    monitor_thread.start()
                    started = time.perf_counter()
                    try:
                        result = worker.invoke(payload)
                        results.append({'kind':kind,'voice':voice,'style':style,'status':'success','elapsed_seconds':time.perf_counter()-started,
                                        'output':str(output) if kind != 'whisper' else None,'result':result,**peaks})
                    except Exception as error:
                        results.append({'kind':kind,'voice':voice,'status':'failed','error':str(error),**peaks})
                    finally:
                        stop.set()
                        monitor_thread.join()
                    print(json.dumps(results[-1], ensure_ascii=False),flush=True)
    finally:
        worker.stop()
    report = {'timestamp':time.strftime('%Y-%m-%dT%H:%M:%S'),'memory_bytes':psutil.virtual_memory().total,
              'python':sys.version,'cpu':os.environ.get('PROCESSOR_IDENTIFIER'),'results':results,
              'limitations':['Synthetic TTS input only; no human microphone verification','GPU memory is whole-device usage, not isolated process allocation','RSS is summed worker RSS; shared memory can be counted multiple times']}
    (folder / 'benchmark.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),'utf-8')

if __name__ == '__main__':
    main()
