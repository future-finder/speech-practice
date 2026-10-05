import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type SlotName = "sidebar" | "sentence";
type Asset =
  | "none"
  | "trace"
  | "paper"
  | "plant"
  | "landscape"
  | "geometry"
  | "gradient"
  | "custom";
export type SlotConfig = {
  asset: Asset;
  image?: string;
  positionX: number;
  positionY: number;
  opacity: number;
  blur: number;
  fit: "cover" | "contain";
};
type Preferences = {
  enabled: boolean;
  wallpaper: boolean;
  motion: "full" | "reduced" | "off";
  sidebar: SlotConfig;
  sentence: SlotConfig;
};
const key = "speech-appearance-v1";
const defaults: Preferences = {
  enabled: false,
  wallpaper: true,
  motion: "full",
  sidebar: {
    asset: "plant",
    positionX: 50,
    positionY: 65,
    opacity: 45,
    blur: 0,
    fit: "cover",
  },
  sentence: {
    asset: "paper",
    positionX: 50,
    positionY: 50,
    opacity: 12,
    blur: 0,
    fit: "cover",
  },
};
export const visualAssets: {
  id: Asset;
  zh: string;
  en: string;
  source?: string;
}[] = [
  { id: "none", zh: "纯净", en: "None" },
  {
    id: "trace",
    zh: "声音线迹",
    en: "Voice trace",
    source: "/images/decor/voice-trace.svg",
  },
  {
    id: "paper",
    zh: "纸张肌理",
    en: "Paper",
    source: "/images/decor/paper.svg",
  },
  {
    id: "plant",
    zh: "植物光影",
    en: "Botanical",
    source: "/images/practice-botanical.png",
  },
  {
    id: "landscape",
    zh: "山水留白",
    en: "Landscape",
    source: "/images/decor/landscape.svg",
  },
  {
    id: "geometry",
    zh: "几何线条",
    en: "Geometry",
    source: "/images/decor/geometry.svg",
  },
  { id: "gradient", zh: "柔和渐变", en: "Soft gradient" },
  { id: "custom", zh: "自定义图片", en: "Custom image" },
];
function readPreferences(saved?: unknown): Preferences {
  try {
    const value =
      saved === undefined
        ? JSON.parse(localStorage.getItem(key) || "null")
        : saved;
    const data = value as Partial<Preferences> | null;
    if (!data) return structuredClone(defaults);
    const slot = (name: SlotName): SlotConfig => {
      const s: Partial<SlotConfig> = data[name] || {},
        fallback = defaults[name];
      const clamp = (v: unknown, max: number, initial: number) =>
        typeof v === "number" && Number.isFinite(v)
          ? Math.max(0, Math.min(max, v))
          : initial;
      return {
        asset: visualAssets.some((a) => a.id === s.asset)
          ? s.asset!
          : fallback.asset,
        image: typeof s.image === "string" ? s.image : undefined,
        positionX: clamp(s.positionX, 100, 50),
        positionY: clamp(s.positionY, 100, 50),
        opacity: clamp(s.opacity, 70, fallback.opacity),
        blur: clamp(s.blur, 12, 0),
        fit: s.fit === "contain" ? "contain" : "cover",
      };
    };
    return {
      enabled: data.enabled === true,
      wallpaper: data.wallpaper !== false,
      motion: ["full", "reduced", "off"].includes(data.motion || "")
        ? data.motion!
        : "full",
      sidebar: slot("sidebar"),
      sentence: slot("sentence"),
    };
  } catch {
    return structuredClone(defaults);
  }
}
// Store raster blobs separately from the small preference document; no server upload.
async function imageStore(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("speech-visual-assets", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("images");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("images", mode),
        req = action(tx.objectStore("images"));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Image storage aborted"));
    });
  } finally {
    db.close();
  }
}
async function imageFile(
  action: "get" | "put" | "delete",
  id: string,
  blob?: Blob,
) {
  if (window.desktop?.visualImage) {
    const bytes = await window.desktop.visualImage(
      action,
      id,
      blob ? new Uint8Array(await blob.arrayBuffer()) : undefined,
    );
    return bytes
      ? new Blob([new Uint8Array(bytes)], { type: "image/webp" })
      : undefined;
  }
  return imageStore(action === "get" ? "readonly" : "readwrite", (store) =>
    action === "get"
      ? store.get(id)
      : action === "put"
        ? store.put(blob, id)
        : store.delete(id),
  );
}
type AppearanceValue = {
  prefs: Preferences;
  urls: Partial<Record<SlotName, string>>;
  error: string;
  ready: boolean;
  update: (changes: Partial<Preferences>) => void;
  changeSlot: (slot: SlotName, changes: Partial<SlotConfig>) => void;
  importImage: (slot: SlotName, file: File) => Promise<void>;
  removeImage: (slot: SlotName) => Promise<void>;
  reset: () => Promise<void>;
};
const Context = createContext<AppearanceValue | null>(null);
export const useAppearance = () => {
  const value = useContext(Context);
  if (!value) throw new Error("Appearance provider missing");
  return value;
};
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(() => readPreferences()),
    [urls, setUrls] = useState<AppearanceValue["urls"]>({}),
    [error, setError] = useState(""),
    [ready, setReady] = useState(!window.desktop?.visualPreferences);
  useEffect(() => {
    if (!window.desktop?.visualPreferences) return;
    let disposed = false;
    void window.desktop
      .visualPreferences()
      .then((saved) => {
        if (!disposed) {
          setPrefs(readPreferences(saved));
          setReady(true);
        }
      })
      .catch(() => {
        if (!disposed) {
          setError("storage");
          setReady(true);
        }
      });
    return () => {
      disposed = true;
    };
  }, []);
  const update = (changes: Partial<Preferences>) => {
    const next = { ...prefs, ...changes };
    // A failed write must not pretend that the preference was saved.
    localStorage.setItem(key, JSON.stringify(next));
    setPrefs(next);
    if (window.desktop?.visualPreferences)
      void window.desktop
        .visualPreferences(next)
        .catch(() => setError("storage"));
  };
  useEffect(() => {
    let disposed = false;
    const created: string[] = [];
    setUrls({});
    void (async () => {
      const next: AppearanceValue["urls"] = {};
      let missing = false;
      try {
        for (const slot of ["sidebar", "sentence"] as const) {
          const id = prefs[slot].image;
          if (!id) continue;
          const blob = await imageFile("get", id);
          if (disposed) return;
          if (blob instanceof Blob) {
            next[slot] = URL.createObjectURL(blob);
            created.push(next[slot]!);
          } else if (prefs[slot].asset === "custom") missing = true;
        }
        if (!disposed) {
          setUrls(next);
          setError((previous) =>
            missing ? "missing" : previous === "missing" ? "" : previous,
          );
        }
      } catch {
        if (!disposed) setError("storage");
      }
    })();
    return () => {
      disposed = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [
    prefs.sidebar.image,
    prefs.sentence.image,
    prefs.sidebar.asset,
    prefs.sentence.asset,
  ]);
  useEffect(() => {
    document.documentElement.dataset.motion = prefs.motion;
  }, [prefs.motion]);
  useEffect(() => {
    document.documentElement.dataset.wallpaper = prefs.wallpaper ? "on" : "off";
  }, [prefs.wallpaper]);
  useEffect(() => {
    const resize = () => {
      // Scale typography, controls and columns together in the unframed desktop mode.
      const scale = window.innerWidth >= 1400 ? window.innerWidth / 1466 : 1;
      document.documentElement.style.setProperty(
        "--workspace-scale",
        String(scale),
      );
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const removeImage = async (slot: SlotName) => {
    const id = prefs[slot].image;
    update({ [slot]: { ...prefs[slot], image: undefined, asset: "none" } });
    if (id) await imageFile("delete", id);
  };
  const importImage = async (slot: SlotName, file: File) => {
    if (
      !/^image\/(png|jpeg|webp|avif|gif)$/.test(file.type) ||
      file.size > 12 * 1024 * 1024
    )
      throw new Error("format");
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error("decode");
    }
    try {
      if (bitmap.width * bitmap.height > 40_000_000) throw new Error("size");
      const factor = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * factor));
      canvas.height = Math.max(1, Math.round(bitmap.height * factor));
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("decode"))),
          "image/webp",
          0.86,
        ),
      );
      const id = crypto.randomUUID(),
        previous = prefs[slot].image;
      await imageFile("put", id, blob);
      try {
        update({ [slot]: { ...prefs[slot], asset: "custom", image: id } });
      } catch (e) {
        await imageFile("delete", id);
        throw e;
      }
      setError("");
      if (previous) await imageFile("delete", previous);
    } finally {
      bitmap.close();
    }
  };
  const reset = async () => {
    update(structuredClone(defaults));
    for (const slot of ["sidebar", "sentence"] as const)
      if (prefs[slot].image) await imageFile("delete", prefs[slot].image!);
    setError("");
  };
  return (
    <Context.Provider
      value={{
        prefs,
        urls,
        error,
        ready,
        update,
        changeSlot: (slot, changes) =>
          update({ [slot]: { ...prefs[slot], ...changes } }),
        importImage,
        removeImage,
        reset,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function DecorSlot({
  slot,
  className = "",
  preview = false,
}: {
  slot: SlotName;
  className?: string;
  preview?: boolean;
}) {
  const { prefs, urls } = useAppearance(),
    config = prefs[slot];
  const source =
    config.asset === "custom"
      ? urls[slot]
      : visualAssets.find((a) => a.id === config.asset)?.source;
  const visible =
    (preview || prefs.enabled) &&
    config.asset !== "none" &&
    (config.asset !== "custom" || !!source);
  const style = {
    "--decor-opacity": config.opacity / 100,
    "--decor-blur": `${config.blur}px`,
    backgroundImage: source ? `url("${source}")` : undefined,
    backgroundSize: config.fit,
    backgroundPosition: `${config.positionX}% ${config.positionY}%`,
  } as CSSProperties;
  return (
    <div
      className={`decor-slot ${className}`}
      data-slot={slot}
      data-asset={visible ? config.asset : "none"}
      aria-hidden="true"
    >
      <div className="decor-material" style={style} />
    </div>
  );
}

export function AppearanceSettings({ lang }: { lang: "zh" | "en" }) {
  const a = useAppearance(),
    t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [busy, setBusy] = useState<SlotName | "reset" | null>(null),
    [message, setMessage] = useState("");
  const run = async (
    slot: SlotName | "reset",
    action: () => void | Promise<void>,
  ) => {
    setBusy(slot);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(
        e instanceof Error && ["format", "size"].includes(e.message)
          ? t(
              "请选择不超过 12 MB、4000 万像素的 PNG、JPEG、WebP、AVIF 或 GIF 图片。",
              "Choose a PNG, JPEG, WebP, AVIF or GIF up to 12 MB and 40 megapixels.",
            )
          : t(
              "图片读取或本机保存失败，请换一张图片或检查可用空间。",
              "Image could not be read or saved locally. Try another image or check available storage.",
            ),
      );
    } finally {
      setBusy(null);
    }
  };
  const safe = (action: () => void) => {
    try {
      action();
      setMessage("");
    } catch {
      setMessage(
        t(
          "外观设置未保存，请检查浏览器存储空间。",
          "Appearance could not be saved. Check browser storage.",
        ),
      );
    }
  };
  return (
    <section
      id="settings-appearance"
      className="settings-section appearance-settings"
    >
      <h2>{t("外观", "Appearance")}</h2>
      <fieldset
        className="appearance-global"
        disabled={!a.ready || busy !== null}
      >
        <label>
          <input
            type="checkbox"
            checked={a.prefs.wallpaper}
            onChange={(e) =>
              safe(() => a.update({ wallpaper: e.target.checked }))
            }
          />
          {t("显示背景壁纸", "Show background wallpaper")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={a.prefs.enabled}
            onChange={(e) =>
              safe(() => a.update({ enabled: e.target.checked }))
            }
          />
          {t("开启装饰", "Enable decoration")}
        </label>
        <label>
          {t("动效", "Motion")}
          <select
            aria-label={t("动效", "Motion")}
            value={a.prefs.motion}
            onChange={(e) =>
              safe(() =>
                a.update({ motion: e.target.value as Preferences["motion"] }),
              )
            }
          >
            <option value="full">{t("完整", "Full")}</option>
            <option value="reduced">{t("简化", "Reduced")}</option>
            <option value="off">{t("关闭", "Off")}</option>
          </select>
        </label>
      </fieldset>
      <p className="muted appearance-note">
        {t(
          "图片仅保存在此设备；动效遵循系统的减少动态效果设置。",
          "Images stay on this device. Motion respects your system’s reduced-motion setting.",
        )}
      </p>
      <div className="appearance-slots">
        {(["sidebar", "sentence"] as const).map((slot) => {
          const title =
              slot === "sidebar"
                ? t("左下角素材", "Sidebar material")
                : t("右上角素材", "Sentence material"),
            config = a.prefs[slot];
          return (
            <fieldset
              key={slot}
              disabled={!a.ready || busy !== null}
              className="appearance-slot-controls"
            >
              <legend>{title}</legend>
              <DecorSlot slot={slot} preview className="decor-preview" />
              <label>
                {t("素材", "Material")}
                <select
                  aria-label={title}
                  value={config.asset}
                  onChange={(e) =>
                    safe(() =>
                      a.changeSlot(slot, { asset: e.target.value as Asset }),
                    )
                  }
                >
                  {visualAssets
                    .filter((asset) => asset.id !== "custom" || config.image)
                    .map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {lang === "zh" ? asset.zh : asset.en}
                      </option>
                    ))}
                </select>
              </label>
              <div className="appearance-actions">
                <label className="image-import">
                  {config.image
                    ? t("替换图片", "Replace image")
                    : t("导入图片", "Import image")}
                  <input
                    aria-label={`${title}${t("导入图片", " import image")}`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void run(slot, () => a.importImage(slot, file));
                    }}
                  />
                </label>
                {config.image && (
                  <button
                    type="button"
                    onClick={() => void run(slot, () => a.removeImage(slot))}
                  >
                    {t("删除图片", "Delete image")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    safe(() =>
                      a.changeSlot(slot, {
                        ...defaults[slot],
                        image: config.image,
                      }),
                    )
                  }
                >
                  {t("恢复默认", "Restore default")}
                </button>
              </div>
              {config.asset !== "none" && (
                <div className="material-adjustments">
                  <label>
                    {t("填充方式", "Fit")}
                    <select
                      aria-label={`${title}${t("填充方式", " fit")}`}
                      value={config.fit}
                      onChange={(e) =>
                        safe(() =>
                          a.changeSlot(slot, {
                            fit: e.target.value as SlotConfig["fit"],
                          }),
                        )
                      }
                    >
                      <option value="cover">{t("裁剪填满", "Cover")}</option>
                      <option value="contain">
                        {t("完整显示", "Contain")}
                      </option>
                    </select>
                  </label>
                  {(["positionX", "positionY", "opacity", "blur"] as const).map(
                    (property) => {
                      const label = {
                        positionX: t("水平位置", "Horizontal position"),
                        positionY: t("垂直位置", "Vertical position"),
                        opacity: t("不透明度", "Opacity"),
                        blur: t("模糊", "Blur"),
                      }[property];
                      return (
                        <label key={property}>
                          <span>
                            {label}
                            <output aria-hidden="true">
                              {config[property]}
                              {property === "blur" ? "px" : "%"}
                            </output>
                          </span>
                          <input
                            aria-label={`${title}${label}`}
                            aria-valuetext={`${config[property]}${property === "blur" ? "px" : "%"}`}
                            type="range"
                            min="0"
                            max={
                              property === "blur"
                                ? 12
                                : property === "opacity"
                                  ? 70
                                  : 100
                            }
                            value={config[property]}
                            onChange={(e) =>
                              safe(() =>
                                a.changeSlot(slot, {
                                  [property]: Number(e.target.value),
                                }),
                              )
                            }
                          />
                        </label>
                      );
                    },
                  )}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>
      {busy && <p role="status">{t("正在保存外观…", "Saving appearance…")}</p>}
      {(message || a.error) && (
        <p role="alert" className="pa-error">
          {message ||
            t(
              a.error === "storage"
                ? "外观读取或保存失败，请检查本机存储后重试。"
                : "自定义图片暂不可用，可重新导入或恢复默认。",
              a.error === "storage"
                ? "Appearance could not be read or saved. Check local storage and retry."
                : "Custom image unavailable. Import it again or restore defaults.",
            )}
        </p>
      )}
      <button
        type="button"
        disabled={!a.ready || busy !== null}
        onClick={() => void run("reset", a.reset)}
      >
        {t("恢复全部默认外观", "Restore all appearance defaults")}
      </button>
    </section>
  );
}
