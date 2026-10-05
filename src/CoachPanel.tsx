import {
  AudioLines,
  Gauge,
  Pause,
  Star,
  Lightbulb,
  Users,
  Smile,
  ChevronRight,
  Play,
} from "lucide-react";
import { CoachItem, ProgressRing, StatusBadge } from "./DesignSystem";
import { recordingScore, paceObservation } from "./practiceData";
import { recordingGaps } from "./CoachEvidence";
import type { WorkspaceProps } from "./Workspace";

export function CoachPanel({
  p,
}: {
  p: WorkspaceProps;
  readerMode?: "focus" | "script";
}) {
  const t = (zh: string, en: string) => (p.lang === "zh" ? zh : en);
  const locked = p.recording || p.uploading || p.preparing;
  const score = recordingScore(p.take),
    pace = paceObservation(p.take);
  const result = p.take?.pronunciation_feedback;
  const issues = result?.status === "success" ? result.issues || [] : [];
  const gaps = recordingGaps(
    p.take?.content_feedback?.observations?.find(
      (o) => o.kind === "interword_gaps",
    )?.value,
    p.take?.duration || 0,
  );
  const clarity =
    result?.status === "success" ? result.scores?.intelligibility?.value : null;
  const open = () => p.navigate("analysis");
  const pending = t("待评测", "Not assessed");
  const isAnalysis = p.view === "analysis";
  return (
    <div className="coach-panel continuous-coach">
      {
        <section className="coach-overview">
          <div className="section-heading">
            <h2>
              {p.recording
                ? t("录音中", "Recording Studio")
                : t("本句反馈", "Sentence Feedback")}
            </h2>
            <StatusBadge
              tone={
                p.processing
                  ? "blue"
                  : score !== null || p.recording
                    ? "positive"
                    : "neutral"
              }
            >
              {p.processing
                ? t("分析中", "Analyzing")
                : p.recording
                  ? t("录音中", "Active")
                  : score !== null
                    ? t("已评测", "Assessed")
                    : pending}
            </StatusBadge>
          </div>
          <div className="coach-summary">
            <div className="coach-score">
              {score !== null ? (
                <ProgressRing
                  value={score}
                  tone="positive"
                  suffix=""
                  label={`${t("发音评分", "Pronunciation")} ${score}/100`}
                />
              ) : (
                <div className="pending-ring">
                  <strong>—</strong>
                </div>
              )}
              <small>{t("发音评分 / 100", "Pronunciation / 100")}</small>
            </div>
          </div>
          <p className="feedback-provenance">
            {p.take
              ? new Date(p.take.created_at).toLocaleString(
                  p.lang === "zh" ? "zh-CN" : "en-US",
                  {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                ) + ` · v${p.take.sentence_version}`
              : "\u00a0"}
          </p>
          {p.take &&
            p.take.sentence_version !==
              p.session?.sentences?.find((s) => s.id === p.current)
                ?.version && (
              <p className="small-note">
                {t(
                  "稿件已修改，此反馈属于旧版本录音。",
                  "The script changed; this feedback belongs to an earlier version.",
                )}
              </p>
            )}
        </section>
      }
      <div className="coaching-stream">
        <CoachItem
          title={t("语速", "Stay on pace")}
          tone="blue"
          icon={<Gauge size={27} />}
          status={
            pace === null ? t("无数据", "No data") : `${Math.round(pace)} WPM`
          }
          advice={
            pace === null
              ? t(
                  "识别录音后显示词速。建议 140–160 WPM。",
                  "Check your transcript for pace. Aim for 140–160 WPM.",
                )
              : t(
                  `识别词速为 ${Math.round(pace)} WPM；建议 140–160 WPM。`,
                  `You're speaking at ${Math.round(pace)} WPM. Try 140–160 WPM for clarity.`,
                )
          }
          disabled={locked || !p.take}
          onClick={open}
        />
        <CoachItem
          title={t("发音", "Pronunciation")}
          tone="violet"
          icon={<AudioLines size={28} />}
          status={score === null ? pending : `${Math.round(score)} / 100`}
          advice={
            score === null
              ? t(
                  "录音后使用已配置的服务评测发音。",
                  "Record a take to assess pronunciation.",
                )
              : issues.length
                ? t(
                    `${issues.length} 项发音反馈需回听复核。`,
                    `${issues.length} pronunciation items to review by listening.`,
                  )
                : t(
                    "评测完成。查看词级评分和原始反馈。",
                    "Assessment complete. View word scores and provider feedback.",
                  )
          }
          disabled={locked || !p.take}
          onClick={open}
        />
        <CoachItem
          title={t("停顿", "Pauses")}
          tone="warning"
          icon={<Pause size={27} fill="currentColor" />}
          status={gaps === null ? t("无数据", "No data") : `${gaps.length}`}
          advice={
            gaps === null
              ? t(
                  "在意群结束处停顿，让重点更清晰。",
                  "Pause briefly after key ideas.",
                )
              : t(
                  `${gaps.length} 处估计词间间隔，回听后判断。`,
                  `${gaps.length} estimated interword gaps. Listen to review.`,
                )
          }
          disabled={locked || !p.take}
          onClick={open}
        />
        <CoachItem
          title={t("可理解度", "Clarity")}
          tone="issue"
          icon={<Star size={28} fill="currentColor" />}
          status={
            typeof clarity === "number"
              ? String(clarity)
              : t("未提供", "Unavailable")
          }
          advice={
            typeof clarity === "number"
              ? t(
                  "来自评测服务的可理解度指标。",
                  "Intelligibility reported by the assessment provider.",
                )
              : t(
                  "评测服务未提供该指标时，不推算分数。",
                  "Shown when supplied by your assessment provider.",
                )
          }
          disabled={locked || !p.take}
          onClick={open}
        />
      </div>
      {
        <div className="analysis-actions">
          <button
            disabled={locked || !p.take || !!p.processing}
            onClick={p.analyze}
          >
            {t("检查识别差异", "Check transcript")}
          </button>
          <button
            disabled={locked || !p.take || !!p.processing}
            onClick={p.assess}
          >
            {t("发音评测", "Assess pronunciation")}
          </button>
        </div>
      }
      {isAnalysis && !!issues.length && (
        <section className="coach-priorities">
          <div className="section-heading">
            <h2>{t("发音重点", "Pronunciation Highlights")}</h2>
          </div>
          {issues.slice(0, 3).map((issue) => (
            <article className="priority-item" key={issue.id}>
              <div>
                <strong>{issue.text}</strong>
                <p>{p.lang === "zh" ? issue.problem : issue.problem_en}</p>
                <details>
                  <summary>{t("练习建议", "Practice tip")}</summary>
                  <p>{p.lang === "zh" ? issue.advice : issue.advice_en}</p>
                </details>
              </div>
              <button
                className="review-play"
                disabled={locked}
                aria-label={`${t("回听", "Replay")} ${issue.text}`}
                onClick={() => p.play(issue.start, issue.end)}
              >
                <Play size={15} fill="currentColor" />
              </button>
            </article>
          ))}
        </section>
      )}
      {!isAnalysis && (
        <section className="quick-tips">
          <div className="section-heading">
            <h2>{t("练习提示", "Quick Tips")}</h2>
          </div>
          {[
            [
              Lightbulb,
              "warning",
              t("保持自然语速", "Use natural pace"),
              t("尝试 140–160 词/分钟。", "Aim for 140–160 WPM."),
            ],
            [
              Users,
              "blue",
              t("使用语调与重音", "Speak with emotion"),
              t(
                "改变语调，强调关键词。",
                "Vary your tone and emphasize key words.",
              ),
            ],
            [
              Smile,
              "warning",
              t("回听自己的录音", "Listen to your recording"),
              t(
                "每次选择一个需要调整的短语。",
                "Choose one phrase to improve each time.",
              ),
            ],
          ].map(([Icon, tone, title, copy], i) => {
            const I = Icon as typeof Lightbulb;
            return (
              <div className={`tip-row tone-${tone}`} key={i}>
                <span className="coach-icon">
                  <I size={24} />
                </span>
                <div>
                  <strong>{title as string}</strong>
                  <p>{copy as string}</p>
                </div>
              </div>
            );
          })}
        </section>
      )}
      <button
        className="full-analysis plain"
        disabled={locked || !p.take}
        onClick={open}
      >
        {t("查看完整分析", "Full analysis")}
        <ChevronRight size={17} />
      </button>
    </div>
  );
}
