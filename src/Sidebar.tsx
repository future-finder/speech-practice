import {
  AudioLines,
  FileText,
  Mic,
  ChartNoAxesColumn,
  ClipboardList,
  Settings2,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  Home,
} from "lucide-react";
import type { View, WorkspaceProps } from "./Workspace";
import { DecorSlot } from "./Appearance";
export function Sidebar({
  p,
  drawer,
  rail,
  locked,
  toggleSidebar,
  nav,
}: {
  p: WorkspaceProps;
  drawer: boolean;
  rail: boolean;
  locked: boolean;
  toggleSidebar: () => void;
  nav: (view: View) => void;
}) {
  const t = (zh: string, en: string) => (p.lang === "zh" ? zh : en);
  const labels = {
    library: t("稿件", "Library"),
    practice: t("练习", "Practice"),
    sessions: t("练习记录", "Sessions"),
    progress: t("进度", "Progress"),
    settings: t("设置", "Settings"),
  };
  return (
    <aside
      id="workspace-sidebar"
      className={`app-sidebar ${drawer ? "is-open" : ""}`}
    >
      <button
        className="workspace-brand"
        aria-label={t("首页", "Home")}
        disabled={locked}
        onClick={() => nav("home")}
      >
        <span className="brand-mark">
          <AudioLines size={31} strokeWidth={2.4} />
        </span>
        <span>Speech Practice</span>
      </button>
      <button
        className="sidebar-toggle"
        title={
          rail
            ? t("展开侧栏", "Expand sidebar")
            : t("收起侧栏", "Collapse sidebar")
        }
        aria-label={
          rail
            ? t("展开侧栏", "Expand sidebar")
            : t("收起侧栏", "Collapse sidebar")
        }
        aria-expanded={!rail}
        aria-controls="workspace-sidebar"
        onClick={toggleSidebar}
      >
        {rail ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        <span>{t("收起侧栏", "Collapse sidebar")}</span>
      </button>
      <nav className="primary-nav" aria-label={t("主导航", "Main navigation")}>
        {p.view === "home" && (
          <button aria-current="page" onClick={() => nav("home")}>
            <Home size={25} strokeWidth={1.65} />
            <span>{t("首页", "Home")}</span>
          </button>
        )}
        {(
          [
            ["practice", Mic],
            ["library", BookOpen],
            ["sessions", ClipboardList],
            ["progress", ChartNoAxesColumn],
          ] as const
        ).map(([view, Icon]) => (
          <button
            key={view}
            title={rail ? labels[view] : undefined}
            aria-label={labels[view]}
            disabled={locked}
            aria-current={p.view === view ? "page" : undefined}
            onClick={() => nav(view)}
          >
            <Icon size={23} strokeWidth={1.65} />
            <span>{labels[view]}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-section-heading">
        <span>{t("我的稿件", "My speeches")}</span>
        <button
          disabled={locked || !p.loaded}
          onClick={p.newSpeech}
          aria-label={t("新建演讲稿", "New speech")}
        >
          <Plus size={18} />
        </button>
      </div>
      <nav className="speech-list" aria-label={t("我的稿件", "My speeches")}>
        {p.sessions.map((item) => (
          <button
            key={item.id}
            title={item.title}
            disabled={locked}
            aria-current={p.session?.id === item.id ? "true" : undefined}
            onClick={() => {
              p.openSession(item);
              nav("practice");
            }}
          >
            <FileText size={23} strokeWidth={1.65} />
            <span>{item.title}</span>
            <small>
              {item.sentence_ids.length} {t("句", "sentences")}
            </small>
          </button>
        ))}
        {p.loaded && !p.sessions.length && (
          <p className="muted sidebar-empty">
            {t("暂无稿件", "No speeches yet")}
          </p>
        )}
      </nav>
      <div className="sidebar-footer">
        <button
          title={labels.settings}
          aria-label={labels.settings}
          disabled={locked}
          onClick={() => nav("settings")}
        >
          <Settings2 size={19} />
          <span>{labels.settings}</span>
        </button>
        <button disabled={locked} onClick={p.language}>
          {p.lang === "zh" ? "EN" : "中文"}
        </button>
        <small>{t("语言", "Language")}</small>
      </div>
      <DecorSlot slot="sidebar" className="botanical-edge" />
    </aside>
  );
}
