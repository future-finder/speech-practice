from typing import Literal
from pydantic import BaseModel, Field, model_validator


class Options(BaseModel):
    provider: Literal["kokoro", "qwen", "qwen-small"] = "kokoro"
    voice: str = "af_sarah"
    speed: float = Field(default=1, ge=0.5, le=2)
    style: str = Field(default="", max_length=500)

    @model_validator(mode='after')
    def supported_style(self):
        if self.provider == 'qwen-small' and self.style.strip():
            raise ValueError('Qwen3-TTS 0.6B does not support delivery instructions. Clear the style or select 1.7B.')
        return self


class SessionCreate(BaseModel):
    title: str = Field(default="Untitled speech", min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=100_000)


class SentenceEdit(BaseModel):
    spoken_text: str = Field(min_length=1, max_length=10_000)
    options: Options = Field(default_factory=Options)


class SplitRequest(BaseModel):
    offset: int = Field(gt=0)


class Progress(BaseModel):
    sentence_id: str


class GenerateRequest(BaseModel):
    sentence_id: str | None = None


class ExportRequest(BaseModel):
    pause_ms: int = Field(default=300, ge=0, le=3000)


class PronunciationRequest(BaseModel):
    consent: bool = False
    locale: Literal["en-us", "en-gb"] = "en-us"
    provider: Literal['speechace', 'tencent'] = 'speechace'


class AnalyzeRequest(BaseModel):
    provider: Literal['local', 'tencent'] = 'local'
    model: Literal['whisper', 'whisper-distil', 'whisper-turbo', 'parakeet'] = 'whisper'
    device: Literal['cpu', 'cuda'] = 'cpu'
    consent: bool = False

    @model_validator(mode='after')
    def supported_device(self):
        if self.provider == 'local' and self.model == 'parakeet' and self.device != 'cpu':
            raise ValueError('Parakeet uses CPU int8 in this app. Select CPU.')
        return self


class TencentCredential(BaseModel):
    appid: str = Field(pattern=r'^\d{1,20}$')
    secret_id: str = Field(min_length=1, max_length=200)
    secret_key: str = Field(min_length=1, max_length=200)


class SettingsEdit(BaseModel):
    model_dir: str | None = None
    recording_dir: str | None = None
    speechace_enabled: bool | None = None
    speechace_region: Literal["us", "eu"] | None = None
    tencent_asr_enabled: bool | None = None
    tencent_pronunciation_enabled: bool | None = None
    asr_provider: Literal['local', 'tencent'] | None = None
    asr_model: Literal['whisper', 'whisper-distil', 'whisper-turbo', 'parakeet'] | None = None
    asr_device: Literal['cpu', 'cuda'] | None = None
    pronunciation_provider: Literal['speechace', 'tencent'] | None = None
    model_source: Literal['publisher', 'hf-mirror'] | None = None


class Credential(BaseModel):
    key: str = Field(min_length=1, max_length=500)


class ImportModel(BaseModel):
    directory: str


class AudioResult(BaseModel):
    path: str
    sample_rate: int
    duration: float


class Transcript(BaseModel):
    text: str
    words: list[dict]
    uncertain: bool = False
    reason: str | None = None
    provider: str = 'local'
    model: str | None = None
    device: str | None = None
    parameters: dict = Field(default_factory=dict)
    audio_quality: dict = Field(default_factory=dict)
    raw_provider_result: dict | None = None
