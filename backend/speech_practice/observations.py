"""Local measurements with explicit provenance, never a speaking score."""
import math
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly


def prepare(audio):
    signal, rate = sf.read(str(audio), dtype='float32', always_2d=True)
    mono = signal.mean(axis=1)
    rms = float(np.sqrt(np.mean(mono ** 2))) if mono.size else 0
    peak = float(np.max(np.abs(mono))) if mono.size else 0
    gcd = math.gcd(rate, 16000)
    samples = resample_poly(mono, 16000 // gcd, rate // gcd).astype(np.float32) if rate != 16000 else mono
    quality = {'source_rate': rate, 'source_channels': signal.shape[1], 'asr_rate': 16000, 'rms': rms, 'peak': peak,
               'near_peak_fraction': float(np.mean(np.abs(mono) >= .979)) if mono.size else 0,
               'duration': len(mono) / rate, 'processing': 'mean channels; polyphase resample; no gain boost or denoise'}
    return np.ascontiguousarray(samples), quality


def observations(transcript, duration):
    quality = transcript.get('audio_quality', {})
    result = [{'kind': 'audio_quality', 'value': quality, 'source': 'local PCM measurement',
               'notice': 'Amplitude alone cannot establish speech clarity, clipping or noise.'}] if quality else []
    if transcript.get('uncertain') or duration <= 0:
        return result
    words = transcript.get('words') or []
    timed = [w for w in words if isinstance(w.get('start'), (int, float)) and isinstance(w.get('end'), (int, float)) and 0 <= w['start'] < w['end'] <= duration]
    if len(timed) != len(words) or not timed or any(a['end'] > b['start'] for a, b in zip(timed, timed[1:])):
        return result
    result.append({'kind': 'recognized_words_per_minute', 'value': round(len(words) * 60 / duration, 1),
                   'source': 'recognized word count / full recording duration', 'notice': 'Includes leading/trailing silence; transcription dependent; not a fluency score.'})
    gaps = [{'start': a['end'], 'end': b['start'], 'seconds': round(b['start'] - a['end'], 3)}
            for a, b in zip(timed, timed[1:]) if b['start'] - a['end'] >= .7]
    result.append({'kind': 'interword_gaps', 'value': gaps, 'source': 'ASR word timestamps; threshold 0.7s / observation-v1',
                   'notice': 'An estimated gap, not automatically an error or an acoustic silence detection.'})
    return result
