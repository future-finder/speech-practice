# Third-party components

Original application code in this repository is MIT licensed. Third-party
components retain their own licenses; the MIT license does not override them.

| Component | Upstream / source | License |
|---|---|---|
| Electron | https://github.com/electron/electron | MIT, Chromium/Node notices |
| React | https://github.com/facebook/react | MIT |
| Kokoro ONNX wrapper | https://github.com/thewh1teagle/kokoro-onnx | MIT |
| Kokoro model and voice pack | https://huggingface.co/hexgrad/Kokoro-82M | Apache-2.0; check the pinned pack notices |
| Qwen3-TTS code/model | https://github.com/QwenLM/Qwen3-TTS | Apache-2.0 |
| faster-whisper | https://github.com/SYSTRAN/faster-whisper | MIT |
| Whisper model | https://github.com/openai/whisper | MIT |
| sherpa-onnx runtime | https://github.com/k2-fsa/sherpa-onnx | Apache-2.0 |
| Parakeet TDT 0.6B v3 weights (INT8 conversion by sherpa-onnx maintainer) | https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3; https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8 | CC-BY-4.0 |
| ONNX Runtime | https://github.com/microsoft/onnxruntime | MIT |
| CTranslate2 | https://github.com/OpenNMT/CTranslate2 | MIT |
| phonemizer-fork | https://github.com/thewh1teagle/phonemizer | GPL-3.0 |
| eSpeak NG library/data in espeakng-loader | https://github.com/espeak-ng/espeak-ng; https://github.com/thewh1teagle/espeakng-loader | GPL-3.0 library/data; see loader notices |
| PyAV / bundled FFmpeg | https://github.com/PyAV-Org/PyAV; https://ffmpeg.org | BSD-3-Clause / LGPL and codec-specific notices |
| PyTorch / CUDA runtime | https://github.com/pytorch/pytorch; https://developer.nvidia.com | BSD-style / NVIDIA redistribution terms |
| Speechace | https://www.speechace.com/api-terms-of-service/ | Optional proprietary remote service; no server code distributed |

`third-party/base/inventory.json` and `third-party/qwen/inventory.json` list
the exact installed distributions, upstream locations and copied notices.
Generate them with `scripts/collect_notices.py` in each respective environment.
Electron's own `LICENSE` and `LICENSES.chromium.html` remain in its distribution.

The local installers are preview build artifacts, not an audited public release.
Before publicly redistributing binaries, finish the corresponding-source and
build-recipe bundle for copyleft native dependencies (eSpeak NG, phonemizer and
the exact FFmpeg/PyAV wheel build) and verify NVIDIA redistribution notices.
MIT application source alone is not a substitute for those obligations. Publish
the matching original source and lock files alongside every binary release.
No claim of a completed binary redistribution audit is made here.

## 0.2 additions

Parakeet TDT 0.6B v3 INT8 and Qwen3-TTS 0.6B CustomVoice are additional optional,
on-demand weights. Their upstream attribution, fixed revision, license and file
hashes are recorded in `backend/speech_practice/model_manifest.json`. NVIDIA's
Parakeet model is licensed CC-BY-4.0; preserve attribution when redistributing
the original or converted weights. Qwen3-TTS 0.6B is Apache-2.0. The base runtime
includes sherpa-onnx 1.13.8 and its bundled notices; the GPU component reuses the
existing qwen-tts runtime for both Qwen model sizes.

The optional ASR models use pinned CTranslate2 files from distil-whisper/distil-large-v3.5-ct2 (MIT) and the community large-v3-turbo conversion now published by dropbox-dash (MIT). Weights remain on-demand downloads and are not included in the base installer/source ZIP. The GPU component additionally bundles faster-whisper and CTranslate2; their individual notices are retained in third-party/qwen. The base adds websockets 15.0.1 (BSD-3-Clause, notice retained in third-party/base). Tencent adapters implement the official HTTP/WebSocket contracts; Tencent SDK source inspected for signing is not bundled. hf-mirror is a third-party transport option with the same pinned integrity checks, not an assertion of publisher provenance or domestic-only routing.
