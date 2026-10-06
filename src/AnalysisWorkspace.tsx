import { AudioLines, Clock3, Gauge } from "lucide-react";
import { useState, useEffect } from "react";
import { MetricCard, Panel, StatusBadge } from "./DesignSystem";
import { LocalFeedback } from "./LocalFeedback";
import { audioTime } from "./PracticeAudio";
import { paceObservation, recordingScore } from "./practiceData";
import type { Recording, Sentence, Pronunciation } from "./types";
import type { WorkspaceProps } from "./Workspace";

export function SentenceRow({
  sentence,
  recording,
  index,
  selected,
  disabled,
  lang,
  onClick,
}: {
  sentence: Sentence;
  recording?: Recording;
  index: number;
  selected: boolean;
  disabled: boolean;
  lang: "zh" | "en";
  onClick: () => void;
}) {
  const score = recordingScore(recording),
    changed = recording && recording.sentence_version !== sentence.version;
  const issue =
    recording?.pronunciation_feedback?.status === "success"
      ? recording.pronunciation_feedback.issues?.[0]
      : undefined;
  const status = changed
    ? lang === "zh"
      ? "旧版本"
      : "Older version"
    : !recording
      ? lang === "zh"
        ? "未录音"
        : "Not recorded"
      : score === null
        ? lang === "zh"
          ? "未评分"
          : "Unscored"
        : String(Math.round(score));
  return (
    <button
      className={`sentence-row ${selected ? "selected" : ""}`}
      disabled={disabled}
      aria-current={selected ? "true" : undefined}
      onClick={onClick}
    >
      <span className="sentence-number">{index + 1}</span>
      <span className="sentence-row-copy">
        <span>{sentence.spoken_text}</span>
        {issue && (
          <small>{lang === "zh" ? issue.problem : issue.problem_en}</small>
        )}
      </span>
      <StatusBadge
        tone={
          changed
            ? "warning"
            : score === null
              ? "neutral"
              : issue
                ? "warning"
                : "positive"
        }
      >
        {status}
      </StatusBadge>
    </button>
  );
}
export function AnalysisWorkspace({ p }: { p: WorkspaceProps }) {
  const t = (zh: string, en: string) => (p.lang === "zh" ? zh : en);
  const locked = p.recording || p.uploading || p.preparing;
  const [assessment, setAssessment] = useState<Pronunciation>();
  useEffect(() => {
    setAssessment(undefined);
  }, [p.take?.id]);
  const result = assessment || p.take?.pronunciation_feedback;
  const score = recordingScore(
      p.take ? { ...p.take, pronunciation_feedback: result } : undefined,
    ),
    pace = paceObservation(p.take);
  const fluency =
    result?.status === "success" ? result.scores?.fluency?.value : null;
  return (
    <section className="analysis-content pa-feedback">
      <p className="analysis-scope">
        {t("当前句所选录音", "Selected take of the current sentence")}
        {p.take
          ? ` · ${new Date(p.take.created_at).toLocaleString(p.lang === "zh" ? "zh-CN" : "en-US")} · v${p.take.sentence_version}`
          : ""}
      </p>
      <div className="analysis-metrics">
        <MetricCard
          title={t("发音评分", "Pronunciation")}
          value={score === null ? "—" : Math.round(score)}
          unit={score === null ? "" : "/100"}
          tone="violet"
          icon={<AudioLines size={23} />}
          detail={result?.provider || t("未评测", "Not assessed")}
        />
        <MetricCard
          title={t("识别词速", "Recognized Pace")}
          value={pace === null ? "—" : Math.round(pace)}
          unit={pace === null ? "" : "WPM"}
          icon={<Gauge size={23} />}
          detail={t("包含首尾停顿", "Includes leading/trailing silence")}
        />
        <MetricCard
          title={t("录音时长", "Recording Duration")}
          value={p.take ? audioTime(p.take.duration) : "—"}
          icon={<Clock3 size={23} />}
          tone="neutral"
        />
        {typeof fluency === "number" && (
          <MetricCard
            title={t("流利度", "Fluency")}
          value={Math.round(fluency * 100) / 100}
          unit={`/${result?.scores?.fluency?.raw_scale?.[1] ?? 1}`}
            tone="positive"
          />
        )}
      </div>
      <Panel className="sentence-breakdown">
        <div className="section-heading">
          <h2>{t("逐句分析", "Sentence-by-Sentence Breakdown")}</h2>
          <span className="muted">
            {p.session?.sentences?.length} {t("句", "sentences")}
          </span>
        </div>
        {p.session?.sentences?.map((s, i) => {
          const latest = p.recordings
            .filter((r) => r.sentence_id === s.id)
            .sort(
              (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
            )[0];
          return (
            <SentenceRow
              key={s.id}
              sentence={s}
              recording={s.id === p.current ? p.take : latest}
              index={i}
              selected={s.id === p.current}
              disabled={locked}
              lang={p.lang}
              onClick={() => {
                p.selectSentence(s.id);
                p.selectRecording(latest?.id || "");
              }}
            />
          );
        })}
      </Panel>
      <Panel className="sentence-detail">
        <div className="section-heading">
          <h2>{t("录音分析", "Recording Analysis")}</h2>
          <button
            className="plain"
            disabled={locked}
            onClick={() => p.navigate("practice")}
          >
            {t("练习这一句", "Practice sentence")}
          </button>
        </div>
        {p.take ? (
          <>
            <div className="analysis-reference">
              <small>
                {t("录音时的朗读稿", "Reference when recorded")} · v
                {p.take.sentence_version}
              </small>
              <p>{p.take.spoken_text}</p>
            </div>
            {p.take.sentence_version !==
              p.session?.sentences?.find((s) => s.id === p.current)
                ?.version && (
              <p className="small-note">
                {t(
                  "稿件已修改。以下分析对应录音时的版本。",
                  "The script changed. This analysis uses the recorded version.",
                )}
              </p>
            )}
            {!p.take.content_feedback && !result && (
              <p className="empty-inline">
                {t(
                  "此录音尚未分析。可先检查识别差异，或调用已配置的发音评测。",
                  "This recording has not been analyzed. Check the transcript or use your configured assessment provider.",
                )}
              </p>
            )}
            <LocalFeedback
              key={p.take.id}
              record={p.take}
              lang={p.lang}
              play={p.play}
              locked={locked}
              onResult={setAssessment}
            />
          </>
        ) : (
          <p className="empty-inline">
            {t(
              "当前句暂无录音，返回练习页开始录音。",
              "No recording for this sentence. Return to Practice to record.",
            )}
          </p>
        )}
      </Panel>
    </section>
  );
}
