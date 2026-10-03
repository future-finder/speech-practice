import hashlib
import json
import os
import queue
import subprocess
import sys
import threading
from pathlib import Path
from .audio import merge_wav
from .storage import identifier, now
from .text import align


class WorkerBridge:
    def __init__(self, settings):
        self.settings = settings
        self.process = None
        self.mode = None
        self.lock = threading.RLock()

    def command(self, mode):
        if mode == "qwen":
            packaged = self.settings.root / "components" / "qwen" / "speech-qwen.exe"
            if packaged.exists():
                return [str(packaged)]
            source = Path(__file__).resolve().parents[2]
            python = source / ".venv-qwen" / "Scripts" / "python.exe"
            if not getattr(sys, "frozen", False) and python.exists():
                return [str(python), "-m", "speech_practice.worker"]
            raise ValueError("Install the high-mode runtime component in Settings before using Qwen.")
        if getattr(sys, "frozen", False):
            return [sys.executable, "--worker"]
        return [sys.executable, "-m", "speech_practice.worker"]

    def stop(self):
        with self.lock:
            process = self.process
            self.process = None
            if process and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()

    def invoke(self, payload):
        mode = "qwen" if payload["kind"] in ("qwen", "qwen-small") or payload.get('device') == 'cuda' else "cpu"
        if payload.get('device') == 'cuda':
            component = self.settings.root / 'components/qwen/component.json'
            if component.exists():
                manifest = json.loads(component.read_text('utf8'))
                if 'gpu-asr' not in manifest.get('capabilities', []):
                    raise ValueError('GPU ASR requires the 0.2 GPU runtime component. Your recording is preserved.')
        with self.lock:
            if self.mode != mode or not self.process or self.process.poll() is not None:
                self.stop()
                environment = os.environ.copy()
                environment["PYTHONPATH"] = str(Path(__file__).resolve().parents[1])
                environment["PYTHONUTF8"] = "1"
                environment["OMP_NUM_THREADS"] = "6"
                logs = self.settings.root / "worker.log"
                with logs.open("ab") as log:
                    self.process = subprocess.Popen(self.command(mode), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                        stderr=log, text=True, encoding="utf-8", bufsize=1, env=environment,
                        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
                self.mode = mode
            process = self.process
            process.stdin.write(json.dumps(payload) + "\n")
            process.stdin.flush()
        response = process.stdout.readline()
        if not response:
            raise ValueError("Inference worker stopped. See worker.log; retry the sentence or use lightweight mode.")
        result = json.loads(response)
        if not result["ok"]:
            raise ValueError(result["error"])
        return result["result"]


class Jobs:
    def __init__(self, store, settings, models):
        self.store, self.settings, self.models = store, settings, models
        self.worker = WorkerBridge(settings)
        self.queue = queue.PriorityQueue()
        self.download_queue = queue.PriorityQueue()
        self.counter = 0
        self.lock = threading.RLock()
        self.cancelled = set()
        self.active = None
        self.closed = False
        for job in store.list("job"):
            if job["status"] in ("queued", "running"):
                job.update(status="failed", error="Application closed before completion. Retry.")
                store.put("job", job)
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()
        self.download_thread = threading.Thread(target=self.run, args=(self.download_queue, False), daemon=True)
        self.download_thread.start()

    def submit(self, action, payload, priority=10):
        job = {"id": identifier(), "action": action, "payload": payload, "status": "queued", "stage": "queued",
               "created_at": now(), "completed": 0, "total": len(payload.get("sentences", [])) or 1,
               "result": None, "error": None, "priority": priority}
        self.store.put("job", job)
        self.enqueue(job)
        return job

    def enqueue(self, job):
        with self.lock:
            self.counter += 1
            target = self.download_queue if job["action"] in ("download", "import") else self.queue
            target.put((job["priority"], self.counter, job["id"]))

    def update(self, id, **changes):
        job = self.store.get("job", id)
        job.update(changes)
        return self.store.put("job", job)

    def cancel(self, id):
        with self.lock:
            job = self.store.get("job", id)
            if job["status"] not in ("queued", "running"):
                return job
            self.cancelled.add(id)
            self.update(id, status="cancelled", stage="cancelled")
            if self.active == id:
                self.worker.stop()
            return self.store.get("job", id)

    def run(self, task_queue=None, inference=True):
        task_queue = task_queue or self.queue
        while not self.closed:
            try:
                _, _, id = task_queue.get(timeout=0.2)
            except queue.Empty:
                continue
            with self.lock:
                if id in self.cancelled:
                    continue
                if inference:
                    self.active = id
                job = self.update(id, status="running", stage="working")
            try:
                result, again = self.execute(job)
                with self.lock:
                    if id in self.cancelled:
                        continue
                    if again:
                        job = self.update(id, completed=job["completed"]+1, status="queued", stage="queued")
                        self.enqueue(job)
                    else:
                        self.update(id, status="completed", stage="completed", completed=job["total"], result=result)
            except Exception as error:
                with self.lock:
                    if id not in self.cancelled:
                        self.update(id, status="failed", stage="failed", error=f"{type(error).__name__}: {error}")
            finally:
                if inference:
                    self.active = None

    def execute(self, job):
        p = job["payload"]
        action = job["action"]
        if action == "download":
            def progress(done, total):
                if job["id"] in self.cancelled:
                    raise ValueError("Cancelled")
                self.update(job["id"], stage="downloading", bytes_done=done, bytes_total=total)
            return self.models.download(p["model"], progress), False
        if action == "import":
            return self.models.import_directory(p["model"], p["directory"]), False
        if action == "component":
            from .components import install_qwen
            self.worker.stop()
            return install_qwen(self.settings, p["archive"]), False
        if action == "generate":
            sentence = p["sentences"][job["completed"]]
            options = sentence["options"]
            model = options["provider"]
            if not self.models.ready(model):
                raise ValueError("Model not installed. Download or import it in Settings.")
            signature = json.dumps({"text": sentence["spoken_text"], "options": options,
                                    "revision": self.models.model(model)["revision"]}, sort_keys=True)
            cache = hashlib.sha256(signature.encode()).hexdigest()
            path = self.settings.audio / f"{cache}.wav"
            try:
                asset = self.store.get("asset", cache)
                if not path.exists():
                    raise KeyError(cache)
            except KeyError:
                self.update(job["id"], stage=f"synthesizing_{model}")
                partial = path.with_suffix(".tmp.wav")
                try:
                    # Both Qwen sizes use the same inference protocol. Keep compatibility
                    # with the existing 0.2 GPU component; the directory selects the weights.
                    result = self.worker.invoke({"kind": 'qwen' if model == 'qwen-small' else model, "directory": str(self.models.directory(model)),
                        "output": str(partial), "text": sentence["spoken_text"], "voice": options["voice"], "options": options})
                    if job["id"] in self.cancelled:
                        raise ValueError("Cancelled")
                    partial.replace(path)
                finally:
                    partial.unlink(missing_ok=True)
                asset = self.store.put("asset", {**result, "path": str(path), "id": cache, "kind": "tts", "signature": signature})
            with self.store.lock:
                current = self.store.get("sentence", sentence["id"])
                if current["version"] == sentence["version"]:
                    current["asset_id"] = asset["id"]
                    self.store.put("sentence", current)
            return {"asset_id": asset["id"]}, job["completed"] + 1 < len(p["sentences"])
        if action == "export":
            path = self.settings.audio / f"{identifier()}.wav"
            result = merge_wav(p["paths"], path, p["pause_ms"])
            asset = self.store.put("asset", {**result, "id": identifier(), "kind": "export"})
            return {"asset_id": asset["id"]}, False
        recording = self.store.get("recording", p["recording"])
        if action == "analyze":
            self.update(job["id"], stage="transcribing")
            if p.get('provider') == 'tencent':
                from .cloud import TencentASRProvider
                transcript = TencentASRProvider(self.settings).transcribe(recording['path']).model_dump()
            else:
                model = p.get('model', 'whisper')
                if not self.models.ready(model):
                    raise ValueError('ASR model not installed. Download or import it in Settings.')
                transcript = self.worker.invoke({'kind': 'parakeet' if model == 'parakeet' else 'whisper', 'directory': str(self.models.directory(model)),
                                                 'audio': recording['path'], 'device': p.get('device', 'cpu')})
            from .observations import observations
            # Word times returned by a cloud model can be absent or invalid. Text alignment remains usable.
            safe_words = [{**w, 'start': w['start'] if w.get('start') is not None else None,
                           'end': w['end'] if w.get('end') is not None else None} for w in transcript['words']]
            feedback = {"transcript": transcript, "differences": [] if transcript["uncertain"] else
                        align(recording["spoken_text"], transcript["text"], safe_words), "notice": "Recognition differences are not pronunciation scores.",
                        'observations': observations(transcript, recording['duration']), 'sentence_version': recording['sentence_version'],
                        'spoken_text': recording['spoken_text'], 'created_at': now()}
            for difference in feedback['differences']:
                from .feedback import extent
                timing = difference.get('time')
                if timing and extent(timing.get('start'), timing.get('end'), recording['duration'])[0] is None:
                    difference['time'] = None
            recording["content_feedback"] = feedback
            recording.setdefault('recognition_history', []).append(feedback)
        elif action == "assess":
            from .feedback import normalize_legacy, recording_view
            self.update(job["id"], stage="uploading_for_assessment")
            if p.get('provider') == 'tencent':
                from .cloud import TencentPronunciationProvider
                feedback = TencentPronunciationProvider(self.settings).assess(recording['path'], recording['spoken_text'], p['locale'])
            else:
                from .pronunciation import SpeechaceProvider
                feedback = normalize_legacy(SpeechaceProvider(self.settings).assess(recording['path'], recording['spoken_text'], p['locale']), recording['duration'])
            feedback.update(id=identifier(), created_at=now(), recording_id=recording['id'],
                            sentence_version=recording['sentence_version'], spoken_text=recording['spoken_text'])
            recording['assessment_history'] = recording_view(recording)['assessment_history'] + [feedback]
            recording["pronunciation_feedback"] = feedback
        else:
            raise ValueError("Unknown job action.")
        if job["id"] not in self.cancelled:
            # Deleted recordings must not be resurrected by a completed job.
            self.store.get("recording", recording["id"])
            self.store.put("recording", recording)
        return feedback, False

    def close(self):
        self.closed = True
        for job in self.store.list("job"):
            if job["status"] in ("running", "queued"):
                self.cancel(job["id"])
        self.worker.stop()
