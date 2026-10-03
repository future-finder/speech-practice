"""One persistent serial model worker. JSON-lines protocol over private stdio."""
import json
import os
import sys
import traceback
from pathlib import Path


def main():
    # Third-party packages may print diagnostics: keep stdout exclusively for JSON.
    protocol = sys.stdout
    sys.stdout = sys.stderr
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    loaded = None
    loaded_key = None
    for line in sys.stdin:
        try:
            request = json.loads(line)
            kind = request["kind"]
            key = (kind, request["directory"], request.get('device', 'cpu'))
            if key != loaded_key:
                if loaded is not None:
                    del loaded
                    import gc
                    gc.collect()
                    if "torch" in sys.modules:
                        sys.modules["torch"].cuda.empty_cache()
                loaded = None
                loaded_key = None
                from .providers import KokoroProvider, QwenProvider, WhisperProvider, ParakeetProvider
                cls = {"kokoro": KokoroProvider, "qwen": QwenProvider, "qwen-small": QwenProvider,
                       "whisper": WhisperProvider, "parakeet": ParakeetProvider}[kind]
                directory = Path(request["directory"])
                loaded = cls(directory, request.get('device', 'cpu')) if kind in ("whisper", "parakeet") else cls(directory, Path(request["output"]))
                loaded_key = key
            if kind in ("whisper", "parakeet"):
                result = loaded.transcribe(Path(request["audio"]))
            else:
                loaded.output = Path(request["output"])
                result = loaded.synthesize(request["text"], request["voice"], request["options"])
            protocol.write(json.dumps({"ok": True, "result": result.model_dump()}) + "\n")
        except Exception as error:
            traceback.print_exc(file=sys.stderr)
            protocol.write(json.dumps({"ok": False, "error": f"{type(error).__name__}: {error}"}) + "\n")
        protocol.flush()


if __name__ == "__main__":
    main()
