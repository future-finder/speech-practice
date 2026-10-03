# 0.2 recognition and pronunciation settings

Install `release/Speech Practice Setup 0.2.0.exe`. Existing recordings and saved reference revisions remain compatible. Cloud features are disabled by default.

For free practice, download Kokoro and small.en, generate examples, record, listen back, and select **Check transcript**. ASR indicates what was recognized, not pronunciation accuracy. Uncertain recognition suppresses word-difference conclusions and local speaking observations. High-confidence recognition can still be wrong.

In settings, select **Local** recognition, **small.en / CPU** for the default. Distil large-v3.5 CT2 and large-v3-turbo CT2 are optional downloads. CPU large models took ~5–8s for ~6s recordings on the development laptop, compared with ~1.4–2.1s for small.en. Initial loading adds ~3–6s. These are limited measurements on Ultra 9 275HX / 32GB / RTX5060 Laptop 8GB, not guarantees for lower-spec computers. The actual human recordings include reading errors and noise; their intended reference is not ground truth, so accuracy improvements have not been established.

GPU ASR requires the **0.2 GPU component ZIP** imported through the existing runtime import button. The same component supports Qwen high-mode TTS and GPU ASR. GPU tasks run serially; runtime/model switches may reload a model. Old 0.1 components continue to support Qwen but do not provide GPU ASR. Keep recordings after errors and switch to CPU small.en manually. 4GB GPU compatibility remains unverified.

**Tencent English ASR** and **Tencent new SOE sentence assessment** are independent choices. Enable each service separately. In Tencent's console, enable ASR and the **new** SOE service, obtain AppID, SecretId and SecretKey, then enter them only in the app settings. Credentials are saved by the controlled backend in Windows Credential Manager. They are never included in the installer.

ASR uploads only the selected recording: at most 60s, converted to 16kHz mono PCM16 WAV, with base64 payload at most 3MB. Assessment uploads the recording and its reference saved when recorded: at most 30 words and 60s. Speechace v9 Basic remains available with its separate key and 30s limit. Exceeding a limit requires splitting the reference and rerecording; content is not silently truncated. Requests can incur charges and require explicit confirmation. There is no automatic switch to another paid service after failure.

Tencent assessment displays PronAccuracy (0–100), PronFluency (0–1), PronCompletion (0–1), and SuggestedScore separately. Missing values show unavailable, not zero. Prosody, intelligibility, expressiveness and the five-dimension composite remain unavailable without a validated method. Provider scores are not assumed comparable. The original result and source fields are inspectable; all assessment attempts retain their source and reference version in history.

Issues show an application practice priority, not a diagnosis. Click a reliable word/phoneme location to replay with 250ms context on both sides. Invalid/absent times disable replay. General phoneme templates explain a practice action without inferring the cause of a low score. Local recognized WPM and word gaps are observations, not professional scores; leading/trailing silence is included in the WPM denominator.

Model downloads retain pinned revisions, licenses and checksums. A third-party hf-mirror option is provided; the tested requests redirected to Hugging Face, so an overseas-free first download route has not been verified. Manual import of verified files is supported. Once models are prepared, local practice works offline.

No Tencent credentials were available in this iteration. Signing, requests, response parsing, failures and playback were tested offline. **Real online assessment, permission availability, billing and human pronunciation/localization validity remain unverified.** iFlytek is a future candidate, not an implemented provider. See [iteration report](ITERATION_0.2.md) and the official pricing links in the app.

GPU tasks serialize to control memory. Switching models can reload them. The frozen Qwen first call, including loading, took ~69s in this check; warm ASR timing does not imply instant high-mode TTS. Prefer lightweight TTS and small.en for ordinary-computer responsiveness.
