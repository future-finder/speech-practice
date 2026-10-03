import { useEffect, useState } from "react";
import type { Recording } from "./types";

export function FeedbackPanel({
  record,
  lang,
  play,
}: {
  record: Recording;
  lang: "zh" | "en";
  play: (start: number | null, end: number | null) => void;
}) {
  const [selected, select] = useState("");
  useEffect(() => select(""), [record.id, record.pronunciation_feedback?.id]);
  const history = record.assessment_history || [];
  const result =
    history.find((x) => x.id === selected) || record.pronunciation_feedback;
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const labels: Record<string, string[]> = {
    pronunciation: ["发音评分", "Pronunciation"],
    fluency: ["流利度", "Fluency"],
    completeness: ["完整度", "Completeness"],
    provider_suggested: ["供应商建议评分", "Provider suggested score"],
    prosody: ["韵律", "Prosody"],
    intelligibility: ["可理解度", "Intelligibility"],
    expressiveness: ["表达力", "Expressiveness"],
    five_dimension_overall: ["五维综合分", "Five-dimension overall"],
  };
  if (!result) return null;
  const error =
    typeof result.error === "object"
      ? JSON.stringify(result.error)
      : result.error;
  return (
    <section className="feedback assessment-panel">
      <h3>{t("发音评测", "Pronunciation assessment")}</h3>
      {!!history.length && (
        <label>
          {t("评测历史", "Assessment history")}{" "}
          <select value={selected} onChange={(e) => select(e.target.value)}>
            <option value="">{t("最新结果", "Latest result")}</option>
            {history.map((r, i) => (
              <option key={r.id || i} value={r.id}>
                {r.created_at} · {r.provider} · {r.status}
              </option>
            ))}
          </select>
        </label>
      )}
      <p>
        {result.provider} · {result.provider_version} · {result.status}
      </p>
      {result.status !== "success" && (
        <p className="uncertain">
          {t("评测未完成：", "Assessment incomplete: ")}
          {error || result.status}
        </p>
      )}
      <div className="score-grid">
        {Object.entries(result.scores || {}).map(([key, score]) => (
          <div className="score-card" key={key}>
            <b>{labels[key]?.[lang === "zh" ? 0 : 1] || key}</b>
            <strong>
              {score.value === null
                ? "—"
                : Math.round(score.value * 1000) / 1000}
              <small> / {score.raw_scale?.[1]}</small>
            </strong>
            <small>
              {score.status} · {score.source} ·{" "}
              {score.source_field || t("未提供评分依据", "No score source")}
            </small>
            <small>
              {score.conversion}
              {score.reason ? " · " + score.reason : ""}
            </small>
          </div>
        ))}
      </div>
      <p className="muted">
        {t(
          "不同供应商分数不直接比较；完整度不代表可理解度。低分仅提示复核，一般发音建议不是错误原因诊断。",
          "Scores are not comparable across providers. Completeness is not intelligibility. Low scores suggest review; general tips do not diagnose the cause.",
        )}
      </p>
      <div
        className="issue-timeline"
        aria-label={t("问题时间轴", "Issue timeline")}
      >
        {(result.issues || [])
          .filter((i) => i.start !== null && i.end !== null)
          .map((i) => (
            <button
              title={`${i.text} · ${i.severity}`}
              key={i.id}
              className={`issue-marker ${i.severity}`}
              style={{
                left: `${(i.start! / record.duration) * 100}%`,
                width: `${Math.max(0.8, ((i.end! - i.start!) / record.duration) * 100)}%`,
              }}
              onClick={() => play(i.start, i.end)}
              aria-label={`${i.text} ${i.severity}`}
            />
          ))}
      </div>
      <div className="issue-list">
        {!(result.issues || []).length && (
          <p>{t("暂无可用练习项。", "No practice items available.")}</p>
        )}
        {(result.issues || []).map((i) => (
          <article className={`issue ${i.severity}`} key={i.id}>
            <b>
              {t(
                { minor: "轻微", moderate: "中等", major: "重点" }[
                  i.severity
                ] || i.severity,
                i.severity,
              )}{" "}
              · {i.text}
            </b>
            <p>{lang === "zh" ? i.problem : i.problem_en}</p>
            <p>
              {t("一般练习建议：", "General practice tip: ")}
              {lang === "zh" ? i.advice : i.advice_en}
            </p>
            <button
              className="secondary"
              disabled={i.start === null || i.end === null}
              onClick={() => play(i.start, i.end)}
            >
              {t("回放片段", "Replay segment")} · {i.localization_level}{" "}
              {i.start?.toFixed(2)}–{i.end?.toFixed(2)} s
            </button>
            <small>
              {i.source} ·{" "}
              {i.time_source || t("无可靠定位", "No reliable localization")}
            </small>
          </article>
        ))}
      </div>
      <details>
        <summary>{t("原始评测结果", "Raw assessment result")}</summary>
        <pre>{JSON.stringify(result.raw_provider_result, null, 2)}</pre>
      </details>
    </section>
  );
}
