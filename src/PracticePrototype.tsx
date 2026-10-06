import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Mic,
  Square,
  Trash2,
  AudioLines,
  Settings2,
  Keyboard,
  FileText,
  Check,
} from "lucide-react";
import type { Recording, Session } from "./types";
import { PracticeAudio, audioTime } from "./PracticeAudio";
import "@fontsource/source-serif-4/latin-400.css";
import "@fontsource/source-sans-3/latin-400.css";
import "@fontsource/source-sans-3/latin-600.css";
import "@fontsource/noto-sans-sc/chinese-simplified-400.css";
import "./practice-prototype.css";

type Props = {
  lang: "zh" | "en";
  session: Session;
  sessions: Session[];
  current: string;
  take?: Recording;
  history: Recording[];
  practiced: string[];
  recording: boolean;
  uploading: boolean;
  seconds: number;
  preview: string;
  error: string;
  notice: string;
  rate: number;
  loop: boolean;
  demo: RefObject<HTMLAudioElement | null>;
  own: RefObject<HTMLAudioElement | null>;
  editor: ReactNode;
  voice: ReactNode;
  jobs: ReactNode;
  audioUrl: (id: string) => string;
  openSession: (item: Session) => void;
  selectSentence: (id: string) => void;
  selectRecording: (id: string) => void;
  setRate: (value: number) => void;
  setLoop: (value: boolean) => void;
  generate: () => void;
  record: () => void;
  analyze: () => void;
  assess: () => void;
  download: (id: string) => void;
  remove: () => void;
  play: (start: number | null, end: number | null) => void;
  manualPlayback: () => void;
  audioTimeUpdate: () => void;
  setError: (value: string) => void;
  settings: () => void;
  language: () => void;
  dismissNotice: () => void;
};

export function PracticePrototype(p: Props) {
  const t = (zh: string, en: string) => (p.lang === "zh" ? zh : en);
  const sentences = p.session.sentences || [];
  const index = sentences.findIndex((s) => s.id === p.current);
  const sentence = sentences[index];
  const [demoDuration, setDemoDuration] = useState(0);
  const [ownDuration, setOwnDuration] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(
    () => matchMedia("(min-width: 761px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(min-width: 761px)");
    const update = () => setDirectoryOpen(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const previewRef = useRef<HTMLAudioElement>(null);
  const locked = p.recording || p.uploading;
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        p.uploading
      )
        return;
      const target = event.target as HTMLElement;
      if (
        target.closest(
          "input, textarea, select, button, a, summary, [contenteditable], [role=dialog]",
        ) ||
        document.querySelector("[aria-modal=true]")
      )
        return;
      event.preventDefault();
      p.demo.current?.pause();
      p.own.current?.pause();
      p.record();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [p.record, p.uploading, p.demo, p.own]);
  const showPreview = !!p.preview && (p.uploading || !!p.error || !p.take);
  useEffect(() => {
    setDemoDuration(0);
  }, [p.current, sentence?.asset_id]);
  useEffect(() => {
    setOwnDuration(0);
  }, [p.current, p.take?.id, showPreview]);
  const scale = Math.max(demoDuration, ownDuration, p.take?.duration || 0, 1);
  const ownSrc = showPreview
    ? p.preview
    : p.take
      ? p.audioUrl(p.take.asset_id)
      : "";
  return (
    <div className="practice-prototype">
      <header className="pa-header">
        <span className="pa-brand">
          <AudioLines size={30} strokeWidth={1.7} />
          Oracy
        </span>
        <label className="pa-session">
          <span>{t("稿件", "Speech")}</span>
          <select
            aria-label={t("当前稿件", "Current speech")}
            value={p.session.id}
            disabled={locked}
            onChange={(e) => {
              const item = p.sessions.find((s) => s.id === e.target.value);
              if (item) p.openSession(item);
            }}
          >
            {p.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <div className="pa-header-actions">
          <a href={`${location.pathname}?practice=legacy`}>
            {t("稿件管理", "Manage speeches")}
          </a>
          <button onClick={p.language}>
            {p.lang === "zh" ? "EN" : "中文"}
          </button>
          <button onClick={p.settings}>{t("设置", "Settings")}</button>
        </div>
      </header>
      <main className="pa-layout">
        <aside className="pa-directory">
          <details
            open={directoryOpen}
            onToggle={(e) => setDirectoryOpen(e.currentTarget.open)}
          >
            <summary>
              {t("句子目录", "Sentences")} <span>{sentences.length}</span>
            </summary>
            <nav aria-label={t("句子目录", "Sentences")}>
              {sentences.map((s, i) => (
                <button
                  key={s.id}
                  disabled={locked}
                  aria-current={s.id === p.current ? "true" : undefined}
                  onClick={() => p.selectSentence(s.id)}
                >
                  <span className="pa-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{s.spoken_text}</span>
                  <span
                    className={`pa-sentence-status ${p.practiced.includes(s.id) ? "is-completed" : ""}`}
                    aria-label={
                      p.practiced.includes(s.id)
                        ? t("已录音", "Recorded")
                        : t("未录音", "Not recorded")
                    }
                  >
                    {p.practiced.includes(s.id) ? <Check size={12} /> : null}
                  </span>
                </button>
              ))}
            </nav>
          </details>
          <div className="pa-directory-bottom">
            <div className="pa-progress-label">
              <span>{t("录音进度", "Recording progress")}</span>
              <span>
                {sentences.filter((s) => p.practiced.includes(s.id)).length} /{" "}
                {sentences.length}
              </span>
            </div>
            <progress
              aria-label={t("录音进度", "Recording progress")}
              max={Math.max(sentences.length, 1)}
              value={sentences.filter((s) => p.practiced.includes(s.id)).length}
            />
            <button className="pa-sidebar-action" onClick={p.settings}>
              <Settings2 size={17} />
              {t("练习设置", "Practice settings")}
            </button>
            <button
              className="pa-sidebar-action"
              aria-expanded={shortcutsOpen}
              onClick={() => setShortcutsOpen(!shortcutsOpen)}
            >
              <Keyboard size={17} />
              {t("快捷键", "Shortcuts")}
              <kbd>Space</kbd>
            </button>
            {shortcutsOpen && (
              <p className="pa-shortcut-help">
                {t(
                  "Space：开始 / 停止录音。编辑文字和操作控件时不触发。",
                  "Space: start / stop recording, except while editing or using controls.",
                )}
              </p>
            )}
          </div>
        </aside>
        <div className="pa-content">
          <section className="pa-script">
            <div className="pa-sentence-top">
              <span>
                {t("当前句", "Sentence")} {String(index + 1).padStart(2, "0")} /{" "}
                {sentences.length}
              </span>
              <div>
                <button
                  aria-label={t("上一句", "Previous sentence")}
                  disabled={locked || index <= 0}
                  onClick={() => p.selectSentence(sentences[index - 1].id)}
                >
                  <ArrowLeft size={18} />
                </button>
                <button
                  aria-label={t("下一句", "Next sentence")}
                  disabled={locked || index >= sentences.length - 1}
                  onClick={() => p.selectSentence(sentences[index + 1].id)}
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
            <h1
              className={
                sentence?.spoken_text.length > 220 ? "pa-long-sentence" : ""
              }
            >
              {sentence?.spoken_text}
            </h1>
            <div className="pa-script-actions">
              {p.editor}
              <details className="pa-original">
                <summary>
                  <FileText size={16} />
                  {t("查看原文", "View original")}
                </summary>
                <p>{p.session.original_text}</p>
              </details>
            </div>
          </section>
          {p.error && (
            <div className="pa-message pa-error" role="alert">
              <span>{p.error}</span>
              <button onClick={() => p.setError("")}>
                {t("关闭", "Dismiss")}
              </button>
            </div>
          )}
          <section
            className="pa-track pa-demo-track"
            aria-labelledby="pa-demo-title"
          >
            <div className="pa-track-heading">
              <h2 id="pa-demo-title">{t("示范音频", "Example audio")}</h2>
              <label className="pa-speed">
                {t("播放速度", "Playback speed")}{" "}
                <select
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
              </label>
              <label className="pa-loop">
                <input
                  type="checkbox"
                  checked={p.loop}
                  disabled={locked}
                  onChange={(e) => p.setLoop(e.target.checked)}
                />
                {t("循环本句", "Loop sentence")}
              </label>
            </div>
            {sentence?.asset_id ? (
              <PracticeAudio
                key={sentence.asset_id}
                src={p.audioUrl(sentence.asset_id)}
                label={t("示范音频", "Example audio")}
                audioRef={p.demo}
                scale={scale}
                rate={p.rate}
                loop={p.loop}
                disabled={locked}
                onDuration={setDemoDuration}
                onError={p.setError}
                lang={p.lang}
                onManual={() => p.own.current?.pause()}
              />
            ) : (
              <div className="pa-missing">
                <span>{t("尚未生成示范音频", "No example audio yet")}</span>
                <button
                  className="pa-text-action"
                  disabled={locked}
                  onClick={p.generate}
                >
                  {t("生成本句", "Generate example")}
                </button>
              </div>
            )}
            <div className="pa-track-options">
              <details className="pa-voice">
                <summary>{t("发音风格与声线", "Delivery & voice")}</summary>
                {p.voice}
                <button
                  className="pa-text-action"
                  disabled={locked}
                  onClick={p.generate}
                >
                  {t("重新生成本句", "Regenerate example")}
                </button>
              </details>
              {sentence?.asset_id && (
                <button
                  aria-label={t("下载示范音频", "Download example")}
                  onClick={() => p.download(sentence.asset_id!)}
                >
                  <Download size={16} />
                </button>
              )}
            </div>
          </section>
          <section
            className={`pa-capture ${p.recording ? "is-recording" : ""}`}
            aria-label={t("录音", "Record")}
          >
            <button
              className="pa-record-orb"
              disabled={p.uploading}
              aria-label={
                p.recording
                  ? t("停止录音", "Stop recording")
                  : p.history.length
                    ? t("重新录音", "Record again")
                    : t("开始录音", "Start recording")
              }
              onClick={() => {
                p.demo.current?.pause();
                p.own.current?.pause();
                p.record();
              }}
            >
              {p.recording ? (
                <Square size={25} fill="currentColor" />
              ) : (
                <Mic size={30} strokeWidth={1.7} />
              )}
            </button>
            <div className="pa-capture-copy">
              <h2>
                {p.recording
                  ? t("停止录音", "Stop recording")
                  : p.uploading
                    ? t("正在保存录音", "Saving recording")
                    : p.history.length
                      ? t("重新录音", "Record again")
                      : t("开始录音", "Start recording")}
              </h2>
              <p role="status">
                {p.recording
                  ? `${t("正在录音", "Recording")} · ${audioTime(p.seconds)} / 2:00`
                  : p.uploading
                    ? t("请稍候…", "Please wait…")
                    : t("按 Space 开始 / 停止", "Press Space to start / stop")}
              </p>
              <small>
                {t(
                  "保存在本机 · 最长 120 秒",
                  "Saved locally · up to 120 seconds",
                )}
              </small>
            </div>
            <div className="pa-capture-wave" aria-hidden="true">
              {Array.from({ length: 25 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    height: `${12 + Math.sin(i * 1.9) ** 2 * (i < 12 ? i * 5 : (25 - i) * 5)}px`,
                    animationDelay: `${i * 40}ms`,
                  }}
                />
              ))}
            </div>
          </section>
          <section
            className="pa-track pa-recording-track"
            aria-labelledby="pa-own-title"
          >
            <div className="pa-track-heading">
              <h2 id="pa-own-title">{t("我的录音", "My recording")}</h2>
              {!ownSrc && (
                <span className="pa-meta">
                  {t("尚未录音", "No recording yet")}
                </span>
              )}
              {!!p.history.length && (
                <label className="pa-history">
                  {t("录音记录", "Recordings")}
                  <select
                    aria-label={t("录音记录", "Recordings")}
                    disabled={locked}
                    value={p.take?.id || ""}
                    onChange={(e) => p.selectRecording(e.target.value)}
                  >
                    {p.history.map((r, i) => (
                      <option key={r.id} value={r.id}>
                        {t("录音", "Take")} {p.history.length - i} ·{" "}
                        {new Date(r.created_at).toLocaleString(
                          p.lang === "zh" ? "zh-CN" : "en-US",
                          {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}{" "}
                        · v{r.sentence_version}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {ownSrc ? (
              <PracticeAudio
                key={ownSrc}
                src={ownSrc}
                label={t("我的录音", "My recording")}
                audioRef={showPreview ? previewRef : p.own}
                scale={scale}
                rate={p.rate}
                disabled={locked}
                onDuration={setOwnDuration}
                onError={p.setError}
                lang={p.lang}
                onManual={() => {
                  p.manualPlayback();
                  p.demo.current?.pause();
                }}
                onTime={showPreview ? undefined : p.audioTimeUpdate}
              />
            ) : (
              <div className="pa-missing">
                <AudioLines size={30} strokeWidth={1.4} />
                <span>
                  {t(
                    "录音后在这里回听、查看识别文本与发音反馈。",
                    "Record to replay your audio and review transcripts and pronunciation feedback here.",
                  )}
                </span>
              </div>
            )}
            <div className="pa-record-controls">
              {p.take && (
                <div className="pa-record-actions">
                  <button
                    aria-label={t("下载录音", "Download recording")}
                    disabled={locked}
                    onClick={() => p.download(p.take!.asset_id)}
                  >
                    <Download size={16} />
                  </button>
                  <button
                    aria-label={t("删除录音", "Delete recording")}
                    disabled={locked}
                    onClick={p.remove}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            {p.notice && (
              <div className="pa-save-status" role="status">
                {p.notice}
                <button onClick={p.dismissNotice}>
                  {t("关闭", "Dismiss")}
                </button>
              </div>
            )}
            {showPreview && (
              <p className="pa-meta">
                {t("本次录音预览", "Latest recording preview")}
              </p>
            )}
            {p.take && p.take.sentence_version !== sentence?.version && (
              <details className="pa-reference">
                <summary>
                  {t("录音时的朗读稿", "Reference when recorded")} · v
                  {p.take.sentence_version}
                </summary>
                <p>{p.take.spoken_text}</p>
              </details>
            )}
          </section>
          {p.take && (
            <section className="pa-feedback">
              <div className="pa-feedback-actions">
                <button
                  className="pa-text-action"
                  disabled={locked}
                  onClick={p.analyze}
                >
                  {t("检查识别差异", "Check transcript")}
                </button>
                <button
                  className="pa-text-action"
                  disabled={locked}
                  onClick={p.assess}
                >
                  {t("发音评测", "Assess pronunciation")}
                </button>
              </div>
              <p className="pa-meta">
                {t(
                  "识别差异提示读了哪些词；它不是发音评分。",
                  "Transcript differences show recognized words, not pronunciation quality.",
                )}
              </p>
              <LocalFeedback
                key={p.take.id}
                record={p.take}
                lang={p.lang}
                play={p.play}
                locked={locked}
              />
            </section>
          )}
          {p.jobs}
        </div>
      </main>
    </div>
  );
}

function LocalFeedback({
  record,
  lang,
  play,
  locked,
}: {
  record: Recording;
  lang: "zh" | "en";
  play: Props["play"];
  locked: boolean;
}) {
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [assessment, setAssessment] = useState("");
  const [selected, setSelected] = useState("");
  const history = record.assessment_history || [];
  const result =
    history.find((r) => r.id === assessment) || record.pronunciation_feedback;
  const errorKey = typeof result?.error === "string" ? result.error : "";
  const knownError: Record<string, string> = {
    provider_disabled: t(
      "评测服务未启用，请在设置中启用。",
      "Assessment provider is disabled. Enable it in Settings.",
    ),
    api_key_required: t(
      "未配置评测密钥，请在设置中配置。",
      "No assessment API key. Configure it in Settings.",
    ),
  };
  useEffect(() => {
    setAssessment("");
    setSelected("");
  }, [record.id, record.pronunciation_feedback?.id]);
  const issues = result?.issues || [];
  const labels: Record<string, string> = {
    pronunciation: t("发音", "Pronunciation"),
    fluency: t("流利度", "Fluency"),
    completeness: t("完整度", "Completeness"),
    prosody: t("韵律", "Prosody"),
    intelligibility: t("可理解度", "Intelligibility"),
    expressiveness: t("表达力", "Expressiveness"),
    five_dimension_overall: t("五维综合分", "Five-dimension overall"),
    provider_suggested: t("供应商建议评分", "Provider suggested score"),
  };
  return (
    <>
      {record.content_feedback && (
        <div className="pa-transcript">
          <h3>{t("识别文本差异", "Transcript differences")}</h3>
          {record.content_feedback.transcript.uncertain ? (
            <p>
              {t(
                "识别可信度不足，请回听后复核。",
                "Recognition is uncertain. Listen back to review.",
              )}
            </p>
          ) : (
            <div className="pa-differences">
              {record.content_feedback.differences.map((d, i) => {
                const name =
                  d.type === "match"
                    ? t("识别一致", "Recognized match")
                    : t(
                        "识别差异，需复核",
                        "Recognition difference; review needed",
                      );
                return (
                  <button
                    key={i}
                    className={d.type === "match" ? "" : "pa-difference"}
                    disabled={locked || !d.time}
                    aria-label={`${name}: ${d.expected || ""} ${d.actual || ""}`}
                    onClick={() =>
                      play(d.time?.start ?? null, d.time?.end ?? null)
                    }
                  >
                    {d.expected}
                    {d.type === "substitute" ? " → " : ""}
                    {d.type === "match" ? "" : d.actual}
                  </button>
                );
              })}
            </div>
          )}
          <details>
            <summary>{t("识别文本与依据", "Transcript and evidence")}</summary>
            <p>{record.content_feedback.transcript.text || "—"}</p>
            <pre>{JSON.stringify(record.content_feedback, null, 2)}</pre>
          </details>
        </div>
      )}
      {result && (
        <div className="pa-assessment">
          <div className="pa-feedback-heading">
            <h3>{t("发音评测", "Pronunciation assessment")}</h3>
            {!!history.length && (
              <label>
                {t("评测历史", "Assessment history")}
                <select
                  value={assessment}
                  onChange={(e) => {
                    setAssessment(e.target.value);
                    setSelected("");
                  }}
                >
                  <option value="">{t("最新结果", "Latest result")}</option>
                  {history.map((r, i) => (
                    <option key={r.id || i} value={r.id}>
                      {r.created_at} · {r.provider} · {r.status}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <p className="pa-meta">
            {result.provider} · {result.provider_version}
          </p>
          {result.status !== "success" ? (
            <p className="pa-error" role="alert">
              {t("评测未完成：", "Assessment incomplete: ")}
              {knownError[errorKey] ||
                (typeof result.error === "object"
                  ? JSON.stringify(result.error)
                  : result.error || result.status)}
            </p>
          ) : (
            <>
              {!!issues.length ? (
                <div className="pa-issues">
                  {issues.map((i) => (
                    <div className="pa-issue" key={i.id}>
                      <button
                        className="pa-issue-select"
                        aria-expanded={selected === i.id}
                        onClick={() =>
                          setSelected(selected === i.id ? "" : i.id)
                        }
                      >
                        <span>{i.text}</span>
                        <span>
                          {t(
                            { minor: "轻微", moderate: "中等", major: "重点" }[
                              i.severity
                            ] || i.severity,
                            i.severity,
                          )}
                        </span>
                        <span>
                          {i.start !== null && i.end !== null
                            ? `${i.start.toFixed(2)}–${i.end.toFixed(2)} s`
                            : t("无可靠定位", "No reliable localization")}
                        </span>
                      </button>
                      {selected === i.id && (
                        <div className="pa-issue-detail">
                          <p>{lang === "zh" ? i.problem : i.problem_en}</p>
                          <p>
                            {t("一般练习建议：", "General practice tip: ")}
                            {lang === "zh" ? i.advice : i.advice_en}
                          </p>
                          <button
                            className="pa-text-action"
                            disabled={
                              locked || i.start === null || i.end === null
                            }
                            onClick={() => play(i.start, i.end)}
                          >
                            {t("回放片段", "Replay segment")}
                          </button>
                          <p className="pa-meta">
                            {i.source} · {i.localization_level} ·{" "}
                            {i.time_source ||
                              t("无可靠定位", "No reliable localization")}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p>{t("暂无可用练习项。", "No practice items available.")}</p>
              )}
              <details className="pa-scores" open>
                <summary>{t("评分与依据", "Scores and evidence")}</summary>
                {Object.entries(result.scores || {}).map(([key, score]) => (
                  <div key={key} className="pa-score">
                    <span>{labels[key] || key}</span>
                    <strong>
                      {score.value === null
                        ? "—"
                        : Math.round(score.value * 1000) / 1000}{" "}
                      / {score.raw_scale?.[1]}
                    </strong>
                    <small>
                      {score.status} · {score.source} ·{" "}
                      {score.source_field ||
                        t("未提供评分依据", "No score source")}{" "}
                      · {score.conversion} {score.reason}
                    </small>
                  </div>
                ))}
                <p className="pa-meta">
                  {t(
                    "不同供应商分数不直接比较；完整度不代表可理解度。低分仅提示复核，一般建议不是错误原因诊断。",
                    "Scores are not comparable across providers. Completeness is not intelligibility. Low scores suggest review; general tips do not diagnose the cause.",
                  )}
                </p>
              </details>
            </>
          )}
          <details>
            <summary>{t("原始评测结果", "Raw assessment result")}</summary>
            <pre>
              {JSON.stringify(result.raw_provider_result ?? result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </>
  );
}
