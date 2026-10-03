$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
uv sync --frozen
if ($LASTEXITCODE) { throw 'Python dependency installation failed' }
& .venv\Scripts\python.exe scripts/collect_notices.py
$manifestPath = (Resolve-Path backend/speech_practice/model_manifest.json).Path
$windowsManifestPath = (Resolve-Path packaging/windows.manifest).Path
& .venv\Scripts\python.exe -m PyInstaller --noconfirm --clean --onedir --name speech-backend --distpath build/runtime --workpath build/pyinstaller --specpath build `
  --manifest "$windowsManifestPath" `
  --paths backend --add-data "$manifestPath;speech_practice" `
  --collect-all kokoro_onnx --collect-all espeakng_loader --collect-all phonemizer --collect-all faster_whisper `
  --collect-all ctranslate2 --collect-all onnxruntime --collect-all sherpa_onnx --collect-all av --collect-all keyring `
  --hidden-import keyring.backends.Windows --hidden-import uvicorn.logging --hidden-import uvicorn.loops.auto `
  --hidden-import uvicorn.protocols.http.auto --hidden-import uvicorn.protocols.websockets.auto --hidden-import uvicorn.lifespan.on `
  backend/server.py
if ($LASTEXITCODE) { throw 'Backend packaging failed' }
# inflect/typeguard inspect function source at import time; retain that package's Python source.
Copy-Item -LiteralPath .venv/Lib/site-packages/inflect -Destination build/runtime/speech-backend/_internal -Recurse -Force
Copy-Item -LiteralPath .venv/Lib/site-packages/language_tags -Destination build/runtime/speech-backend/_internal -Recurse -Force
