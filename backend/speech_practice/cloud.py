"""Tencent ASR (2019-06-14) and new SOE websocket adapters. No URL logging."""
import base64
import hashlib
import hmac
import io
import json
import secrets
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode, quote
import httpx
import keyring
import soundfile as sf
from .feedback import empty, extent, tencent_feedback, json_safe
from .observations import prepare
from .schemas import Transcript

SERVICE = 'speech-practice.tencent'
ACCOUNT = 'credentials'


class CloudError(ValueError):
    def __init__(self, code, request_id=None):
        self.code, self.request_id = str(code), request_id
        # Only a bounded code, never a request URL, token or server-echoed secret.
        super().__init__('Tencent: ' + ''.join(c for c in self.code if c.isalnum() or c in '._-')[:100])


def credentials():
    try:
        value = json.loads(keyring.get_password(SERVICE, ACCOUNT) or '{}')
        return value if all(value.get(k) for k in ('appid', 'secret_id', 'secret_key')) else None
    except Exception:
        return None


def wav16(audio, maximum=60):
    samples, quality = prepare(audio)
    if quality['duration'] > maximum:
        raise CloudError('duration_limit_split_or_rerecord')
    if quality['rms'] < .001:
        raise CloudError('no_clear_speech')
    output = io.BytesIO()
    sf.write(output, samples, 16000, format='WAV', subtype='PCM_16')
    return output.getvalue(), quality


def tc3_headers(body, credential, timestamp):
    """Tencent signature v3, canonical JSON bytes are exactly the submitted bytes."""
    date = datetime.fromtimestamp(timestamp, timezone.utc).strftime('%Y-%m-%d')
    canonical = 'POST\n/\n\ncontent-type:application/json; charset=utf-8\nhost:asr.tencentcloudapi.com\n\ncontent-type;host\n' + hashlib.sha256(body).hexdigest()
    scope = f'{date}/asr/tc3_request'
    string = f'TC3-HMAC-SHA256\n{timestamp}\n{scope}\n{hashlib.sha256(canonical.encode()).hexdigest()}'
    def sign(key, message):
        return hmac.new(key, message.encode(), hashlib.sha256).digest()
    key = sign(sign(sign(('TC3' + credential['secret_key']).encode(), date), 'asr'), 'tc3_request')
    signature = hmac.new(key, string.encode(), hashlib.sha256).hexdigest()
    return {'Content-Type': 'application/json; charset=utf-8', 'Host': 'asr.tencentcloudapi.com',
            'X-TC-Action': 'SentenceRecognition', 'X-TC-Version': '2019-06-14', 'X-TC-Timestamp': str(timestamp),
            'Authorization': f'TC3-HMAC-SHA256 Credential={credential["secret_id"]}/{scope}, SignedHeaders=content-type;host, Signature={signature}'}


def soe_url(credential, reference, timestamp=None, voice_id=None, nonce=None):
    timestamp = timestamp or int(time.time())
    params = {'secretid': credential['secret_id'], 'timestamp': timestamp, 'expired': timestamp + 3600,
              'nonce': nonce or secrets.randbelow(9999999999) + 1, 'server_engine_type': '16k_en',
              'voice_id': voice_id or str(uuid.uuid4()), 'voice_format': 1, 'text_mode': 0, 'ref_text': reference,
              'eval_mode': 1, 'score_coeff': '1.0', 'sentence_info_enabled': 0, 'rec_mode': 1}
    host = 'soe.cloud.tencent.com/soe/api/' + credential['appid']
    raw = host + '?' + '&'.join(f'{k}={v}' for k, v in sorted(params.items()))
    params['signature'] = base64.b64encode(hmac.new(credential['secret_key'].encode(), raw.encode(), hashlib.sha1).digest()).decode()
    return 'wss://' + host + '?' + urlencode(params, quote_via=quote)


def parse_asr(packet, duration):
    packet = json_safe(packet)
    response = packet.get('Response') if isinstance(packet, dict) else None
    if not isinstance(response, dict):
        raise CloudError('invalid_response')
    if response.get('Error'):
        raise CloudError(response['Error'].get('Code', 'provider_error'), response.get('RequestId'))
    text = response.get('Result')
    if not isinstance(text, str):
        raise CloudError('missing_transcript')
    words = []
    for word in response.get('WordList') or []:
        if not isinstance(word, dict):
            continue
        start, end = extent(word.get('StartTime'), word.get('EndTime'), duration, 1000)
        words.append({'word': word.get('Word', ''), 'start': start, 'end': end, 'probability': None})
    return Transcript(text=text, words=words, uncertain=not bool(text.strip()), reason='no_clear_speech' if not text.strip() else None,
                      provider='tencent', model='SentenceRecognition/2019-06-14/16k_en', device='cloud',
                      parameters={'WordInfo': 1, 'language': 'en', 'reference_prompt': False}, raw_provider_result=packet)


class TencentASRProvider:
    def __init__(self, settings, client=None):
        self.settings, self.client = settings, client

    def transcribe(self, audio):
        if not self.settings.values.get('tencent_asr_enabled'):
            raise CloudError('provider_disabled')
        credential = credentials()
        if not credential:
            raise CloudError('api_key_required')
        wav, quality = wav16(audio)
        data = base64.b64encode(wav).decode()
        if len(data) > 3 * 1024 * 1024:
            raise CloudError('base64_limit_split_or_rerecord')
        body = json.dumps({'EngSerViceType': '16k_en', 'SourceType': 1, 'VoiceFormat': 'wav',
                           'Data': data, 'DataLen': len(wav), 'WordInfo': 1}, separators=(',', ':')).encode()
        try:
            if self.client:
                response = self.client.post('https://asr.tencentcloudapi.com/', content=body, headers=tc3_headers(body, credential, int(time.time())))
            else:
                with httpx.Client(timeout=90) as client:
                    response = client.post('https://asr.tencentcloudapi.com/', content=body, headers=tc3_headers(body, credential, int(time.time())))
            response.raise_for_status()
            transcript = parse_asr(response.json(), quality['duration'])
            transcript.audio_quality = quality
            return transcript
        except CloudError:
            raise
        except httpx.TimeoutException:
            raise CloudError('timeout') from None
        except Exception:
            raise CloudError('network_or_invalid_response') from None


class TencentPronunciationProvider:
    def __init__(self, settings, connect=None):
        self.settings, self.connect = settings, connect

    def assess(self, audio, reference_text, locale):
        if not self.settings.values.get('tencent_pronunciation_enabled'):
            return empty('tencent', error={'code': 'provider_disabled'})
        credential = credentials()
        if not credential:
            return empty('tencent', error={'code': 'api_key_required'})
        try:
            if len(reference_text.split()) > 30 or not reference_text.strip():
                raise CloudError('text_limit_split_reference')
            wav, quality = wav16(audio)
            from websockets.sync.client import connect
            connector = self.connect or connect
            # rec_mode=1 uses one complete WAV binary frame. Final marker may contain no result.
            with connector(soe_url(credential, reference_text), open_timeout=20, close_timeout=5, max_size=8 * 1024 * 1024) as websocket:
                handshake = json.loads(websocket.recv(timeout=20))
                if handshake.get('code') != 0:
                    return tencent_feedback(handshake, quality['duration'])
                websocket.send(wav)
                websocket.send('{"type":"end"}')
                selected = None
                deadline = time.monotonic() + 90
                for _ in range(1000):
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise TimeoutError()
                    packet = json.loads(websocket.recv(timeout=remaining))
                    if packet.get('code') != 0:
                        return tencent_feedback(packet, quality['duration'])
                    if isinstance(packet.get('result'), dict):
                        # Nonstreaming sentence mode returns the full result. No segment offsets invented.
                        selected = packet
                    if packet.get('final') == 1:
                        return tencent_feedback(selected or packet, quality['duration'])
                raise CloudError('response_limit')
        except CloudError as error:
            return empty('tencent', 'unreliable' if error.code == 'no_clear_speech' else 'failed', {'code': error.code})
        except TimeoutError:
            return empty('tencent', 'failed', {'code': 'timeout'})
        except Exception:
            return empty('tencent', 'failed', {'code': 'network_or_invalid_response'})
