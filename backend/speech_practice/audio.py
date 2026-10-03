from fractions import Fraction
from pathlib import Path
import av
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

RATE = 24_000


def decode(path: Path, max_duration=120):
    chunks = []
    count = 0
    with av.open(str(path)) as container:
        if not container.streams.audio:
            raise ValueError("File has no audio stream.")
        resampler = av.AudioResampler(format="fltp", layout="mono", rate=RATE)
        for frame in container.decode(audio=0):
            for converted in resampler.resample(frame):
                data = converted.to_ndarray().flatten()
                count += data.size
                if count > RATE * max_duration:
                    raise ValueError(f"Recording exceeds {max_duration} seconds.")
                chunks.append(data)
        for converted in resampler.resample(None):
            chunks.append(converted.to_ndarray().flatten())
    if not chunks:
        raise ValueError("Recording is empty.")
    audio = np.concatenate(chunks)
    if audio.size < RATE / 10 or audio.size > RATE * max_duration or not np.isfinite(audio).all():
        raise ValueError("Invalid or empty recording.")
    return audio


def write_wav(path, audio, rate):
    audio = np.asarray(audio, dtype=np.float32)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if not audio.size or not np.isfinite(audio).all():
        raise ValueError("Synthesizer returned invalid audio.")
    if rate != RATE:
        factor = Fraction(RATE, int(rate))
        audio = resample_poly(audio, factor.numerator, factor.denominator)
    # Avoid clipping without flattening the model's expressive dynamics.
    peak = np.abs(audio).max()
    if peak > 0.98:
        audio *= 0.98 / peak
    sf.write(str(path), audio, RATE, subtype="PCM_16")
    return {"path": str(path), "sample_rate": RATE, "duration": audio.size / RATE}


def merge_wav(paths, output, pause_ms=300):
    # Streaming output avoids loading an entire long speech into RAM.
    silence = np.zeros(int(RATE * pause_ms / 1000), dtype=np.float32)
    with sf.SoundFile(str(output), "w", samplerate=RATE, channels=1, subtype="PCM_16", format="WAV") as destination:
        for i, path in enumerate(paths):
            audio, rate = sf.read(str(path), dtype="float32")
            if audio.ndim > 1:
                audio = audio.mean(axis=1)
            if rate != RATE:
                factor = Fraction(RATE, rate)
                audio = resample_poly(audio, factor.numerator, factor.denominator)
            if i:
                destination.write(silence)
            destination.write(audio / max(1, float(np.abs(audio).max()) / 0.98))
    return {"path": str(output), "sample_rate": RATE, "duration": sf.info(str(output)).duration}
