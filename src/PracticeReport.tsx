import { ArrowRight } from "lucide-react";
import { audioTime } from "./PracticeAudio";
import type { WorkspaceProps } from "./Workspace";
export function Report({ p }: { p: WorkspaceProps }) {
  const t = (zh: string, en: string) => (p.lang === "zh" ? zh : en);
  const sentences = p.session!.sentences || [];
  const latest = sentences.map(
    (s) =>
      [...p.recordings]
        .filter((r) => r.sentence_id === s.id)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0],
  );
  const covered = latest.filter(Boolean).length;
  return (
    <section className="document-page report-page">
      <header className="document-heading">
        <div>
          <small>{t("练习总结", "Practice summary")}</small>
          <h1>{p.session!.title}</h1>
        </div>
        <button onClick={() => window.print()}>
          {t("打印报告", "Print report")}
        </button>
      </header>
      <div className="report-meta">
        <span>
          {t("已录音", "Recorded")}{" "}
          <b>
            {covered} / {sentences.length}
          </b>
        </span>
        <span>
          {t("录音总数", "Total takes")} <b>{p.recordings.length}</b>
        </span>
        <span>
          {t("已有分析", "Analyzed")}{" "}
          <b>
            {
              latest.filter(
                (r) =>
                  r?.content_feedback ||
                  r?.pronunciation_feedback?.status === "success",
              ).length
            }
          </b>
        </span>
      </div>
      <p className="report-note">
        {t(
          "以下仅整理每句最新录音及其反馈。识别差异需回听复核，供应商评分不作跨服务汇总。",
          "The report uses the latest recording and feedback for each sentence. Review transcript differences by listening; provider scores are not combined.",
        )}
      </p>
      <h2>{t("逐句记录", "Sentence records")}</h2>
      <div className="report-rows">
        {sentences.map((s, i) => {
          const r = latest[i],
            result = r?.pronunciation_feedback;
          const differences = r?.content_feedback?.differences.filter(
            (d) => d.type !== "match",
          ).length;
          return (
            <article key={s.id}>
              <span className="sentence-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="report-sentence">{s.spoken_text}</p>
                {r ? (
                  <>
                    <p className="muted">
                      {new Date(r.created_at).toLocaleString(
                        p.lang === "zh" ? "zh-CN" : "en-US",
                      )}{" "}
                      · {audioTime(r.duration)} · v{r.sentence_version}
                      {r.sentence_version !== s.version
                        ? ` · ${t("稿件已修改", "Script changed")}`
                        : ""}
                    </p>
                    <p>
                      {r.content_feedback?.transcript.uncertain
                        ? t(
                            "识别可信度不足，需回听复核",
                            "Recognition is uncertain; listen to review",
                          )
                        : differences !== undefined
                          ? `${differences} ${t("处识别差异", "transcript differences")}`
                          : t("未检查识别差异", "Transcript not checked")}
                      {" · "}
                      {result
                        ? `${result.provider || ""}${result.provider_version ? ` · ${result.provider_version}` : ""} · ${result.status === "success" ? t("评测完成", "Assessment complete") : t("评测未完成", "Assessment incomplete")}`
                        : t("未评测", "Not assessed")}
                    </p>
                    {result?.status === "success" &&
                      !!result.issues?.length && (
                        <ul>
                          {result.issues.map((issue) => (
                            <li key={issue.id}>
                              <strong>{issue.text}</strong> —{" "}
                              {p.lang === "zh"
                                ? issue.problem
                                : issue.problem_en}
                            </li>
                          ))}
                        </ul>
                      )}
                  </>
                ) : (
                  <p className="muted">{t("尚未录音", "Not recorded")}</p>
                )}
              </div>
              <button
                onClick={() => {
                  p.selectSentence(s.id);
                  p.selectRecording(r?.id || "");
                  p.navigate(r ? "analysis" : "practice");
                }}
              >
                {r ? t("查看分析", "View analysis") : t("开始练习", "Practice")}
                <ArrowRight size={16} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
