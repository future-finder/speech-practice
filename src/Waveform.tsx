import { useEffect, useState, useId } from "react";

const emptyPeaks = Array.from({ length: 180 }, () => 0);

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
  const gradient = useId();
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
  const displayPeaks = peaks.length ? peaks : emptyPeaks;
  const peakScale = Math.max(0.02, ...displayPeaks);
  const progress = duration ? position / duration : 0;
  const visualProgress = progress;
  return (
    <div
      data-source={source}
      className={`transport-waveform ${peaks.length ? "has-wave" : "empty-wave"}`}
      data-waveform={peaks.length ? "decoded" : "empty"}
    >
      <svg viewBox="0 0 540 48" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient
            id={gradient}
            gradientUnits="userSpaceOnUse"
            x1="0"
            x2="540"
            y1="0"
            y2="0"
          >
            <stop offset="0" stopColor="#087cff" />
            <stop offset="1" stopColor="#9a66ff" />
          </linearGradient>
        </defs>
        {displayPeaks.map((peak, i) => (
          <line
            key={i}
            x1={i * 3 + 1}
            x2={i * 3 + 1}
            y1={24 - Math.max(1, (peak / peakScale) * 16)}
            y2={24 + Math.max(1, (peak / peakScale) * 16)}
            stroke={
              peaks.length && i / displayPeaks.length <= visualProgress
                ? `url(#${gradient})`
                : "#cdd3e3"
            }
            className={
              i / displayPeaks.length <= visualProgress ? "played" : ""
            }
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
        style={{ left: `${Math.min(100, visualProgress * 100)}%` }}
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
