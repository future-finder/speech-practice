import { useEffect, useState } from "react";
import {
  AudioLines,
  ChevronRight,
  Clock3,
  Flame,
  Mic,
  Target,
  Trophy,
} from "lucide-react";
import {
  MetricCard,
  Panel,
  ProgressRing,
  SegmentedControl,
  StatusBadge,
} from "./DesignSystem";
import { audioTime } from "./PracticeAudio";
import {
  localDay,
  practiceStats,
  recordingScore,
  type ActivityData,
} from "./practiceData";
import type { WorkspaceProps } from "./Workspace";

export function ActivityPage({ p }: { p: WorkspaceProps }) {
  const t = (zh: string, en: string) => (p.lang === "zh" ? zh : en);
  const [data, setData] = useState<ActivityData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState("");
  const [measure, setMeasure] = useState<"minutes" | "takes">("minutes");
  const [goal, setGoal] = useState<number | null>(() => {
    const saved = Number(localStorage.getItem("speech-weekly-goal"));
    return Number.isInteger(saved) && saved > 0 && saved <= 10080
      ? saved
      : null;
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goal || 30));
  const [goalError, setGoalError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void p
      .loadActivity()
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            t(
              "无法加载练习记录，请重试。",
              "Could not load practice records. Retry.",
            ),
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [p.loadActivity, retry]);
  const stats = practiceStats(data?.speeches || []);
  const partial = !!data?.failed.length;
  const number = (n: number) =>
    n.toLocaleString(p.lang === "zh" ? "zh-CN" : "en-US", {
      maximumFractionDigits: 1,
    });
  const rows = stats.rows.filter((r) => !filter || r.session.id === filter);
  const recent = stats.rows
    .filter(
      (r, i, all) => all.findIndex((x) => x.session.id === r.session.id) === i,
    )
    .slice(0, 4);
  const peak = Math.max(
    1,
    ...stats.days.map((d) => (measure === "minutes" ? d.minutes : d.count)),
  );
  const viewRecord = (row: (typeof rows)[number]) =>
    p.openRecording(row.session, row.recording);
  const recentRows = (
    <div className="recent-rows">
      {recent.length ? (
        recent.map((row) => (
          <button key={row.recording.id} onClick={() => viewRecord(row)}>
            <span className="recent-icon">
              <AudioLines size={23} />
            </span>
            <span className="record-copy">
              <strong>{row.session.title}</strong>
              <small>
                {new Date(row.recording.created_at).toLocaleDateString(
                  p.lang === "zh" ? "zh-CN" : "en-US",
                )}{" "}
                · {audioTime(row.recording.duration)}
              </small>
            </span>
            <ChevronRight size={18} />
          </button>
        ))
      ) : (
        <p className="empty-inline">
          {t(
            "暂无录音。进入练习页开始录音。",
            "No recordings yet. Start recording in Practice.",
          )}
        </p>
      )}
    </div>
  );
  return (
    <section className={`document-page activity-page ${p.view}-page`}>
      <header className="document-heading">
        <h1>
          {p.view === "progress"
            ? t("练习进度", "Your Progress")
            : t("练习记录", "Sessions")}
        </h1>
        {p.view === "progress" ? (
          <span className="period-label">
            {t("本周", "This week")} ·{" "}
            {stats.days[0].date.toLocaleDateString(
              p.lang === "zh" ? "zh-CN" : "en-US",
              { month: "short", day: "numeric" },
            )}
          </span>
        ) : (
          <select
            aria-label={t("筛选稿件", "Filter speeches")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">{t("所有稿件", "All speeches")}</option>
            {p.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        )}
      </header>
      {loading ? (
        <p role="status" className="empty-inline">
          {t("正在加载练习记录…", "Loading practice records…")}
        </p>
      ) : (
        <>
          {(error || partial) && (
            <div className="activity-warning" role="alert">
              <span>
                {error ||
                  t(
                    `有 ${data!.failed.length} 篇稿件加载失败，以下仅为已加载数据。`,
                    `${data!.failed.length} speeches could not be loaded. Showing partial data.`,
                  )}
              </span>
              <button onClick={() => setRetry((v) => v + 1)}>
                {t("重试", "Retry")}
              </button>
            </div>
          )}
          {p.view === "sessions" ? (
            <Panel className="sessions-list">
              {!rows.length ? (
                <p className="empty-inline">
                  {t("暂无录音记录。", "No recordings yet.")}
                </p>
              ) : (
                rows.map((row, i) => {
                  const date = localDay(new Date(row.recording.created_at));
                  const score = recordingScore(row.recording);
                  return (
                    <div key={row.recording.id}>
                      {(i === 0 ||
                        date !==
                          localDay(
                            new Date(rows[i - 1].recording.created_at),
                          )) && (
                        <h2 className="date-heading">
                          {new Date(
                            row.recording.created_at,
                          ).toLocaleDateString(
                            p.lang === "zh" ? "zh-CN" : "en-US",
                            { year: "numeric", month: "long", day: "numeric" },
                          )}
                        </h2>
                      )}
                      <button
                        className="session-row"
                        onClick={() => viewRecord(row)}
                      >
                        <span className="recent-icon">
                          <Mic size={20} />
                        </span>
                        <span className="record-copy">
                          <strong>{row.session.title}</strong>
                          <span>{row.recording.spoken_text}</span>
                          <small>
                            {new Date(
                              row.recording.created_at,
                            ).toLocaleTimeString(
                              p.lang === "zh" ? "zh-CN" : "en-US",
                              { hour: "2-digit", minute: "2-digit" },
                            )}{" "}
                            · {audioTime(row.recording.duration)} · v
                            {row.recording.sentence_version}
                          </small>
                        </span>
                        <StatusBadge tone={score === null ? "neutral" : "blue"}>
                          {score === null
                            ? t("未评分", "Unscored")
                            : Math.round(score)}
                        </StatusBadge>
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  );
                })
              )}
            </Panel>
          ) : (
            <>
              <div className="progress-metrics">
                <Panel className="weekly-goal">
                  {goal && (
                    <ProgressRing
                      value={(stats.weeklyMinutes / goal) * 100}
                      label={`${t("周目标", "Weekly goal")} ${number(stats.weeklyMinutes)} / ${goal} ${t("分钟", "minutes")}`}
                    />
                  )}
                  <div>
                    <h2>{t("每周录音目标", "Weekly Goal")}</h2>
                    <p className="goal-value">
                      {number(stats.weeklyMinutes)}
                      {goal ? ` / ${goal}` : ""}{" "}
                      <small>{t("分钟", "minutes")}</small>
                    </p>
                    <button
                      className="plain"
                      onClick={() => {
                        setEditing(true);
                        setGoalError("");
                      }}
                    >
                      {goal
                        ? t("调整目标", "Edit goal")
                        : t("设置目标", "Set goal")}
                    </button>
                  </div>
                  {editing && (
                    <form
                      className="goal-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const n = Number(draft);
                        if (!Number.isInteger(n) || n < 1 || n > 10080) {
                          setGoalError(
                            t(
                              "请输入 1–10080 的整数分钟。",
                              "Enter 1–10080 whole minutes.",
                            ),
                          );
                          return;
                        }
                        try {
                          localStorage.setItem("speech-weekly-goal", String(n));
                          setGoal(n);
                          setEditing(false);
                        } catch {
                          setGoalError(
                            t(
                              "无法保存目标，请重试。",
                              "Could not save the goal. Retry.",
                            ),
                          );
                        }
                      }}
                    >
                      <label>
                        {t("每周分钟数", "Weekly minutes")}
                        <input
                          autoFocus
                          type="number"
                          min="1"
                          max="10080"
                          step="1"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                        />
                      </label>
                      <button className="primary" type="submit">
                        {t("保存", "Save")}
                      </button>
                      <button type="button" onClick={() => setEditing(false)}>
                        {t("取消", "Cancel")}
                      </button>
                      {goalError && <p role="alert">{goalError}</p>}
                    </form>
                  )}
                </Panel>
                <MetricCard
                  title={t("连续录音", "Day Streak")}
                  value={stats.streak}
                  unit={t("天", "days")}
                  icon={<Flame size={28} />}
                  tone="warning"
                />
                <MetricCard
                  title={t("已逐句录音稿件", "Speeches Recorded")}
                  value={stats.completed}
                  unit={`/ ${p.sessions.length}`}
                  icon={<Target size={28} />}
                  tone="violet"
                  detail={t(
                    "每句均有当前版本录音",
                    "Each sentence has a current-version take",
                  )}
                />
              </div>
              <div className="progress-grid">
                <div className="progress-primary">
                  <Panel className="activity-chart">
                    <div className="section-heading">
                      <h2>{t("练习活动", "Practice Activity")}</h2>
                      <SegmentedControl
                        label={t("活动指标", "Activity measure")}
                        value={measure}
                        options={[
                          { value: "minutes", label: t("分钟", "Minutes") },
                          { value: "takes", label: t("录音次数", "Takes") },
                        ]}
                        onChange={setMeasure}
                      />
                    </div>
                    <div className="chart-axis" aria-hidden="true">
                      <span>{number(peak)}</span>
                      <span>{number(peak / 2)}</span>
                      <span>0</span>
                    </div>
                    <div className="activity-bars">
                      {stats.days.map((d) => {
                        const value =
                          measure === "minutes" ? d.minutes : d.count;
                        return (
                          <div
                            className={`activity-day ${d.dateKey === localDay(new Date()) ? "today" : ""}`}
                            key={d.dateKey}
                          >
                            <span className="bar-number">{number(value)}</span>
                            <div className="bar-track">
                              <span
                                className="activity-bar"
                                style={{ height: `${(value / peak) * 100}%` }}
                              />
                            </div>
                            <span>
                              {d.date.toLocaleDateString(
                                p.lang === "zh" ? "zh-CN" : "en-US",
                                { weekday: "short" },
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                  <Panel className="recent-panel">
                    <div className="section-heading">
                      <h2>{t("最近练习", "Recently Practiced")}</h2>
                      <button
                        className="plain"
                        onClick={() => p.navigate("sessions")}
                      >
                        {t("所有记录", "All sessions")}
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    {recentRows}
                  </Panel>
                </div>
                <Panel className="milestone-panel">
                  <h2>{t("里程碑", "Milestones")}</h2>
                  {[
                    {
                      title: t("首次录音", "First Recording"),
                      tone: "positive",
                      value: Math.min(1, stats.rows.length),
                      max: 1,
                      icon: <Mic size={22} />,
                    },
                    {
                      title: t("累计录音 100 分钟", "100 Recorded Minutes"),
                      tone: "violet",
                      value: stats.totalMinutes,
                      max: 100,
                      icon: <Clock3 size={22} />,
                    },
                    {
                      title: t("连续录音 7 天", "7-Day Streak"),
                      tone: "warning",
                      value: stats.streak,
                      max: 7,
                      icon: <Flame size={22} />,
                    },
                    {
                      title: t("逐句录音 5 篇稿件", "5 Speeches Recorded"),
                      tone: "blue",
                      value: stats.completed,
                      max: 5,
                      icon: <Trophy size={22} />,
                    },
                  ].map((item) => (
                    <div
                      className={`milestone tone-${item.tone}`}
                      key={item.title}
                    >
                      <span className="milestone-icon">{item.icon}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <div className="milestone-progress">
                          <progress
                            value={Math.min(item.value, item.max)}
                            max={item.max}
                          />
                          <small>
                            {number(Math.min(item.value, item.max))} /{" "}
                            {item.max}
                          </small>
                        </div>
                      </div>
                    </div>
                  ))}
                </Panel>
              </div>
              <p className="statistics-note">
                {t(
                  "时长统计已保存的录音，包含重录；删除录音后会更新。",
                  "Minutes include saved takes and retakes, and update after deletion.",
                )}
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
