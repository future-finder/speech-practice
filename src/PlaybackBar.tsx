import { useEffect, useState, type RefObject } from "react";
import { RotateCcw, Mic, Square, Ellipsis, PanelRight } from "lucide-react";
import { Waveform } from "./Waveform";
import { RecordingWaveform } from "./RecordingWaveform";
import { TransportIcon } from "./TransportIcon";
import { audioTime } from "./PracticeAudio";
import type { WorkspaceProps } from "./Workspace";
export function AudioTransport({
  p,
  whole,
  own,
  ownSrc,
  locked,
  pauseAudio,
  openPractice,
}: {
  p: WorkspaceProps;
  whole: RefObject<HTMLAudioElement | null>;
  own: RefObject<HTMLAudioElement | null>;
  ownSrc: string;
  locked: boolean;
  pauseAudio: () => void;
  openPractice: () => void;
}) {
  const t = (zh: string, en: string) => (p.lang === "zh" ? zh : en);
  const [target, setTarget] = useState("demo"),
    [position, setPosition] = useState(0),
    [duration, setDuration] = useState(0),
    [playing, setPlaying] = useState(false);
  const sentence = p.session?.sentences?.find((s) => s.id === p.current);
  const refs = { demo: p.demo, own, whole };
  useEffect(() => {
    if (whole.current) whole.current.playbackRate = p.rate;
  }, [p.rate, p.wholeAsset, whole]);
  useEffect(() => {
    setTarget(ownSrc ? "own" : "demo");
    setPosition(0);
    setDuration(0);
    setPlaying(false);
  }, [p.current, p.session?.id, p.view, p.take?.id, p.preview]);
  useEffect(() => {
    const listeners: (() => void)[] = [];
    Object.entries(refs).forEach(([name, ref]) => {
      const el = ref.current;
      if (!el) return;
      const onPlay = () => setTarget(name);
      const update = () => {
        if (name === target) {
          setPosition(el.currentTime);
          setDuration(Number.isFinite(el.duration) ? el.duration : 0);
          setPlaying(!el.paused);
        }
      };
      el.addEventListener("play", onPlay);
      [
        "loadedmetadata",
        "timeupdate",
        "play",
        "pause",
        "ended",
        "durationchange",
      ].forEach((event) => el.addEventListener(event, update));
      update();
      listeners.push(() => {
        el.removeEventListener("play", onPlay);
        [
          "loadedmetadata",
          "timeupdate",
          "play",
          "pause",
          "ended",
          "durationchange",
        ].forEach((event) => el.removeEventListener(event, update));
      });
    });
    return () => listeners.forEach((fn) => fn());
  }, [
    target,
    p.current,
    sentence?.asset_id,
    p.take?.id,
    p.preview,
    ownSrc,
    p.wholeAsset,
    p.view,
  ]);
  const active = refs[target as keyof typeof refs].current;
  useEffect(() => {
    if (!playing || !active) return;
    let frame: number;
    const update = () => {
      setPosition(active.currentTime);
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [active, playing]);
  const src =
    target === "demo"
      ? sentence?.asset_id
        ? p.audioUrl(sentence.asset_id)
        : ""
      : target === "own"
        ? ownSrc
        : p.wholeAsset
          ? p.audioUrl(p.wholeAsset)
          : "";
  const available =
    target === "demo"
      ? !!sentence?.asset_id
      : target === "own"
        ? !!(p.take || p.preview)
        : !!p.wholeAsset;
  const seek = (value: number) => {
    p.manualPlayback();
    if (active) {
      active.currentTime = Math.max(0, Math.min(duration, value));
      setPosition(active.currentTime);
    }
  };
  return (
    <footer
      className={`playback-bar ${playing ? "is-playing" : ""} ${p.recording ? "is-recording" : ""} ${p.processing ? "is-analyzing" : ""}`}
    >
      <audio
        ref={whole}
        src={p.wholeAsset ? p.audioUrl(p.wholeAsset) : undefined}
        preload="metadata"
        onPlay={() => {
          p.demo.current?.pause();
          own.current?.pause();
        }}
      />
      <div className="playback-progress">
        <span>
          {audioTime(p.recording ? p.seconds : position)}{" "}
          <em>
            /{" "}
            {p.recording
              ? "2:00"
              : available && duration
                ? audioTime(duration)
                : "—"}
          </em>
        </span>
        <Waveform
          src={src}
          source={target as "demo" | "own" | "whole"}
          position={position}
          duration={duration}
          disabled={locked}
          label={t("当前音频播放位置", "Current audio playback position")}
          onSeek={seek}
        />
      </div>
      <div className="playback-controls">
        <div className="playback-options">
          <select
            aria-label={t("播放速度", "Playback speed")}
            disabled={locked}
            value={p.rate}
            onChange={(e) => p.setRate(Number(e.target.value))}
          >
            {[0.5, 0.75, 1, 1.25, 1.5].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
          {!sentence?.asset_id &&
            p.view === "practice" &&
            target === "demo" && (
              <div className="transport-empty">
                <span>{t("尚未生成示范音频", "No example audio yet")}</span>
                <button
                  className="plain"
                  disabled={locked}
                  onClick={p.generate}
                >
                  {t("生成本句", "Generate example")}
                </button>
              </div>
            )}
        </div>
        <div className="transport">
          <button
            disabled={locked || !duration}
            aria-label={t("后退5秒", "Back 5 seconds")}
            onClick={() => seek(position - 5)}
          >
            <RotateCcw size={25} strokeWidth={1.65} />
            <span>{t("后退 5 秒", "Rewind 5s")}</span>
          </button>
          <button
            className="main-play"
            disabled={locked || !available}
            aria-label={t(
              playing ? "暂停当前音频" : "播放当前音频",
              playing ? "Pause current audio" : "Play current audio",
            )}
            onClick={() => {
              if (!active) return;
              if (!active.paused) active.pause();
              else {
                pauseAudio();
                p.manualPlayback();
                active.play().catch((e) => p.setError(String(e)));
              }
            }}
          >
            <TransportIcon playing={playing} size={31} />
          </button>
          <button
            disabled={locked || !duration}
            aria-label={t("前进5秒", "Forward 5 seconds")}
            onClick={() => seek(position + 5)}
          >
            <RotateCcw className="flip" size={25} strokeWidth={1.65} />
            <span>{t("前进 5 秒", "Forward 5s")}</span>
          </button>
        </div>
        <div className="playback-end">
          {p.view === "practice" && (
            <section
              className={`pa-capture ${p.recording ? "is-recording" : ""}`}
              aria-label={t("录音", "Record")}
            >
              <button
                className="record-button"
                disabled={p.uploading || p.preparing}
                aria-label={
                  p.recording
                    ? t("停止录音", "Stop recording")
                    : p.history.length
                      ? t("重新录音", "Record again")
                      : t("开始录音", "Start recording")
                }
                onClick={() => {
                  pauseAudio();
                  p.record();
                }}
              >
                {p.recording ? (
                  <Square fill="currentColor" size={18} />
                ) : (
                  <Mic size={21} />
                )}
              </button>
              <div>
                <h3>
                  {p.recording
                    ? t("停止录音", "Stop recording")
                    : p.uploading
                      ? t("正在保存录音", "Saving recording")
                      : p.preparing
                        ? t("正在准备录音", "Preparing recording")
                        : p.history.length
                          ? t("重新录音", "Record again")
                          : t("开始录音", "Start recording")}
                </h3>
                <p>
                  {p.recording
                    ? `${audioTime(p.seconds)} / 2:00`
                    : t("Space · 最长 120 秒", "Space · up to 120 seconds")}
                </p>
              </div>
            </section>
          )}
          <button
            className="mobile-practice-open"
            aria-label={t("练习当前句", "Practice sentence")}
            aria-controls="sentence-practice-panel"
            onClick={openPractice}
          >
            <span>{t("练习当前句", "Practice sentence")}</span>
            <PanelRight size={16} />
          </button>
          <details className="transport-menu">
            <summary aria-label={t("播放选项", "Playback options")}>
              <Ellipsis size={20} strokeWidth={1.7} />
            </summary>
            <div className="transport-menu-content">
              <select
                aria-label={t("播放对象", "Playback source")}
                value={target}
                disabled={locked}
                onChange={(e) => {
                  pauseAudio();
                  setTarget(e.target.value);
                  setDuration(0);
                  setPosition(0);
                }}
              >
                <option value="demo">
                  {t("本句示范", "Sentence example")}
                </option>
                <option value="own" disabled={!p.take && !p.preview}>
                  {t("我的录音", "My recording")}
                </option>
                <option value="whole" disabled={!p.wholeAsset}>
                  {t("整篇示范", "Full speech")}
                </option>
              </select>
              <label className="checkbox">
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={p.loop}
                  onChange={(e) => p.setLoop(e.target.checked)}
                />
                {t("循环本句", "Loop sentence")}
              </label>
              <button
                disabled={
                  locked || !p.session?.sentences?.every((s) => s.asset_id)
                }
                onClick={() => {
                  pauseAudio();
                  p.exportSpeech(true);
                }}
              >
                {t("整篇播放", "Full speech")}
              </button>
            </div>
          </details>
        </div>
      </div>
      {p.view === "practice" && (
        <div className="capture-wave">
          <RecordingWaveform
            key={p.current}
            stream={p.recordingStream}
            recording={p.recording}
            lang={p.lang}
          />
        </div>
      )}
    </footer>
  );
}
