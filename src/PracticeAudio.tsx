import { useEffect, useState, type RefObject } from "react";
import { TransportIcon } from "./TransportIcon";

export function audioTime(value: number, precise = false) {
  const seconds = Number.isFinite(value) ? Math.max(0, value) : 0;
  const whole = `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  return precise ? `${whole}.${Math.floor((seconds % 1) * 10)}` : whole;
}

/** Both tracks use seconds on the same horizontal scale, never word alignment. */
export function PracticeAudio({
  src,
  label,
  audioRef,
  scale,
  rate,
  loop = false,
  disabled,
  onDuration,
  onManual,
  onStart,
  onTime,
  onError,
  lang,
}: {
  src: string;
  label: string;
  audioRef: RefObject<HTMLAudioElement | null>;
  scale: number;
  rate: number;
  loop?: boolean;
  disabled?: boolean;
  onDuration: (duration: number) => void;
  onManual?: () => void;
  onStart?: () => void;
  onTime?: () => void;
  onError: (message: string) => void;
  lang: "zh" | "en";
}) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  useEffect(() => {
    setPeaks([]);
    setDuration(0);
    setPosition(0);
    setPlaying(false);
    setFailed(false);
    const abort = new AbortController();
    let context: AudioContext | undefined;
    void (async () => {
      try {
        const response = await fetch(src, { signal: abort.signal });
        if (!response.ok) throw new Error("Audio unavailable");
        const bytes = await response.arrayBuffer();
        if (abort.signal.aborted) return;
        context = new AudioContext();
        const buffer = await context.decodeAudioData(bytes);
        if (abort.signal.aborted) return;
        // Peak envelope of the decoded samples; no scoring or normalization.
        const bins = 180;
        const values = Array.from({ length: bins }, (_, i) => {
          const start = Math.floor((i * buffer.length) / bins);
          const end = Math.floor(((i + 1) * buffer.length) / bins);
          let peak = 0;
          for (let c = 0; c < buffer.numberOfChannels; c++) {
            const samples = buffer.getChannelData(c);
            for (let n = start; n < end; n++)
              peak = Math.max(peak, Math.abs(samples[n]));
          }
          return peak;
        });
        setPeaks(values);
        setDuration(buffer.duration);
        onDuration(buffer.duration);
      } catch {
        // Playback can still work when waveform decoding is unsupported.
        if (!abort.signal.aborted) setPeaks([]);
      } finally {
        if (context && context.state !== "closed") await context.close();
      }
    })();
    return () => {
      abort.abort();
    };
  }, [src]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, src]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      last = 0;
    const tick = (time: number) => {
      if (time - last >= 32) {
        last = time;
        if (audioRef.current) setPosition(audioRef.current.currentTime);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, audioRef]);
  const total = Math.max(scale, duration, 1);
  const width = (duration / total) * 100;
  return (
    <div className={`pa-audio ${playing ? "is-playing" : ""}`}>
      <audio
        ref={audioRef}
        src={src}
        loop={loop}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const value = e.currentTarget.duration;
          if (Number.isFinite(value)) {
            setDuration(value);
            onDuration(value);
          }
          e.currentTarget.playbackRate = rate;
        }}
        onPlay={() => {
          onStart?.();
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          setPosition(e.currentTarget.currentTime);
          onTime?.();
        }}
        onError={() => {
          setFailed(true);
          setPlaying(false);
        }}
      />
      <button
        className="pa-play"
        disabled={disabled || failed}
        aria-label={`${playing ? t("暂停", "Pause") : t("播放", "Play")} ${label}`}
        onClick={() => {
          onManual?.();
          if (playing) audioRef.current?.pause();
          else
            void audioRef.current
              ?.play()
              .catch((e) => onError(String(e.message || e)));
        }}
      >
        <TransportIcon playing={playing} />
      </button>
      <div className="pa-timeline">
        <div className="pa-wave" style={{ width: `${Math.min(100, width)}%` }}>
          {peaks.length > 0 && (
            <svg
              viewBox="0 0 540 48"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {peaks.map((p, i) => (
                <line
                  key={i}
                  x1={i * 3 + 1}
                  x2={i * 3 + 1}
                  y1={24 - p * 23}
                  y2={24 + p * 23}
                  strokeOpacity={
                    i / peaks.length <= position / Math.max(duration, 1)
                      ? 1
                      : 0.5
                  }
                  style={{
                    stroke:
                      i / peaks.length <= position / Math.max(duration, 1)
                        ? "var(--pa-blue)"
                        : "#c9d1de",
                  }}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          )}
        </div>
        <span
          className="pa-playhead"
          style={{ left: `${(position / total) * 100}%` }}
        />
        <input
          type="range"
          min="0"
          max={duration || 1}
          step="0.01"
          value={Math.min(position, duration || 1)}
          style={{ width: `${Math.min(100, width || 100)}%` }}
          disabled={disabled || !duration || failed}
          aria-label={t(`${label}播放位置`, `${label} playback position`)}
          aria-valuetext={`${audioTime(position)} / ${audioTime(duration)}`}
          onChange={(e) => {
            onManual?.();
            const time = Number(e.target.value);
            if (audioRef.current) audioRef.current.currentTime = time;
            setPosition(time);
          }}
        />
        <div className="pa-ruler" aria-hidden="true">
          <span>{audioTime(position, duration < 10)}</span>
          <span>{audioTime(total / 2, total < 10)}</span>
          <span>{audioTime(total, total < 10)}</span>
        </div>
      </div>
      {failed && (
        <span className="pa-time" role="alert">
          {t("音频加载失败", "Audio unavailable")}
        </span>
      )}
    </div>
  );
}
