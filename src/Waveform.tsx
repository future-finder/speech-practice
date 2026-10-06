import { useEffect, useState } from "react";

export function Waveform({
  src,
  source = "demo",
  position,
  duration,
  disabled,
  label,
  onSeek,
}: {
  src: string;
  source?: "demo" | "own" | "whole";
  position: number;
  duration: number;
  disabled: boolean;
  label: string;
  onSeek: (time: number) => void;
}) {
  const [peaks, setPeaks] = useState<number[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    setPeaks([]);
    if (!src) return;
    void (async () => {
      let context: AudioContext | undefined;
      try {
        const response = await fetch(src, { signal: abort.signal });
        if (!response.ok) return;
        const bytes = await response.arrayBuffer();
        if (abort.signal.aborted) return;
        context = new AudioContext();
        const audio = await context.decodeAudioData(bytes);
        if (abort.signal.aborted) return;
        setPeaks(
          Array.from({ length: 180 }, (_, i) => {
            let peak = 0;
            for (let c = 0; c < audio.numberOfChannels; c++) {
              const samples = audio.getChannelData(c);
              const end = Math.floor(((i + 1) * samples.length) / 180);
              for (let j = Math.floor((i * samples.length) / 180); j < end; j++)
                peak = Math.max(peak, Math.abs(samples[j]));
            }
            return peak;
          }),
        );
      } catch {
        /* The seek control remains usable if waveform decoding fails. */
      } finally {
        if (context && context.state !== "closed") await context.close();
      }
    })();
    return () => abort.abort();
  }, [src]);
  // Fit decoded amplitudes to the transport height; preserve relative peaks.
  const peakScale = Math.max(0.02, ...peaks);
  const progress = duration ? position / duration : 0;
  return (
    <div
      data-source={source}
      className={`transport-waveform ${peaks.length ? "has-wave" : ""}`}
    >
      <svg viewBox="0 0 540 48" preserveAspectRatio="none" aria-hidden="true">
        {peaks.map((peak, i) => (
          <line
            key={i}
            x1={i * 3 + 1}
            x2={i * 3 + 1}
            y1={24 - (peak / peakScale) * 16}
            y2={24 + (peak / peakScale) * 16}
            className={i / peaks.length <= progress ? "played" : ""}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <span
        className="transport-progress-fill"
        style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        aria-hidden="true"
      />
      <span
        className="transport-playhead"
        style={{ left: `${Math.min(100, progress * 100)}%` }}
      />
      <input
        type="range"
        min="0"
        max={duration || 1}
        step="0.01"
        value={Math.min(position, duration || 1)}
        disabled={disabled || !duration}
        aria-label={label}
        aria-valuetext={`${position.toFixed(1)} / ${duration.toFixed(1)} s`}
        onChange={(e) => onSeek(Number(e.target.value))}
      />
    </div>
  );
}
