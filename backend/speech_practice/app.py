import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from .audio import decode, write_wav
from .config import Settings
from .jobs import Jobs
from .models import ModelManager
from .storage import Store, identifier, now
from .schemas import (SessionCreate, SentenceEdit, SplitRequest, Progress, GenerateRequest, ExportRequest,
                      PronunciationRequest, SettingsEdit, Credential, ImportModel, Options, AnalyzeRequest, TencentCredential)


def create_app(root=None, token=None):
    settings = Settings(root)
    store = Store(settings.root / "practice.sqlite3")
    models = ModelManager(settings)
    jobs = Jobs(store, settings, models)
    secret = token or os.environ.get("SPEECH_TOKEN")
    if not secret:
        jobs.close()
        raise RuntimeError("SPEECH_TOKEN is required; use backend/server.py or Electron.")

    @asynccontextmanager
    async def lifespan(app):
        yield
        jobs.close()

    app = FastAPI(title="Speech Practice", lifespan=lifespan)
    app.state.store, app.state.jobs, app.state.settings = store, jobs, settings
    app.add_middleware(CORSMiddleware, allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
                       allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"])

    @app.middleware("http")
    async def auth(request: Request, call_next):
        if request.url.path.startswith("/api/") and request.method != "OPTIONS":
            supplied = request.headers.get("authorization", "").removeprefix("Bearer ")
            # Media and EventSource cannot set Authorization; query tokens only on these read-only routes.
            if request.url.path.startswith("/api/assets/") or request.url.path == "/api/events":
                supplied = supplied or request.query_params.get("token", "")
            import hmac
            if not hmac.compare_digest(supplied, secret):
                return JSONResponse({"detail": "Unauthorized"}, status_code=401)
        return await call_next(request)

    @app.exception_handler(KeyError)
    async def missing(request, error):
        return JSONResponse({"detail": "Not found"}, status_code=404)

    @app.exception_handler(ValueError)
    async def invalid(request, error):
        return JSONResponse({"detail": str(error)}, status_code=400)

    @app.exception_handler(RequestValidationError)
    async def validation(request, error):
        # Validation errors normally echo input, including credential fields.
        return JSONResponse({'detail': [{'loc': e['loc'], 'msg': e['msg'], 'type': e['type']} for e in error.errors()]}, status_code=422)

    @app.get("/api/health")
    def health():
        return {"status": "ok", "version": "0.2.1"}

    @app.get("/api/sessions")
    def sessions():
        return store.list("session")

    @app.post("/api/sessions")
    def create(body: SessionCreate):
        session = store.create_session(body.title, body.text)
        return store.detail(session["id"])

    @app.get("/api/sessions/{id}")
    def detail(id: str):
        return store.detail(id)

    @app.patch("/api/sessions/{id}/progress")
    def progress(id: str, body: Progress):
        session = store.get("session", id)
        if body.sentence_id not in session["sentence_ids"]:
            raise ValueError("Sentence does not belong to this session.")
        session["current_sentence_id"] = body.sentence_id
        return store.put("session", session)

    @app.patch("/api/sessions/{id}/options")
    def apply_options(id: str, body: Options):
        if body.provider == "kokoro" and body.voice not in ("af_sarah", "am_michael"):
            raise ValueError("Choose a Kokoro voice.")
        if body.provider in ("qwen", "qwen-small") and (body.voice not in ("Ryan", "Aiden") or body.speed != 1):
            raise ValueError("Choose a Qwen voice; synthesis speed must be 1.")
        with store.lock:
            for sentence in store.detail(id)["sentences"]:
                store.edit_sentence(sentence["id"], sentence["spoken_text"], body.model_dump())
        return store.detail(id)

    @app.patch("/api/sentences/{id}")
    def edit(id: str, body: SentenceEdit):
        if not body.spoken_text.strip():
            raise ValueError("Sentence cannot be blank.")
        if body.options.provider == "kokoro" and body.options.voice not in ("af_sarah", "am_michael"):
            raise ValueError("Choose a Kokoro voice.")
        if body.options.provider in ("qwen", "qwen-small") and (body.options.voice not in ("Ryan", "Aiden") or body.options.speed != 1):
            raise ValueError("Choose a Qwen voice; synthesis speed must be 1.")
        return store.edit_sentence(id, body.spoken_text.strip(), body.options.model_dump())

    @app.post("/api/sentences/{id}/split")
    def split(id: str, body: SplitRequest):
        return store.split(id, body.offset)

    @app.post("/api/sentences/{id}/merge")
    def merge(id: str):
        return store.merge(id)

    @app.post("/api/sessions/{id}/generate")
    def generate(id: str, body: GenerateRequest):
        session = store.detail(id)
        if body.sentence_id and body.sentence_id not in session["sentence_ids"]:
            raise ValueError("Sentence does not belong to this session.")
        sentences = [s for s in session["sentences"] if not body.sentence_id or s["id"] == body.sentence_id]
        return jobs.submit("generate", {"sentences": sentences}, priority=0 if body.sentence_id else 10)

    @app.post("/api/sessions/{id}/export")
    def export(id: str, body: ExportRequest):
        session = store.detail(id)
        if not all(s["asset_id"] for s in session["sentences"]):
            raise ValueError("Generate every sentence before exporting the whole speech.")
        paths = [store.get("asset", s["asset_id"])["path"] for s in session["sentences"]]
        return jobs.submit("export", {"paths": paths, "pause_ms": body.pause_ms}, priority=5)

    @app.get("/api/assets/{id}")
    def asset(id: str, download: bool = False):
        data = store.get("asset", id)
        path = Path(data["path"])
        if not path.is_file():
            raise HTTPException(404, "Audio file is missing.")
        return FileResponse(path, media_type="audio/wav", filename=f"speech-{id[:10]}.wav" if download else None,
                            content_disposition_type="attachment" if download else "inline")

    @app.post("/api/sentences/{id}/recordings")
    async def upload(id: str, file: UploadFile):
        sentence = store.get("sentence", id)  # snapshot before asynchronous upload
        if (file.content_type or "").split(";")[0].strip().lower() not in ("audio/webm", "video/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/mpeg", "application/octet-stream"):
            raise ValueError("Unsupported audio file type.")
        recording_id = identifier()
        temporary = settings.recordings / f"{recording_id}.upload"
        destination = settings.recordings / f"{recording_id}.wav"
        try:
            size = 0
            with temporary.open("wb") as target:
                while chunk := await file.read(1024 * 512):
                    size += len(chunk)
                    if size > 20 * 1024 * 1024:
                        raise ValueError("Recording exceeds 20 MB.")
                    target.write(chunk)
            try:
                samples = await run_in_threadpool(decode, temporary)
            except ValueError:
                raise
            except Exception:
                raise ValueError("Cannot decode this audio recording.") from None
            result = await run_in_threadpool(write_wav, destination, samples, 24000)
            store.put("asset", {**result, "id": recording_id, "kind": "recording"})
            return store.put("recording", {**result, "id": recording_id, "asset_id": recording_id,
                "sentence_id": id, "session_id": sentence["session_id"], "sentence_version": sentence["version"],
                "spoken_text": sentence["spoken_text"], "created_at": now(), "content_feedback": None, "pronunciation_feedback": None})
        finally:
            temporary.unlink(missing_ok=True)
            await file.close()

    @app.get("/api/sessions/{id}/recordings")
    def recordings(id: str):
        store.get("session", id)
        from .feedback import recording_view
        return [recording_view(r) for r in store.list("recording") if r["session_id"] == id]

    @app.delete("/api/recordings/{id}")
    def delete_recording(id: str):
        recording = store.get("recording", id)
        for job in store.list("job"):
            if job["payload"].get("recording") == id:
                jobs.cancel(job["id"])
        Path(recording["path"]).unlink(missing_ok=True)
        store.delete("recording", id)
        store.delete("asset", id)
        return {"deleted": True}

    @app.post("/api/recordings/{id}/analyze")
    def analyze(id: str, body: AnalyzeRequest = AnalyzeRequest()):
        recording = store.get("recording", id)
        if body.provider == 'tencent':
            if not body.consent:
                raise ValueError('Explicit upload consent is required for cloud ASR.')
            if recording['duration'] > 60:
                raise ValueError('Tencent ASR supports at most 60 seconds. Split or rerecord.')
        return jobs.submit("analyze", {"recording": id, **body.model_dump()}, priority=0)

    @app.post("/api/recordings/{id}/assess")
    def assess(id: str, body: PronunciationRequest):
        if not body.consent:
            raise ValueError("Explicit upload consent is required.")
        recording = store.get("recording", id)
        maximum = 60 if body.provider == 'tencent' else 30
        if recording['duration'] > maximum:
            raise ValueError(f'{body.provider} supports at most {maximum} seconds. Split or rerecord.')
        if body.provider == 'tencent' and len(recording['spoken_text'].split()) > 30:
            raise ValueError('Tencent sentence assessment supports at most 30 words. Split the reference and rerecord.')
        return jobs.submit("assess", {"recording": id, "locale": body.locale, 'provider': body.provider}, priority=1)

    @app.get("/api/jobs")
    def list_jobs():
        # Expose the recording association needed by the studio, not the full payload.
        return [{**{k: v for k, v in job.items() if k != "payload"},
                 "recording_id": job.get("payload", {}).get("recording")}
                for job in store.list("job")[:100]]

    @app.get("/api/jobs/{id}")
    def get_job(id: str):
        return store.get("job", id)

    @app.post("/api/jobs/{id}/cancel")
    def cancel(id: str):
        return jobs.cancel(id)

    @app.get("/api/events")
    async def events(request: Request):
        async def stream():
            previous = ""
            while not await request.is_disconnected():
                current = json.dumps(list_jobs())
                if current != previous:
                    yield f"data: {current}\n\n"
                    previous = current
                else:
                    yield ": heartbeat\n\n"
                await asyncio.sleep(1)
        return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})

    @app.get("/api/models")
    def list_models():
        return models.list()

    @app.get('/api/providers')
    def provider_contracts():
        from .contracts import CONTRACTS
        return CONTRACTS

    @app.post("/api/models/{id}/download")
    def download(id: str):
        models.model(id)
        return jobs.submit("download", {"model": id}, priority=20)

    @app.post("/api/models/{id}/import")
    def import_model(id: str, body: ImportModel):
        models.model(id)
        return jobs.submit("import", {"model": id, "directory": body.directory}, priority=20)

    @app.delete("/api/models/{id}")
    def delete_model(id: str):
        if any(j["status"] in ("running", "queued") for j in store.list("job")):
            raise ValueError("Finish or cancel active tasks before removing models.")
        jobs.worker.stop()
        models.delete(id)
        return {"deleted": True}

    @app.get("/api/settings")
    def get_settings():
        from .pronunciation import configured
        from .cloud import credentials
        return {**settings.public(), "speechace_configured": configured(),
                'tencent_configured': bool(credentials()),
                "qwen_runtime": (settings.root / "components/qwen/speech-qwen.exe").exists() or
                    (not getattr(__import__('sys'), 'frozen', False) and Path('.venv-qwen/Scripts/python.exe').exists())}

    @app.post("/api/components/qwen/import")
    def import_component(body: ImportModel):
        return jobs.submit("component", {"archive": body.directory}, priority=20)

    @app.patch("/api/settings")
    def update_settings(body: SettingsEdit):
        if any(j["status"] in ("running", "queued") for j in store.list("job")):
            raise ValueError("Finish or cancel active tasks before changing settings.")
        changes = body.model_dump(exclude_none=True)
        if changes.get('asr_model', settings.values.get('asr_model', 'whisper')) == 'parakeet':
            if changes.get('asr_device') == 'cuda':
                raise ValueError('Parakeet uses CPU int8 in this app. Select CPU.')
            changes['asr_device'] = 'cpu'
        for field in ("model_dir", "recording_dir"):
            if field in changes and (not changes[field] or not Path(changes[field]).is_absolute()):
                raise ValueError("Select an absolute directory path.")
        jobs.worker.stop()
        settings.update(changes)
        return get_settings()

    @app.post("/api/settings/credential")
    def save_credential(body: Credential):
        import keyring
        from .pronunciation import SERVICE, ACCOUNT
        try:
            keyring.set_password(SERVICE, ACCOUNT, body.key)
        except Exception:
            raise ValueError("Windows credential storage unavailable; key was not saved.") from None
        return {"saved": True}

    @app.post('/api/settings/tencent/credential')
    def save_tencent_credential(body: TencentCredential):
        import keyring
        from .cloud import SERVICE, ACCOUNT
        try:
            keyring.set_password(SERVICE, ACCOUNT, json.dumps(body.model_dump()))
        except Exception:
            raise ValueError('Windows credential storage unavailable; credentials were not saved.') from None
        return {'saved': True}

    @app.delete('/api/settings/tencent/credential')
    def delete_tencent_credential():
        import keyring
        from .cloud import SERVICE, ACCOUNT
        try:
            keyring.delete_password(SERVICE, ACCOUNT)
        except keyring.errors.PasswordDeleteError:
            pass
        return {'deleted': True}

    @app.delete("/api/settings/credential")
    def delete_credential():
        import keyring
        from .pronunciation import SERVICE, ACCOUNT
        try:
            keyring.delete_password(SERVICE, ACCOUNT)
        except keyring.errors.PasswordDeleteError:
            pass
        return {"deleted": True}

    ui = os.environ.get("SPEECH_UI_DIR")
    if ui and Path(ui).is_dir():
        app.mount("/", StaticFiles(directory=ui, html=True), name="ui")
    return app
