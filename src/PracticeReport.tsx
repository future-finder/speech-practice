import { ArrowRight } from "lucide-react";
import { AudioLines, Gauge, Clock3, Mic, ChevronRight } from "lucide-react";
import { ProgressRing, MetricCard, Panel, StatusBadge } from "./DesignSystem";
import { paceObservation, recordingScore } from "./practiceData";
import { Waveform } from "./Waveform";
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
  const selectedScore = recordingScore(p.take);
  const pace = paceObservation(p.take);
  const measured = latest
    .map((r, i) => ({ r, i, pace: paceObservation(r) }))
    .filter((x) => x.pace !== null);
  return (
    <section className="document-page report-page">
      <header className="document-heading">
        <div>
          <h1>{t("练习报告", "Session Report")}</h1>
          <p>{p.session!.title}</p>
        </div>
        <button onClick={() => window.print()}>
          {t("打印报告", "Print report")}
        </button>
      </header>
      <div className="report-layout">
        <div className="report-primary">
          <div className="report-metrics">
            <Panel className="report-score">
              <div>
                {selectedScore === null ? (
                  <div className="pending-ring">
                    <strong>—</strong>
                  </div>
                ) : (
                  <ProgressRing
                    value={selectedScore}
                    tone="positive"
                    suffix=""
                    label={`${selectedScore}/100`}
                  />
                )}
              </div>
              <div>
                <h2>{t("所选录音发音评分", "Selected Take Score")}</h2>
                <p>
                  {p.take?.pronunciation_feedback?.provider ||
                    t("未评测", "Not assessed")}
                </p>
                <small>
                  {t(
                    "不跨供应商汇总分数。",
                    "Provider scores are not combined.",
                  )}
                </small>
              </div>
            </Panel>
            <MetricCard
              title={t("识别词速", "Pace")}
              value={pace === null ? "—" : Math.round(pace)}
              unit={pace === null ? "" : "WPM"}
              icon={<Gauge size={24} />}
              tone="blue"
            />
            <MetricCard
              title={t("录音时长", "Duration")}
              value={p.take ? audioTime(p.take.duration) : "—"}
              tone="violet"
              icon={<Clock3 size={24} />}
            />
          </div>
          <Panel className="report-heatmap">
            <div className="section-heading">
              <div>
                <h2>{t("所选录音波形", "Recording Waveform")}</h2>
                <p className="small-note">
                  {t(
                    "打开分析页可回听标记片段。",
                    "Open Analysis to replay marked segments.",
                  )}
                </p>
              </div>
              <button
                className="plain"
                disabled={!p.take}
                onClick={() => p.navigate("analysis")}
              >
                {t("查看分析", "Analysis")}
                <ChevronRight size={17} />
              </button>
            </div>
            <Waveform
              src={p.take ? p.audioUrl(p.take.asset_id) : ""}
              source="own"
              position={0}
              duration={p.take?.duration || 0}
              disabled
              label={t("录音波形", "Recording waveform")}
              onSeek={() => {}}
            />
          </Panel>
          <Panel className="report-pacing">
            <div className="section-heading">
              <h2>{t("逐句语速", "Pacing Analysis")}</h2>
              <span className="small-note">WPM</span>
            </div>
            <div className="report-pace-chart">
              {measured.length ? (
                <svg
                  viewBox="-35 0 825 124"
                  role="img"
                  aria-label={t(
                    "有识别词速的句子",
                    "Sentences with recognized pace",
                  )}
                >
                  {[40, 100, 160, 220].map((value) => (
                    <g key={value}>
                      <line
                        x1="0"
                        x2="780"
                        y1={100 - (value / 260) * 90}
                        y2={100 - (value / 260) * 90}
                        stroke="#e7edf6"
                      />
                      <text
                        x="-8"
                        y={104 - (value / 260) * 90}
                        textAnchor="end"
                        fontSize="11"
                        fill="#7a88a5"
                      >
                        {value}
                      </text>
                    </g>
                  ))}
                  <rect
                    x="0"
                    y={100 - (160 / 260) * 90}
                    width="780"
                    height={(20 / 260) * 90}
                    fill="#e5efff"
                  />
                  <polyline
                    fill="none"
                    stroke="#096cff"
                    strokeWidth="2"
                    points={measured
                      .map(
                        (x, i) =>
                          `${measured.length === 1 ? 390 : (i / (measured.length - 1)) * 760 + 10},${100 - (Math.min(260, x.pace!) / 260) * 90}`,
                      )
                      .join(" ")}
                  />
                  {measured.map((x, i) => (
                    <g key={x.i}>
                      <circle
                        cx={
                          measured.length === 1
                            ? 390
                            : (i / (measured.length - 1)) * 760 + 10
                        }
                        cy={100 - (Math.min(260, x.pace!) / 260) * 90}
                        r="3"
                        fill="#096cff"
                      />
                      <text
                        x={
                          measured.length === 1
                            ? 390
                            : (i / (measured.length - 1)) * 760 + 10
                        }
                        y="118"
                        textAnchor="middle"
                        fontSize="11"
                        fill="#7a88a5"
                      >
                        {x.i + 1}
                      </text>
                    </g>
                  ))}
                </svg>
              ) : (
                <p className="empty-inline">
                  {t(
                    "完成录音识别后显示逐句词速。",
                    "Check transcripts to display measured sentence pace.",
                  )}
                </p>
              )}
            </div>
          </Panel>
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
                    {r
                      ? t("查看分析", "View analysis")
                      : t("开始练习", "Practice")}
                    <ArrowRight size={16} />
                  </button>
                </article>
              );
            })}
          </div>
        </div>
        <aside className="report-rail">
          <div className="segmented-control">
            <button onClick={() => p.navigate("practice")}>
              {t("教练", "Coach")}
            </button>
            <button aria-selected="true" onClick={() => p.navigate("analysis")}>
              {t("分析", "Analysis")}
            </button>
            <button onClick={() => p.navigate("analysis")}>
              {t("识别文本", "Transcript")}
            </button>
          </div>
          <Panel>
            <div className="section-heading">
              <h2>{t("练习概况", "Practice Summary")}</h2>
            </div>
            <p>
              {covered} / {sentences.length}{" "}
              {t("句已有录音", "sentences recorded")}
            </p>
            <p className="small-note">
              {p.recordings.length}{" "}
              {t(
                "条已保存录音；每句使用最新录音。",
                "saved takes; the report uses the latest recording for each sentence.",
              )}
            </p>
          </Panel>
          <Panel>
            <h2>{t("待复核项", "Review Items")}</h2>
            {latest.flatMap((r, i) =>
              (r?.pronunciation_feedback?.status === "success"
                ? r.pronunciation_feedback.issues || []
                : []
              )
                .slice(0, 2)
                .map((issue) => (
                  <button
                    className="report-review"
                    key={`${i}-${issue.id}`}
                    onClick={() => {
                      p.selectSentence(sentences[i].id);
                      p.selectRecording(r.id);
                      p.navigate("analysis");
                    }}
                  >
                    <span className="coach-icon tone-violet">
                      <AudioLines size={25} />
                    </span>
                    <span>
                      <strong>{issue.text}</strong>
                      <p>
                        {p.lang === "zh" ? issue.problem : issue.problem_en}
                      </p>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                )),
            )}
            {!latest.some((r) => r?.pronunciation_feedback?.issues?.length) && (
              <p className="empty-inline">
                {t("暂无评测复核项。", "No assessed review items available.")}
              </p>
            )}
          </Panel>
          <Panel>
            <h2>{t("下一步", "Next Steps")}</h2>
            <button
              className="report-review"
              onClick={() => p.navigate("practice")}
            >
              <span className="coach-icon tone-blue">
                <Mic size={24} />
              </span>
              <span>{t("练习当前句", "Practice the current sentence")}</span>
              <ChevronRight size={17} />
            </button>
            <button
              className="report-review"
              onClick={() => p.navigate("sessions")}
            >
              <span className="coach-icon tone-violet">
                <Clock3 size={24} />
              </span>
              <span>{t("查看录音记录", "Review saved takes")}</span>
              <ChevronRight size={17} />
            </button>
          </Panel>
        </aside>
      </div>
    </section>
  );
}
