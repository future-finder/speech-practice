# Speech Practice

Speech Practice is an open-source Windows desktop app for practising spoken English with your own scripts. It is currently a **Public Beta**.

- **Download:** [Windows installer](../../releases/latest)
- **Current platform:** Windows 11 x64 is the tested target
- **Core workflow:** paste an English script, generate a reference reading, record yourself, play it back, and compare the local transcript with the script
- **Data handling:** scripts, recordings, model files, and history are stored locally by default. Optional cloud providers upload audio only after you enable them and confirm the action.

## What it supports

- English scripts with sentence-level practice
- Local example reading with Kokoro on CPU (Sarah and Michael)
- Optional Qwen3-TTS voices (Ryan and Aiden) with a compatible NVIDIA GPU runtime
- Microphone recording, playback, sentence export, and whole-script WAV export
- Local speech recognition with faster-whisper; optional Parakeet and larger ASR models can be downloaded in Settings
- Transcript differences and uncertainty indicators for practice feedback
- Optional Tencent ASR / speech assessment and Speechace integration. These require your own credentials, are disabled by default, and may incur provider charges. The app does not present local transcript differences as validated pronunciation scores.

## Install on Windows

1. Download the latest `Speech Practice Setup ...exe` from [Releases](https://github.com/future-finder/speech-practice/releases).
2. Run the installer and choose an installation directory.
3. Open **Models & settings** and download the models you want. The installer does not include model weights.
4. Create a practice script, generate a reference reading, allow microphone access, and record.

The first model download needs an internet connection. After the selected models are ready, the default CPU workflow can run offline. The app stores data under `%LOCALAPPDATA%\speech-practice` unless you choose another recording location.

## Hardware and model requirements

- **CPU mode:** Kokoro TTS and `small.en` ASR are intended for ordinary Windows PCs. Larger ASR models use more time and memory.
- **GPU mode:** Qwen3-TTS 1.7B and 0.6B need a compatible NVIDIA GPU and driver. The tested expressive configuration is an RTX 5060 Laptop 8GB; smaller GPUs are not promised to work. The GPU runtime component and model weights are downloaded/imported separately and are not stored in this repository or release.
- **Storage:** model downloads range from hundreds of MiB to several GiB. Check the size shown in the app before downloading.

## Optional online services and privacy

Local practice, TTS, recording, playback, and local ASR do not require an account. If you enable Tencent or Speechace, credentials are stored through Windows Credential Manager and the selected audio/reference text are sent to that provider only after confirmation. Provider limits, pricing, availability, and privacy terms apply; online assessment has not been fully validated in this beta.

## Known limitations

- Transcript differences can contain omissions, substitutions, or additions. They are practice feedback, not a validated measure of English ability or pronunciation quality.
- Recognition and synthesis speed depends on model, hardware, and whether a model is already loaded.
- Long scripts and long recordings may need to be split; the current limits are shown in the app and documented in the Chinese guide.
- GPU tasks run serially to control memory use. Some model switches require reloading.
- The public beta has not established performance across accents, microphones, or noisy environments. Cloud providers have not been fully tested without user credentials.

## Feedback

- [Report a bug](../../issues/new?template=bug_report.yml)
- [Request a feature](../../issues/new?template=feature_request.yml)

Please remove API keys, tokens, private recordings, and personal data before posting logs or screenshots.

## Development

Requirements: Python 3.12, Node.js 22+, npm, and [uv](https://docs.astral.sh/uv/).

```powershell
uv sync --frozen
npm.cmd ci
npm.cmd run desktop
```

Useful checks:

```powershell
.venv\Scripts\python.exe -m pytest -q
npm.cmd run build
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/VALIDATION.md](docs/VALIDATION.md), and [README.en.md](README.en.md) for implementation and validation details.

## License

Application source is MIT licensed. Third-party libraries, native components, model files, and online services retain their own licenses and terms. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Model weights are downloaded on demand and are not included in Git or Releases.
