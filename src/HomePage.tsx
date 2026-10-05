import { useEffect, useState } from "react";
import {
  FileText,
  Mic,
  BookOpen,
  ChevronRight,
  Flame,
  Lightbulb,
  AudioLines,
  Star,
  Settings2,
  Target,
} from "lucide-react";
import { ProgressRing } from "./DesignSystem";
import {
  practiceStats,
  recordingScore,
  type ActivityData,
} from "./practiceData";
import type { WorkspaceProps } from "./Workspace";
import { speechCover } from "./coverAssets";

export function HomePage({ p }: { p: WorkspaceProps }) {
  const t = (zh: string, en: string) => (p.lang === "zh" ? zh : en);
  const [activity, setActivity] = useState<ActivityData>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    p.loadActivity()
      .then((v) => {
        if (active) setActivity(v);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [p.loadActivity]);
  const stats = practiceStats(activity?.speeches || []);
  const goal = Number(localStorage.getItem("speech-weekly-goal")) || 0;
  const recent =
    activity?.speeches.filter((s) => s.recordings.length).slice(0, 3) || [];
  return (
    <section className="home-page">
      <div className="home-main">
        <header className="home-hero">
          <img src="./assets/convergence/home-hero.png" alt="" />
          <div>
            <h1>{t("开始口语练习", "Ready to practice?")}</h1>
            <p>
              {t(
                "新建稿件，或继续已有的逐句练习。",
                "Start from a script or continue your sentence practice.",
              )}
            </p>
          </div>
        </header>
        <div className="home-start">
          <button className="home-action tone-blue" onClick={p.newSpeech}>
            <span className="coach-icon">
              <FileText size={27} />
            </span>
            <h2>{t("从稿件开始", "Start from Script")}</h2>
            <p>
              {t(
                "粘贴英文稿件，编辑分句与示范语音。",
                "Practice with your own text and example voices.",
              )}
            </p>
            <span className="action-arrow">
              <ChevronRight size={22} />
            </span>
            <img
              src="./assets/convergence/entry-script.png"
              className="entry-art"
              alt=""
            />
          </button>
          <button
            className="home-action tone-warning"
            onClick={() => (p.session ? p.navigate("practice") : p.newSpeech())}
          >
            <span className="coach-icon">
              <Mic size={27} />
            </span>
            <h2>{t("录音练习", "Record a Sentence")}</h2>
            <p>
              {t(
                "录音并回听当前练习句。",
                "Record and listen back to the current sentence.",
              )}
            </p>
            <span className="action-arrow">
              <ChevronRight size={22} />
            </span>
            <img
              src="./assets/convergence/entry-record.png"
              className="entry-art"
              alt=""
            />
          </button>
          <button
            className="home-action tone-violet"
            onClick={() => p.navigate("library")}
          >
            <span className="coach-icon">
              <BookOpen size={27} />
            </span>
            <h2>{t("打开稿件库", "Speech Collection")}</h2>
            <p>
              {t(
                "浏览已保存的稿件，查看练习与分析。",
                "Browse saved speeches and their practice results.",
              )}
            </p>
            <span className="action-arrow">
              <ChevronRight size={22} />
            </span>
            <img
              src="./assets/convergence/entry-collection.png"
              className="entry-art"
              alt=""
            />
          </button>
        </div>
        <div className="section-heading">
          <h2>{t("继续练习", "Continue Practicing")}</h2>
          <button className="plain" onClick={() => p.navigate("library")}>
            {t("查看全部", "See All")}
          </button>
        </div>
        <div className="home-recents">
          {(recent.length
            ? recent.map((s) => s.session)
            : p.sessions.slice(0, 3)
          ).map((s) => {
            const take = recent.find((r) => r.session.id === s.id)
              ?.recordings[0];
            const score = recordingScore(take);
            return (
              <button
                key={s.id}
                onClick={() => {
                  p.openSession(s);
                  p.navigate("practice");
                }}
              >
                <img src={speechCover(s.title)} alt="" />
                <div>
                  <strong>{s.title}</strong>
                  <small>
                    {s.sentence_ids.length}{" "}
                    {t("个练习句", "practice sentences")}
                  </small>
                </div>
                {score !== null && (
                  <ProgressRing
                    value={score}
                    tone="positive"
                    suffix=""
                    label={`${score}/100`}
                  />
                )}
                <ChevronRight size={20} />
              </button>
            );
          })}
        </div>
        {!p.sessions.length && (
          <p className="empty-inline">
            {t(
              "暂无稿件。选择“从稿件开始”新建。",
              "No speeches yet. Choose Start from Script to create one.",
            )}
          </p>
        )}
        <div className="home-bottom">
          <AudioLines size={24} />
          <div>
            <h2>{t("最近录音", "Recording Activity")}</h2>
            <p>
              {activity
                ? t(
                    `已保存 ${stats.rows.length} 条录音，总时长 ${stats.totalMinutes.toFixed(1)} 分钟。`,
                    `${stats.rows.length} saved takes · ${stats.totalMinutes.toFixed(1)} recorded minutes.`,
                  )
                : t("正在加载…", "Loading…")}
            </p>
          </div>
          <button className="plain" onClick={() => p.navigate("sessions")}>
            {t("练习记录", "Sessions")}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <aside className="home-rail">
        <div className="home-options">
          <button onClick={() => p.navigate("settings")}>
            <Settings2 size={17} />
            {t("设置", "Options")}
          </button>
          <span>
            {new Date().toLocaleDateString(
              p.lang === "zh" ? "zh-CN" : "en-US",
              { month: "short", day: "numeric" },
            )}
          </span>
        </div>
        <section className="surface-panel home-goal">
          <div className="section-heading">
            <h2>{t("每周目标", "Weekly Goal")}</h2>
            <button
              aria-label={t("调整目标", "Edit goal")}
              onClick={() => p.navigate("progress")}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <ProgressRing
            value={goal ? Math.min(100, (stats.weeklyMinutes / goal) * 100) : 0}
            label={t("每周目标进度", "Weekly goal progress")}
          />
          <p>
            {stats.weeklyMinutes.toFixed(1)}
            {goal ? ` / ${goal}` : ""} {t("分钟", "minutes")}
          </p>
          <button
            className="goal-callout"
            onClick={() => p.navigate("progress")}
          >
            <Target size={27} />
            {goal
              ? t("查看练习进度", "View your progress")
              : t("设置每周目标", "Set a weekly goal")}
          </button>
        </section>
        <section className="surface-panel home-streak tone-warning">
          <span className="coach-icon">
            <Flame size={30} />
          </span>
          <div>
            <strong>{stats.streak}</strong>
            <h2>{t("连续录音天数", "Day Streak")}</h2>
          </div>
        </section>
        <section className="surface-panel home-tips">
          <h2>{t("练习提示", "Practice Tips")}</h2>
          {[
            [
              Lightbulb,
              "warning",
              t("停顿与语速", "Breathe and pace"),
              t(
                "在意群结束处自然停顿。",
                "Pause naturally after each key idea.",
              ),
            ],
            [
              AudioLines,
              "violet",
              t("回听关键短语", "Replay key phrases"),
              t(
                "先听示范，再比较自己的录音。",
                "Listen to an example, then compare your take.",
              ),
            ],
            [
              Star,
              "issue",
              t("一次调整一处", "Focus on one phrase"),
              t(
                "重录后检查是否有所改善。",
                "Record again and check the change.",
              ),
            ],
          ].map(([Icon, tone, title, copy], i) => {
            const I = Icon as typeof Star;
            return (
              <div className={`tip-row tone-${tone}`} key={i}>
                <span className="coach-icon">
                  <I size={25} />
                </span>
                <div>
                  <strong>{title as string}</strong>
                  <p>{copy as string}</p>
                </div>
              </div>
            );
          })}
        </section>
        {(error || !!activity?.failed.length) && (
          <p className="small-note" role="alert">
            {t(
              "部分记录加载失败，统计可能不完整。",
              "Some records could not load; totals may be incomplete.",
            )}
          </p>
        )}
      </aside>
    </section>
  );
}
