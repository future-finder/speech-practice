import hashlib
import io
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient
from speech_practice.app import create_app
from speech_practice.audio import merge_wav, decode
from speech_practice.models import download_file
from speech_practice.pronunciation import parse_response
from speech_practice.storage import Store
from speech_practice.text import align, split_sentences


@pytest.fixture
def client(tmp_path):
    app = create_app(tmp_path, "test-token")
    with TestClient(app) as client:
        client.headers["Authorization"] = "Bearer test-token"
        yield client


def sample_wav(duration=1, rate=24000):
    file = io.BytesIO()
    sf.write(file, np.sin(np.arange(int(rate * duration)) / rate * 2 * np.pi * 220) * .2, rate, format="WAV", subtype="PCM_16")
    return file.getvalue()


def test_sentence_abbreviations():
    assert split_sentences("Dr. Smith paid $3.50. Then he left.\nNext paragraph!") == ["Dr. Smith paid $3.50.", "Then he left.", "Next paragraph!"]


def test_alignment_repeated_words_and_offsets():
    operations = align("I really really like tea.", "I really like coffee today.")
    assert [d["type"] for d in operations].count("omit") == 1
    assert any(d["type"] == "substitute" and d["expected"] == "tea" for d in operations)
    assert operations[-1]["type"] == "insert"
    for d in operations:
        if d["reference_span"]:
            start, end = d["reference_span"]
            assert "I really really like tea."[start:end].lower() == d["expected"]


def test_contractions_numbers():
    assert all(d["type"] == "match" for d in align("I'm 21. I can't go.", "I am twenty one I can not go"))


def test_recording_reference_survives_edit_split_merge(client):
    session = client.post('/api/sessions', json={"text": "Hello world. Keep going."}).json()
    sentence = session['sentences'][0]
    rec = client.post(f"/api/sentences/{sentence['id']}/recordings", files={"file": ("test.wav", sample_wav(), "audio/wav")}).json()
    edit = client.patch(f"/api/sentences/{sentence['id']}", json={"spoken_text": "Hello wonderful world.", "options": sentence['options']}).json()
    assert edit['version'] == 2
    split = client.post(f"/api/sentences/{sentence['id']}/split", json={"offset": 6}).json()
    assert len(split['sentences']) == 3
    merged = client.post(f"/api/sentences/{sentence['id']}/merge").json()
    assert len(merged['sentences']) == 2
    recordings = client.get(f"/api/sessions/{session['id']}/recordings").json()
    assert recordings[0]['spoken_text'] == "Hello world."
    assert recordings[0]['sentence_version'] == 1
    assert rec['duration'] == pytest.approx(1)


def test_wav_bytes_range_and_deletion(client):
    session = client.post('/api/sessions', json={"text": "Hello."}).json()
    rec = client.post(f"/api/sentences/{session['sentences'][0]['id']}/recordings", files={"file": ("test.wav", sample_wav(), "audio/wav")}).json()
    url = f"/api/assets/{rec['id']}"
    response = client.get(url + '?download=true')
    assert response.content[:4] == b'RIFF' and response.content[8:12] == b'WAVE'
    assert response.headers['content-type'] == 'audio/wav'
    assert 'attachment' in response.headers['content-disposition']
    part = client.get(url, headers={"Range": "bytes=0-11"})
    assert part.status_code == 206 and part.content == response.content[:12]
    client.delete(f"/api/recordings/{rec['id']}")
    assert client.get(url).status_code == 404


def test_upload_validation(client):
    session = client.post('/api/sessions', json={"text": "Hello."}).json()
    url = f"/api/sentences/{session['sentences'][0]['id']}/recordings"
    assert client.post(url, files={"file": ("bad.exe", b'x', "application/x-msdownload")}).status_code == 400
    assert client.post(url, files={"file": ("bad.wav", b'not audio', "audio/wav")}).status_code == 400
    assert client.post(url, files={"file": ("empty.wav", sample_wav(0), "audio/wav")}).status_code == 400


def test_decode_limits(tmp_path):
    path = tmp_path / 'long.wav'
    path.write_bytes(sample_wav(2))
    with pytest.raises(ValueError, match='exceeds'):
        decode(path, max_duration=1)


def test_mixed_sample_rates_merge(tmp_path):
    a, b, out = [tmp_path / name for name in ('a.wav','b.wav','out.wav')]
    a.write_bytes(sample_wav(1, 16000))
    b.write_bytes(sample_wav(1, 48000))
    result = merge_wav([a,b], out, 300)
    assert result['duration'] == pytest.approx(2.3)
    assert sf.info(out).samplerate == 24000
    assert sf.info(out).subtype == 'PCM_16'


def test_speechace_sample_missing_fields():
    sample = json.loads((__import__('pathlib').Path(__file__).parent / 'fixtures/speechace.json').read_text())
    result = parse_response(sample)
    assert result['words'][0]['phones'][0]['start'] == .11
    assert result['words'][0]['end'] == .41
    assert result['score'] is None
    result = parse_response({"status":"success","text_score":{"word_score_list":[{"word":"hi"}]}})
    assert result['words'][0]['start'] is None and result['words'][0]['score'] is None
    assert parse_response({"status":"error","error_code":"invalid_key"})['status'] == 'failed'
    assert parse_response({'status': 'success', 'text_score': None})['score'] is None
    assert parse_response({'status': 'success', 'text_score': {'speechace_score': None, 'word_score_list': None}})['words'] == []
    with pytest.raises(ValueError):
        parse_response([])


def test_api_auth_and_input_limits(client):
    assert client.get('/api/sessions', headers={"Authorization":""}).status_code == 401
    assert client.get('/api/sessions?token=test-token', headers={"Authorization":""}).status_code == 401
    assert client.post('/api/sessions', json={"text":"x"*100001}).status_code == 422
    assert client.post('/api/sessions', json={"text":"   "}).status_code == 400


def test_export_missing_audio(client):
    session = client.post('/api/sessions', json={"text":"Hello."}).json()
    assert client.post(f"/api/sessions/{session['id']}/export", json={}).status_code == 400


def test_download_resume_and_checksum(tmp_path):
    data = b'validated model bytes' * 100
    requests = []
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_): pass
        def do_GET(self):
            offset = int(self.headers.get('Range', 'bytes=0-').split('=')[1].split('-')[0])
            requests.append(offset)
            self.send_response(206 if offset else 200)
            if offset:
                self.send_header('Content-Range', f'bytes {offset}-{len(data)-1}/{len(data)}')
            self.end_headers()
            self.wfile.write(data[offset:])
    server = ThreadingHTTPServer(('127.0.0.1',0), Handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    file = {"size":len(data),"hash":hashlib.sha256(data).hexdigest(),"algorithm":"sha256","url":f'http://127.0.0.1:{server.server_port}/model'}
    destination = tmp_path / 'model'
    destination.with_name('model.partial').write_bytes(data[:100])
    try:
        download_file(file, destination)
        assert destination.read_bytes() == data and requests[0] == 100
        destination.unlink()
        with pytest.raises(ValueError, match='checksum'):
            download_file({**file,"hash":"0"*64},destination)
        assert not destination.exists()
    finally:
        server.shutdown()


def test_cancel_worker_and_keep_completed_audio(client, monkeypatch):
    jobs = client.app.state.jobs
    entered = threading.Event()
    stopped = threading.Event()
    def invoke(payload):
        entered.set()
        stopped.wait(2)
        raise ValueError('stopped')
    monkeypatch.setattr(jobs.models, 'ready', lambda _: True)
    monkeypatch.setattr(jobs.worker, 'invoke', invoke)
    monkeypatch.setattr(jobs.worker, 'stop', stopped.set)
    session = client.post('/api/sessions', json={"text":"Hello."}).json()
    job = client.post(f"/api/sessions/{session['id']}/generate",json={}).json()
    assert entered.wait(2)
    assert client.post(f"/api/jobs/{job['id']}/cancel").json()['status'] == 'cancelled'
    time.sleep(.1)
    assert client.get(f"/api/jobs/{job['id']}").json()['status'] == 'cancelled'
    assert client.get(f"/api/sessions/{session['id']}").json()['sentences'][0]['asset_id'] is None


def test_apply_voice_changes_versions_but_preserves_recording(client):
    session = client.post('/api/sessions', json={'text': 'Hello world. Keep going.'}).json()
    first = session['sentences'][0]
    rec = client.post(f"/api/sentences/{first['id']}/recordings", files={'file': ('test.wav', sample_wav(), 'audio/wav')}).json()
    options = {**first['options'], 'voice': 'am_michael'}
    updated = client.patch(f"/api/sessions/{session['id']}/options", json=options)
    assert updated.status_code == 200
    assert all(s['version'] == 2 and s['options']['voice'] == 'am_michael' for s in updated.json()['sentences'])
    saved = client.get(f"/api/sessions/{session['id']}/recordings").json()[0]
    assert saved['id'] == rec['id'] and saved['sentence_version'] == 1
    assert client.patch(f"/api/sessions/{session['id']}/options", json={**options, 'voice': 'unknown'}).status_code == 400


def test_download_does_not_block_inference(client, monkeypatch):
    jobs = client.app.state.jobs
    entered, release, foreground = threading.Event(), threading.Event(), threading.Event()
    def execute(job):
        if job['action'] == 'download':
            entered.set()
            release.wait(3)
        else:
            foreground.set()
        return {}, False
    monkeypatch.setattr(jobs, 'execute', execute)
    try:
        jobs.submit('download', {'model': 'qwen'})
        assert entered.wait(1)
        jobs.submit('generate', {'sentences': [{}]}, priority=0)
        assert foreground.wait(1)
    finally:
        release.set()


@pytest.mark.parametrize('unsafe', [True, False])
def test_component_rejects_traversal_or_corruption(tmp_path, unsafe):
    import zipfile
    from speech_practice.components import install_qwen
    from speech_practice.config import Settings
    archive = tmp_path / 'component.zip'
    manifest = {'component': 'qwen', 'protocol': 1, 'files': {'speech-qwen.exe': '0' * 64}}
    with zipfile.ZipFile(archive, 'w') as bundle:
        bundle.writestr('component.json', json.dumps(manifest))
        if unsafe:
            bundle.writestr('../escape.exe', b'bad')
        else:
            bundle.writestr('speech-qwen.exe', b'corrupt')
    with pytest.raises(ValueError, match='Unsafe|checksum'):
        install_qwen(Settings(tmp_path / 'data'), archive)
    assert not (tmp_path / 'data/components/qwen').exists()
    assert not (tmp_path / 'data/escape.exe').exists()
