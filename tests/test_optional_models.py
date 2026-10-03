"""Capability and alignment regressions for the optional local models."""
import io
import time
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient
from speech_practice.app import create_app
from speech_practice.providers import parakeet_words
from speech_practice.schemas import AnalyzeRequest, Options


def test_parakeet_bpe_word_times_preserve_repetitions_and_punctuation():
    words = parakeet_words('I really really like tea.',
                          [' I', ' real', 'ly', ' really', ' like', ' tea', '.'],
                          [0, .2, .3, .5, .8, 1, 1.2], [.1, .1, .1, .2, .1, .2, .05], 2)
    assert [word['word'] for word in words] == ['I', 'really', 'really', 'like', 'tea.']
    assert words[1]['start'] == .2 and words[1]['end'] == .4
    assert words[2]['start'] == .5 and words[2]['end'] == .7


def test_parakeet_missing_or_invalid_times_do_not_fabricate_word_ranges():
    for durations in ([], [float('nan')], [5]):
        assert parakeet_words('Hello', [' Hello'], [.1], durations, 1) == [
            {'word': 'Hello', 'start': None, 'end': None}]
    assert parakeet_words('Hello world', [' different'], [0], [.1], 1) == [
        {'word': 'Hello', 'start': None, 'end': None}, {'word': 'world', 'start': None, 'end': None}]


def test_models_reject_unsupported_capabilities():
    with pytest.raises(ValueError, match='delivery instructions'):
        Options(provider='qwen-small', voice='Ryan', style='Speak happily')
    with pytest.raises(ValueError, match='CPU int8'):
        AnalyzeRequest(model='parakeet', device='cuda')


def test_new_models_api_selection_dispatch_and_history(tmp_path, monkeypatch):
    app = create_app(tmp_path, 'optional-test')
    with TestClient(app) as client:
        client.headers['Authorization'] = 'Bearer optional-test'
        assert client.patch('/api/settings', json={'asr_device': 'cuda'}).status_code == 200
        settings = client.patch('/api/settings', json={'asr_model': 'parakeet'}).json()
        assert settings['asr_model'] == 'parakeet' and settings['asr_device'] == 'cpu'
        assert client.patch('/api/settings', json={'asr_device': 'cuda'}).status_code == 400
        session = client.post('/api/sessions', json={'text': 'Hello world.'}).json()
        sentence = session['sentences'][0]
        options = {'provider': 'qwen-small', 'voice': 'Aiden', 'speed': 1, 'style': ''}
        edited = client.patch(f'/api/sentences/{sentence["id"]}', json={
            'spoken_text': 'Hello world.', 'options': options})
        assert edited.status_code == 200 and edited.json()['options'] == options
        assert client.patch(f'/api/sentences/{sentence["id"]}', json={
            'spoken_text': 'Hello world.', 'options': {**options, 'speed': 1.2}}).status_code == 400
        audio = io.BytesIO()
        sf.write(audio, np.ones(16000) * .1, 16000, format='WAV')
        recording = client.post(f'/api/sentences/{sentence["id"]}/recordings', files={
            'file': ('voice.wav', audio.getvalue(), 'audio/wav')}).json()
        monkeypatch.setattr(app.state.jobs.models, 'ready', lambda _: True)
        invoked = []
        def invoke(payload):
            invoked.append(payload)
            return {'text': 'Hello world.', 'words': [], 'uncertain': False,
                    'model': 'parakeet', 'device': 'cpu'}
        monkeypatch.setattr(app.state.jobs.worker, 'invoke', invoke)
        job = client.post(f'/api/recordings/{recording["id"]}/analyze', json={
            'model': 'parakeet', 'device': 'cpu'}).json()
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            state = client.get(f'/api/jobs/{job["id"]}').json()
            if state['status'] in ('completed', 'failed'):
                break
            time.sleep(.02)
        assert state['status'] == 'completed', state
        assert invoked[0]['kind'] == 'parakeet'
        assert Path(invoked[0]['directory']).name == 'parakeet'
        saved = client.get(f'/api/sessions/{session["id"]}/recordings').json()[0]
        assert saved['recognition_history'][0]['transcript']['model'] == 'parakeet'
    restored = create_app(tmp_path, 'optional-test')
    with TestClient(restored) as client:
        client.headers['Authorization'] = 'Bearer optional-test'
        assert client.get('/api/settings').json()['asr_model'] == 'parakeet'
        assert client.get(f'/api/sessions/{session["id"]}').json()['sentences'][0]['options'] == options
