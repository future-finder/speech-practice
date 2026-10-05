import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, Folder, Trash2 } from "lucide-react";
import { Workspace, type View } from "./Workspace";
import { Dialog } from "./Dialog";
import { ProviderSettings } from "./ProviderSettings";
import { modelDescription } from "./modelInfo";
import { playbackRange } from "./segment";
import type { ActivityData, ActivitySpeech } from "./practiceData";
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
  const [lang, setLang] = useState<"zh" | "en">(() =>
    localStorage.getItem("language") === "en" ? "en" : "zh",
  );
  const [view, setView] = useState<View>("practice");
  const [preparing, setPreparing] = useState(false);
  const [pathRequest, setPathRequest] = useState<{
    label: string;
    resolve: (value: string | null) => void;
  }>();
  const [pathValue, setPathValue] = useState("");
  const requestPath = (label: string) => {
    setPathValue("");
    return new Promise<string | null>((resolve) =>
      setPathRequest({ label, resolve }),
    );
  };
  const closePath = useCallback(
    () =>
      setPathRequest((item) => {
        item?.resolve(null);
        return undefined;
      }),
    [],
  );
  const [confirmation, setConfirmation] = useState<{
    message: string;
    resolve: (value: boolean) => void;
  }>();
  const ask = (message: string) =>
    new Promise<boolean>((resolve) => setConfirmation({ message, resolve }));
  const closeNew = useCallback(() => setNewOpen(false), []);
  const closeConfirm = useCallback(
    () =>
      setConfirmation((item) => {
        item?.resolve(false);
        return undefined;
      }),
    [],
  );
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [conn, setConn] = useState<Connection>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionListLoaded, setSessionListLoaded] = useState(false);
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
  const [practiceJobIds, setPracticeJobIds] = useState<
    { id: string; sentence: string; recording?: string; action: string }[]
  >([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
  const pendingRecording = useRef<string | null>(null);
  const [activityVersion, setActivityVersion] = useState(0);
  const activityCache = useRef<
    { version: number; data: ActivityData } | undefined
  >(undefined);
  const sentences = session?.sentences || [];
  const sentence = sentences.find((s) => s.id === current);
  const index = sentences.findIndex((s) => s.id === current);
  const history = recordings.filter((r) => r.sentence_id === current);
  const take = history.find((r) => r.id === selectedRecording) || history[0];
  const activeJobs = jobs.filter((j) =>
    ["queued", "running"].includes(j.status),
  );

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
      const result = await response.json();
      if (method !== "GET") setActivityVersion((v) => v + 1);
      return result;
    },
    [conn],
  );
  const activitySignature = JSON.stringify([
    sessions.map((s) => s.id),
    session,
    recordings,
  ]);
  useEffect(() => {
    setActivityVersion((v) => v + 1);
  }, [activitySignature]);
  const loadActivity = useCallback(async (): Promise<ActivityData> => {
    if (activityCache.current?.version === activityVersion)
      return activityCache.current.data;
    const speeches: ActivitySpeech[] = [],
      failed: string[] = [];
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, sessions.length) }, async () => {
        while (cursor < sessions.length) {
          const item = sessions[cursor++];
          try {
            const detail = await api<Session>(`/sessions/${item.id}`);
            const takes = await api<Recording[]>(
              `/sessions/${item.id}/recordings`,
            );
            speeches.push({ session: detail, recordings: takes });
          } catch {
            failed.push(item.id);
          }
        }
      }),
    );
    const data = { speeches, failed };
    if (!failed.length)
      activityCache.current = { version: activityVersion, data };
    return data;
  }, [api, sessions, activityVersion]);
  const run = async (action: () => Promise<unknown>) => {
    setError("");
    try {
      await action();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };
  async function queuePractice(
    path: string,
    body: unknown,
    recordingId?: string,
  ) {
    const sentenceId = current;
    const job = await api<Job>(path, "POST", body);
    setPracticeJobIds((items) => [
      ...items.filter(
        (item) =>
          !(
            item.sentence === sentenceId &&
            item.recording === recordingId &&
            item.action === job.action
          ),
      ),
      {
        id: job.id,
        sentence: sentenceId,
        recording: recordingId,
        action: job.action,
      },
    ]);
    return job;
  }
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
    setSessionListLoaded(true);
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
        window.history.replaceState(
          null,
          "",
          location.pathname + location.search,
        );
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
    setSelectedRecording(pendingRecording.current || "");
    pendingRecording.current = null;
  }, [current, sentence?.version, session?.id]);
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

  async function openSession(item: Session, recordingToOpen?: Recording) {
    if (recording || uploading || preparing) return;
    demo.current?.pause();
    own.current?.pause();
    stopAt.current = null;
    activeSession.current = item.id;
    const detail = await api<Session>(`/sessions/${item.id}`);
    const takes = await api<Recording[]>(`/sessions/${item.id}/recordings`);
    if (activeSession.current !== item.id) return;
    pendingRecording.current =
      recordingToOpen &&
      (current !== recordingToOpen.sentence_id || session?.id !== item.id)
        ? recordingToOpen.id
        : null;
    setSession(detail);
    setCurrent(recordingToOpen?.sentence_id || detail.current_sentence_id);
    setSelectedRecording(recordingToOpen?.id || "");
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
    if (!session || recording || uploading || preparing) return;
    demo.current?.pause();
    own.current?.pause();
    stopAt.current = null;
    pendingRecording.current = null;
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
    if (!sentence || recording || uploading || preparing) return;
    setPreparing(true);
    demo.current?.pause();
    own.current?.pause();
    try {
      const snapshot = await saveSentence();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream.current = stream;
      const mime = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/webm",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : {},
      );
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
          setNotice(t("录音已保存。", "Recording saved."));
        } catch (e) {
          setError(String(e));
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
    } finally {
      setPreparing(false);
    }
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

  const editorControls = session && (
    <details className="editor">
      <summary>
        {t("编辑朗读稿与分句", "Edit spoken text & sentence breaks")}
      </summary>
      <textarea
        ref={editor}
        aria-label={t("实际朗读稿", "Spoken text")}
        disabled={recording || uploading || preparing}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="editor-actions">
        <button
          className="secondary"
          disabled={recording || uploading || preparing}
          onClick={() => run(() => saveSentence())}
        >
          {t("保存", "Save")}
        </button>
        <button
          className="plain"
          disabled={recording || uploading || preparing}
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
            uploading ||
            preparing
          }
          onClick={() =>
            run(async () => {
              await saveSentence();
              setSession(
                await api<Session>(`/sentences/${current}/merge`, "POST"),
              );
            })
          }
        >
          {t("合并下一句", "Merge next")}
        </button>
      </div>
    </details>
  );
  const voiceControls = session && (
    <>
      <div className="voice-options">
        <label>
          {t("示范模型", "Voice model")}
          <select
            disabled={recording || uploading || preparing}
            value={options.provider}
            aria-label={t("示范模型", "Voice model")}
            aria-describedby="tts-model-description"
            onChange={(e) =>
              setOptions({
                provider: e.target.value as Options["provider"],
                voice: e.target.value === "kokoro" ? "af_sarah" : "Ryan",
                speed: 1,
                style: "",
              })
            }
          >
            <option value="kokoro">Kokoro · CPU</option>
            <option value="qwen">Qwen3-TTS 1.7B · NVIDIA</option>
            <option value="qwen-small">Qwen3-TTS 0.6B · NVIDIA</option>
          </select>
        </label>
        <label>
          {t("声线", "Speaker")}
          <select
            disabled={recording || uploading || preparing}
            value={options.voice}
            aria-label={t("声线", "Speaker")}
            onChange={(e) => setOptions({ ...options, voice: e.target.value })}
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
              disabled={recording || uploading || preparing}
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
        disabled={recording || uploading || preparing}
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
        {t("将示范设置应用到整篇", "Apply voice settings to whole speech")}
      </button>
    </>
  );

  const settingsContent = (
    <>
      <p className="settings-intro">
        {t(
          "首次下载需要联网。模型准备好后，本地练习可离线使用。",
          "Initial downloads need internet. Local practice works offline once models are installed.",
        )}
      </p>
      <div id="settings-services">
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
      </div>
      <h2 id="settings-models">{t("模型", "Models")}</h2>
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
                      : await requestPath(
                          t("模型文件夹的绝对路径", "Absolute model directory"),
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
                onClick={async () => {
                  if (await ask(t("删除模型缓存？", "Delete model cache?")))
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
        <h3>{t("Qwen / GPU 运行组件", "Qwen / GPU runtime component")}</h3>
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
                : await requestPath(
                    t("组件 ZIP 的绝对路径", "Absolute component ZIP path"),
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
        <h3 id="settings-storage">{t("文件存储", "File storage")}</h3>
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
                    : await requestPath(
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
        <h3>{t("Speechace 发音评测", "Speechace pronunciation assessment")}</h3>
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
      <section className="settings-section">
        <h3>{t("后台任务", "Background tasks")}</h3>
        {activeJobs.length ? (
          activeJobs.map((job) => (
            <div className="background-job" key={job.id}>
              <span>
                {job.action} · {job.stage} · {job.completed} / {job.total}
              </span>
              <button
                onClick={() => run(() => api(`/jobs/${job.id}/cancel`, "POST"))}
              >
                {t("取消", "Cancel")}
              </button>
            </div>
          ))
        ) : (
          <p className="muted">{t("暂无进行中的任务", "No active tasks")}</p>
        )}
      </section>
    </>
  );
  return (
    <>
      <Workspace
        loadActivity={loadActivity}
        openRecording={(item, row) =>
          run(async () => {
            await openSession(item, row);
            if (activeSession.current !== item.id) return;
            setView("analysis");
          })
        }
        lang={lang}
        session={session}
        sessions={sessions}
        current={current}
        take={take}
        history={history}
        recordings={recordings}
        recordingStream={recording ? micStream.current : null}
        preparing={preparing}
        processing={activeJobs.find((job) =>
          ["analyze", "assess"].includes(job.action) && practiceJobIds.some((item) =>
            item.id === job.id && item.sentence === current && item.recording === take?.id
          )
        )?.action as "analyze" | "assess" | undefined}
        loaded={sessionListLoaded}
        view={view}
        navigate={(next) => {
          if (!recording && !uploading && !preparing) setView(next);
        }}
        newSpeech={() => {
          setTitle("");
          setScript("");
          setNewOpen(true);
        }}
        settingsContent={settingsContent}
        wholeAsset={wholeAsset}
        generateAll={() => {
          if (!session) return;
          run(async () => {
            await saveSentence();
            await queuePractice(`/sessions/${session!.id}/generate`, {});
          });
        }}
        exportSpeech={(play) => {
          run(() => exportSpeech(play));
        }}
        recording={recording}
        uploading={uploading}
        seconds={seconds}
        preview={preview}
        error={error}
        notice={notice}
        rate={rate}
        loop={loop}
        demo={demo}
        own={own}
        editor={editorControls}
        voice={voiceControls}
        jobs={
          <div className="pa-job-status">
            {jobs
              .filter(
                (job) =>
                  ["queued", "running", "failed"].includes(job.status) &&
                  practiceJobIds.some(
                    (item) =>
                      item.id === job.id &&
                      item.sentence === current &&
                      (!item.recording || item.recording === take?.id),
                  ),
              )
              .slice(0, 3)
              .map((job) => (
                <div
                  key={job.id}
                  role={job.status === "failed" ? "alert" : "status"}
                >
                  <span>
                    {t(
                      {
                        generate: "生成示范",
                        analyze: "识别录音",
                        assess: "发音评测",
                      }[job.action] || job.action,
                      job.action,
                    )}{" "}
                    ·{" "}
                    {t(
                      { queued: "排队", running: "进行中", failed: "失败" }[
                        job.status
                      ] || job.status,
                      job.status,
                    )}
                    {job.error ? `：${job.error}` : ""}
                  </span>
                  {job.status !== "failed" && (
                    <button
                      onClick={() =>
                        run(() => api(`/jobs/${job.id}/cancel`, "POST"))
                      }
                    >
                      {t("取消", "Cancel")}
                    </button>
                  )}
                </div>
              ))}
          </div>
        }
        audioUrl={audioUrl}
        openSession={(item) => {
          run(() => openSession(item));
        }}
        selectSentence={(id) => {
          run(() => selectSentence(id));
        }}
        selectRecording={setSelectedRecording}
        setRate={setRate}
        setLoop={setLoop}
        setError={setError}
        generate={() => {
          run(async () => {
            await saveSentence();
            await queuePractice(`/sessions/${session!.id}/generate`, {
              sentence_id: current,
            });
          });
        }}
        record={() =>
          recording ? mic.current?.stop() : void run(() => startRecording())
        }
        analyze={async () => {
          if (!take) return;
          const cloud = config?.asr_provider === "tencent";
          if (
            cloud &&
            !(await ask(
              t(
                "将录音上传至腾讯云识别，可能收费，是否继续？",
                "Upload audio to Tencent ASR? Charges may apply.",
              ),
            ))
          )
            return;
          run(() =>
            queuePractice(
              `/recordings/${take.id}/analyze`,
              {
                provider: config?.asr_provider || "local",
                model: config?.asr_model || "whisper",
                device: config?.asr_device || "cpu",
                consent: cloud,
              },
              take.id,
            ),
          );
        }}
        assess={async () => {
          if (
            !take ||
            !(await ask(
              t(
                `将此录音和录音时的朗读稿上传至 ${config?.pronunciation_provider || "speechace"}。可能收费，是否继续？`,
                `Upload audio and its saved reference to ${config?.pronunciation_provider || "speechace"}? Charges may apply.`,
              ),
            ))
          )
            return;
          run(() =>
            queuePractice(
              `/recordings/${take.id}/assess`,
              {
                consent: true,
                locale: "en-us",
                provider: config?.pronunciation_provider || "speechace",
              },
              take.id,
            ),
          );
        }}
        download={(id) => {
          run(() => saveAudio(id));
        }}
        remove={async () => {
          if (
            !take ||
            !(await ask(
              t(
                "删除这条录音及反馈？",
                "Delete this recording and its feedback?",
              ),
            ))
          )
            return;
          run(async () => {
            await api(`/recordings/${take.id}`, "DELETE");
            await refresh();
          });
        }}
        play={(start, end) => {
          demo.current?.pause();
          playSegment(start, end);
        }}
        manualPlayback={() => {
          stopAt.current = null;
        }}
        audioTimeUpdate={() => {
          if (
            own.current &&
            stopAt.current !== null &&
            own.current.currentTime >= stopAt.current
          ) {
            own.current.pause();
            stopAt.current = null;
          }
        }}
        dismissNotice={() => setNotice("")}
        language={() => {
          const next = lang === "zh" ? "en" : "zh";
          setLang(next);
          localStorage.setItem("language", next);
        }}
      />
      {newOpen && (
        <Dialog
          title={t("新建演讲稿", "New speech")}
          close={closeNew}
          closeLabel={t("关闭", "Close")}
        >
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
                    title: title.trim() || t("未命名演讲稿", "Untitled speech"),
                    text: script,
                  });
                  setNewOpen(false);
                  setView("practice");
                  await openSession(result);
                  setSessions(await api<Session[]>("/sessions"));
                })
              }
            >
              {t("创建练习", "Create practice")}
              <ArrowRight size={16} />
            </button>
          </div>
        </Dialog>
      )}
      {pathRequest && (
        <Dialog
          title={t("选择本地文件", "Select local files")}
          close={closePath}
          closeLabel={t("关闭", "Close")}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!pathValue.trim()) return;
              pathRequest.resolve(pathValue.trim());
              setPathRequest(undefined);
            }}
          >
            <label>
              {pathRequest.label}
              <input
                value={pathValue}
                onChange={(event) => setPathValue(event.target.value)}
              />
            </label>
            <div className="confirm-actions">
              <button type="button" onClick={closePath}>
                {t("取消", "Cancel")}
              </button>
              <button
                className="primary"
                type="submit"
                disabled={!pathValue.trim()}
              >
                {t("继续", "Continue")}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {confirmation && (
        <Dialog
          title={t("确认操作", "Confirm")}
          close={closeConfirm}
          closeLabel={t("关闭", "Close")}
        >
          <p>{confirmation.message}</p>
          <div className="confirm-actions">
            <button onClick={closeConfirm}>{t("取消", "Cancel")}</button>
            <button
              className="primary"
              onClick={() => {
                confirmation.resolve(true);
                setConfirmation(undefined);
              }}
            >
              {t("继续", "Continue")}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
