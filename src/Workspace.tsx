import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  FileText,
  Plus,
  ChevronLeft,
  Download,
  Trash2,
  Menu,
  X,
  ArrowRight,
  Check,
  PanelRight,
  MoreHorizontal,
  Gauge,
  ClipboardList,
} from "lucide-react";
import { DecorSlot, AppearanceSettings } from "./Appearance";
import type { Recording, Session } from "./types";
import { PracticeAudio } from "./PracticeAudio";
import { Report } from "./PracticeReport";
import { AudioTransport } from "./PlaybackBar";
import { Sidebar } from "./Sidebar";
import { SegmentedControl, Toolbar } from "./DesignSystem";
import { SpeechReader, SentenceNavigation } from "./SpeechReader";
import { CoachPanel } from "./CoachPanel";
import { AnalysisWorkspace } from "./AnalysisWorkspace";
import { ActivityPage } from "./ActivityPages";
import { LibraryPage } from "./LibraryPage";
import { HomePage } from "./HomePage";
import type { ActivityData } from "./practiceData";
import { useOverlayFocus } from "./useOverlayFocus";
import "@fontsource/noto-sans-sc/chinese-simplified-400.css";
import "@fontsource/source-sans-3/latin-400.css";
import "@fontsource/source-sans-3/latin-500.css";

export type View =
  | "home"
  | "library"
  | "practice"
  | "analysis"
  | "report"
  | "settings"
  | "sessions"
  | "progress";
export type WorkspaceProps = {
  loadActivity: () => Promise<ActivityData>;
  openRecording: (session: Session, recording: Recording) => void;
  lang: "zh" | "en";
  session?: Session;
  sessions: Session[];
  current: string;
  take?: Recording;
  history: Recording[];
  recordings: Recording[];
  recording: boolean;
  recordingStream: MediaStream | null;
  uploading: boolean;
  preparing: boolean;
  processing?: "analyze" | "assess";
  loaded: boolean;
  seconds: number;
  preview: string;
  error: string;
  notice: string;
  rate: number;
  loop: boolean;
  wholeAsset: string;
  demo: RefObject<HTMLAudioElement | null>;
  own: RefObject<HTMLAudioElement | null>;
  editor: ReactNode;
  voice: ReactNode;
  jobs: ReactNode;
  settingsContent: ReactNode;
  view: View;
  navigate: (view: View) => void;
  newSpeech: () => void;
  audioUrl: (id: string) => string;
  openSession: (item: Session) => void;
  selectSentence: (id: string) => void;
  selectRecording: (id: string) => void;
  setRate: (value: number) => void;
  setLoop: (value: boolean) => void;
  generate: () => void;
  generateAll: () => void;
  exportSpeech: (play: boolean) => void;
  record: () => void;
  analyze: () => void;
  assess: () => void;
  download: (id: string) => void;
  remove: () => void;
  play: (start: number | null, end: number | null) => void;
  manualPlayback: () => void;
  audioTimeUpdate: () => void;
  setError: (value: string) => void;
  language: () => void;
  dismissNotice: () => void;
};

export function Workspace(p: WorkspaceProps) {
  const t = (zh: string, en: string) => (p.lang === "zh" ? zh : en);
  const sentences = p.session?.sentences || [];
  const sentence = sentences.find((s) => s.id === p.current);
  const locked = p.recording || p.uploading || p.preparing;
  const [drawer, setDrawer] = useState(
    () =>
      matchMedia("(max-width:1199px)").matches &&
      localStorage.getItem("speech-sidebar-collapsed") === "false",
  );
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("speech-sidebar-collapsed") === "true",
  );
  const [compact, setCompact] = useState(
    () => matchMedia("(max-width:1199px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(max-width:1199px)");
    const update = () => {
      setCompact(media.matches);
      setDrawer(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const rail = compact ? !drawer : collapsed;
  const toggleSidebar = () => {
    const next = !rail;
    setCollapsed(next);
    localStorage.setItem("speech-sidebar-collapsed", String(next));
    if (compact) setDrawer(!next);
  };
  const [tools, setTools] = useState(false);
  const [auxiliaryOpen, setAuxiliaryOpen] = useState(false);
  const [readerMode, setReaderMode] = useState<"script" | "focus">(() =>
    localStorage.getItem("speech-reader-mode") === "script"
      ? "script"
      : "focus",
  );
  const [panelTab, setPanelTab] = useState<"coach" | "transcript" | "settings">(
    "coach",
  );
  const [panelVisible, setPanelVisible] = useState(true);
  const [narrowPanel, setNarrowPanel] = useState(
    () => matchMedia("(max-width:999px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(max-width:999px)");
    const update = () => {
      setNarrowPanel(media.matches);
      setAuxiliaryOpen(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const panelRef = useRef<HTMLElement>(null);
  const closePanel = useCallback(() => setAuxiliaryOpen(false), []);
  useOverlayFocus(panelRef, auxiliaryOpen && narrowPanel, closePanel);
  const [demoDuration, setDemoDuration] = useState(0);
  const [ownDuration, setOwnDuration] = useState(0);
  const previewRef = useRef<HTMLAudioElement>(null);
  const whole = useRef<HTMLAudioElement>(null);
  const showPreview = !!p.preview && (p.uploading || !!p.error || !p.take);
  const ownSrc = showPreview
    ? p.preview
    : p.take
      ? p.audioUrl(p.take.asset_id)
      : "";
  const scale = Math.max(demoDuration, ownDuration, p.take?.duration || 0, 1);
  const activeAudio = showPreview ? previewRef : p.own;
  const labels = {
    home: t("首页", "Home"),
    library: t("稿件", "Speeches"),
    practice: t("练习", "Practice"),
    analysis: t("分析", "Analysis"),
    report: t("总结", "Summary"),
    settings: t("设置", "Settings"),
    sessions: t("练习记录", "Sessions"),
    progress: t("进度", "Progress"),
  };
  const pauseAudio = useCallback(() => {
    p.demo.current?.pause();
    p.own.current?.pause();
    previewRef.current?.pause();
    whole.current?.pause();
  }, [p.demo, p.own]);
  useEffect(() => {
    pauseAudio();
  }, [p.current, p.session?.id, p.view, pauseAudio]);
  useEffect(() => {
    setDemoDuration(0);
    setOwnDuration(0);
  }, [p.current, p.session?.id]);
  useEffect(() => {
    if (p.view !== "practice") return;
    const keydown = (e: KeyboardEvent) => {
      if (
        e.code !== "Space" ||
        e.repeat ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        p.uploading ||
        p.preparing
      )
        return;
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,button,a,summary,[contenteditable],[role=dialog]",
        ) ||
        document.querySelector("[aria-modal=true]")
      )
        return;
      e.preventDefault();
      pauseAudio();
      p.record();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [p.view, p.record, p.uploading, p.preparing, pauseAudio]);
  const nav = (view: View) => {
    if (locked) return;
    setDrawer(false);
    p.navigate(view);
  };
  const media = p.session && (p.view === "practice" || p.view === "analysis");

  return (
    <div
      className={`speech-workspace reference-workspace view-${p.view} mode-${readerMode} ${rail ? "sidebar-collapsed" : ""} ${p.recording ? "recording-mode" : ""}`}
    >
      <div className="mobile-top">
        <button
          aria-label={t("打开导航", "Open navigation")}
          onClick={() => setDrawer(true)}
        >
          <Menu size={21} />
        </button>
        <span>Speech Practice</span>
        <small className="mobile-page-label">{labels[p.view]}</small>
      </div>
      {drawer && (
        <button
          className="drawer-backdrop"
          aria-label={t("关闭导航", "Close navigation")}
          onClick={() => setDrawer(false)}
        />
      )}
      <Sidebar
        p={p}
        drawer={drawer}
        rail={rail}
        locked={locked}
        toggleSidebar={toggleSidebar}
        nav={nav}
      />
      <main className="workspace-main">
        {p.error && (
          <div className="global-message pa-error" role="alert">
            <span>{p.error}</span>
            <button
              onClick={() => p.setError("")}
              aria-label={t("关闭错误提示", "Dismiss error")}
            >
              <X size={17} />
            </button>
          </div>
        )}
        {p.notice && (
          <div className="global-message pa-save-status" role="status">
            <span className="completion-notice">
              <Check size={15} aria-hidden="true" />
              {p.notice}
            </span>
            <button
              onClick={p.dismissNotice}
              aria-label={t("关闭提示", "Dismiss notice")}
            >
              <X size={17} />
            </button>
          </div>
        )}
        {!p.loaded ? (
          <div className="empty-page">
            <h1>{t("正在加载稿件", "Loading speeches")}</h1>
            <p>{t("正在连接本地服务…", "Connecting to the local service…")}</p>
          </div>
        ) : media ? (
          <div
            className={`practice-grid ${!panelVisible ? "panel-hidden" : ""}`}
          >
            <section className="reading-column">
              <header className="workspace-toolbar">
                <button
                  className="speech-back"
                  aria-label={t("返回稿件库", "Back to library")}
                  disabled={locked}
                  onClick={() => nav("library")}
                >
                  <ChevronLeft size={25} />
                </button>
                <div className="speech-heading">
                  <h1 className="speech-title">{p.session!.title}</h1>
                  <span>
                    {sentences.length} {t("句", "sentences")}
                  </span>
                </div>
                <Toolbar>
                  <button
                    className="header-icon-action"
                    disabled={locked}
                    title={t("分析", "Analysis")}
                    aria-label={
                      p.view === "analysis"
                        ? t("返回练习", "Return to practice")
                        : t("分析", "Analysis")
                    }
                    onClick={() =>
                      nav(p.view === "analysis" ? "practice" : "analysis")
                    }
                  >
                    {p.view === "analysis" ? (
                      <ChevronLeft size={20} />
                    ) : (
                      <Gauge size={20} />
                    )}
                  </button>
                  <button
                    className="header-icon-action"
                    disabled={locked}
                    aria-label={t("总结", "Summary")}
                    title={t("总结", "Summary")}
                    onClick={() => nav("report")}
                  >
                    <ClipboardList size={20} />
                  </button>
                  <button
                    onClick={() => {
                      if (matchMedia("(max-width:999px)").matches)
                        setAuxiliaryOpen((v) => !v);
                      else setPanelVisible((v) => !v);
                    }}
                    aria-expanded={
                      matchMedia("(max-width:999px)").matches
                        ? auxiliaryOpen
                        : panelVisible
                    }
                    aria-controls="sentence-practice-panel"
                    aria-label={t("切换辅助面板", "Toggle auxiliary panel")}
                  >
                    <PanelRight size={19} />
                  </button>
                  <button
                    disabled={locked}
                    onClick={() => setTools((v) => !v)}
                    aria-expanded={tools}
                    aria-label={t("稿件操作", "Speech actions")}
                  >
                    <MoreHorizontal size={20} />
                  </button>
                </Toolbar>
              </header>
              {tools && (
                <div className="speech-tools">
                  <button disabled={locked} onClick={p.generateAll}>
                    {t("生成整篇示范", "Generate all")}
                  </button>
                  <button
                    disabled={locked || !sentences.every((s) => s.asset_id)}
                    onClick={() => p.exportSpeech(false)}
                  >
                    <Download size={15} />
                    {t("导出整篇", "Export speech")}
                  </button>
                  <details>
                    <summary>{t("查看原文", "View original")}</summary>
                    <p className="original-copy">{p.session!.original_text}</p>
                  </details>
                </div>
              )}
              <div className="reading-scroll">
                {p.view === "practice" ? (
                  <>
                    <Toolbar className="reader-toolbar">
                      <SegmentedControl
                        label={t("阅读模式", "Reading mode")}
                        value={readerMode}
                        options={[
                          { value: "script", label: t("全文", "Script") },
                          { value: "focus", label: t("专注", "Focus") },
                        ]}
                        onChange={(mode) => {
                          setReaderMode(mode);
                          try {
                            localStorage.setItem("speech-reader-mode", mode);
                          } catch {
                            /* Mode remains usable without storage. */
                          }
                        }}
                      />
                      <SentenceNavigation p={p} />
                      <div className="reader-edit">{p.editor}</div>
                    </Toolbar>
                    <SpeechReader p={p} mode={readerMode} />
                  </>
                ) : (
                  <AnalysisWorkspace p={p} />
                )}
                <details className="audio-details">
                  <summary>
                    {t("音频与录音记录", "Audio & recording history")}
                  </summary>
                  <section className="audio-workspace">
                    <section className="pa-track pa-demo-track">
                      <div className="section-heading">
                        <h3>{t("示范朗读", "Example reading")}</h3>
                        {sentence?.asset_id && (
                          <button
                            disabled={locked}
                            aria-label={t("下载示范音频", "Download example")}
                            onClick={() => p.download(sentence.asset_id!)}
                          >
                            <Download size={16} />
                          </button>
                        )}
                      </div>
                      {sentence?.asset_id ? (
                        <PracticeAudio
                          key={sentence.asset_id}
                          src={p.audioUrl(sentence.asset_id)}
                          label={t("示范音频", "Example audio")}
                          audioRef={p.demo}
                          scale={scale}
                          rate={p.rate}
                          loop={p.loop}
                          disabled={locked}
                          onDuration={setDemoDuration}
                          onStart={() => {
                            activeAudio.current?.pause();
                            whole.current?.pause();
                          }}
                          onError={p.setError}
                          lang={p.lang}
                          onManual={() => {
                            activeAudio.current?.pause();
                            whole.current?.pause();
                          }}
                        />
                      ) : (
                        <div className="audio-empty">
                          <span>
                            {t("尚未生成示范音频", "No example audio yet")}
                          </span>
                        </div>
                      )}
                    </section>
                    <section className="pa-track pa-recording-track">
                      <div className="section-heading">
                        <h3>{t("我的录音", "My recording")}</h3>
                        {p.take && (
                          <div className="inline-actions">
                            <button
                              disabled={locked}
                              aria-label={t("下载录音", "Download recording")}
                              onClick={() => p.download(p.take!.asset_id)}
                            >
                              <Download size={16} />
                            </button>
                            <button
                              disabled={locked}
                              aria-label={t("删除录音", "Delete recording")}
                              onClick={p.remove}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                      {ownSrc ? (
                        <PracticeAudio
                          key={ownSrc}
                          src={ownSrc}
                          label={t("我的录音", "My recording")}
                          audioRef={activeAudio}
                          scale={scale}
                          rate={p.rate}
                          disabled={locked}
                          onDuration={setOwnDuration}
                          onStart={() => {
                            p.demo.current?.pause();
                            whole.current?.pause();
                          }}
                          onError={p.setError}
                          lang={p.lang}
                          onManual={() => {
                            p.manualPlayback();
                            p.demo.current?.pause();
                            whole.current?.pause();
                          }}
                          onTime={showPreview ? undefined : p.audioTimeUpdate}
                        />
                      ) : (
                        <p className="audio-empty">
                          {t("尚未录音", "No recording yet")}
                        </p>
                      )}
                      {!!p.history.length && (
                        <label className="pa-history history-selector">
                          {t("录音记录", "Recordings")}
                          <select
                            aria-label={t("录音记录", "Recordings")}
                            disabled={locked}
                            value={p.take?.id || ""}
                            onChange={(e) => p.selectRecording(e.target.value)}
                          >
                            {p.history.map((r, i) => (
                              <option key={r.id} value={r.id}>
                                {t("录音", "Take")} {p.history.length - i} ·{" "}
                                {new Date(r.created_at).toLocaleString(
                                  p.lang === "zh" ? "zh-CN" : "en-US",
                                  {
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}{" "}
                                · v{r.sentence_version}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {showPreview && (
                        <p className="muted">
                          {t(
                            "本次录音预览，尚未保存成功",
                            "Latest recording preview; not yet saved",
                          )}
                        </p>
                      )}
                      {p.take &&
                        p.take.sentence_version !== sentence?.version && (
                          <details className="snapshot">
                            <summary>
                              {t("录音时的朗读稿", "Reference when recorded")} ·
                              v{p.take.sentence_version}
                            </summary>
                            <p>{p.take.spoken_text}</p>
                          </details>
                        )}
                    </section>
                  </section>
                </details>
              </div>
              <AudioTransport
                p={p}
                whole={whole}
                own={activeAudio}
                ownSrc={ownSrc}
                locked={locked}
                pauseAudio={pauseAudio}
                openPractice={() => {
                  setAuxiliaryOpen(true);
                  setPanelTab("coach");
                }}
              />
            </section>
            <aside
              ref={panelRef}
              id="sentence-practice-panel"
              className={`practice-panel ${auxiliaryOpen ? "is-mobile-open" : ""}`}
              role={auxiliaryOpen && narrowPanel ? "dialog" : undefined}
              aria-modal={auxiliaryOpen && narrowPanel ? true : undefined}
              aria-label={t("辅助面板", "Auxiliary panel")}
              inert={!panelVisible && !auxiliaryOpen ? true : undefined}
            >
              <button
                className="mobile-panel-close"
                aria-label={t("返回稿件", "Return to script")}
                onClick={() => setAuxiliaryOpen(false)}
              >
                <ChevronLeft size={17} />
                {t("返回稿件", "Return to script")}
              </button>
              <SegmentedControl
                label={t("辅助面板", "Auxiliary panel")}
                value={panelTab}
                options={[
                  { value: "coach", label: t("教练", "Coach") },
                  { value: "transcript", label: t("识别文本", "Transcript") },
                  { value: "settings", label: t("练习设置", "Options") },
                ]}
                onChange={setPanelTab}
              />
              <div className="auxiliary-content">
                {panelTab === "coach" ? (
                  <CoachPanel p={p} readerMode={readerMode} />
                ) : panelTab === "transcript" ? (
                  <section className="transcript-panel">
                    <h2>{t("识别文本", "Transcript")}</h2>
                    {p.take?.content_feedback ? (
                      <>
                        <p className="feedback-provenance">
                          {new Date(p.take.created_at).toLocaleString()} · v
                          {p.take.sentence_version}
                        </p>
                        <p>{p.take.content_feedback.transcript.text || "—"}</p>
                        {p.take.content_feedback.transcript.uncertain && (
                          <p className="small-note">
                            {t(
                              "识别可信度不足，请回听复核。",
                              "Recognition is uncertain. Listen to review.",
                            )}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="empty-inline">
                        {t(
                          "尚无识别结果。录音后检查识别差异。",
                          "No transcript yet. Check the transcript after recording.",
                        )}
                      </p>
                    )}
                  </section>
                ) : (
                  <section className="voice-settings">
                    <h2>{t("发音风格与声线", "Delivery & voice")}</h2>
                    {p.voice}
                    <button disabled={locked} onClick={p.generate}>
                      {t("重新生成本句", "Regenerate example")}
                    </button>
                  </section>
                )}
                {p.jobs}
              </div>
            </aside>
          </div>
        ) : p.view === "home" ? (
          <HomePage p={p} />
        ) : p.view === "settings" ? (
          <section className="document-page settings-page">
            <header className="document-heading">
              <h1>{t("模型与设置", "Models & settings")}</h1>
            </header>
            <nav
              className="settings-nav"
              aria-label={t("设置分组", "Settings sections")}
            >
              {[
                ["appearance", t("外观", "Appearance")],
                ["voice", t("示范语音", "Example voice")],
                ["services", t("识别与评测", "Recognition & assessment")],
                ["models", t("模型", "Models")],
                ["storage", t("文件存储", "File storage")],
              ].map(([id, label]) => (
                <a key={id} href={`#settings-${id}`}>
                  {label}
                </a>
              ))}
            </nav>
            <AppearanceSettings lang={p.lang} />
            <section id="settings-voice" className="settings-section">
              <h2>{t("示范语音", "Example voice")}</h2>
              {p.session ? (
                p.voice
              ) : (
                <p>
                  {t(
                    "选择或新建稿件后设置示范语音。",
                    "Select or create a speech to configure its example voice.",
                  )}
                </p>
              )}
            </section>
            {p.settingsContent}
            {p.jobs}
          </section>
        ) : p.view === "sessions" || p.view === "progress" ? (
          <ActivityPage p={p} />
        ) : p.view === "report" && p.session ? (
          <Report p={p} />
        ) : (
          <LibraryPage p={p} />
        )}
      </main>
    </div>
  );
}

function Empty({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-page welcome">
      <DecorSlot slot="sidebar" className="empty-art" />
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="primary" onClick={onAction}>
        {action}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
