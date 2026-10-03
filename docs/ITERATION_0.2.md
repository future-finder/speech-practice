# speech-practice 0.2 本轮审查与实现报告

核查日期：2026-10-04。源码、测试和供应商文档分别核查；文档及离线夹具不代表真实云端调用。

## 现状审查

原版实际使用 faster-whisper 1.2.1 / CTranslate2 4.8.2、small.en、CPU int8、6线程、单 worker。固定英文，beam_size=5、词时间戳、VAD、关闭跨段文本条件；没有把参考稿作为识别提示，原版温度采用库默认回退策略。本轮明确 temperature=0，使用单声道16kHz NumPy输入，避免文件解码行为隐含变化。保存录音仍为24kHz PCM16 WAV；解码、声道混合、重采样不提升增益、不降噪，原有峰值限制保留。增加幅度、声道、采样率及近峰值比例观测，不能仅据这些量判定噪音或削波。

原版词级编辑距离对齐保留原始字符位置并处理重复词、缩写及数字。时间来自识别词，不能为漏词捏造时间。录音保存 spoken_text 和 sentence_version，后续编辑不改变录音参考稿。本轮继续复用，校验所有识别及供应商时间范围。

原版 PronunciationProvider 独立于 ASRProvider。Speechace v9 通过 Windows 凭据存储保存密钥；关闭默认，30秒限制，HTTP/响应错误不输出含密钥URL。原解析器缺少评分来源、完整原始结果、时间边界校验和稳定缺失值处理。原版可点击词/音素，但播放没有上下文，切换录音的停止边界需要清理，评估只保存最新结果。

复用 SQLite 通用对象存储、版本快照、模型哈希和断点下载、串行推理队列、独立下载队列、安全 preload、录音和播放组件。GPU ASR 复用可选 GPU 运行组件；和 Qwen 串行，由同一桥接器管理 worker 切换，避免两个推理任务同时占用显存。

## 本轮实现

- ASR 独立选择本地/腾讯，候选 CT2 模型按需下载/导入；CPU int8 或 NVIDIA float16。默认保持 small.en。失败保留录音，通过设置手动切换，禁止自动收费回退。
- 显式16kHz输入、单声道与幅度观测、固定英文和温度；静音及低可信启发式结果显示无法确定。这些规则不是经过校准的准确率；高置信转写仍可能错误。
- 本地观察：识别词数/完整录音时长 ×60，以及可信、有序的词时间戳间 ≥0.7秒间隔。包括首尾静音，不是口语分数，也不把停顿自动判错。无法确定时不展示语速/间隔结论。
- 腾讯 ASR 使用 SentenceRecognition、2019-06-14、16k_en、WordInfo=1。腾讯评测使用产品1774新版 SOE WebSocket、英文句子 eval_mode=1、录音 rec_mode=1，单完整WAV帧，接收最终标志前保存结果。
- 评估 schema_version=2：明确状态、来源、原始尺度、转换方法、缺失原因、原始结果。发音、流利度和完整度对应官方字段；供应商建议评分另列。韵律、可理解度、表达力及五维综合分缺少可信方案时为空，不重新归一化凑分。
- 原 Speechace 历史读取时兼容转换，不修改既有对象；新增评估追加历史，保留录音稿件版本、时间与来源。识别结果也追加历史供后续使用。
- 每次最多10个问题，应用练习优先级规则 practice-priority-v1：分数<40重点、<60中等、<70轻微；不是医学或口型诊断。每个词序号选最低受支持音素，避免同一处重复报告；按分数升序筛选。
- 音素时间有效则优先音素，否则可靠词级时间；时间无效为null并禁用回放。时间必须在录音范围，音素不能越出已知词范围。重复词使用提供的 reference_index/数组序号，不查找首个同名词。
- 点击增加前后250ms上下文，夹在录音边界内；保留原始证据时间。连续点击替换停止边界，切换录音、普通播放操作或结束时清理。时间轴配合文字严重程度。
- 中文/英文一般发音知识模板与词级跟读建议；低分只证明值得复核，不证明具体发音器官原因。当前句子适配器未据 Stress/DetectedStress 自动生成重音诊断，保留原证据供审查。未生成语调、节奏、清晰度、表达力局部问题。
- 云端默认关闭，主动调用时确认上传供应商及内容。腾讯凭据由后端存入 Windows Credential Manager；设置/日志/校验错误不回显密钥。无账号代理、支付或同步。
- 模型固定版本/哈希，下载前检查空间；可手动导入。第三方 hf-mirror 入口依然哈希校验。本次探测发现该入口重定向回 Hugging Face，因此不能声称已验证无海外网络的国内下载链路。模型准备好后的离线流程已另行验证。

## 样本与默认模型依据

用户提供的3条实际录音均为同一说话人、同一参考句，约6.0–6.6秒。用户说明存在发音偏差、错词与较大环境噪音，参考稿只作意图参考。**参考稿不是实际语音真值**。报告中的 reference_mismatch 不表示 ASR 错误率、误报率或发音评分。原始录音没有上传云端，也不收入源码交付包。

另两条为同一条录音的0.15倍幅度和固定种子的加噪派生样本，仅作音频链路压力检查，不能增加独立真人样本量。没有覆盖已标注正确/错词/漏词/重复/停顿多类别语料，也没有完成真人听辨转写真值或纠音有效性复核。

硬件：Windows11 x64 build26200，Intel Core Ultra 9 275HX、32GB RAM、RTX5060 Laptop 8GB、驱动592.01；Python3.12.13，faster-whisper1.2.1，CTranslate2 4.8.2，GPU运行组件 PyTorch2.11.0+cu128。模型见 model_manifest.json 固定修订，MIT；turbo来源为社区转换，当前发布者重命名为 dropbox-dash，原固定URL通过重定向访问。

| 配置 | 模型加载秒 | 真人录音推理秒 | 进程峰值GB | GPU整机峰值MiB |
|---|---:|---:|---:|---:|
| small.en CPU int8 |3.05|1.38–2.05|0.61|847（桌面占用，模型用CPU）|
| Distil large-v3.5 CPU int8 |6.38|6.05–7.20|1.74|854（桌面占用）|
| large-v3-turbo CPU int8 |5.87|5.14–7.56|1.64|847（桌面占用）|
| Distil large-v3.5 GPU float16 |5.30|首条5.17；后续0.28|1.60|3074|
| large-v3-turbo GPU float16 |5.25|首条1.07；后续0.42–0.55|1.72|3202|

加载不包括首次推理的全部懒初始化；实际首次等待须加载与首条推理相加。GPU指标为 nvidia-smi 的整机显存占用，包含桌面，不当作模型净显存或4GB设备兼容证明。内存采样间隔250ms，可能漏过瞬时峰值。此硬件不代表普通低配置电脑。

所有候选在这些实际录音上均出现与意图参考稿的明显差异，无法分辨真实错读与识别误差。未观察到足够稳定的收益支持默认改用大模型；small.en CPU等待更短、内存更低，继续作为免费默认。GPU候选是可选能力增强，不能宣称更准确。完整结果见 docs/evidence/asr-0.2；等待时间和资源占用是选型必要条件，准确性结论需要带真人转写真值的更大语料。

## 供应商契约与费用

| 服务 | 语言/题型与模式 | 评分/定位 | 本轮限制与请求 | 计费 |
|---|---|---|---|---|
| 腾讯ASR | 英文转写，SentenceRecognition 2019-06-14 /16k_en | 无发音评分；词级毫秒时间 | ≤60秒，base64 Data≤3MB；16k单声道PCM16 WAV；HTTPS TC3 | 按调用；免费额度/资源包/后付费取决于账户 |
| 腾讯新版SOE | 英文有稿句子 eval_mode=1 /rec_mode=1 | PronAccuracy 0–100；PronFluency/PronCompletion 0–1；SuggestedScore 0–100；词/音素毫秒时间 | ≤30词、≤60秒；WSS HMAC-SHA1，单WAV帧+end | 句子每次调用计1次；后付费参考0.005元/次 |
| Speechace | en-us/en-gb，Score Text v9 Basic | pronunciation及词/音素quality_score；extent单位10ms | 30秒；multipart音频+稿件 | 用户套餐，详见官方当前价格 |
| 科大讯飞候选 | 英文read_sentence，ISE WS | 需独立核查返回能力和套餐权限 | 本轮未实现适配器/未实际对比 | 无试用条件，未验证 |

腾讯需要账户开通**新版口语评测**和ASR，以及AppID、SecretId、SecretKey/对应权限；旧884接口与新版1774请求不能混用。新版API文档的数据结构链接仍指向共享旧页面，时间单位使用该官方链接定义及新版句子样例校核，其他模式/旧请求不复用。本轮只接单句，不涉及分段偏移推测。

费用核查日2026-10-04；价格及免费条件以实际账户和官网为准。不从产品名称推断用户已免费开通或可用权限。

官方来源：

- [腾讯新版SOE当前API](https://cloud.tencent.com/document/product/1774/107497)、[英文句子模式](https://cloud.tencent.com/document/product/1774/107387)、[评测维度](https://cloud.tencent.com/document/product/1774/107384)、[录音模式](https://cloud.tencent.com/document/product/1774/107372)、[费用](https://cloud.tencent.com/document/product/1774/107342)。
- [腾讯ASR接口](https://cloud.tencent.com/document/product/1093/35646)、[费用](https://cloud.tencent.com/document/product/1093/35686)。
- [Speechace接口](https://api-docs.speechace.com/api-reference/score-text)、[套餐](https://www.speechace.com/api-plans/)。
- [讯飞候选文档](https://www.xfyun.cn/doc/Ise/IseAPI.html)。
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)、[Distil CT2](https://huggingface.co/distil-whisper/distil-large-v3.5-ct2)、[turbo转换模型](https://huggingface.co/dropbox-dash/faster-whisper-large-v3-turbo)。

## 验证状态

本轮源码验证：46项pytest通过，4项Playwright测试通过，TypeScript检查与Vite构建通过。增加官方句子样例子集解析、缺失/特殊分值、不同尺度、非有限数值的安全JSON处理、时间边界、重复词索引、兼容历史、稿件版本关联、主动同意、无密钥、静音、文本超限、权限/额度错误代码和超时处理测试。签名与官方SDK算法离线交叉校核，使用合成非秘密凭据；其中WS/HTTP网络层是MockTransport/模拟socket，不能代表真实权限验证。

浏览器测试使用真实本地后端和虚拟麦克风；新增供应商反馈界面用明确标识的合成夹具验证连续点击、250ms上下文、回放停止、切换录音和历史来源。截图检查发现并修复设置组件误放在对话框外的布局问题，已加对话框内定位检查。未用合成反馈作为纠音有效性证据。

冻结后端测试（PATH移除Python/Node、HTTP代理指向不可用地址）通过真实Kokoro生成、small.en转写、WAV字节/下载/Range、整篇导出、腾讯未配置状态与评估历史。实际0.2 NSIS安装包在中文目录安装成功；桌面测试通过生成、播放时间推进、虚拟麦克风上传、原生保存接口输出WAV、离线识别、腾讯未配置历史、重新加载恢复与退出后后端端口关闭。保存对话框选择由测试夹具替代，实际人的保存窗口操作未复核。这不是无Python/Node已安装的干净虚拟机测试，也不是物理拔网线测试。

GPU组件ZIP通过逐文件SHA256校验安装到独立测试目录，PATH只保留系统目录；独立冻结worker完成Qwen朗读，再串行切换Distil及turbo GPU识别。同样通过冻结后端实际任务API进行GPU识别与历史保存；重启冻结后端后，评估/识别历史、稿件版本、来源均恢复。测试输入为生成的语音，证明组件和调度可运行，不证明中国口音识别有效性。组件安装约59秒，Qwen首次调用含加载约69秒，两个GPU ASR切换调用各约5秒；受本次打包/磁盘负载影响，不作为稳定性能规格。

npm生产依赖审计0漏洞；完整开发工具依赖审计仍有8项high，沿用已有工具链，未通过强制升级绕过兼容性验证。PyInstaller包含可选开发模块缺失警告（FlashAttention/SoX/部分测试模块等）；实际支持路径使用SDPA，所测CPU/GPU推理已通过，不将警告解释为全功能依赖已覆盖。安装包未签名，公开发行的原生依赖对应源码与许可证审计仍沿用0.1的未完成项。

证据：docs/evidence/asr-0.2、desktop-smoke.json、packaged-smoke.json、component-smoke.json；可复现脚本 scripts/benchmark_asr.py、smoke_packaged.py、smoke_desktop.cjs、smoke_component.py、smoke_gpu_api.py、smoke_restart.py。真实腾讯/Speechace在线评估未验证：用户本轮无可用腾讯密钥与权限。官方样例子集及合成边界用例仅用于离线契约解析，不冒充真实调用。真人纠音有效性与音素定位准确性未人工复核。4GB显存、低配置电脑、Windows10、未安装任何开发运行时的干净虚拟机均未独立验证。
