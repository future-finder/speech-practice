import { useEffect, useState } from "react";
import type { Recording, Pronunciation } from "./types";
import { audioTime } from "./PracticeAudio";

export function LocalFeedback({
  record,
  lang,
  play,
  locked,
  onResult,
}: {
  record: Recording;
  lang: "zh" | "en";
  play: (start: number | null, end: number | null) => void;
  locked: boolean;
  onResult?: (value: Pronunciation | undefined) => void;
}) {
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [assessment, setAssessment] = useState("");
  const [selected, setSelected] = useState("");
  const history = record.assessment_history || [];
  const result =
    history.find((r) => r.id === assessment) || record.pronunciation_feedback;
  useEffect(() => {
    onResult?.(result);
  }, [result, onResult]);
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
              {!!result.words?.length && (
                <section
                  className="word-alignment"
                  aria-label={t(
                    "词级发音结果",
                    "Word-level pronunciation results",
                  )}
                >
                  <h3>{t("词级发音", "Word-level Pronunciation")}</h3>
                  <div className="word-chips">
                    {result.words.map((word, index) => {
                      const normalized = word.word.toLowerCase().replace(/[^a-z']/g, "");
                      const issue = issues.find(i => {
                        if (i.text.toLowerCase().replace(/[^a-z']/g, "") !== normalized) return false;
                        if (typeof word.start === "number" && typeof word.end === "number" && typeof i.start === "number" && typeof i.end === "number") return i.start < word.end && i.end > word.start;
                        return ["word", "phoneme"].includes(i.localization_level) && result.words.filter(w => w.word.toLowerCase().replace(/[^a-z']/g, "") === normalized).length === 1;
                      });
                      const timed =
                        typeof word.start === "number" &&
                        typeof word.end === "number" &&
                        word.start >= 0 &&
                        word.end > word.start &&
                        word.end <= record.duration;
                      return (
                        <button
                          key={index}
                          className={`word-chip ${issue ? "has-issue" : ""} ${word.score === null ? "unscored" : ""}`}
                          disabled={locked || !timed}
                          onClick={() => play(word.start, word.end)}
                          aria-label={
                            word.word +
                            ": " +
                            (word.score === null
                              ? t("未评分", "Unscored")
                              : word.score) +
                            (timed
                              ? ""
                              : " · " +
                                t("无可靠定位", "No reliable localization"))
                          }
                        >
                          <span>{word.word}</span>
                          <small>
                            {issue
                              ? lang === "zh"
                                ? issue.problem
                                : issue.problem_en
                              : word.score === null
                                ? "—"
                                : Math.round(word.score)}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                  <p className="small-note">
                    {t(
                      "点击有时间定位的单词回放录音。",
                      "Click a timed word to replay the recording.",
                    )}
                  </p>
                </section>
              )}
              <div
                className="issue-timeline"
                aria-label={t("问题时间轴", "Issue timeline")}
              >
                <span className="timeline-label">0:00</span>
                <div className="timeline-track">
                  {issues
                    .filter(
                      (i) =>
                        i.start !== null &&
                        i.end !== null &&
                        i.start >= 0 &&
                        i.end > i.start &&
                        i.end <= record.duration,
                    )
                    .map((i) => (
                      <button
                        key={i.id}
                        disabled={locked}
                        title={i.text}
                        aria-label={`${t("回放", "Replay")} ${i.text}`}
                        style={{
                          left: `${(i.start! / record.duration) * 100}%`,
                          width: `${Math.max(1, ((i.end! - i.start!) / record.duration) * 100)}%`,
                        }}
                        onClick={() => play(i.start, i.end)}
                      />
                    ))}
                </div>
                <span className="timeline-label">
                  {audioTime(record.duration)}
                </span>
              </div>
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
              <details className="pa-scores">
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
