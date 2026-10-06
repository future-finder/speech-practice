import type { Pronunciation } from "./types";

export function WordScoreStrip({
  words,
  lang,
}: {
  words: Pronunciation["words"];
  lang: "zh" | "en";
}) {
  if (!words.length) return null;
  return (
    <span className="coach-word-scores">
      {words.slice(0, 4).map((word, i) => {
        const score =
          typeof word.score === "number" && Number.isFinite(word.score)
            ? word.score
            : null;
        return (
          <span className="coach-word-score" key={i}>
            <span>{word.word}</span>
            <span className="word-score-track" aria-hidden="true">
              <span
                style={{
                  width: `${score === null ? 0 : Math.max(0, Math.min(100, score))}%`,
                }}
              />
            </span>
            <small>
              {score === null
                ? lang === "zh"
                  ? "未评分"
                  : "Unscored"
                : `${Math.round(score)} / 100`}
            </small>
          </span>
        );
      })}
    </span>
  );
}

export function PaceFeedback({
  value,
  disabled,
  open,
  lang,
}: {
  value: number | null;
  disabled: boolean;
  open: () => void;
  lang: "zh" | "en";
}) {
  const available = value !== null && value >= 0;
  return (
    <button
      className={`coach-pace ${available ? "has-data" : "is-unavailable"}`}
      disabled={disabled}
      onClick={open}
    >
      <span className="evidence-heading">
        <span>{lang === "zh" ? "语速" : "Pace"}</span>
        {!available && (
          <small>{lang === "zh" ? "无数据" : "Unavailable"}</small>
        )}
      </span>
      {available && (
        <>
          <span className="pace-reading">
            {Math.round(value)}
            <small>WPM</small>
          </span>
          <span
            className="pace-scale"
            role="img"
            aria-label={`${Math.round(value)} ${lang === "zh" ? "词/分钟" : "words per minute"}`}
          >
            <span
              className="pace-needle"
              style={{ left: `${Math.min(100, value / 3)}%` }}
            />
            <span className="pace-scale-labels" aria-hidden="true">
              <span>0</span>
              <span>100</span>
              <span>200</span>
              <span>300+</span>
            </span>
          </span>
        </>
      )}
      <span className="evidence-caption">
        {lang === "zh"
          ? "识别词数 / 录音分钟数，包含首尾停顿。"
          : "Recognized words per recording minute, including leading and trailing silence."}
      </span>
    </button>
  );
}

type Gap = { start: number; end: number; seconds: number };
export function recordingGaps(value: unknown, duration: number): Gap[] | null {
  if (!Array.isArray(value) || !Number.isFinite(duration) || duration <= 0)
    return null;
  return value.filter(
    (gap): gap is Gap =>
      gap &&
      typeof gap === "object" &&
      Number.isFinite(gap.start) &&
      Number.isFinite(gap.end) &&
      Number.isFinite(gap.seconds) &&
      gap.start >= 0 &&
      gap.end > gap.start &&
      gap.end <= duration &&
      gap.seconds >= 0.7 &&
      gap.end - gap.start >= 0.7,
  );
}

export function PauseFeedback({
  gaps,
  duration,
  disabled,
  open,
  lang,
}: {
  gaps: Gap[] | null;
  duration: number;
  disabled: boolean;
  open: () => void;
  lang: "zh" | "en";
}) {
  return (
    <button
      className={`coach-pauses ${gaps !== null ? "has-data" : "is-unavailable"}`}
      disabled={disabled}
      onClick={open}
    >
      <span className="evidence-heading">
        <span>{lang === "zh" ? "停顿" : "Pauses"}</span>
        <small>
          {gaps === null
            ? lang === "zh"
              ? "无数据"
              : "Unavailable"
            : `${gaps.length} ${lang === "zh" ? "处间隔" : "gaps"}`}
        </small>
      </span>
      {gaps !== null && (
        <>
          <span
            className="pause-timeline"
            role="img"
            aria-label={
              lang === "zh"
                ? `录音中的 ${gaps.length} 处估计词间隔`
                : `${gaps.length} estimated gaps in the recording`
            }
          >
            {gaps.map((gap, i) => (
              <span
                key={i}
                style={{
                  left: `${(gap.start / duration) * 100}%`,
                  width: `${((gap.end - gap.start) / duration) * 100}%`,
                }}
              />
            ))}
          </span>
          <span className="pause-axis">
            <span>0 s</span>
            <span>{duration.toFixed(1)} s</span>
          </span>
        </>
      )}
      <span className="evidence-caption">
        {gaps === null
          ? lang === "zh"
            ? "需识别时间戳才能估计词间隔。"
            : "Transcript timestamps are needed to estimate gaps."
          : lang === "zh"
            ? "橙色标出 ≥0.7 秒的估计词间隔，需回听复核。"
            : "Orange marks estimated gaps ≥0.7 seconds; listen to review."}
      </span>
    </button>
  );
}
