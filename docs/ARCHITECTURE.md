# 实现结构

当前入口、实现边界和后续开发基线见 [DEVELOPMENT_BASELINE.md](./DEVELOPMENT_BASELINE.md)。
当前 canonical implementation 是下述 ELOVERIS 的 Electron / React / FastAPI 实现。Oracy 工作台属于尚未采用的 alternative implementation，不能套用其组件关系；legacy 的判定依据是实现是否已被替代，而非分支名或版本号。

Git HEAD 与当前源码（含未提交变更）是最终事实源。入口与引用链变化后，应同步更新本文和受影响的 AOCI cognition，并通过正式维护流程验证；文档与历史验收记录不能替代源码核验。

Electron 是桌面生命周期与系统权限边界；React 负责练习交互；FastAPI 管理数据与任务。
模型不在 HTTP 请求线程内推理，避免生成语音时阻塞界面和取消请求。

```mermaid
flowchart LR
  UI[React 练习界面] -->|令牌 / 本机 HTTP| API[FastAPI]
  Electron -->|启动与退出 / 受限 IPC| API
  API --> DB[(SQLite + WAV)]
  API --> Queue[优先任务队列]
  Queue --> CPU[Kokoro / Whisper 独立进程]
  Queue --> GPU[独立 Qwen GPU 组件]
  API --> Downloads[独立下载队列 / 校验]
  API -->|用户主动确认| Speechace[Speechace 可选远程评分]
  API -->|SSE 状态| UI
```

## 可以从这里阅读源码

| 文件 | 职责 |
|---|---|
| `electron/main.cjs`、`preload.cjs` | 本机随机端口与令牌、沙箱、麦克风权限、文件保存、进程退出 |
| `src/App.tsx` | 双语练习、编辑、播放、录音、反馈、模型与服务配置 |
| `backend/speech_practice/app.py` | API、输入限制、鉴权、实际文件与 Range 下载 |
| `storage.py` | 会话、句子版本、历史与进度 |
| `jobs.py`、`worker.py` | 排队、优先级、缓存、取消、推理进程复用与隔离 |
| `providers.py` | Kokoro、Qwen、Whisper 与 Parakeet 的本地推理适配 |
| `text.py` | 分句、带原始位置的规范化与词级编辑距离对齐 |
| `audio.py` | 音频解码、24kHz 单声道 PCM16、重采样与整篇合并 |
| `models.py`、`components.py` | 固定版本模型下载、恢复、哈希校验、安全导入 |
| `pronunciation.py` | Windows 凭据管理器、Speechace v9、缺失字段与时间单位解析 |

## 三个关键不变量

1. **录音引用的是当时的稿件。** 句子修改产生新版本，已保存录音保留旧文本与版本。
   因此历史反馈不会被新稿件重新解释。当前练习卡片展示的是保存后的朗读稿。
2. **缓存包含所有影响语音的输入。** 文本、供应商、声线、参数和固定模型版本共同参与哈希；
   句子编辑会清除当前音频引用，旧缓存仍能在恢复相同参数时复用。
3. **识别差异与发音评分独立。** 编辑距离比较目标词与识别词，只能提示可能的内容变化；
   识别概率没有经过校准，不能作为发音准确率。发音分数来自显式调用的 Speechace 或腾讯评测，并保留供应商来源与量表。

## 当前渲染与状态架构

`electron/main.cjs` 启动本机后端并加载其 HTTP 页面；`index.html` → `src/main.tsx` → `App` 直接挂载，
没有 `AppearanceProvider` 或 `Workspace` 外壳。`App` 协调单一工作台，设置、关于与新建稿件使用模态界面。
样式顺序为 `brand.tokens.css`、`style.css`、`brand.motion.css`；主题与应用内减少动态由 `App` 管理，
系统减少动态同时由 CSS 和真实麦克风波形组件处理。

`Brand` 直接引用 `public/brand/` 的轮廓资源。`RecordingWaveform` 读取真实麦克风流。
任务列表与 SSE 提供 `recording_id`，`App` 据此关联当前录音的分析状态；保存提示由上传成功触发。
显示名 ELOVERIS 不改变 `speech-practice` 技术标识与既有数据目录。

## 调度与恢复

同一推理队列串行工作。整篇任务每完成一句重新入队，让用户新提交的当前句优先运行。
模型下载使用另一条串行队列，不占用已有模型的推理槽位。取消当前推理会结束 worker；
下一次请求重新启动，完成的 WAV 与缓存保留。重启时未完成任务标为失败，用户可重试。
未知生成剩余时间只显示阶段；下载进度来自已接收字节，整篇进度来自已完成句数。

## 构建边界

基础包打包 CPU Python 运行时；高模式包独立打包 PyTorch/CUDA 与 Qwen 依赖。
两个环境分别使用 `uv.lock` 和 `requirements-qwen.lock`；前端使用 `package-lock.json`。
用户无需安装开发运行时。模型权重不在安装包里，版本及哈希在 `model_manifest.json`。
实际测试范围、运行证据与尚未验证的事项见 `VALIDATION.md`。

## 反馈证据与可选推理适配

`feedback.py` owns score provenance, documented scale validation, issue priority rules and non-destructive historical views. `observations.py` owns 16kHz mono preparation and unscored local measurements. `cloud.py` implements independent Tencent ASR and new SOE adapters; credential input validation never echoes secrets. `contracts.py` declares adapter capabilities and limits. Speechace remains behind PronunciationProvider. New assessments are embedded in `assessment_history`; ASR results append to `recognition_history`, retaining the recording's original reference revision. No destructive SQLite migration is needed.

`WhisperProvider` accepts CPU/int8 or CUDA/float16 and a local pinned CT2 directory. GPU requests use the same optional runtime and serial queue as Qwen. Component capability `gpu-asr` prevents silently invoking an old 0.1 GPU runtime for ASR. The worker cache key includes model directory and device, and switching providers releases the previous model.

`src/FeedbackPanel.tsx` renders available/unavailable scores, provider source, history, bounded issues and a timeline. `segment.ts` calculates context independently of original evidence. `ProviderSettings.tsx` keeps ASR and assessment choices independent. Tests verify these boundaries; performance and human validity remain separate evidence in ITERATION_0.2.md.
