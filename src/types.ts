export interface Connection {
  base: string;
  token: string;
}
declare global {
  interface Window {
    desktop?: {
      connection(): Promise<Connection>;
      saveAudio(id: string): Promise<boolean>;
      chooseDirectory(): Promise<string | null>;
      chooseRuntime(): Promise<string | null>;
    };
  }
}
export interface Options {
  provider: "kokoro" | "qwen" | "qwen-small";
  voice: string;
  speed: number;
  style: string;
}
export interface Sentence {
  id: string;
  version: number;
  original_text: string;
  spoken_text: string;
  options: Options;
  asset_id: string | null;
}
export interface Session {
  id: string;
  title: string;
  original_text: string;
  sentence_ids: string[];
  current_sentence_id: string;
  sentences?: Sentence[];
}
export interface Job {
  id: string;
  action: string;
  status: string;
  stage: string;
  completed: number;
  total: number;
  error: string | null;
  bytes_done?: number;
  bytes_total?: number;
  result?: { asset_id?: string };
  payload?: { recording?: string };
  recording_id?: string | null;
}
export interface Diff {
  type: string;
  expected: string | null;
  actual: string | null;
  time?: { start: number; end: number };
}
export interface Phone {
  phone: string;
  score: number | null;
  sound_most_like?: string;
  start: number | null;
  end: number | null;
  suggestion?: { zh: string; en: string };
}
export interface Pronunciation {
  status: string;
  error?: string | { code: string; request_id?: string };
  score: number | null;
  words: {
    word: string;
    score: number | null;
    start: number | null;
    end: number | null;
    phones: Phone[];
  }[];
  schema_version?: number;
  id?: string;
  created_at?: string;
  provider?: string;
  provider_version?: string;
  overall_score?: number | null;
  overall_label?: string;
  score_source?: string;
  scores?: Record<
    string,
    {
      value: number | null;
      status: string;
      source: string;
      source_field: string | null;
      raw_scale: number[];
      conversion: string;
      reason?: string;
    }
  >;
  issues?: {
    id: string;
    start: number | null;
    end: number | null;
    text: string;
    category: string;
    severity: string;
    problem: string;
    problem_en: string;
    advice: string;
    advice_en: string;
    source: string;
    time_source: string | null;
    localization_level: string;
    evidence: unknown;
  }[];
  raw_provider_result?: unknown;
}
export interface Recording {
  id: string;
  asset_id: string;
  sentence_id: string;
  sentence_version: number;
  spoken_text: string;
  duration: number;
  created_at: string;
  content_feedback?: {
    created_at?: string;
    transcript: {
      text: string;
      uncertain: boolean;
      reason?: string;
      provider?: string;
      model?: string;
      device?: string;
    };
    differences: Diff[];
    observations?: {
      kind: string;
      value: unknown;
      source: string;
      notice: string;
    }[];
  };
  pronunciation_feedback?: Pronunciation;
  assessment_history?: Pronunciation[];
}
export interface Model {
  id: string;
  name: string;
  revision: string;
  license: string;
  source: string;
  size: number;
  ready: boolean;
  path: string;
}
export interface Settings {
  model_dir: string;
  recording_dir: string;
  data_dir: string;
  speechace_enabled: boolean;
  speechace_configured: boolean;
  speechace_region: string;
  qwen_runtime: boolean;
  tencent_configured?: boolean;
  tencent_asr_enabled?: boolean;
  tencent_pronunciation_enabled?: boolean;
  asr_provider?: "local" | "tencent";
  asr_model?: string;
  asr_device?: "cpu" | "cuda";
  pronunciation_provider?: "speechace" | "tencent";
  model_source?: "publisher" | "hf-mirror";
}
