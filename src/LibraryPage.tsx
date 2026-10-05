import { useState } from "react";
import {
  Search,
  Plus,
  ChevronRight,
  FileText,
  Play,
  ChartNoAxesColumn,
  Clock3,
  BookOpen,
} from "lucide-react";
import type { WorkspaceProps } from "./Workspace";
import { ProgressRing } from "./DesignSystem";
import { recordingScore } from "./practiceData";
import { speechCover } from "./coverAssets";

export function LibraryPage({ p }: { p: WorkspaceProps }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(
    p.session?.id || p.sessions[0]?.id || "",
  );
  const t = (zh: string, en: string) => (p.lang === "zh" ? zh : en);
  const items = p.sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase()),
  );
  const speech =
    p.session?.id === selected
      ? p.session
      : p.sessions.find((s) => s.id === selected) || items[0];
  const locked = p.recording || p.uploading || p.preparing;
  const score = speech?.id === p.session?.id ? recordingScore(p.take) : null;
  const open = (analysis = false) => {
    if (!speech) return;
    p.openSession(speech);
    p.navigate(analysis ? "analysis" : "practice");
  };
  return (
    <section className="collection-page">
      <div className="collection-main">
        <header className="document-heading">
          <div>
            <h1>{t("稿件库", "Speech Collection")}</h1>
            <p>
              {t(
                "已保存的稿件与逐句练习。",
                "Your saved speeches and sentence practice.",
              )}
            </p>
          </div>
          <label className="collection-search">
            <Search size={19} />
            <input
              aria-label={t("搜索稿件", "Search speeches")}
              placeholder={t("搜索稿件…", "Search speeches…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </header>
        <div className="collection-toolbar">
          <span>
            {t("全部稿件", "All speeches")} <small>{p.sessions.length}</small>
          </span>
          <button disabled={locked} onClick={p.newSpeech}>
            <Plus size={17} />
            {t("新建演讲稿", "New speech")}
          </button>
        </div>
        {!p.sessions.length ? (
          <div className="empty-page welcome">
            <BookOpen size={42} />
            <h2>{t("暂无稿件", "No speeches yet")}</h2>
            <p>
              {t(
                "新建英文稿件，生成示范并逐句录音练习。",
                "Create an English speech to generate examples and record each sentence.",
              )}
            </p>
            <button className="primary" onClick={p.newSpeech}>
              {t("新建演讲稿", "New speech")}
            </button>
          </div>
        ) : (
          <div className="collection-grid">
            {items.map((s) => (
              <button
                key={s.id}
                className={`speech-cover ${speech?.id === s.id ? "selected" : ""}`}
                aria-pressed={speech?.id === s.id}
                onClick={() => {
                  setSelected(s.id);
                  p.openSession(s);
                }}
                disabled={locked}
              >
                <img src={speechCover(s.title)} alt="" />
                <strong>{s.title}</strong>
                <span className="cover-category">{t("演讲稿", "Speech")}</span>
                <span className="cover-meta">
                  <Clock3 size={15} />
                  {s.sentence_ids.length} {t("句", "sentences")}
                  {s.id === p.session?.id && score !== null && (
                    <ProgressRing
                      value={score}
                      suffix=""
                      tone="positive"
                      label={`${score}/100`}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
        {!!p.sessions.length && !items.length && (
          <p className="empty-inline">
            {t("没有匹配的稿件。", "No matching speeches.")}
          </p>
        )}
      </div>
      {speech && (
        <aside className="collection-detail">
          <img className="cover-hero" src={speechCover(speech.title)} alt="" />
          <h2>{speech.title}</h2>
          <span className="cover-category">
            {t("逐句练习", "Sentence practice")}
          </span>
          <p>
            {speech.sentence_ids.length} {t("个练习句", "practice sentences")}
          </p>
          <div className="collection-actions">
            <button
              className="primary"
              onClick={() => open()}
              disabled={locked}
            >
              <Play size={17} fill="currentColor" />
              {t("练习", "Practice")}
            </button>
            <button onClick={() => open(true)} disabled={locked}>
              <ChartNoAxesColumn size={20} />
              {t("查看分析", "View analysis")}
            </button>
          </div>
          <div className="outline-heading">
            <FileText size={18} />
            {t("稿件内容", "Script outline")}
          </div>
          <div className="collection-outline">
            {speech.sentences?.slice(0, 7).map((s, i) => (
              <button
                key={s.id}
                disabled={locked}
                onClick={() => {
                  p.selectSentence(s.id);
                  p.navigate("practice");
                }}
              >
                <span className="outline-number">{i + 1}</span>
                <span>{s.spoken_text}</span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </aside>
      )}
    </section>
  );
}
