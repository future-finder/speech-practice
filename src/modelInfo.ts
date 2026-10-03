// Shared by model selection and download cards so capability descriptions stay consistent.
const descriptions: Record<string, { zh: string; en: string }> = {
  kokoro: {
    zh: "CPU 朗读，无需显卡。适合日常跟读。",
    en: "CPU speech synthesis without a GPU. Suitable for daily practice.",
  },
  qwen: {
    zh: "需要 NVIDIA 显卡，支持语气指令。适合控制示范的朗读语气；首次生成可能较慢。",
    en: "Requires NVIDIA hardware and supports delivery instructions. Choose to control delivery; initial generation can be slow.",
  },
  "qwen-small": {
    zh: "需要 NVIDIA 显卡，下载体积小于 1.7B。适合不需要语气控制的朗读；支持 Ryan、Aiden，不支持语气指令。",
    en: "Requires NVIDIA hardware, with a smaller download than 1.7B. Choose when delivery control is unnecessary; supports Ryan and Aiden without delivery instructions.",
  },
  whisper: {
    zh: "默认英文识别模型，可用 CPU。适合先开始练习。",
    en: "Default English recognition model with CPU support. Suitable for starting practice.",
  },
  "whisper-distil": {
    zh: "英文识别，支持 CPU 和 NVIDIA。用于比较其他识别结果；CPU 识别可能较慢。",
    en: "English recognition for CPU or NVIDIA. Choose to compare transcripts; CPU inference can be slow.",
  },
  "whisper-turbo": {
    zh: "Whisper 加速识别模型，支持 CPU 和 NVIDIA。适合用兼容显卡缩短识别等待。",
    en: "An accelerated Whisper model for CPU or NVIDIA. Choose with a compatible GPU to shorten recognition waits.",
  },
  parakeet: {
    zh: "CPU 识别，无需显卡。用于比较其他本地识别结果，不占用显存。识别差异不代表发音错误。",
    en: "CPU recognition without a GPU. Choose to compare local transcripts without using GPU memory. Transcript differences are not pronunciation errors.",
  },
};

export function modelDescription(id: string, lang: "zh" | "en") {
  return descriptions[id]?.[lang] || "";
}
