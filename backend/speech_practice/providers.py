from pathlib import Path
from typing import Protocol
import numpy as np
from .audio import write_wav
from .schemas import AudioResult, Transcript


class TTSProvider(Protocol):
    def synthesize(self, text: str, voice: str, options: dict) -> AudioResult: ...


class ASRProvider(Protocol):
    def transcribe(self, audio: Path) -> Transcript: ...


def parakeet_words(text, pieces, timestamps, durations, audio_duration):
    """Map BPE spans to words, retaining only complete, bounded token durations.

    Missing durations are not replaced with the next word's onset or audio end:
    those would turn intervening silence into a claimed word duration.
    """
    import math
    import re
    reconstructed = ''.join(piece.replace('▁', ' ') for piece in pieces)
    matches_text = ' '.join(reconstructed.split()) == ' '.join(text.split())
    if not matches_text:
        return [{'word': word, 'start': None, 'end': None} for word in text.split()]
    spans = []
    offset = 0
    for index, piece in enumerate(pieces):
        piece = piece.replace('▁', ' ')
        start = end = None
        if index < len(timestamps) and index < len(durations):
            onset, duration = float(timestamps[index]), float(durations[index])
            if math.isfinite(onset) and math.isfinite(duration) and 0 <= onset < onset + duration <= audio_duration:
                # ORT float32 token boundaries can differ by <1 microsecond.
                # Normalize numerical precision without filling acoustic gaps.
                start, end = round(onset, 6), round(onset + duration, 6)
                if not 0 <= start < end <= audio_duration:
                    start = end = None
        spans.append((offset, offset + len(piece), start, end))
        offset += len(piece)
    words = []
    for match in re.finditer(r'\S+', reconstructed):
        parts = [span for span in spans if span[0] < match.end() and span[1] > match.start()]
        valid = bool(parts) and all(part[2] is not None for part in parts)
        valid = valid and all(a[2] <= b[2] for a, b in zip(parts, parts[1:]))
        words.append({'word': match.group(), 'start': parts[0][2] if valid else None,
                      'end': max(part[3] for part in parts) if valid else None})
    return words


class ParakeetProvider:
    def __init__(self, directory, device='cpu'):
        if device != 'cpu':
            raise ValueError('Parakeet uses CPU int8 in this app. Select CPU.')
        import os
        if os.name == 'nt':
            # sherpa's wheel links onnxruntime.dll dynamically. Windows may otherwise
            # choose its old System32 copy and abort in native code on API mismatch.
            import ctypes
            import importlib.util
            spec = importlib.util.find_spec('onnxruntime')
            library = Path(spec.origin).parent / 'capi' / 'onnxruntime.dll'
            if not library.is_file():
                raise ValueError('Parakeet requires the bundled ONNX Runtime DLL. Reinstall the application runtime.')
            self._ort = ctypes.WinDLL(str(library))
        import sherpa_onnx
        self.identifier = directory.name
        self.model = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=str(directory / 'encoder.int8.onnx'), decoder=str(directory / 'decoder.int8.onnx'),
            joiner=str(directory / 'joiner.int8.onnx'), tokens=str(directory / 'tokens.txt'),
            num_threads=6, sample_rate=16000, feature_dim=128, decoding_method='greedy_search',
            provider='cpu', model_type='nemo_transducer')

    def transcribe(self, audio):
        from .observations import prepare
        signal, quality = prepare(audio)
        parameters = {'compute_type': 'int8', 'runtime': 'sherpa-onnx', 'cpu_threads': 6,
                      'decoding_method': 'greedy_search', 'reference_prompt': False,
                      'language': 'automatic', 'confidence': 'unavailable',
                      'word_time_source': 'BPE token onsets and durations; absent when incomplete'}
        if quality['rms'] < 0.001:
            return Transcript(text='', words=[], uncertain=True, reason='silence', audio_quality=quality,
                              model=self.identifier, device='cpu', parameters=parameters)
        stream = self.model.create_stream()
        stream.accept_waveform(16000, signal)
        self.model.decode_stream(stream)
        result = stream.result
        text = result.text.strip()
        words = parakeet_words(text, list(result.tokens), list(result.timestamps),
                               list(result.durations), quality['duration'])
        return Transcript(text=text, words=words, uncertain=not bool(text),
                          reason=None if text else 'weak_recognition', model=self.identifier, device='cpu',
                          parameters=parameters, audio_quality=quality)


class KokoroProvider:
    def __init__(self, directory, output):
        from kokoro_onnx import Kokoro
        self.model = Kokoro(str(directory / "kokoro-v1.0.onnx"), str(directory / "voices-v1.0.bin"))
        # kokoro-onnx 0.4.9 sends int32 speed for some float32 exports.
        # Match the ONNX model's declared input type instead of modifying third-party code.
        session = self.model.sess
        class TypedSession:
            def get_inputs(self):
                return session.get_inputs()
            def run(self, outputs, inputs):
                types = {"tensor(float)": np.float32, "tensor(int64)": np.int64, "tensor(int32)": np.int32}
                for spec in session.get_inputs():
                    if spec.name in inputs and spec.type in types:
                        inputs[spec.name] = np.asarray(inputs[spec.name], dtype=types[spec.type])
                return session.run(outputs, inputs)
        self.model.sess = TypedSession()
        self.output = output

    def synthesize(self, text, voice, options):
        if voice not in ("af_sarah", "am_michael"):
            raise ValueError("Unsupported Kokoro voice.")
        audio, rate = self.model.create(text, voice=voice, speed=options.get("speed", 1), lang="en-us")
        return AudioResult(**write_wav(self.output, audio, rate))


class QwenProvider:
    def __init__(self, directory, output):
        import torch
        from qwen_tts import Qwen3TTSModel
        if not torch.cuda.is_available():
            raise ValueError("High mode requires a compatible NVIDIA GPU/driver. Use lightweight mode.")
        torch.set_grad_enabled(False)
        self.model = Qwen3TTSModel.from_pretrained(str(directory), device_map="cuda:0", dtype=torch.bfloat16,
                                                  attn_implementation="sdpa", local_files_only=True)
        self.supports_style = self.model.model.tts_model_size != '0b6'
        self.output = output

    def synthesize(self, text, voice, options):
        import torch
        from .text import split_sentences
        if voice.lower() not in ("ryan", "aiden"):
            raise ValueError("Unsupported Qwen voice.")
        if options.get("speed", 1) != 1:
            raise ValueError("Qwen synthesis speed is fixed. Use playback speed controls.")
        if not self.supports_style and (options.get('style') or '').strip():
            raise ValueError('Qwen3-TTS 0.6B does not support delivery instructions. Select 1.7B for delivery control.')
        torch.manual_seed(42)
        chunks = []
        for part in split_sentences(text):
            words = part.split()
            current = []
            for word in words:
                if current and len(' '.join(current) + word) > 400:
                    chunks.append(' '.join(current))
                    current = []
                current.append(word)
            if current:
                chunks.append(' '.join(current))
        if any(len(c) > 400 for c in chunks):
            raise ValueError("A word exceeds the model's input limit. Edit the spoken text.")
        generated = []
        for chunk in chunks:
            audio, rate = self.model.generate_custom_voice(text=chunk, speaker=voice, language="English",
                                                          instruct=options.get("style") or None, max_new_tokens=2048)
            if generated:
                generated.append(np.zeros(int(rate * .15), dtype=np.float32))
            generated.append(audio[0])
        return AudioResult(**write_wav(self.output, np.concatenate(generated), rate))


class WhisperProvider:
    def __init__(self, directory, device='cpu'):
        self.device = device
        self.identifier = directory.name
        if device == 'cuda':
            import os
            import importlib.util
            spec = importlib.util.find_spec('torch')
            if spec is None:
                raise ValueError('Install the GPU runtime component before using GPU ASR.')
            library = str(Path(spec.origin).parent / 'lib')
            os.environ['PATH'] = library + os.pathsep + os.environ.get('PATH', '')
            self.dll = os.add_dll_directory(library) if os.name == 'nt' else None
        from faster_whisper import WhisperModel
        self.model = WhisperModel(str(directory), device=device, compute_type='int8' if device == 'cpu' else 'float16', cpu_threads=6,
                                  num_workers=1, local_files_only=True)

    def transcribe(self, audio):
        from .observations import prepare
        signal, quality = prepare(audio)
        parameters = {'language': 'en', 'word_timestamps': True, 'vad_filter': True, 'condition_on_previous_text': False,
                      'beam_size': 5, 'temperature': 0, 'reference_prompt': False, 'compute_type': 'int8' if self.device == 'cpu' else 'float16'}
        if quality['rms'] < 0.001:
            return Transcript(text="", words=[], uncertain=True, reason="silence", audio_quality=quality,
                              model=self.identifier, device=self.device, parameters=parameters)
        segments, _ = self.model.transcribe(signal, language="en", word_timestamps=True,
                                            vad_filter=True, condition_on_previous_text=False, beam_size=5, temperature=0)
        segments = list(segments)
        words = [{"word": w.word.strip(), "start": w.start, "end": w.end, "probability": w.probability}
                 for s in segments for w in (s.words or [])]
        text = " ".join(s.text.strip() for s in segments)
        # These are conservative heuristics, not calibrated probabilities of correctness.
        weak = not words or any(s.avg_logprob < -1 or s.no_speech_prob > 0.6 for s in segments)
        weak = weak or (bool(words) and np.mean([w["probability"] for w in words]) < 0.55)
        return Transcript(text=text, words=words, uncertain=bool(weak), reason="weak_recognition" if weak else None,
                          audio_quality=quality, model=self.identifier, device=self.device, parameters=parameters)
