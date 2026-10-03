import base64
import hashlib
import hmac
import json
from copy import deepcopy
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
import httpx
import numpy as np
import pytest
import soundfile as sf
from speech_practice import cloud
from speech_practice.config import Settings
from speech_practice.feedback import extent, score, tencent_feedback, normalize_legacy, recording_view
from speech_practice.observations import prepare, observations
from speech_practice.pronunciation import parse_response
from test_core import client, sample_wav


@pytest.fixture
def audio(tmp_path):
    path=tmp_path/'中文 recording.wav'
    sf.write(path,np.column_stack([np.sin(np.arange(48000)/48000*440*2*np.pi)*.2]*2),48000)
    return path


def packet():
    # Subset of the official English sentence example (107387), not a real call.
    return {'code':0,'result':{'SuggestedScore':98.80253601074219,'PronAccuracy':98.80253601074219,
      'PronFluency':.9656875133514404,'PronCompletion':1,'Words':[{'MemBeginTime':210,'MemEndTime':350,
      'PronAccuracy':96.01470947265625,'ReferenceWord':'i_0','Word':'i','MatchTag':0,
      'PhoneInfos':[{'MemBeginTime':210,'MemEndTime':350,'PronAccuracy':96.01470947265625,'Phone':'ay','DetectedStress':False,'Stress':False}]}]}}


def test_official_subset_scales_and_provenance():
    result=tencent_feedback(packet(),2)
    assert result['status']=='success' and result['issues']==[]
    assert result['scores']['fluency']['raw_scale']==[0,1]
    assert result['scores']['fluency']['value']==pytest.approx(.9656875)
    assert result['scores']['five_dimension_overall']['value'] is None
    assert result['scores']['intelligibility']['value'] is None
    assert result['score_source']=='PronAccuracy'
    assert result['words'][0]['start']==.21
    assert result['raw_provider_result']==packet()


@pytest.mark.parametrize('value',[None,-1,101,float('nan'),float('inf'),'99',True])
def test_invalid_scores_not_zero(value):
    result=score(value,'tencent','PronAccuracy')
    assert result['value'] is None and result['status']=='unavailable'


def test_nonfinite_raw_provider_numbers_do_not_break_json():
    p=packet();p['result']['PronAccuracy']=float('nan')
    p['result']['Words'][0]['PhoneInfos'][0]['MemBeginTime']=float('inf')
    result=tencent_feedback(p,2)
    assert result['status']=='unreliable'
    assert result['raw_provider_result']['result']['PronAccuracy']=='nonfinite:nan'
    json.dumps(result,allow_nan=False)
    t=cloud.parse_asr({'Response':{'Result':'hello','WordList':[{'Word':'hello','StartTime':float('nan'),'EndTime':300}]}},1)
    json.dumps(t.model_dump(),allow_nan=False)


@pytest.mark.parametrize('start,end',[(None,1),(-1,1),(1,1),(2,1),(0,3),(float('nan'),1)])
def test_unreliable_times_disable_playback(start,end):
    assert extent(start,end,2)==(None,None)


def test_repeat_word_indices_phone_fallback_and_no_duplicates():
    p=packet();word=p['result']['Words'][0]
    word.update(Word='very',ReferenceWord='very_0',PronAccuracy=55)
    word['PhoneInfos'][0].update(Phone='v',PronAccuracy=20)
    second=deepcopy(word);second.update(ReferenceWord='very_1',MemBeginTime=700,MemEndTime=950)
    second['PhoneInfos'][0].update(MemBeginTime=9999,MemEndTime=10000)
    p['result']['Words'].append(second)
    result=tencent_feedback(p,2)
    assert len(result['issues'])==2
    first,last=result['issues'];assert first['evidence']['reference_index']==0 and last['evidence']['reference_index']==1
    assert first['localization_level']=='phoneme' and last['localization_level']=='word'
    assert last['start']==.7
    assert all(i['category']=='pronunciation' for i in result['issues'])
    assert '上齿' in first['advice']


def test_ten_issue_cap_and_missing_fields():
    p=packet();word=p['result']['Words'][0];word.update(PronAccuracy=40,PhoneInfos=[])
    p['result']['Words']=[deepcopy(word) for _ in range(20)]
    assert len(tencent_feedback(p,2)['issues'])==10
    assert tencent_feedback({'code':0,'result':{}},2)['status']=='unreliable'
    assert tencent_feedback({'code':0},2)['status']=='failed'
    assert tencent_feedback({'code':4105},2)['status']=='unreliable'
    assert tencent_feedback({'code':4004,'message':'secret URL'},2)['error']=={'code':'4004'}


def test_legacy_history_is_non_destructive():
    old={'status':'success','score':80,'words':[{'word':'vase','score':40,'start':0,'end':3,'phones':[]}]}
    record={'id':'r','duration':1,'sentence_version':3,'spoken_text':'Vase.','created_at':'old','pronunciation_feedback':old}
    result=recording_view(record)
    assert old['words'][0]['end']==3
    assert result['pronunciation_feedback']['words'][0]['start'] is None
    assert result['assessment_history'][0]['sentence_version']==3
    assert result['assessment_history'][0]['spoken_text']=='Vase.'


def test_speechace_malformed_phone_extents():
    p={'status':'success','text_score':{'word_score_list':[None,{'word':'hi','phone_score_list':[None,{'extent':['bad',None],'quality_score':'bad'}]}]}}
    result=normalize_legacy(parse_response(p),1)
    assert result['status']=='unreliable' and result['words'][0]['phones'][0]['start'] is None


def test_audio_chain_and_unscored_observations(audio):
    samples,quality=prepare(audio)
    assert samples.shape==(16000,) and quality['source_rate']==48000 and quality['source_channels']==2
    t={'uncertain':False,'audio_quality':quality,'words':[{'start':.1,'end':.2},{'start':.9,'end':1}]}
    result=observations(t,1)
    assert result[1]['value']==120 and result[2]['value'][0]['seconds']==.7
    assert len(observations({**t,'uncertain':True},1))==1


def test_soe_signature_matches_official_sdk_algorithm():
    credential={'appid':'123','secret_id':'testid','secret_key':'testsecret'}
    url=cloud.soe_url(credential,"very very & /?",1700000000,'voice',123)
    parts=urlsplit(url);params={k:v[0] for k,v in parse_qs(parts.query).items()}
    actual=params.pop('signature')
    # Official SDK format_sign_string: sorted raw values; exclude appid in query.
    raw=parts.netloc+parts.path+'?'+'&'.join(f'{k}={v}' for k,v in sorted(params.items()))
    expected=base64.b64encode(hmac.new(b'testsecret',raw.encode(),hashlib.sha1).digest()).decode()
    assert actual==expected and params['voice_format']=='1' and params['rec_mode']=='1'


def test_tc3_official_sdk_cross_checked_golden():
    # Fixed synthetic credential; cross-checked against Tencent SDK Sign.sign_tc3.
    header=cloud.tc3_headers(b'{"EngSerViceType":"16k_en"}',{'secret_id':'testid','secret_key':'testsecret'},1700000000)
    assert header['Authorization'].endswith('Signature=70de0eb25ab51635cf869bb4f0ec3debe8d9beb9a6b498fa614d0f98c8918037')


def test_asr_time_missing_and_errors():
    t=cloud.parse_asr({'Response':{'Result':'very very','WordList':[{'Word':'very','StartTime':100,'EndTime':200},{'Word':'very','StartTime':300,'EndTime':9999}]}},1)
    assert t.words[0]['start']==.1 and t.words[1]['start'] is None
    with pytest.raises(cloud.CloudError,match='AuthFailure'):
        cloud.parse_asr({'Response':{'Error':{'Code':'AuthFailure','Message':'key-secret'},'RequestId':'r'}},1)


def test_offline_asr_request_contract(audio,tmp_path,monkeypatch):
    s=Settings(tmp_path);s.values['tencent_asr_enabled']=True
    monkeypatch.setattr(cloud,'credentials',lambda:{'appid':'123','secret_id':'ID','secret_key':'KEY'})
    def handler(request):
        body=json.loads(request.content);assert body['EngSerViceType']=='16k_en' and 'HotwordList' not in body
        wav=base64.b64decode(body['Data']);assert wav[:4]==b'RIFF' and len(wav)==body['DataLen']
        assert request.headers['X-TC-Version']=='2019-06-14'
        return httpx.Response(200,json={'Response':{'Result':'hello','WordList':None}})
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result=cloud.TencentASRProvider(s,client).transcribe(audio)
    assert result.text=='hello' and result.words==[]


def test_ws_handshake_full_wav_and_final_without_result(audio,tmp_path,monkeypatch):
    s=Settings(tmp_path);s.values['tencent_pronunciation_enabled']=True
    monkeypatch.setattr(cloud,'credentials',lambda:{'appid':'123','secret_id':'ID','secret_key':'KEY'})
    class Socket:
        def __init__(self): self.messages=iter([{'code':0},packet(),{'code':0,'final':1}]);self.sent=[]
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def recv(self,timeout):return json.dumps(next(self.messages))
        def send(self,data):self.sent.append(data)
    socket=Socket()
    result=cloud.TencentPronunciationProvider(s,lambda *a,**k:socket).assess(audio,'I go','en-us')
    assert result['status']=='success' and socket.sent[0][:4]==b'RIFF' and json.loads(socket.sent[1])=={'type':'end'}


def test_missing_key_disabled_limit_timeout_preserve_status(audio,tmp_path,monkeypatch):
    s=Settings(tmp_path);provider=cloud.TencentPronunciationProvider(s)
    assert provider.assess(audio,'hi','en-us')['status']=='not_configured'
    s.values['tencent_pronunciation_enabled']=True
    monkeypatch.setattr(cloud,'credentials',lambda:None)
    assert provider.assess(audio,'hi','en-us')['error']['code']=='api_key_required'
    monkeypatch.setattr(cloud,'credentials',lambda:{'appid':'123','secret_id':'ID','secret_key':'KEY'})
    assert provider.assess(audio,'word '*31,'en-us')['error']['code']=='text_limit_split_reference'
    def fail(*a,**k):raise TimeoutError('secret URL')
    assert cloud.TencentPronunciationProvider(s,fail).assess(audio,'hi','en-us')['error']=={'code':'timeout'}


def test_silence_prevents_cloud_upload(tmp_path):
    path=tmp_path/'silence.wav';sf.write(path,np.zeros(16000),16000)
    with pytest.raises(cloud.CloudError,match='no_clear_speech'):cloud.wav16(path)


def test_api_consent_limits_settings_and_no_validation_secret_echo(client):
    session=client.post('/api/sessions',json={'text':'Hello world.'}).json()
    record=client.post(f'/api/sentences/{session["sentences"][0]["id"]}/recordings',files={'file':('voice.wav',sample_wav(),'audio/wav')}).json()
    assert client.post(f'/api/recordings/{record["id"]}/analyze',json={'provider':'tencent'}).status_code==400
    assert client.post(f'/api/recordings/{record["id"]}/assess',json={'provider':'tencent'}).status_code==400
    assert client.get('/api/settings').json()['asr_model']=='whisper'
    assert client.get('/api/settings').json()['tencent_asr_enabled'] is False
    response=client.post('/api/settings/tencent/credential',json={'appid':'invalid','secret_id':'PRIVATE_ID','secret_key':'PRIVATE_KEY'})
    assert response.status_code==422 and 'PRIVATE' not in response.text
    contracts=client.get('/api/providers').json()
    assert contracts['tencent']['reference_words']==30 and contracts['iflytek']['implemented'] is False


def test_assessment_history_and_saved_version_end_to_end(client,monkeypatch):
    import time
    monkeypatch.setattr(cloud.TencentPronunciationProvider,'assess',lambda self,*args:tencent_feedback(packet(),1))
    session=client.post('/api/sessions',json={'text':'I go.'}).json();sentence=session['sentences'][0]
    record=client.post(f'/api/sentences/{sentence["id"]}/recordings',files={'file':('voice.wav',sample_wav(),'audio/wav')}).json()
    client.patch(f'/api/sentences/{sentence["id"]}',json={'spoken_text':'I leave.'})
    for _ in range(2):
        job=client.post(f'/api/recordings/{record["id"]}/assess',json={'provider':'tencent','consent':True}).json()
        for attempt in range(100):
            state=client.get('/api/jobs/'+job['id']).json()
            if state['status'] not in ('queued','running'):break
            time.sleep(.02)
        assert state['status']=='completed'
    saved=client.get('/api/sessions/'+session['id']+'/recordings').json()[0]
    assert len(saved['assessment_history'])==2
    assert all(r['sentence_version']==1 and r['spoken_text']=='I go.' for r in saved['assessment_history'])
    assert saved['assessment_history'][0]['id']!=saved['assessment_history'][1]['id']
    assert saved['pronunciation_feedback']['schema_version']==2
