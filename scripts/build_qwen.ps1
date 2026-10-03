$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path .venv-qwen/Scripts/python.exe)) { uv venv --python 3.12 .venv-qwen }
uv pip sync --python .venv-qwen/Scripts/python.exe requirements-qwen.lock --extra-index-url https://download.pytorch.org/whl/cu128
if ($LASTEXITCODE) { throw 'Qwen runtime installation failed' }
& .venv-qwen\Scripts\python.exe scripts/collect_notices.py --qwen
& .venv-qwen\Scripts\python.exe -m PyInstaller --noconfirm --clean --onedir --name speech-qwen --distpath build/components --workpath build/pyinstaller-qwen --specpath build `
  --paths backend --collect-all qwen_tts --collect-all transformers --collect-all librosa --collect-all av `
  --collect-all torch --collect-all torchaudio --collect-all soundfile --collect-all scipy --collect-all faster_whisper --collect-all ctranslate2 `
  backend/worker_entry.py
if ($LASTEXITCODE) { throw 'Qwen component packaging failed' }
Copy-Item -LiteralPath .venv-qwen/Lib/site-packages/inflect -Destination build/components/speech-qwen/_internal -Recurse -Force
& .venv\Scripts\python.exe scripts/archive_component.py
if ($LASTEXITCODE) { throw 'Qwen archive failed' }
