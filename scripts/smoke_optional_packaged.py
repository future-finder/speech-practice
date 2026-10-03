"""Verify frozen CPU Parakeet and compatibility with the existing frozen GPU worker."""
import json
import subprocess
import threading
import time
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data = root / '.local/optional-model-verification'
evidence = root / 'docs/evidence/optional-models'


def invoke(executable, payload, name, worker_flag=False):
    with (evidence / f'{name}.log').open('w', encoding='utf-8') as log:
        command = [str(executable)] + (['--worker'] if worker_flag else [])
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=log,
                                   text=True, encoding='utf-8', creationflags=subprocess.CREATE_NO_WINDOW)
        timer = threading.Timer(180, process.kill)
        timer.start()
        started = time.monotonic()
        try:
            process.stdin.write(json.dumps(payload) + '\n')
            process.stdin.flush()
            line = process.stdout.readline()
            if not line:
                raise RuntimeError(f'{name} stopped; see its evidence log.')
            response = json.loads(line)
            if not response.get('ok'):
                raise RuntimeError(response)
            return {'seconds_including_load': time.monotonic() - started,
                    'executable': str(executable), 'result': response['result']}
        finally:
            timer.cancel()
            process.terminate()
            process.wait(timeout=15)


def main():
    evidence.mkdir(parents=True, exist_ok=True)
    cpu = invoke(root / 'build/runtime/speech-backend/speech-backend.exe', {
        'kind': 'parakeet', 'directory': str(data / 'models/parakeet'), 'device': 'cpu',
        'audio': str(data / 'ryan-qwen-small.wav')}, 'frozen-parakeet', True)
    assert cpu['result']['text'] and cpu['result']['model'] == 'parakeet'
    print(f'Frozen Parakeet: {cpu["seconds_including_load"]:.2f}s', flush=True)
    gpu = invoke(root / 'build/components/speech-qwen/speech-qwen.exe', {
        'kind': 'qwen', 'directory': str(data / 'models/qwen-small'), 'output': str(data / 'frozen-qwen-small.wav'),
        'text': 'We choose to listen carefully and speak clearly.', 'voice': 'Ryan',
        'options': {'provider': 'qwen-small', 'speed': 1, 'style': ''}}, 'existing-gpu-qwen-small')
    assert gpu['result']['duration'] > .5
    print(f'Existing frozen GPU component / Qwen 0.6B: {gpu["seconds_including_load"]:.2f}s', flush=True)
    (evidence / 'packaged.json').write_text(json.dumps({'cpu': cpu, 'existing_gpu_component': gpu,
        'scope': 'Frozen local workers / generated English audio; not human quality or accuracy validation'},
        ensure_ascii=False, indent=2), 'utf-8')


if __name__ == '__main__':
    main()
