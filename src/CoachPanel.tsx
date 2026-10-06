import { AudioLines, FileText, ArrowRight, Play } from "lucide-react";
import { CoachItem, Panel, ProgressRing, StatusBadge } from "./DesignSystem";
import { recordingScore, paceObservation } from "./practiceData";
import type { WorkspaceProps } from "./Workspace";
import {
  PaceFeedback,
  PauseFeedback,
  WordScoreStrip,
  recordingGaps,
} from "./CoachEvidence";

export function CoachPanel({ p }: { p: WorkspaceProps }) {
  const t = (zh: string, en: string) => (p.lang === "zh" ? zh : en);
  const locked = p.recording || p.uploading || p.preparing;
  const score = recordingScore(p.take),
    pace = paceObservation(p.take);
  const result = p.take?.pronunciation_feedback;
  const gaps = p.take?.content_feedback?.observations?.find(
    (o) => o.kind === "interword_gaps",
  )?.value;
  const severity: Record<string, number> = { major: 0, moderate: 1, minor: 2 };
  const issues =
    result?.status === "success"
      ? [...(result.issues || [])].sort(
          (a, b) => (severity[a.severity] ?? 3) - (severity[b.severity] ?? 3),
        )
      : [];
  const differences =
    p.take?.content_feedback?.differences.filter((d) => d.type !== "match") ||
    [];
  const words = result?.status === "success" ? result.words : [];
  const pauseGaps = recordingGaps(gaps, p.take?.duration || 0);
  const open = () => p.navigate("analysis");
  const hasResult =
    score !== null ||
    issues.length > 0 ||
    words.length > 0 ||
    !!p.take?.content_feedback;
  if (!hasResult)
    return (
      <div className="coach-panel brief-feedback coach-empty-state">
        <div className="section-heading">
          <h2>{t("本句反馈", "Sentence feedback")}</h2>
          <StatusBadge tone={p.processing ? "blue" : "neutral"}>
            {p.processing
              ? t("正在分析", "Analyzing")
              : p.take
                ? t("待分析", "Not analyzed")
                : t("未录音", "Not recorded")}
          </StatusBadge>
        </div>
        <p className="empty-inline" aria-live="polite">
          {p.processing
            ? t(
                "正在分析录音，完成后显示结果。",
                "Analyzing the recording; results will appear when complete.",
              )
            : p.take
              ? t(
                  "录音已保存。可检查识别差异或评测发音。",
                  "Recording saved. Check the transcript or assess pronunciation.",
                )
              : t(
                  "录音后可查看本句反馈。",
                  "Record to see feedback for this sentence.",
                )}
        </p>
        {p.take && (
          <div className="analysis-actions">
            <button disabled={locked || !!p.processing} onClick={p.analyze}>
              {t("检查识别差异", "Check transcript")}
            </button>
            <button disabled={locked || !!p.processing} onClick={p.assess}>
              {t("发音评测", "Assess pronunciation")}
            </button>
          </div>
        )}
      </div>
    );
  const status = p.processing
    ? t("正在分析", "Analyzing")
    : score !== null
      ? t("评测完成", "Assessed")
      : p.take
        ? t("待评测", "Not assessed")
        : t("未录音", "Not recorded");
  return (
    <div className="coach-panel brief-feedback">
      <Panel className="coach-overview">
        <div className="section-heading">
          <h2>{t("本句结果", "Sentence result")}</h2>
          <StatusBadge tone={p.processing || p.take ? "blue" : "neutral"}>
            {status}
          </StatusBadge>
        </div>
        {p.take ? (
          <>
            <div className="coach-summary">
              <div className="coach-score" key={score}>
                {score === null ? (
                  "—"
                ) : (
                  <ProgressRing
                    value={score}
                    tone="violet"
                    suffix=""
                    label={`${t("发音评分", "Pronunciation")} ${Math.round(score)} / 100`}
                  />
                )}
                <small>
                  {score === null
                    ? t("未评测", "Unscored")
                    : t("发音评分 / 100", "Pronunciation / 100")}
                </small>
              </div>
              <p aria-live="polite">
                {p.processing
                  ? t(
                      "正在分析录音，完成后更新结果。",
                      "Analyzing the recording; results will update when complete.",
                    )
                  : issues.length
                    ? t(
                        `${issues.length} 项发音反馈需回听复核。`,
                        `${issues.length} pronunciation items to review by listening.`,
                      )
                    : score !== null
                      ? t(
                          "评测完成，未提供需复核的发音项。",
                          "Assessment complete; no pronunciation review items were provided.",
                        )
                      : t(
                          "录音已保存，可检查识别差异或评测发音。",
                          "Recording saved. Check the transcript or assess pronunciation.",
                        )}
              </p>
            </div>
            <p className="feedback-provenance">
              {new Date(p.take.created_at).toLocaleString(
                p.lang === "zh" ? "zh-CN" : "en-US",
                {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )}{" "}
              · v{p.take.sentence_version}
            </p>
            {p.take.sentence_version !==
              p.session?.sentences?.find((s) => s.id === p.current)
                ?.version && (
              <p className="small-note">
                {t(
                  "稿件已修改，此反馈属于旧版本录音。",
                  "The script changed; this feedback belongs to an earlier version.",
                )}
              </p>
            )}
          </>
        ) : (
          <p className="empty-inline">
            {t(
              "开始录音后，可检查识别差异与评测发音。",
              "Record to check transcript differences and assess pronunciation.",
            )}
          </p>
        )}
        {p.take && (
          <div className="analysis-actions">
            <button disabled={locked || !!p.processing} onClick={p.analyze}>
              {t("检查识别差异", "Check transcript")}
            </button>
            <button disabled={locked || !!p.processing} onClick={p.assess}>
              {t("发音评测", "Assess pronunciation")}
            </button>
          </div>
        )}
      </Panel>
      {issues.length > 0 && (
        <Panel className="coach-priorities">
          <div className="section-heading">
            <h2>{t("优先复核", "Review first")}</h2>
            <span className="priority-icon">
              <AudioLines size={20} />
            </span>
          </div>
          {issues.length ? (
            issues.slice(0, 3).map((issue) => {
              const wordScore = words.find(
                (word) => word.word === issue.text,
              )?.score;
              const localized =
                issue.start !== null &&
                issue.end !== null &&
                Number.isFinite(issue.start) &&
                Number.isFinite(issue.end) &&
                issue.start >= 0 &&
                issue.end > issue.start &&
                issue.end <= (p.take?.duration || 0);
              return (
                <article className="priority-item" key={issue.id}>
                  <div className="priority-heading">
                    <strong>{issue.text}</strong>
                    <StatusBadge tone="warning">
                      {t("需复核", "Review")}
                    </StatusBadge>
                  </div>
                  <p>
                    {typeof wordScore === "number" && Number.isFinite(wordScore)
                      ? t(
                          `词级评分 ${Math.round(wordScore)} / 100，需回听复核。`,
                          `Word score ${Math.round(wordScore)} / 100; listen to review.`,
                        )
                      : p.lang === "zh"
                        ? issue.problem
                        : issue.problem_en}
                  </p>
                  <button
                    className="review-play"
                    disabled={locked}
                    onClick={() =>
                      p.play(
                        localized ? issue.start : null,
                        localized ? issue.end : null,
                      )
                    }
                  >
                    <Play size={14} fill="currentColor" />
                    {localized
                      ? t("回听片段", "Replay segment")
                      : t("回听本句", "Replay sentence")}
                    {localized && (
                      <small>
                        {issue.start!.toFixed(1)}–{issue.end!.toFixed(1)} s
                      </small>
                    )}
                  </button>
                  <details className="practice-tip">
                    <summary>
                      {t("反馈与练习建议", "Feedback and practice tip")}
                    </summary>
                    <p>{p.lang === "zh" ? issue.problem : issue.problem_en}</p>
                    <p>{p.lang === "zh" ? issue.advice : issue.advice_en}</p>
                  </details>
                </article>
              );
            })
          ) : (
            <p className="empty-inline">
              {score !== null
                ? t(
                    "暂无需复核的发音项。",
                    "No pronunciation review items available.",
                  )
                : t(
                    "完成发音评测后显示需复核的词或片段。",
                    "Assess pronunciation to see words or segments to review.",
                  )}
            </p>
          )}
          {issues.length > 3 && (
            <button className="plain" disabled={locked} onClick={open}>
              {t(
                `查看全部 ${issues.length} 项`,
                `View all ${issues.length} items`,
              )}
            </button>
          )}
        </Panel>
      )}
      {(pace !== null ||
        pauseGaps !== null ||
        !!p.take?.content_feedback ||
        words.length > 0) && (
        <Panel className="coach-metrics">
          <h2>{t("其他指标", "Other metrics")}</h2>
          {pace !== null && (
            <div className="metric-evidence-row">
              <span>{t("语速", "Pace")}</span>
              <strong>
                {pace === null
                  ? t("无数据", "Unavailable")
                  : `${Math.round(pace)} WPM`}
              </strong>
            </div>
          )}
          {pauseGaps !== null && (
            <div className="metric-evidence-row">
              <span>{t("停顿", "Pauses")}</span>
              <strong>
                {pauseGaps === null
                  ? t("无数据", "Unavailable")
                  : t(
                      `${pauseGaps.length} 处估计词间隔`,
                      `${pauseGaps.length} estimated gaps`,
                    )}
              </strong>
            </div>
          )}
          {p.take?.content_feedback && (
            <CoachItem
              title={t("识别差异", "Transcript")}
              quiet={!p.take?.content_feedback}
              icon={<FileText size={19} />}
              status={
                p.take?.content_feedback
                  ? `${differences.length} ${t("处", "differences")}`
                  : t("未检查", "Unchecked")
              }
              advice={t(
                "识别差异不是发音评分。",
                "Transcript differences are not pronunciation scores.",
              )}
              disabled={locked || !p.take}
              onClick={open}
            />
          )}
          <details className="evidence-details">
            <summary>
              {t("词级结果与计算说明", "Word results and calculation details")}
            </summary>
            <WordScoreStrip words={words} lang={p.lang} />
            <PaceFeedback
              value={pace}
              disabled={locked || !p.take}
              open={open}
              lang={p.lang}
            />
            <PauseFeedback
              gaps={pauseGaps}
              duration={p.take?.duration || 0}
              disabled={locked || !p.take}
              open={open}
              lang={p.lang}
            />
            <p className="small-note">
              {t(
                "分数由评测服务提供，低分仅提示复核；不同供应商分数不直接比较。",
                "Scores come from the assessment provider. Low scores suggest review; scores are not comparable across providers.",
              )}
            </p>
          </details>
        </Panel>
      )}
      <button
        className="full-analysis plain"
        disabled={locked || !p.take}
        onClick={open}
      >
        {t("查看完整分析", "Full analysis")}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
