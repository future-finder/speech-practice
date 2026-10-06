import { useState } from "react";
import type { Settings } from "./types";
import { modelDescription } from "./modelInfo";

export function ProviderSettings({
  config,
  lang,
  update,
  credential,
  remove,
}: {
  config?: Settings;
  lang: "zh" | "en";
  update: (changes: Partial<Settings>) => void;
  credential: (value: {
    appid: string;
    secret_id: string;
    secret_key: string;
  }) => Promise<void>;
  remove: () => void;
}) {
  const [appid, setAppid] = useState("");
  const [id, setId] = useState("");
  const [key, setKey] = useState("");
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  return (
    <section className="provider-settings">
      <h2>{t("识别与评测", "Recognition & assessment")}</h2>
      <label>
        {t("识别服务", "Recognition provider")}
        <select
          aria-label={t("识别服务", "Recognition provider")}
          value={config?.asr_provider || "local"}
          onChange={(e) =>
            update({ asr_provider: e.target.value as "local" | "tencent" })
          }
        >
          <option value="local">{t("本地识别", "Local recognition")}</option>
          <option value="tencent">
            {t("腾讯云英文 ASR", "Tencent English ASR")}
          </option>
        </select>
      </label>
      <label>
        {t("本地 ASR 模型", "Local ASR model")}
        <select
          value={config?.asr_model || "whisper"}
          aria-label={t("本地 ASR 模型", "Local ASR model")}
          aria-describedby="asr-model-description"
          onChange={(e) =>
            update({
              asr_model: e.target.value,
              ...(e.target.value === "parakeet"
                ? { asr_device: "cpu" as const }
                : {}),
            })
          }
        >
          <option value="whisper">small.en · {t("默认", "Default")}</option>
          <option value="whisper-distil">Distil large-v3.5 CT2</option>
          <option value="whisper-turbo">large-v3-turbo CT2</option>
          <option value="parakeet">Parakeet TDT 0.6B v3 · CPU</option>
        </select>
      </label>
      <p id="asr-model-description" className="model-description">
        {modelDescription(config?.asr_model || "whisper", lang)}
      </p>
      <label>
        {t("本地推理设备", "Local device")}
        <select
          value={config?.asr_device || "cpu"}
          aria-label={t("本地推理设备", "Local device")}
          disabled={config?.asr_model === "parakeet"}
          onChange={(e) =>
            update({ asr_device: e.target.value as "cpu" | "cuda" })
          }
        >
          <option value="cpu">CPU / int8</option>
          <option value="cuda">NVIDIA / float16</option>
        </select>
      </label>
      <p>
        {t(
          "Whisper GPU 识别需要 0.2 版 GPU 组件。识别与示范生成依次执行，首次加载和模型切换会增加等待时间。",
          "Whisper GPU recognition requires the 0.2 GPU component. Recognition and speech synthesis run sequentially; initial loading and model switching add waiting time.",
        )}
      </p>
      <label>
        {t("模型获取来源", "Model download source")}
        <select
          aria-label={t("模型获取来源", "Model download source")}
          value={config?.model_source || "publisher"}
          onChange={(e) =>
            update({
              model_source: e.target.value as "publisher" | "hf-mirror",
            })
          }
        >
          <option value="publisher">
            {t("发布者来源", "Publisher source")}
          </option>
          <option value="hf-mirror">
            hf-mirror.com ·{" "}
            {t(
              "第三方镜像，固定哈希校验",
              "Third-party mirror / pinned hash verification",
            )}
          </option>
        </select>
      </label>
      <label>
        {t("发音评测供应商", "Pronunciation provider")}
        <select
          aria-label={t("发音评测供应商", "Pronunciation provider")}
          value={config?.pronunciation_provider || "speechace"}
          onChange={(e) =>
            update({
              pronunciation_provider: e.target.value as "speechace" | "tencent",
            })
          }
        >
          <option value="speechace">Speechace v9 / Basic · 30s</option>
          <option value="tencent">
            {t(
              "腾讯新版英文句子评测 · 30词 / 60s",
              "Tencent new SOE / sentence · 30 words / 60s",
            )}
          </option>
        </select>
      </label>
      <h3>{t("腾讯云凭据", "Tencent credentials")}</h3>
      <p>
        {t(
          "识别会上传录音；评测还会上传录音时的朗读稿。每次调用需确认，可能收费，费用以账户和官网为准。失败后不会自动调用其他付费服务。",
          "Recognition uploads audio; assessment also uploads its saved reference. Each request requires confirmation and may incur charges under your account terms. Failed requests do not call another paid service automatically.",
        )}
      </p>
      <p>
        <a
          href="https://cloud.tencent.com/document/product/1093/35686"
          target="_blank"
          rel="noreferrer"
        >
          {t("ASR 费用", "ASR pricing")}
        </a>{" "}
        ·{" "}
        <a
          href="https://cloud.tencent.com/document/product/1774/107342"
          target="_blank"
          rel="noreferrer"
        >
          {t("新版评测费用", "New SOE pricing")}
        </a>
      </p>
      <label>
        <input
          type="checkbox"
          checked={config?.tencent_asr_enabled || false}
          onChange={(e) => update({ tencent_asr_enabled: e.target.checked })}
        />
        {t("启用腾讯 ASR", "Enable Tencent ASR")}
      </label>
      <label>
        <input
          type="checkbox"
          checked={config?.tencent_pronunciation_enabled || false}
          onChange={(e) =>
            update({ tencent_pronunciation_enabled: e.target.checked })
          }
        />
        {t("启用腾讯新版评测", "Enable Tencent new SOE")}
      </label>
      <input
        aria-label="Tencent AppID"
        placeholder="AppID"
        value={appid}
        onChange={(e) => setAppid(e.target.value)}
      />
      <input
        aria-label="Tencent SecretId"
        type="password"
        placeholder="SecretId"
        value={id}
        onChange={(e) => setId(e.target.value)}
      />
      <input
        aria-label="Tencent SecretKey"
        type="password"
        placeholder="SecretKey"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />
      <button
        className="secondary"
        disabled={!appid || !id || !key}
        onClick={async () => {
          try {
            await credential({ appid, secret_id: id, secret_key: key });
            setAppid("");
            setId("");
            setKey("");
          } catch {
            /* Parent displays the error; retain input for retry. */
          }
        }}
      >
        {t("保存到 Windows 凭据存储", "Save to Windows Credential Manager")}
      </button>
      <button className="plain" onClick={remove}>
        {t("删除腾讯凭据", "Remove Tencent credentials")}
      </button>
      <p>
        {config?.tencent_configured
          ? t("凭据已保存", "Credentials saved")
          : t(
              "尚未配置；本地功能可用",
              "Not configured; local practice remains available",
            )}
      </p>
    </section>
  );
}
