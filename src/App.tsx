import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Check,
  ChevronRight,
  CircleHelp,
  Folder,
  Globe,
  Headphones,
  Mic,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { Brand } from "./Brand";
import { RecordingWaveform } from "./RecordingWaveform";
import { FeedbackPanel } from "./FeedbackPanel";
import { ProviderSettings } from "./ProviderSettings";
import { modelDescription } from "./modelInfo";
import { playbackRange } from "./segment";
import type {
  Connection,
  Job,
  Model,
  Options,
  Recording,
  Sentence,
  Session,
  Settings,
} from "./types";

const SAMPLE = `Every meaningful change begins with a small decision. We choose to listen more carefully, ask a better question, or try again after a difficult day.

When I first started learning something new, I thought progress would be obvious. I imagined a straight path, clear milestones, and a moment when everything would finally make sense. The reality was much less tidy. Some days I worked hard and understood very little. Other days, a simple conversation changed the way I saw an entire problem.

I have learned that uncertainty is not a reason to stop. It is a reason to look more closely. When we do not understand something, we can break it into smaller parts. We can test an idea, compare it with the evidence, and ask someone to challenge our assumptions. Each of these steps gives us a little more clarity.

The same is true when we speak. A clear message does not require perfect words or a perfect voice. It requires an honest purpose, a thoughtful structure, and the willingness to practice. We learn by hearing ourselves, noticing where the message becomes difficult to follow, and making one useful change at a time.

Today, I want to invite you to choose one small action. Read a paragraph aloud. Explain an idea to a friend. Ask the question you have been avoiding. Do not wait until you feel completely ready. Readiness often comes from doing the work, not from thinking about doing it.

There will be mistakes. There will be pauses, revisions, and moments of frustration. But there will also be discoveries. You will find a clearer sentence, a stronger argument, or a new connection between ideas. These discoveries are the reward for staying curious.

If we keep showing up, our small actions begin to add up. A single practice session becomes a habit. A habit becomes confidence. And confidence gives us the courage to share what we know and keep learning what we do not. Thank you.`;

export default function App() {
  const [lang, setLang] = useState<"zh" | "en">(
    () =>
      (localStorage.getItem("language") ||
        (navigator.language.startsWith("zh") ? "zh" : "en")) as "zh" | "en",
  );
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [conn, setConn] = useState<Connection>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [session, setSession] = useState<Session>();
  const [current, setCurrent] = useState("");
  const [draft, setDraft] = useState("");
  const [options, setOptions] = useState<Options>({
    provider: "kokoro",
    voice: "af_sarah",
    speed: 1,
    style: "",
  });
  const [models, setModels] = useState<Model[]>([]);
  const [config, setConfig] = useState<Settings>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "true",
  );
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "system",
  );
  const [reducedMotion, setReducedMotion] = useState(
    () => localStorage.getItem("reduced-motion") === "true",
  );
  const [newOpen, setNewOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [key, setKey] = useState("");
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [pause, setPause] = useState(300);
  const [wholeAsset, setWholeAsset] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const mic = useRef<MediaRecorder | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const demo = useRef<HTMLAudioElement>(null);
  const own = useRef<HTMLAudioElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const stopAt = useRef<number | null>(null);
  const previousJobs = useRef("");
  const activeSession = useRef("");
  const sentences = session?.sentences || [];
  const sentence = sentences.find((s) => s.id === current);
  const index = sentences.findIndex((s) => s.id === current);
  const history = recordings.filter((r) => r.sentence_id === current);
  const take = history.find((r) => r.id === selectedRecording) || history[0];
  const activeJobs = jobs.filter((j) =>
    ["queued", "running"].includes(j.status),
  );

  const analysisJobs = jobs.filter(
    (j) =>
      (j.recording_id || j.payload?.recording) === take?.id &&
      ["analyze", "assess"].includes(j.action),
  );
  const analyzing = analysisJobs.some((j) =>
    ["queued", "running"].includes(j.status),
  );
  const failedAnalysis =
    analysisJobs[0]?.status === "failed" ? analysisJobs[0] : undefined;
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.elvTheme =
        theme === "system" ? (system.matches ? "dark" : "light") : theme;
    };
    apply();
    system.addEventListener("change", apply);
    localStorage.setItem("theme", theme);
    return () => system.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.elvReducedMotion = String(reducedMotion);
    localStorage.setItem("reduced-motion", String(reducedMotion));
  }, [reducedMotion]);
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);
  useEffect(() => {
    if (!settingsOpen && !newOpen && !aboutOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".modal");
    const controls = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length);
    controls()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setNewOpen(false);
        setAboutOpen(false);
      }
      if (event.key !== "Tab") return;
      const items = controls(),
        first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [settingsOpen, newOpen, aboutOpen]);

  const api = useCallback(
    async <T,>(path: string, method = "GET", body?: unknown): Promise<T> => {
      if (!conn) throw new Error("Backend connection not ready");
      const form = body instanceof FormData;
      const response = await fetch(conn.base + "/api" + path, {
        method,
        headers: {
          Authorization: `Bearer ${conn.token}`,
          ...(!form && body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body:
          body === undefined ? undefined : form ? body : JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail || response.status),
        );
      }
      return response.json();
    },
    [conn],
  );
  const run = async (action: () => Promise<unknown>) => {
    setError("");
    try {
      await action();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };
  const audioUrl = (id: string, download = false) =>
    conn
      ? `${conn.base}/api/assets/${id}?token=${conn.token}${download ? "&download=true" : ""}`
      : "";
  const refresh = useCallback(async () => {
    if (!conn) return;
    const [list, modelList, settings] = await Promise.all([
      api<Session[]>("/sessions"),
      api<Model[]>("/models"),
      api<Settings>("/settings"),
    ]);
    setSessions(list);
    setModels(modelList);
    setConfig(settings);
    if (session && activeSession.current === session.id) {
      const [detail, takes] = await Promise.all([
        api<Session>(`/sessions/${session.id}`),
        api<Recording[]>(`/sessions/${session.id}/recordings`),
      ]);
      if (activeSession.current === session.id) {
        setSession(detail);
        setRecordings(takes);
      }
    }
  }, [api, conn, session?.id]);

  useEffect(() => {
    if (window.desktop)
      window.desktop
        .connection()
        .then(setConn)
        .catch((e) => setError(String(e)));
    else {
      const params = new URLSearchParams(location.hash.slice(1));
      const token =
        params.get("token") || sessionStorage.getItem("speech-token");
      if (token) {
        sessionStorage.setItem("speech-token", token);
        window.history.replaceState(null, "", location.pathname);
        setConn({ base: location.origin, token });
      } else
        setError(
          t(
            "请通过桌面应用或 start.bat 启动。",
            "Launch through the desktop app or start.bat.",
          ),
        );
    }
    return () => {
      mic.current?.state === "recording" && mic.current.stop();
      micStream.current?.getTracks().forEach((track) => track.stop());
      clearInterval(timer.current);
    };
  }, []);
  useEffect(() => {
    if (conn) refresh().catch((e) => setError(String(e)));
  }, [conn]);
  useEffect(() => {
    if (!conn) return;
    const events = new EventSource(
      `${conn.base}/api/events?token=${conn.token}`,
    );
    events.onmessage = (event) => {
      const incoming = JSON.parse(event.data) as Job[];
      setJobs(incoming);
      const signature = JSON.stringify(
        incoming.map((j) => [j.id, j.status, j.completed]),
      );
      if (signature !== previousJobs.current) {
        previousJobs.current = signature;
        refresh().catch((e) => setError(String(e)));
      }
    };
    return () => events.close();
  }, [conn, refresh]);
  useEffect(() => {
    if (sentence) {
      setDraft(sentence.spoken_text);
      setOptions(sentence.options);
    }
    setPreview("");
    setSelectedRecording("");
  }, [current, sentence?.version]);
  useEffect(() => {
    if (demo.current) demo.current.playbackRate = rate;
    if (own.current) own.current.playbackRate = rate;
  }, [rate, current, take?.id, wholeAsset]);
  useEffect(() => {
    setWholeAsset("");
  }, [JSON.stringify(sentences.map((s) => s.asset_id))]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function openSession(item: Session) {
    if (recording || uploading) return;
    activeSession.current = item.id;
    const detail = await api<Session>(`/sessions/${item.id}`);
    const takes = await api<Recording[]>(`/sessions/${item.id}/recordings`);
    if (activeSession.current !== item.id) return;
    setSession(detail);
    setCurrent(detail.current_sentence_id);
    setWholeAsset("");
    setRecordings(takes);
    localStorage.setItem("session", item.id);
  }
  useEffect(() => {
    if (conn && sessions.length && !session) {
      const id = localStorage.getItem("session");
      run(() => openSession(sessions.find((s) => s.id === id) || sessions[0]));
    }
  }, [sessions.length, conn]);
  async function selectSentence(id: string) {
    if (!session || recording || uploading) return;
    setCurrent(id);
    await api(`/sessions/${session.id}/progress`, "PATCH", { sentence_id: id });
  }
  async function saveSentence(): Promise<Sentence> {
    if (!sentence)
      throw new Error(t("请先选择句子。", "Select a sentence first."));
    const saved = await api<Sentence>(`/sentences/${sentence.id}`, "PATCH", {
      spoken_text: draft,
      options,
    });
    await refresh();
    return saved;
  }
  async function waitJob(job: Job) {
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const current = await api<Job>(`/jobs/${job.id}`);
      if (current.status === "completed") return current;
      if (["failed", "cancelled"].includes(current.status))
        throw new Error(current.error || current.status);
    }
  }
  async function exportSpeech(play: boolean) {
    if (!session) return;
    const job = await api<Job>(`/sessions/${session.id}/export`, "POST", {
      pause_ms: pause,
    });
    const done = await waitJob(job);
    if (done.result?.asset_id) {
      if (play) setWholeAsset(done.result.asset_id);
      else await saveAudio(done.result.asset_id);
    }
  }
  async function saveAudio(id: string) {
    if (window.desktop) await window.desktop.saveAudio(id);
    else {
      const a = document.createElement("a");
      a.href = audioUrl(id, true);
      a.download = "speech.wav";
      a.click();
    }
  }
  async function startRecording() {
    if (!sentence || recording || uploading) return;
    setNotice("");
    const snapshot = await saveSentence();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStream.current = stream;
    const mime = [
      "audio/webm;codecs=opus",
      "audio/ogg;codecs=opus",
      "audio/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    mic.current = recorder;
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => {
      stream.getTracks().forEach((track) => track.stop());
      clearInterval(timer.current);
      setRecording(false);
      setError(
        t(
          "录音失败，请检查麦克风。",
          "Recording failed. Check the microphone.",
        ),
      );
    };
    recorder.onstop = async () => {
      clearInterval(timer.current);
      stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
      const blob = new Blob(chunks, { type: recorder.mimeType });
      if (!blob.size) {
        setError(t("录音为空，请重试。", "Empty recording. Please retry."));
        return;
      }
      setPreview(URL.createObjectURL(blob));
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", blob, "recording.webm");
        const saved = await api<Recording>(
          `/sentences/${snapshot.id}/recordings`,
          "POST",
          form,
        );
        setSelectedRecording(saved.id);
        await refresh();
        setNotice(t("这次练习已保存。", "Recording saved."));
      } catch (e) {
        setError(
          t(
            "保存失败，本次录音仍可在下方回听或下载；请保存副本后重试。",
            "Save failed. Replay or download the latest recording below before retrying.",
          ) +
            " " +
            String(e),
        );
      } finally {
        setUploading(false);
      }
    };
    recorder.start(250);
    setSeconds(0);
    setRecording(true);
    const started = Date.now();
    timer.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setSeconds(elapsed);
      if (elapsed >= 119 && recorder.state === "recording") recorder.stop();
    }, 250);
  }
  useEffect(() => {
    stopAt.current = null;
    if (own.current) own.current.pause();
  }, [take?.id]);
  function playSegment(start: number | null, end: number | null) {
    if (!own.current || !take) return;
    const range = playbackRange(start, end, take.duration);
    if (!range) return;
    own.current.currentTime = range.start;
    stopAt.current = range.end;
    own.current.play().catch((e) => setError(String(e)));
  }

  return (
    <div className="app">
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="brand">
          <Brand compact={collapsed} />
        </div>
        <button
          className="plain sidebar-toggle"
          aria-label={
            collapsed
              ? t("展开侧栏", "Expand sidebar")
              : t("折叠侧栏", "Collapse sidebar")
          }
          aria-expanded={!collapsed}
          onClick={() => {
            setCollapsed(!collapsed);
            localStorage.setItem("sidebar-collapsed", String(!collapsed));
          }}
        >
          {collapsed ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
        </button>
        <button
          aria-label={t("新建演讲稿", "New speech")}
          className="new-button"
          onClick={() => {
            setNewOpen(true);
            setTitle("");
            setScript("");
          }}
        >
          <Plus size={17} />
          <span className="sidebar-copy">{t("新建演讲稿", "New speech")}</span>
        </button>
        <div className="sidebar-label">
          {t("稿件", "Speeches")}
          <span>{sessions.length.toString().padStart(2, "0")}</span>
        </div>
        <nav>
          {sessions.map((item) => (
            <button
              className={`session-link ${session?.id === item.id ? "active" : ""}`}
              title={item.title}
              aria-label={item.title}
              key={item.id}
              onClick={() => run(() => openSession(item))}
            >
              {collapsed ? <Folder size={18} /> : <span>{item.title}</span>}
              <small>
                {item.sentence_ids.length} {t("个练习句", "sentences")}
              </small>
              <ChevronRight size={15} />
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="plain"
            aria-label={t("模型与设置", "Models & settings")}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={16} />
            <span className="sidebar-copy">
              {t("模型与设置", "Models & settings")}
            </span>
          </button>
          <button
            className="plain"
            aria-label={t("关于 ELOVERIS", "About ELOVERIS")}
            onClick={() => setAboutOpen(true)}
          >
            <CircleHelp size={16} />
            <span className="sidebar-copy">
              {t("关于 ELOVERIS", "About ELOVERIS")}
            </span>
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            {t("练习工作台", "Practice studio")}
            <ChevronRight size={13} />
            <span>{session?.title || t("暂无稿件", "No speech")}</span>
          </div>
          <div className="header-actions">
            <button
              className="plain"
              onClick={() => {
                const next = lang === "zh" ? "en" : "zh";
                setLang(next);
                localStorage.setItem("language", next);
              }}
            >
              <Globe size={15} />
              {lang === "zh" ? "EN" : "中文"}
            </button>
            <button
              className="icon-button"
              aria-label={t("设置", "Settings")}
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={18} />
            </button>
          </div>
        </header>
        {error && (
          <div className="alert error" role="alert">
            {error}
            <button
              aria-label={t("关闭", "Close")}
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="alert notice elv-complete" role="status">
            {notice}
            <button
              aria-label={t("关闭", "Close")}
              onClick={() => setNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {!session ? (
          <section className="welcome">
            <Brand />
            <p className="brand-promise">
              {t(
                "让表达更清晰、更自在",
                "Express yourself with clarity and ease",
              )}
            </p>
            <h1>{t("口语练习", "Speech practice")}</h1>
            <p>
              {t(
                "新建英文稿件，生成示范并逐句录音练习。",
                "Create an English speech to generate examples and record each sentence.",
              )}
            </p>
            <button className="primary" onClick={() => setNewOpen(true)}>
              <Plus size={18} />
              {t("新建演讲稿", "New speech")}
            </button>
            <button
              className="plain"
              onClick={() => {
                setScript(SAMPLE);
                setTitle(t("示例稿件", "Sample speech"));
                setNewOpen(true);
              }}
            >
              {t("使用示例稿件", "Use sample speech")}
            </button>
          </section>
        ) : (
          <>
            <section className="page-heading">
              <div>
                <h1>{session.title}</h1>
                <p>
                  {sentences.length} {t("个句子", "sentences")}
                  <span> / </span>
                  {sentences.filter((s) => s.asset_id).length}{" "}
                  {t("个示范已生成", "examples ready")}
                </p>
              </div>
              <div className="heading-actions">
                <button
                  className="secondary"
                  onClick={() =>
                    run(async () => {
                      await saveSentence();
                      await api(`/sessions/${session.id}/generate`, "POST", {});
                    })
                  }
                >
                  <Sparkles size={16} />
                  {t("生成整篇示范", "Generate all")}
                </button>
                <button
                  className="secondary"
                  onClick={() => run(() => exportSpeech(false))}
                >
                  <ArrowDownToLine size={16} />
                  {t("导出整篇", "Export speech")}
                </button>
              </div>
            </section>
            <div className="workspace">
              <section className="sentence-panel">
                <div className="panel-label">
                  {t("句子列表", "Sentences")}
                  <span>
                    {(index + 1).toString().padStart(2, "0")} /{" "}
                    {sentences.length.toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="sentences">
                  {sentences.map((s, i) => (
                    <button
                      disabled={recording || uploading}
                      key={s.id}
                      className={`sentence-row ${s.id === current ? "selected" : ""}`}
                      onClick={() => run(() => selectSentence(s.id))}
                    >
                      <span className="sentence-number">
                        {(i + 1).toString().padStart(2, "0")}
                      </span>
                      <span className="sentence-copy">{s.spoken_text}</span>
                      <span className="sentence-state">
                        {s.asset_id ? <Check size={14} /> : <span />}
                      </span>
                    </button>
                  ))}
                </div>
                <details className="original">
                  <summary>{t("查看完整原文", "View original speech")}</summary>
                  <p>{session.original_text}</p>
                </details>
              </section>
              <div className="practice-column">
                <section className="practice-card">
                  <div className="card-top">
                    <span className="sentence-label">
                      {t("当前句", "Current sentence")}{" "}
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <button
                        disabled={index <= 0 || recording}
                        className="icon-button"
                        aria-label={t("上一句", "Previous sentence")}
                        onClick={() =>
                          run(() => selectSentence(sentences[index - 1].id))
                        }
                      >
                        <ArrowLeft size={17} />
                      </button>
                      <button
                        disabled={index >= sentences.length - 1 || recording}
                        className="icon-button"
                        aria-label={t("下一句", "Next sentence")}
                        onClick={() =>
                          run(() => selectSentence(sentences[index + 1].id))
                        }
                      >
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  </div>
                  <blockquote>{sentence?.spoken_text}</blockquote>
                  <details className="editor">
                    <summary>
                      {t(
                        "编辑朗读稿与分句",
                        "Edit spoken text & sentence breaks",
                      )}
                      <small>{t("原文保留", "Original preserved")}</small>
                    </summary>
                    <textarea
                      ref={editor}
                      aria-label={t("实际朗读稿", "Spoken text")}
                      disabled={recording || uploading}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <div className="editor-actions">
                      <button
                        className="secondary"
                        disabled={recording || uploading}
                        onClick={() => run(() => saveSentence())}
                      >
                        {t("保存", "Save")}
                      </button>
                      <button
                        className="plain"
                        disabled={recording || uploading}
                        onClick={() =>
                          run(async () => {
                            const offset = editor.current?.selectionStart || 0;
                            await saveSentence();
                            const updated = await api<Session>(
                              `/sentences/${current}/split`,
                              "POST",
                              { offset },
                            );
                            setSession(updated);
                          })
                        }
                      >
                        {t("在光标处分句", "Split at cursor")}
                      </button>
                      <button
                        className="plain"
                        disabled={
                          index === sentences.length - 1 ||
                          recording ||
                          uploading
                        }
                        onClick={() =>
                          run(async () => {
                            await saveSentence();
                            setSession(
                              await api<Session>(
                                `/sentences/${current}/merge`,
                                "POST",
                              ),
                            );
                          })
                        }
                      >
                        {t("合并下一句", "Merge next")}
                      </button>
                    </div>
                  </details>
                  <div className="voice-options">
                    <label>
                      {t("示范模型", "Voice model")}
                      <select
                        disabled={recording || uploading}
                        value={options.provider}
                        aria-label={t("示范模型", "Voice model")}
                        aria-describedby="tts-model-description"
                        onChange={(e) =>
                          setOptions({
                            provider: e.target.value as Options["provider"],
                            voice:
                              e.target.value === "kokoro" ? "af_sarah" : "Ryan",
                            speed: 1,
                            style: "",
                          })
                        }
                      >
                        <option value="kokoro">Kokoro · CPU</option>
                        <option value="qwen">Qwen3-TTS 1.7B · NVIDIA</option>
                        <option value="qwen-small">
                          Qwen3-TTS 0.6B · NVIDIA
                        </option>
                      </select>
                    </label>
                    <label>
                      {t("声线", "Speaker")}
                      <select
                        disabled={recording || uploading}
                        value={options.voice}
                        aria-label={t("声线", "Speaker")}
                        onChange={(e) =>
                          setOptions({ ...options, voice: e.target.value })
                        }
                      >
                        {(options.provider === "kokoro"
                          ? ["af_sarah", "am_michael"]
                          : ["Ryan", "Aiden"]
                        ).map((voice) => (
                          <option key={voice}>{voice}</option>
                        ))}
                      </select>
                    </label>
                    {options.provider === "qwen" && (
                      <label className="style-select">
                        {t("语气", "Delivery")}
                        <select
                          value={options.style}
                          aria-label={t("语气", "Delivery")}
                          onChange={(e) =>
                            setOptions({ ...options, style: e.target.value })
                          }
                        >
                          <option value="">{t("自然", "Natural")}</option>
                          <option value="Speak with a confident, engaging public-speaking delivery, with clear articulation and thoughtful pauses.">
                            {t("自信演讲", "Confident speech")}
                          </option>
                          <option value="Speak warmly and calmly, with gentle emphasis and a measured pace.">
                            {t("温暖平静", "Warm & calm")}
                          </option>
                          <option value="Deliver the supplied words as an energetic public speech, using a lively but controlled speaking voice. Read only the supplied text, without laughter, interjections, or extra words.">
                            {t("热情有力", "Energetic")}
                          </option>
                        </select>
                      </label>
                    )}
                  </div>
                  <p id="tts-model-description" className="model-description">
                    {modelDescription(options.provider, lang)}
                  </p>
                  <button
                    className="plain"
                    disabled={recording || uploading}
                    onClick={() =>
                      run(async () => {
                        await saveSentence();
                        setSession(
                          await api<Session>(
                            `/sessions/${session.id}/options`,
                            "PATCH",
                            options,
                          ),
                        );
                        setNotice(
                          t(
                            "示范设置已应用到整篇。",
                            "Voice settings applied to the whole speech.",
                          ),
                        );
                      })
                    }
                  >
                    {t(
                      "将示范设置应用到整篇",
                      "Apply voice settings to whole speech",
                    )}
                  </button>
                  <div className="demo-box">
                    <div className="demo-label">
                      <Headphones size={19} />
                      <div>
                        <strong>{t("示范音频", "Example audio")}</strong>
                      </div>
                    </div>
                    <button
                      className="primary"
                      onClick={() =>
                        run(async () => {
                          await saveSentence();
                          await api(
                            `/sessions/${session.id}/generate`,
                            "POST",
                            { sentence_id: current },
                          );
                        })
                      }
                    >
                      <RefreshCw size={15} />
                      {t("生成本句", "Generate")}
                    </button>
                  </div>
                  {sentence?.asset_id && (
                    <div className="audio-with-save">
                      <audio
                        ref={demo}
                        key={sentence.asset_id}
                        controls
                        loop={loop}
                        src={audioUrl(sentence.asset_id)}
                      />
                      <button
                        className="icon-button"
                        aria-label={t("下载示范音频", "Download example")}
                        onClick={() => run(() => saveAudio(sentence.asset_id!))}
                      >
                        <ArrowDownToLine size={18} />
                      </button>
                    </div>
                  )}
                  <div className="playback-options">
                    <label>
                      {t("播放速度", "Playback speed")}
                      <select
                        value={rate}
                        onChange={(e) => setRate(Number(e.target.value))}
                      >
                        {[0.5, 0.75, 1, 1.25, 1.5].map((n) => (
                          <option key={n} value={n}>
                            {n}×
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={loop}
                        onChange={(e) => setLoop(e.target.checked)}
                      />
                      {t("循环本句", "Loop sentence")}
                    </label>
                    <button
                      className="plain"
                      onClick={() => run(() => exportSpeech(true))}
                    >
                      {t("播放整篇", "Play whole speech")}
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  {wholeAsset && (
                    <div className="whole-audio">
                      <small>{t("整篇示范", "Full speech")}</small>
                      <audio controls autoPlay src={audioUrl(wholeAsset)} />
                    </div>
                  )}
                </section>
                <section className="record-card">
                  <div className="record-heading">
                    <div>
                      <h2>{t("录音练习", "Recording")}</h2>
                    </div>
                    <span className="take-count">
                      {history.length} {t("次练习", "takes")}
                    </span>
                  </div>
                  <div className="record-controls">
                    <button
                      disabled={uploading}
                      className={`record-button ${recording ? "recording" : ""}`}
                      onClick={() =>
                        recording
                          ? mic.current?.stop()
                          : run(() => startRecording())
                      }
                    >
                      {recording ? <Square size={19} /> : <Mic size={20} />}
                      <span>
                        {recording
                          ? t("停止录音", "Stop recording")
                          : history.length
                            ? t("重新录音", "Record again")
                            : t("开始录音", "Start recording")}
                      </span>
                    </button>
                    <div className="record-hint" role="status">
                      {recording ? (
                        <>
                          <RecordingWaveform
                            stream={micStream.current}
                            reducedMotion={reducedMotion}
                          />
                          {t(
                            "正在聆听 · 点击结束",
                            "Listening · stop when ready",
                          )}{" "}
                          · {Math.floor(seconds / 60)}:
                          {String(seconds % 60).padStart(2, "0")}
                        </>
                      ) : uploading ? (
                        t("正在保存…", "Saving…")
                      ) : (
                        t(
                          "录音保存在本机，最长 120 秒",
                          "Saved locally · up to 120 seconds",
                        )
                      )}
                    </div>
                  </div>
                  {preview && (
                    <div className="immediate">
                      <small>{t("本次录音", "Latest recording")}</small>
                      <audio controls src={preview} />
                      <a href={preview} download="eloveris-recording.webm">
                        {t(
                          "下载本次录音副本",
                          "Download latest recording copy",
                        )}
                      </a>
                    </div>
                  )}
                  {take && (
                    <>
                      <div className="history-selector">
                        <label>
                          {t("练习记录", "Practice history")}
                          <select
                            value={take.id}
                            onChange={(e) =>
                              setSelectedRecording(e.target.value)
                            }
                          >
                            {history.map((r, i) => (
                              <option key={r.id} value={r.id}>
                                {t("录音", "Take")} {history.length - i} ·{" "}
                                {new Date(r.created_at).toLocaleString()} · v
                                {r.sentence_version}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="icon-button"
                          aria-label={t("下载录音", "Download recording")}
                          onClick={() => run(() => saveAudio(take.asset_id))}
                        >
                          <ArrowDownToLine size={17} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={t("删除录音", "Delete recording")}
                          onClick={() => {
                            if (
                              confirm(
                                t(
                                  "删除这条录音及反馈？",
                                  "Delete this recording and its feedback?",
                                ),
                              )
                            )
                              run(async () => {
                                await api(`/recordings/${take.id}`, "DELETE");
                                await refresh();
                              });
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      <audio
                        ref={own}
                        controls
                        key={take.id}
                        onPause={() => {
                          stopAt.current = null;
                        }}
                        onEnded={() => {
                          stopAt.current = null;
                        }}
                        onPointerDown={() => {
                          stopAt.current = null;
                        }}
                        onKeyDown={() => {
                          stopAt.current = null;
                        }}
                        src={audioUrl(take.asset_id)}
                        onTimeUpdate={() => {
                          if (
                            own.current &&
                            stopAt.current !== null &&
                            own.current.currentTime >= stopAt.current
                          ) {
                            own.current.pause();
                            stopAt.current = null;
                          }
                        }}
                      />
                      <div className="snapshot">
                        <span>
                          v{take.sentence_version} ·{" "}
                          {t("录音时的朗读稿", "Reference when recorded")}
                        </span>
                        <p>{take.spoken_text}</p>
                      </div>
                      <div className="feedback-actions">
                        <button
                          className="secondary"
                          onClick={() => {
                            const cloud = config?.asr_provider === "tencent";
                            if (
                              cloud &&
                              !confirm(
                                t(
                                  "将录音上传至腾讯云识别，可能收费，是否继续？",
                                  "Upload audio to Tencent ASR? Charges may apply.",
                                ),
                              )
                            )
                              return;
                            run(() =>
                              api(`/recordings/${take.id}/analyze`, "POST", {
                                provider: config?.asr_provider || "local",
                                model: config?.asr_model || "whisper",
                                device: config?.asr_device || "cpu",
                                consent: cloud,
                              }),
                            );
                          }}
                        >
                          <AudioLines size={16} />
                          {t("检查识别差异", "Check transcript")}
                        </button>
                        <button
                          className="secondary"
                          onClick={() => {
                            if (
                              confirm(
                                t(
                                  `将此录音和录音时的朗读稿上传至 ${config?.pronunciation_provider || "speechace"}。可能收费，是否继续？`,
                                  `Upload audio and its saved reference to ${config?.pronunciation_provider || "speechace"}? Charges may apply.`,
                                ),
                              )
                            )
                              run(() =>
                                api(`/recordings/${take.id}/assess`, "POST", {
                                  consent: true,
                                  locale: "en-us",
                                  provider:
                                    config?.pronunciation_provider ||
                                    "speechace",
                                }),
                              );
                          }}
                        >
                          <Sparkles size={16} />
                          {t("发音评测", "Assess pronunciation")}
                        </button>
                      </div>
                      <div className="feedback-note">
                        <CircleHelp size={15} />
                        {t(
                          "识别差异提示读了哪些词；它不是发音评分。",
                          "Transcript differences show recognized words, not pronunciation quality.",
                        )}
                      </div>
                      {take.content_feedback && (
                        <section
                          className="feedback elv-enter"
                          key={take.content_feedback.created_at}
                        >
                          <h3>{t("识别文本差异", "Transcript differences")}</h3>
                          <small>
                            {take.content_feedback.transcript.provider ||
                              "local"}{" "}
                            ·{" "}
                            {take.content_feedback.transcript.model ||
                              "small.en (legacy)"}{" "}
                            · {take.content_feedback.transcript.device || "cpu"}
                          </small>
                          <div className="local-observations">
                            {take.content_feedback.observations?.map((o, i) => (
                              <details key={i}>
                                <summary>
                                  {t(
                                    {
                                      recognized_words_per_minute:
                                        "识别语速（词/分钟）",
                                      interword_gaps: "词间间隔",
                                      audio_quality: "音频质量",
                                    }[o.kind] || o.kind,
                                    o.kind,
                                  )}{" "}
                                  {typeof o.value === "number" ? o.value : ""}
                                </summary>
                                <pre>{JSON.stringify(o.value, null, 2)}</pre>
                                <small>
                                  {o.source} · {o.notice}
                                </small>
                              </details>
                            ))}
                          </div>
                          <p className="transcript">
                            {take.content_feedback.transcript.text || "—"}
                          </p>
                          {take.content_feedback.transcript.uncertain ? (
                            <p className="uncertain">
                              {t(
                                "无法确定：录音无有效语音或识别可信度不足，请回听后重录。",
                                "Uncertain: no clear speech or weak recognition. Listen back and try again.",
                              )}
                            </p>
                          ) : (
                            <div className="diff-list">
                              {take.content_feedback.differences.map((d, i) => (
                                <button
                                  key={i}
                                  disabled={!d.time}
                                  className={`diff ${d.type}`}
                                  onClick={() =>
                                    playSegment(
                                      d.time?.start ?? null,
                                      d.time?.end ?? null,
                                    )
                                  }
                                  title={
                                    d.type === "match"
                                      ? t("识别一致", "Recognized match")
                                      : t(
                                          "识别差异，需复核",
                                          "Recognition difference; review needed",
                                        )
                                  }
                                >
                                  {d.type === "match" ? (
                                    d.expected
                                  ) : (
                                    <>
                                      <small>
                                        {t(
                                          {
                                            omit: "可能漏读",
                                            insert: "可能增读",
                                            substitute: "可能替换",
                                          }[d.type] || "",
                                          {
                                            omit: "Possible omission",
                                            insert: "Possible insertion",
                                            substitute: "Possible substitution",
                                          }[d.type] || "",
                                        )}
                                      </small>
                                      {d.expected}
                                      {d.type === "substitute" && " → "}
                                      {d.actual}
                                    </>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </section>
                      )}
                      {analyzing && (
                        <p className="analysis-status" role="status">
                          <span className="elv-busy-dot" />
                          {t("正在整理反馈", "Preparing feedback")}
                        </p>
                      )}
                      {!analyzing && failedAnalysis && (
                        <p className="analysis-error" role="status">
                          {t(
                            "分析失败，已保存的录音仍可回听。请重试分析。",
                            "Analysis failed. Your saved recording is available; retry analysis.",
                          )}
                        </p>
                      )}
                      <FeedbackPanel
                        key={`${take.id}-${take.pronunciation_feedback?.id || ""}`}
                        record={take}
                        lang={lang}
                        play={playSegment}
                      />
                    </>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
        {!!jobs.length && (
          <section className="job-tray">
            <div className="panel-label">
              {t("任务", "Tasks")}
              <span>
                {activeJobs.length} {t("进行中", "active")}
              </span>
            </div>
            {jobs.slice(0, 5).map((job) => (
              <div className={`job ${job.status}`} key={job.id}>
                <span
                  className={`job-dot ${["queued", "running"].includes(job.status) ? "elv-busy-dot" : ""}`}
                />
                <strong>
                  {t(
                    {
                      generate: "生成示范",
                      analyze: "识别录音",
                      assess: "发音评测",
                      download: "下载模型",
                      export: "合并音频",
                      import: "导入模型",
                      component: "安装 GPU 组件",
                    }[job.action] || job.action,
                    job.action,
                  )}
                </strong>
                <span>
                  {t(
                    {
                      queued: "排队",
                      running: "运行中",
                      completed: "完成",
                      failed: "失败",
                      cancelled: "已取消",
                    }[job.status] || job.status,
                    job.status,
                  )}{" "}
                  {job.total > 1 && `${job.completed}/${job.total}`}
                </span>
                {job.bytes_total && (
                  <progress max={job.bytes_total} value={job.bytes_done} />
                )}
                <small>
                  {job.error ||
                    (job.status === "running"
                      ? t(
                          {
                            synthesizing_kokoro: "正在生成 Kokoro 示范",
                            synthesizing_qwen: "正在生成 Qwen 1.7B 示范",
                            "synthesizing_qwen-small":
                              "正在生成 Qwen 0.6B 示范",
                            transcribing: "正在识别录音",
                            downloading: "正在下载并校验",
                            uploading_for_assessment: "正在请求发音评测",
                            working: "正在处理",
                          }[job.stage] || "正在处理",
                          {
                            synthesizing_kokoro: "Synthesizing Kokoro voice",
                            synthesizing_qwen: "Synthesizing Qwen 1.7B voice",
                            "synthesizing_qwen-small":
                              "Synthesizing Qwen 0.6B voice",
                            transcribing: "Transcribing recording",
                            downloading: "Downloading and verifying",
                            uploading_for_assessment:
                              "Requesting pronunciation assessment",
                            working: "Working",
                          }[job.stage] || "Working",
                        )
                      : "")}
                </small>
                {["queued", "running"].includes(job.status) && (
                  <button
                    className="plain"
                    onClick={() =>
                      run(() => api(`/jobs/${job.id}/cancel`, "POST"))
                    }
                  >
                    {t("取消", "Cancel")}
                  </button>
                )}
              </div>
            ))}
          </section>
        )}
      </main>
      {newOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("新建演讲稿", "New speech")}
          >
            <button
              className="modal-close icon-button"
              onClick={() => setNewOpen(false)}
              aria-label={t("关闭", "Close")}
            >
              <X />
            </button>
            <h2>{t("新建演讲稿", "New speech")}</h2>
            <label>
              {t("标题", "Title")}
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </label>
            <label>
              {t("英文演讲稿", "English speech")}
              <textarea
                className="script-input"
                value={script}
                onChange={(e) => setScript(e.target.value)}
                maxLength={100000}
                placeholder={t(
                  "粘贴英文稿件，稍后可以修改分句与朗读稿。",
                  "Paste your English speech. You can edit sentence breaks later.",
                )}
              />
            </label>
            <div className="modal-bottom">
              <button
                className="plain"
                onClick={() => {
                  setScript(SAMPLE);
                  setTitle(t("示例稿件", "Sample speech"));
                }}
              >
                {t("填入示例", "Use sample")}
              </button>
              <span>{script.length.toLocaleString()} / 100,000</span>
              <button
                disabled={!script.trim()}
                className="primary"
                onClick={() =>
                  run(async () => {
                    const result = await api<Session>("/sessions", "POST", {
                      title:
                        title.trim() || t("未命名演讲稿", "Untitled speech"),
                      text: script,
                    });
                    setNewOpen(false);
                    await openSession(result);
                    setSessions(await api<Session[]>("/sessions"));
                  })
                }
              >
                {t("创建练习", "Create practice")}
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </div>
      )}
      {aboutOpen && (
        <div className="modal-backdrop">
          <section
            className="modal about-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("关于 ELOVERIS", "About ELOVERIS")}
          >
            <button
              className="modal-close icon-button"
              aria-label={t("关闭", "Close")}
              onClick={() => setAboutOpen(false)}
            >
              <X />
            </button>
            <Brand />
            <h2>
              {t(
                "让表达更清晰、更自在",
                "Express yourself with clarity and ease",
              )}
            </h2>
            <p>
              {t(
                "通过朗读、回听和具体反馈，让每一次练习都能继续向前。",
                "Move forward with each practice through reading, replay and actionable feedback.",
              )}
            </p>
            <p>ELOVERIS · v0.2.1</p>
          </section>
        </div>
      )}
      {settingsOpen && (
        <div className="modal-backdrop">
          <section
            className="modal settings-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("设置", "Settings")}
          >
            <button
              className="modal-close icon-button"
              aria-label={t("关闭", "Close")}
              onClick={() => setSettingsOpen(false)}
            >
              <X />
            </button>
            <h2>{t("模型与设置", "Models & settings")}</h2>
            <div className="appearance-settings">
              <label>
                {t("外观", "Appearance")}
                <select
                  aria-label={t("外观", "Appearance")}
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  <option value="system">{t("跟随系统", "System")}</option>
                  <option value="light">{t("浅色", "Light")}</option>
                  <option value="dark">{t("深色", "Dark")}</option>
                </select>
              </label>
              <label className="motion-setting">
                <input
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={(e) => setReducedMotion(e.target.checked)}
                />
                {t("减少动态效果", "Reduce motion")}
              </label>
            </div>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            <p>
              {t(
                "首次下载需要联网，准备好模型后，本地练习无需网络。",
                "Initial downloads need internet. Local practice works offline once models are installed.",
              )}
            </p>
            <ProviderSettings
              config={config}
              lang={lang}
              update={(changes) =>
                run(async () => {
                  await api("/settings", "PATCH", changes);
                  await refresh();
                })
              }
              credential={async (value) => {
                try {
                  await api("/settings/tencent/credential", "POST", value);
                  await refresh();
                } catch (e) {
                  setError(String(e));
                  throw e;
                }
              }}
              remove={() =>
                run(async () => {
                  await api("/settings/tencent/credential", "DELETE");
                  await refresh();
                })
              }
            />
            <div className="models">
              {models.map((model) => (
                <article key={model.id}>
                  <div>
                    <strong>{model.name}</strong>
                    <span className={model.ready ? "ready" : "not-ready"}>
                      {model.ready
                        ? t("已准备", "Ready")
                        : t("未安装", "Not installed")}
                    </span>
                  </div>
                  <p>
                    {(model.size / 1024 ** 2).toFixed(1)} MiB · {model.license}
                  </p>
                  <p className="model-description">
                    {modelDescription(model.id, lang)}
                  </p>
                  <small>{model.source}</small>
                  <div className="model-actions">
                    <button
                      className="secondary"
                      onClick={() =>
                        run(() => api(`/models/${model.id}/download`, "POST"))
                      }
                    >
                      <ArrowDownToLine size={14} />
                      {model.ready
                        ? t("校验 / 恢复", "Verify / repair")
                        : t("下载", "Download")}
                    </button>
                    <button
                      className="plain"
                      onClick={() =>
                        run(async () => {
                          const directory = window.desktop
                            ? await window.desktop.chooseDirectory()
                            : prompt(
                                t(
                                  "模型文件夹的绝对路径",
                                  "Absolute model directory",
                                ),
                              );
                          if (directory)
                            await api(`/models/${model.id}/import`, "POST", {
                              directory,
                            });
                        })
                      }
                    >
                      <Folder size={14} />
                      {t("导入", "Import")}
                    </button>
                    <button
                      className="plain danger"
                      onClick={() => {
                        if (confirm(t("删除模型缓存？", "Delete model cache?")))
                          run(async () => {
                            await api(`/models/${model.id}`, "DELETE");
                            await refresh();
                          });
                      }}
                    >
                      <Trash2 size={14} />
                      {t("删除", "Delete")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="settings-section">
              <h3>
                {t("Qwen / GPU 运行组件", "Qwen / GPU runtime component")}
              </h3>
              <p>
                {config?.qwen_runtime
                  ? t(
                      "已检测到运行环境。Qwen 0.6B、1.7B 模型需分别下载。",
                      "Runtime detected. Download Qwen 0.6B and 1.7B models separately.",
                    )
                  : t(
                      "导入发行版的 GPU 组件 ZIP，需要兼容的 NVIDIA 显卡。无法运行时可切换 Kokoro。",
                      "Import the release GPU component ZIP. Requires compatible NVIDIA hardware; use Kokoro if it cannot run.",
                    )}
              </p>
              <button
                className="secondary"
                onClick={() =>
                  run(async () => {
                    const archive = window.desktop
                      ? await window.desktop.chooseRuntime()
                      : prompt(
                          t(
                            "组件 ZIP 的绝对路径",
                            "Absolute component ZIP path",
                          ),
                        );
                    if (archive)
                      await api("/components/qwen/import", "POST", {
                        directory: archive,
                      });
                  })
                }
              >
                {t("导入组件 ZIP", "Import component ZIP")}
              </button>
            </div>
            <div className="settings-section">
              <h3>{t("文件存储", "File storage")}</h3>
              {(["model_dir", "recording_dir"] as const).map((field) => (
                <div className="directory" key={field}>
                  <span>
                    {field === "model_dir"
                      ? t("模型目录", "Models")
                      : t("新录音目录", "New recordings")}
                  </span>
                  <code>{config?.[field]}</code>
                  <button
                    className="plain"
                    onClick={() =>
                      run(async () => {
                        const directory = window.desktop
                          ? await window.desktop.chooseDirectory()
                          : prompt(
                              t("文件夹的绝对路径", "Absolute directory path"),
                            );
                        if (directory) {
                          await api("/settings", "PATCH", {
                            [field]: directory,
                          });
                          await refresh();
                        }
                      })
                    }
                  >
                    {t("更改", "Change")}
                  </button>
                </div>
              ))}
              <small>
                {t(
                  "更改目录不会移动旧录音。旧文件仍可播放和删除。",
                  "Changing directories does not move existing recordings. They remain playable and deletable.",
                )}
              </small>
              <label>
                {t("整篇句间停顿（毫秒）", "Full speech pause (ms)")}
                <input
                  type="number"
                  min="0"
                  max="3000"
                  value={pause}
                  onChange={(e) => setPause(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="settings-section">
              <h3>
                {t("Speechace 发音评测", "Speechace pronunciation assessment")}
              </h3>
              <p>
                {t(
                  "此服务可能收费。仅主动评测时上传对应录音与朗读稿，Basic 最长 30 秒。密钥存储在 Windows 凭据管理器。",
                  "This service may charge you. Only an explicit assessment uploads the selected recording and reference. Basic supports 30 seconds. Keys stay in Windows Credential Manager.",
                )}
              </p>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={config?.speechace_enabled || false}
                  onChange={(e) =>
                    run(async () => {
                      await api("/settings", "PATCH", {
                        speechace_enabled: e.target.checked,
                      });
                      await refresh();
                    })
                  }
                />
                {t("启用 Speechace 评测", "Enable Speechace assessment")}
              </label>
              <label>
                {t("订阅区域", "Subscription region")}
                <select
                  value={config?.speechace_region || "us"}
                  onChange={(e) =>
                    run(async () => {
                      await api("/settings", "PATCH", {
                        speechace_region: e.target.value,
                      });
                      await refresh();
                    })
                  }
                >
                  <option value="us">US</option>
                  <option value="eu">EU</option>
                </select>
              </label>
              <label>
                API key
                <input
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={
                    config?.speechace_configured
                      ? t("已保存；输入可替换", "Saved; enter to replace")
                      : t("未配置", "Not configured")
                  }
                />
              </label>
              <div className="model-actions">
                <button
                  className="secondary"
                  disabled={!key.trim()}
                  onClick={() =>
                    run(async () => {
                      await api("/settings/credential", "POST", { key });
                      setKey("");
                      await refresh();
                    })
                  }
                >
                  {t("保存密钥", "Save key")}
                </button>
                <button
                  className="plain"
                  onClick={() =>
                    run(async () => {
                      await api("/settings/credential", "DELETE");
                      await refresh();
                    })
                  }
                >
                  {t("移除密钥", "Remove key")}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
