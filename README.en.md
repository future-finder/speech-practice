# Oracy

Oracy is an open-source Windows desktop app for practising spoken English with your own scripts. It is currently a **Public Beta**.

- **Download:** [Windows installer](../../releases/latest)
- **Tested target:** Windows 11 x64
- **Workflow:** paste an English script, generate a reference reading, record, replay, and compare the local transcript with the script
- **Default processing:** scripts, recordings, model files, and history stay local. Optional cloud providers upload audio only after you enable them and confirm the action.

## Features

- Sentence-level English script practice
- Kokoro CPU TTS with Sarah and Michael
- Optional Qwen3-TTS 1.7B/0.6B voices Ryan and Aiden with a compatible NVIDIA GPU runtime
- Recording, playback, sentence export, and whole-script WAV export
- Local faster-whisper ASR, with optional Parakeet and larger ASR models
- Transcript differences and uncertainty indicators
- Optional Tencent ASR / speech assessment and Speechace. These need your own credentials, are disabled by default, and may incur charges. Local transcript differences are not validated pronunciation scores.

## Windows installation

1. Download the latest `Oracy Setup ...exe` from [Releases](../../releases).
2. Run the installer.
3. Open **Models & settings** and download the required models. Model weights are not bundled.
4. Create a script, generate a reference reading, allow microphone access, and record.

The first model download needs internet. The default CPU workflow can run offline after setup. Data is stored under `%LOCALAPPDATA%\\speech-practice` unless you choose another recording directory.

## Hardware and models

CPU mode is intended for ordinary Windows PCs. Larger ASR models need more time and memory. Qwen TTS requires a compatible NVIDIA GPU and driver; the tested expressive setup is an RTX 5060 Laptop 8GB, and smaller GPUs are not promised to work. GPU runtime components and weights are downloaded/imported separately. Model sizes are shown in the app before download and can range from hundreds of MiB to several GiB.

## Privacy and online services

Local TTS, recording, playback, and local ASR need no account. Tencent and Speechace credentials are stored through Windows Credential Manager. When you explicitly confirm an online assessment, the selected recording and its reference text are sent to that provider. Provider terms, limits, pricing, and availability apply; online assessment is not fully validated in this beta.

## Known limitations

Transcript differences may include recognition errors and do not measure English ability or pronunciation quality. Speed depends on the model and hardware. Long scripts or recordings may need splitting. GPU jobs are serialized and model changes may reload the model. Coverage across accents, microphones, and noisy environments has not been established.

## Feedback

- [Bug report](../../issues/new?template=bug_report.yml)
- [Feature request](../../issues/new?template=feature_request.yml)

Do not post API keys, tokens, private recordings, or personal data.

## Development

Requirements: Python 3.12, Node.js 22+, npm, and [uv](https://docs.astral.sh/uv/).

```powershell
uv sync --frozen
npm.cmd ci
npm.cmd run desktop
```

Checks:

```powershell
.venv\Scripts\python.exe -m pytest -q
npm.cmd run build
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/VALIDATION.md](docs/VALIDATION.md).

## License

Application source is MIT. Third-party libraries, native components, model files, and services retain their own terms; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Model weights are not included in Git or Releases.
