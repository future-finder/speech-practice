from typing import Protocol
import httpx
import keyring
from .feedback import number, extent

SERVICE = "speech-practice.speechace"
ACCOUNT = "api-key"
HOSTS = {"us": "https://api.speechace.co", "eu": "https://api4.speechace.com"}


class PronunciationProvider(Protocol):
    def assess(self, audio, reference_text, locale) -> dict: ...


def configured():
    try:
        return bool(keyring.get_password(SERVICE, ACCOUNT))
    except Exception:
        return False


def parse_response(payload):
    if not isinstance(payload, dict):
        raise ValueError("Invalid provider response object.")
    if payload.get("status") != "success":
        return {"status": "failed", "error": payload.get("error_code", "provider_error"), "words": [], "score": None}
    text = payload.get("text_score") or {}
    if not isinstance(text, dict):
        raise ValueError("Invalid provider score object.")
    words = []
    for word in text.get("word_score_list") or []:
        if not isinstance(word, dict):
            continue
        phones = []
        for phone in word.get("phone_score_list") or []:
            if not isinstance(phone, dict):
                continue
            interval = phone.get("extent")
            start, end = extent(interval[0], interval[1], float('inf'), 100) if isinstance(interval, (list, tuple)) and len(interval) == 2 else (None, None)
            phones.append({"phone": phone.get("phone"), "score": number(phone.get("quality_score")),
                           "sound_most_like": phone.get("sound_most_like"),
                           "start": start, "end": end,
                           "stress_score": phone.get("stress_score"), "suggestion": suggestion(phone)})
        timed = [p for p in phones if p["start"] is not None]
        words.append({"word": word.get("word"), "score": word.get("quality_score"), "phones": phones,
                      "start": min((p["start"] for p in timed), default=None), "end": max((p["end"] for p in timed), default=None)})
    return {"status": "success", "score": (text.get("speechace_score") or {}).get("pronunciation"), 'raw_provider_result': payload,
            "words": words, "provider": "speechace", "version": payload.get("version"),
            "notice": "Provider assessment, not a definitive diagnosis."}


def suggestion(phone):
    value = number(phone.get('quality_score'))
    if value is None or not 0 <= value < 70:
        return None
    tips = {"th": {"zh": "舌尖轻触上下齿之间，送气，不振动声带。", "en": "Place your tongue lightly between your teeth; let air flow without voicing."},
            "dh": {"zh": "舌尖轻触上下齿之间，并让声带振动。", "en": "Place your tongue lightly between your teeth and add voicing."},
            "r": {"zh": "舌头向后收，避免舌尖接触上颚。", "en": "Draw the tongue back without touching the roof of your mouth."},
            "v": {"zh": "上齿轻触下唇，送气并振动声带。", "en": "Touch the lower lip with upper teeth; add airflow and voicing."}}
    tip = tips.get(phone.get("phone"))
    return {"kind": "general_articulation_tip", **tip} if tip else None


class SpeechaceProvider:
    def __init__(self, settings):
        self.settings = settings

    def assess(self, audio, reference_text, locale):
        if not self.settings.values.get("speechace_enabled"):
            return {"status": "unavailable", "error": "provider_disabled", "words": [], "score": None}
        try:
            key = keyring.get_password(SERVICE, ACCOUNT)
        except Exception:
            key = None
        if not key:
            return {"status": "unavailable", "error": "api_key_required", "words": [], "score": None}
        import soundfile as sf
        if sf.info(str(audio)).duration > 30:
            raise ValueError("Speechace Basic accepts up to 30 seconds. Split the sentence or record again.")
        # Never include HTTP exception URLs: the vendor requires the API key in the query string.
        try:
            with open(audio, "rb") as source, httpx.Client(timeout=90) as client:
                response = client.post(HOSTS[self.settings.values.get("speechace_region", "us")] + "/api/scoring/text/v9/json",
                    params={"key": key, "dialect": locale}, data={"text": reference_text, "no_mc": "1"},
                    files={"user_audio_file": ("recording.wav", source, "audio/wav")})
            if response.status_code != 200:
                return {"status": "failed", "error": f"provider_http_{response.status_code}", "words": [], "score": None}
            return parse_response(response.json())
        except (httpx.HTTPError, ValueError):
            return {"status": "failed", "error": "provider_connection_or_response_error", "words": [], "score": None}
