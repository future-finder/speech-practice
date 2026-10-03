"""Run real optional models through the application API in an isolated data root."""
import hashlib
import json
import sys
import time
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'backend'))
from fastapi.testclient import TestClient
import numpy as np
import soundfile as sf
from speech_practice.app import create_app


def wait(client, job, maximum=240):
    started = time.monotonic()
    checkpoint = 0
    while time.monotonic() - started < maximum:
        state = client.get(f'/api/jobs/{job["id"]}').raise_for_status().json()
        if state['status'] in ('completed', 'failed', 'cancelled'):
            if state['status'] != 'completed':
                raise RuntimeError(state)
            return state, time.monotonic() - started
        elapsed = time.monotonic() - started
        if elapsed >= checkpoint:
            print(f'{state["stage"]}: {elapsed:.0f}s', flush=True)
            checkpoint += 10
        time.sleep(.2)
    raise TimeoutError('Optional model verification timed out.')


def main():
    data = root / '.local/optional-model-verification'
    report = {'scope': 'Real models / isolated application API / generated speech; not a human accent benchmark',
              'models': {}, 'results': []}
    token = 'optional-smoke'
    app = create_app(data, token)
    with TestClient(app) as client:
        client.headers['Authorization'] = f'Bearer {token}'
        for entry in client.get('/api/models').json():
            if entry['id'] in ('parakeet', 'qwen-small'):
                assert entry['ready'], entry
                report['models'][entry['id']] = {key: entry[key] for key in ('revision', 'size', 'license')}
        session = client.post('/api/sessions', json={'title': 'Optional model verification',
            'text': 'We choose to listen carefully and speak clearly. Practice helps us explain each idea.'}).raise_for_status().json()
        for sentence, voice in zip(session['sentences'], ('Ryan', 'Aiden')):
            options = {'provider': 'qwen-small', 'voice': voice, 'speed': 1.0, 'style': ''}
            signature = json.dumps({'text': sentence['spoken_text'], 'options': options,
                'revision': report['models']['qwen-small']['revision']}, sort_keys=True)
            cache = data / 'audio' / (hashlib.sha256(signature.encode()).hexdigest() + '.wav')
            # Only remove this isolated smoke test's known generated cache entry.
            cache.unlink(missing_ok=True)
            client.patch(f'/api/sentences/{sentence["id"]}', json={
                'spoken_text': sentence['spoken_text'], 'options': options}).raise_for_status()
            job = client.post(f'/api/sessions/{session["id"]}/generate', json={
                'sentence_id': sentence['id']}).raise_for_status().json()
            state, generated_seconds = wait(client, job)
            audio = client.get(f'/api/assets/{state["result"]["asset_id"]}').raise_for_status().content
            assert audio[:4] == b'RIFF'
            wav = data / f'{voice.lower()}-qwen-small.wav'
            wav.write_bytes(audio)
            info = sf.info(wav)
            assert info.duration > .5 and info.subtype == 'PCM_16'
            record = client.post(f'/api/sentences/{sentence["id"]}/recordings', files={
                'file': ('generated.wav', audio, 'audio/wav')}).raise_for_status().json()
            job = client.post(f'/api/recordings/{record["id"]}/analyze', json={
                'model': 'parakeet', 'device': 'cpu'}).raise_for_status().json()
            _, recognized_seconds = wait(client, job)
            take = next(item for item in client.get(f'/api/sessions/{session["id"]}/recordings').json()
                        if item['id'] == record['id'])
            transcript = take['content_feedback']['transcript']
            assert transcript['model'] == 'parakeet' and transcript['text'] and not transcript['uncertain']
            for word in transcript['words']:
                if word['start'] is not None:
                    assert 0 <= word['start'] < word['end'] <= record['duration']
            report['results'].append({'voice': voice, 'input_text': sentence['spoken_text'],
                'generation_seconds_including_load': generated_seconds, 'audio_duration': info.duration,
                'audio_sha256': hashlib.sha256(audio).hexdigest(),
                'recognition_seconds_including_load': recognized_seconds, 'transcript': transcript})
            print(f'{voice}: generated {generated_seconds:.2f}s; recognized {recognized_seconds:.2f}s: {transcript["text"]}', flush=True)
        silence = data / 'silence.wav'
        sf.write(silence, np.zeros(16000, dtype=np.float32), 16000)
        from speech_practice.providers import ParakeetProvider
        provider = ParakeetProvider(data / 'models/parakeet')
        assert provider.transcribe(silence).reason == 'silence'
        report['silence'] = 'passed'
    with TestClient(create_app(data, token)) as client:
        client.headers['Authorization'] = f'Bearer {token}'
        assert len(client.get(f'/api/sessions/{session["id"]}/recordings').json()) == 2
        report['history_after_restart'] = 'passed'
    out = root / 'docs/evidence/optional-models/smoke.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), 'utf-8')
    print(out, flush=True)


if __name__ == '__main__':
    main()
