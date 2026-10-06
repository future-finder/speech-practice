import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DecorSlot } from "./Appearance";
import type { WorkspaceProps } from "./Workspace";

export function SentenceNavigation({ p }: { p: WorkspaceProps }) {
  const sentences = p.session?.sentences || [],
    index = sentences.findIndex((s) => s.id === p.current);
  const locked = p.recording || p.uploading || p.preparing;
  return (
    <div className="sentence-navigation">
      <button
        aria-label={p.lang === "zh" ? "上一句" : "Previous sentence"}
        disabled={locked || index <= 0}
        onClick={() => p.selectSentence(sentences[index - 1].id)}
      >
        <ChevronLeft size={19} />
      </button>
      <span>
        {index + 1} / {sentences.length}
      </span>
      <button
        aria-label={p.lang === "zh" ? "下一句" : "Next sentence"}
        disabled={locked || index >= sentences.length - 1}
        onClick={() => p.selectSentence(sentences[index + 1].id)}
      >
        <ChevronRight size={19} />
      </button>
    </div>
  );
}
export function SpeechReader({
  p,
  mode,
}: {
  p: WorkspaceProps;
  mode: "script" | "focus";
}) {
  const reader = useRef<HTMLDivElement>(null);
  const [playback, setPlayback] = useState<number | null>(null);
  useEffect(() => {
    const audio = p.own.current;
    const update = () =>
      setPlayback(audio && !audio.paused ? audio.currentTime : null);
    const events = ["timeupdate", "play", "pause", "ended"];
    events.forEach((event) => audio?.addEventListener(event, update));
    update();
    return () =>
      events.forEach((event) => audio?.removeEventListener(event, update));
  }, [p.current, p.take?.id, p.own, p.preview]);
  useEffect(() => {
    if (mode === "script")
      reader.current
        ?.querySelector("[aria-current=true]")
        ?.scrollIntoView({ block: "nearest", behavior: "instant" });
    else {
      const scroll = reader.current?.closest(".reading-scroll");
      if (scroll) scroll.scrollTop = 0;
    }
  }, [p.current, mode]);
  const sentences = p.session?.sentences || [],
    index = sentences.findIndex((s) => s.id === p.current);
  const locked = p.recording || p.uploading || p.preparing;
  const t = (zh: string, en: string) => (p.lang === "zh" ? zh : en);
  const current = sentences[index];
  // Only mark an actual timestamped word from a recording of this script version.
  const words =
    p.take?.sentence_version === current?.version &&
    p.take?.pronunciation_feedback?.status === "success"
      ? p.take.pronunciation_feedback.words
      : [];
  const text = current?.spoken_text || "";
  let cursor = 0;
  const highlighted: React.ReactNode[] = [];
  for (const [i, word] of words.entries()) {
    const offset = text.toLowerCase().indexOf(word.word.toLowerCase(), cursor);
    if (!word.word || offset < 0) continue;
    const end = offset + word.word.length;
    // Partial string matches (e.g. 'act' in 'actions') are not word alignment.
    if (
      /[\p{L}\p{N}]/u.test(text[offset - 1] || "") ||
      /[\p{L}\p{N}]/u.test(text[end] || "")
    )
      continue;
    highlighted.push(text.slice(cursor, offset));
    const active =
      playback !== null &&
      word.start !== null &&
      word.end !== null &&
      Number.isFinite(word.start) &&
      Number.isFinite(word.end) &&
      word.start >= 0 &&
      word.end > word.start &&
      word.end <= (p.take?.duration || 0) &&
      playback >= word.start &&
      playback < word.end;
    highlighted.push(
      <span key={i} className={active ? "playing-word" : undefined}>
        {text.slice(offset, end)}
      </span>,
    );
    cursor = end;
  }
  highlighted.push(text.slice(cursor));
  // Preserve paragraph gaps from the original script without rewriting sentence text.
  let originalCursor = 0;
  const paragraphStarts = sentences.map((s) => {
    const offset = p.session!.original_text.indexOf(
      s.original_text,
      originalCursor,
    );
    if (offset < 0) return false;
    const starts = /\n\s*\n/.test(
      p.session!.original_text.slice(originalCursor, offset),
    );
    originalCursor = offset + s.original_text.length;
    return starts;
  });
  return (
    <div
      ref={reader}
      className={`speech-reader ${mode === "focus" ? "focus-reader" : "manuscript"}`}
      aria-label={t("朗读稿", "Spoken script")}
    >
      {mode === "focus" ? (
        <>
          <div className="focus-progress">
            <span>{t("逐句练习", "Sentence Practice")}</span>
            <progress
              aria-label={t("当前句进度", "Current sentence progress")}
              value={index + 1}
              max={sentences.length}
            />
            <div className="sentence-progress-dots" aria-hidden="true">
              {Array.from(
                { length: Math.min(sentences.length, 24) },
                (_, i) => {
                  const point = Math.round(
                    (i * (sentences.length - 1)) /
                      Math.max(1, Math.min(sentences.length, 24) - 1),
                  );
                  return (
                    <span key={i} className={point <= index ? "reached" : ""} />
                  );
                },
              )}
            </div>
            <span>
              {index + 1} / {sentences.length}
            </span>
          </div>
          <div className="focus-copy" key={p.current}>
            <p className="focus-context focus-previous">
              {sentences[index - 1]?.spoken_text || "\u00a0"}
            </p>
            <div
              className={`current-sentence ${text.length > 180 ? "is-long" : ""}`}
            >
              <DecorSlot slot="sentence" />
              <p className="sentence-content">
                <span className="focus-highlight">{highlighted}</span>
              </p>
            </div>
            <p className="focus-context focus-next">
              {sentences[index + 1]?.spoken_text || "\u00a0"}
            </p>
          </div>
          <div className="focus-navigation">
            <SentenceNavigation p={p} />
          </div>
        </>
      ) : (
        sentences.map((s, i) => (
          <button
            key={s.id}
            className={`manuscript-sentence ${paragraphStarts[i] ? "paragraph-start" : ""} ${s.id === p.current ? "selected" : ""} ${i < index ? "already-read" : ""}`}
            disabled={locked}
            aria-label={`${t("第", "Sentence ")}${i + 1}${t("句", "")}: ${s.spoken_text}`}
            aria-current={s.id === p.current ? "true" : undefined}
            onClick={() => p.selectSentence(s.id)}
          >
            <span
              className="sentence-number"
              data-recorded={
                p.recordings.some(
                  (r) =>
                    r.sentence_id === s.id && r.sentence_version === s.version,
                ) || undefined
              }
            >
              {String(i + 1).padStart(2, "0")}
              {p.recordings.some(
                (r) =>
                  r.sentence_id === s.id && r.sentence_version === s.version,
              ) && <Check size={11} aria-label={t("已有录音", "Recorded")} />}
            </span>
            <span>
              <span className="reader-text">{s.spoken_text}</span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}
