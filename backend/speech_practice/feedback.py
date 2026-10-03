"""Evidence-preserving feedback v2; application priorities are not diagnoses."""
import math
import re
from copy import deepcopy

RULE_VERSION = 'practice-priority-v1'


def json_safe(value):
    """Preserve malformed nonfinite provider numbers as text, not invalid JSON."""
    if isinstance(value, float) and not math.isfinite(value):
        return 'nonfinite:' + str(value)
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    return value
TIPS = {
    'v': ('上齿轻触下唇，保持气流摩擦并让声带振动，再连到后面的元音。', 'Touch your lower lip with your upper teeth, add friction and voicing, then connect to the vowel.'),
    'th': ('舌尖轻触上下齿之间，送气，不振动声带，再连读这个词。', 'Place your tongue lightly between your teeth, let air flow without voicing, then repeat the word.'),
    'dh': ('舌尖轻触上下齿之间，让声带振动，再连读这个词。', 'Place your tongue lightly between your teeth, add voicing, then repeat the word.'),
    'r': ('舌头向后收，避免舌尖接触上颚，再跟读并回听比较。', 'Draw your tongue back without touching the roof of your mouth, then shadow and compare.'),
}


def number(value):
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else None


def score(value, source, field, maximum=100, reason=None):
    value = number(value)
    valid = value is not None and 0 <= value <= maximum
    return {'value': value if valid else None, 'status': 'available' if valid else 'unavailable',
            'source': source, 'source_field': field, 'raw_scale': [0, maximum], 'conversion': 'identity',
            'reason': None if valid else reason or 'Missing or outside the documented scale.'}


def extent(start, end, duration, divisor=1):
    start, end = number(start), number(end)
    if start is None or end is None:
        return None, None
    start, end = start / divisor, end / divisor
    return (start, end) if 0 <= start < end <= duration else (None, None)


def empty(provider, status='not_configured', error=None, version=None):
    return {'schema_version': 2, 'status': status, 'provider': provider, 'provider_version': version,
            'overall_score': None, 'overall_label': '发音评分', 'score_source': None,
            'scores': {k: score(None, provider, None, reason='No supported scoring method.') for k in
                       ('pronunciation', 'fluency', 'completeness', 'prosody', 'intelligibility', 'expressiveness', 'five_dimension_overall')},
            'issues': [], 'observations': [], 'raw_provider_result': None, 'error': error,
            'priority_rule_version': RULE_VERSION, 'score': None, 'words': []}


def build_issues(feedback):
    issues = []
    for index, word in enumerate(feedback['words']):
        # One issue per provider word occurrence; prefer the lowest supported phone.
        candidates = [p for p in word['phones'] if number(p.get('score')) is not None and 0 <= p['score'] < 70]
        phone = min(candidates, key=lambda p: p['score']) if candidates else None
        value = phone['score'] if phone else number(word.get('score'))
        if value is None or not 0 <= value < 70:
            continue
        timed_phone = phone and phone.get('start') is not None
        start, end = (phone['start'], phone['end']) if timed_phone else (word['start'], word['end'])
        label = phone.get('phone', '') if phone else None
        tip = TIPS.get(re.sub(r'\d', '', label or '').lower())
        problem = f'评估结果提示，{word["word"]}' + (f' 中的 /{label}/' if phone else '') + '值得重点复核。'
        advice = tip or ('跟读示范，再回听这个词与相邻词的连接，比较差异。', 'Shadow the example, replay this word with its neighbors and compare.')
        issues.append({'id': f'{feedback["provider"]}-{index}', 'start': start, 'end': end, 'text': word['word'],
                       'category': 'pronunciation', 'severity': 'major' if value < 40 else 'moderate' if value < 60 else 'minor',
                       'problem': problem, 'problem_en': f'The provider flags {word["word"]}' + (f' /{label}/' if phone else '') + ' for review.',
                       'advice': advice[0], 'advice_en': advice[1], 'source': feedback['provider'],
                       'time_source': word.get('time_source') if start is not None else None,
                       'localization_level': 'phoneme' if timed_phone else 'word' if start is not None else 'unavailable',
                       'evidence': {'word_index': index, 'reference_index': word.get('reference_index'), 'phone': label,
                                    'score': value, 'source_field': 'PhoneInfos.PronAccuracy' if phone and feedback['provider'] == 'tencent' else 'quality_score' if feedback['provider'] == 'speechace' else 'Words.PronAccuracy',
                                    'raw_word': word.get('evidence')}, 'priority_rule_version': RULE_VERSION,
                       'advice_kind': 'general_phoneme_template' if tip else 'listening_practice'})
    feedback['issues'] = sorted(issues, key=lambda i: i['evidence']['score'])[:10]
    return feedback


def tencent_feedback(packet, duration):
    packet = json_safe(packet)
    result = empty('tencent', version='soe-new/eval_mode=1/rec_mode=1')
    if not isinstance(packet, dict):
        result.update(status='failed', error={'code': 'invalid_response'})
        return result
    result['raw_provider_result'] = deepcopy(packet)
    if packet.get('code') != 0:
        result.update(status='unreliable' if packet.get('code') in (4105, 4108) else 'failed', error={'code': str(packet.get('code', 'invalid_response'))})
        return result
    raw = packet.get('result')
    if not isinstance(raw, dict):
        result.update(status='failed', error={'code': 'missing_result'})
        return result
    result['scores'].update({k: score(raw.get(field), 'tencent', field, maximum) for k, field, maximum in
                             [('pronunciation', 'PronAccuracy', 100), ('fluency', 'PronFluency', 1),
                              ('completeness', 'PronCompletion', 1), ('provider_suggested', 'SuggestedScore', 100)]})
    result.update(status='success' if result['scores']['pronunciation']['value'] is not None else 'unreliable',
                  overall_score=result['scores']['pronunciation']['value'], score_source='PronAccuracy',
                  overall_label='发音精准度 / PronAccuracy', score=result['scores']['pronunciation']['value'])
    for index, word in enumerate(raw.get('Words') or []):
        if not isinstance(word, dict):
            continue
        start, end = extent(word.get('MemBeginTime'), word.get('MemEndTime'), duration, 1000)
        phones = []
        for phone in word.get('PhoneInfos') or []:
            if not isinstance(phone, dict):
                continue
            ps, pe = extent(phone.get('MemBeginTime'), phone.get('MemEndTime'), duration, 1000)
            # Invalid phone ranges cannot be repaired by invented alignment.
            if start is not None and ps is not None and not start <= ps < pe <= end:
                ps = pe = None
            phones.append({'phone': phone.get('Phone', ''), 'score': score(phone.get('PronAccuracy'), 'tencent', 'PhoneInfos.PronAccuracy')['value'],
                           'start': ps, 'end': pe})
        reference = re.search(r'_(\d+)$', str(word.get('ReferenceWord', '')))
        result['words'].append({'word': word.get('Word', ''), 'score': score(word.get('PronAccuracy'), 'tencent', 'Words.PronAccuracy')['value'],
                                'start': start, 'end': end, 'phones': phones, 'reference_index': int(reference[1]) if reference else None,
                                'time_source': 'Tencent MemBeginTime/MemEndTime (ms)', 'evidence': deepcopy(word)})
    return build_issues(result)


def normalize_legacy(value, duration):
    if not value or value.get('schema_version') == 2:
        return value
    value = json_safe(value)
    result = empty(value.get('provider', 'speechace'), version=value.get('version', 'v9/legacy'))
    result.update(status=value.get('status', 'failed'), error=value.get('error'), raw_provider_result=deepcopy(value.get('raw_provider_result', value)))
    if result['status'] == 'unavailable':
        result['status'] = 'not_configured'
    result['scores']['pronunciation'] = score(value.get('score'), result['provider'], 'speechace_score.pronunciation')
    if result['status'] == 'success' and result['scores']['pronunciation']['value'] is None:
        result['status'] = 'unreliable'
    result.update(overall_score=result['scores']['pronunciation']['value'], score=result['scores']['pronunciation']['value'],
                  score_source='speechace_score.pronunciation')
    for index, word in enumerate(value.get('words') or []):
        word = deepcopy(word)
        word['start'], word['end'] = extent(word.get('start'), word.get('end'), duration)
        word['score'] = score(word.get('score'), result['provider'], 'quality_score')['value']
        for phone in word.get('phones') or []:
            phone['start'], phone['end'] = extent(phone.get('start'), phone.get('end'), duration)
            phone['score'] = score(phone.get('score'), result['provider'], 'quality_score')['value']
        word.update(reference_index=index, time_source='Speechace extent (10ms)', evidence=deepcopy(word))
        result['words'].append(word)
    return build_issues(result)


def recording_view(record):
    record = deepcopy(record)
    record['pronunciation_feedback'] = normalize_legacy(record.get('pronunciation_feedback'), record['duration'])
    history = record.get('assessment_history', [])
    if not history and record['pronunciation_feedback']:
        history = [{**record['pronunciation_feedback'], 'id': 'legacy-' + record['id'], 'created_at': record['created_at'],
                    'sentence_version': record['sentence_version'], 'spoken_text': record['spoken_text']}]
    record['assessment_history'] = history
    return record
