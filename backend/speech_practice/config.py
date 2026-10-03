import json
import os
from pathlib import Path


class Settings:
    def __init__(self, root: Path | None = None):
        self.root = root or Path(os.environ.get("SPEECH_DATA_DIR", str(Path(os.environ.get("LOCALAPPDATA", Path.home())) / "speech-practice")))
        self.root.mkdir(parents=True, exist_ok=True)
        self.file = self.root / "settings.json"
        self.values = json.loads(self.file.read_text("utf-8")) if self.file.exists() else {}
        self.models = Path(self.values.get("model_dir", self.root / "models"))
        self.recordings = Path(self.values.get("recording_dir", self.root / "recordings"))
        self.audio = self.root / "audio"
        for folder in (self.models, self.recordings, self.audio):
            folder.mkdir(parents=True, exist_ok=True)

    def public(self):
        return {"model_dir": str(self.models), "recording_dir": str(self.recordings), "data_dir": str(self.root),
                "speechace_region": self.values.get("speechace_region", "us"), "speechace_enabled": self.values.get("speechace_enabled", False),
                **{key: self.values.get(key, default) for key, default in {
                    'tencent_asr_enabled': False, 'tencent_pronunciation_enabled': False, 'asr_provider': 'local',
                    'asr_model': 'whisper', 'asr_device': 'cpu', 'pronunciation_provider': 'speechace', 'model_source': 'publisher'}.items()}}

    def update(self, changes):
        self.values.update(changes)
        tmp = self.file.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.values, indent=2), "utf-8")
        tmp.replace(self.file)
        self.__init__(self.root)
