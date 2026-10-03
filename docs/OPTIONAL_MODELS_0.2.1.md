# 0.2.1 可选本地模型

日期：2026-10-04。本轮接入 Parakeet 和 Qwen3-TTS 0.6B；没有替换既有默认模型，没有重构推理调度，也没有执行付费云端评测。

## 接入与选择说明

| 模型 ID | 模型与推理路径 | 下载总字节 | 适用选择与限制 |
|---|---|---:|---|
| `parakeet` | Parakeet TDT 0.6B v3，sherpa-onnx 1.13.8，CPU INT8、6线程 | 670478772 | 无需显卡，希望比较另一种本地转写且不占用显存。并不保证更适合中国口音；不是发音评分模型。 |
| `qwen-small` | Qwen3-TTS 12Hz 0.6B CustomVoice，现有 qwen-tts、NVIDIA BF16、SDPA | 2498383610 | 希望减小 Qwen 权重下载体积；Ryan/Aiden，不支持语气指令，不保证更快或音质更好。 |

选中模型后在选择器下面显示简短介绍，下载卡片复用同一份中英文信息。相关字段保留无障碍名称，说明使用 `aria-describedby` 关联选择器。

Parakeet 仅提供 CPU 路径：界面自动设置 CPU 并禁用设备切换；后端拒绝 CUDA 请求。Qwen 0.6B 隐藏语气选项；更换示范模型会清空先前语气。API 与推理适配器拒绝不支持的语气指令，避免用户以为参数已经生效。

### 固定权重与依赖

- Parakeet ONNX 文件由 sherpa-onnx 维护者 csukuangfj 发布，固定 revision `2bda32ec70b097a55adaa07d9a7173915b43cc78`；原 NVIDIA 权重 CC-BY-4.0，保留归属信息。
- Qwen 0.6B 固定 revision `85e237c12c027371202489a0ec509ded67b5e4b5`，Apache-2.0。
- 下载、断点续传、手动导入、删除与 SHA256/git-blob 校验沿用 ModelManager。模型文件留在用户选择的模型目录，不包含在安装包或源码包中。
- Windows 上明确加载应用自带 `onnxruntime/capi/onnxruntime.dll` 后再导入 sherpa-onnx。本机 System32 中的 ORT 1.17.1 不支持 sherpa 所需 API 28，直接默认加载会导致原生进程退出。基础依赖明确要求 ONNX Runtime >=1.28，并通过锁文件冻结实际版本。
- 基础包收集 sherpa-onnx 原生模块。Qwen 0.6B 对 GPU worker 使用既有 `kind=qwen` 协议，目录决定模型尺寸，可沿用 0.2 GPU 组件；不同模型目录仍有独立加载标识和音频缓存键。

## 验证

50 项后端测试、5 项 Playwright 测试通过，前端 TypeScript 与生产构建通过。新增回归覆盖 BPE 词时间、重复词、缺失/非法时间、能力限制、CPU 设备切换、推理分发、录音历史、重启恢复，以及中英文介绍与语气控件。

真实模型使用隔离数据目录 `.local/optional-model-verification`，不修改日常练习设置或录音。通过应用任务 API 实际生成 Ryan、Aiden 语音，再上传到本地录音接口并由 Parakeet 转写。PCM16 输出、非空转写、词时间边界、静音处理与重启后的录音历史均通过。

| 声线/输入 | Qwen 0.6B 调用秒（含加载） | 输出音频秒 | Parakeet 调用秒（含加载） |
|---|---:|---:|---:|
| Ryan / We choose to listen carefully and speak clearly. | 32.49 | 3.84 | 6.31 |
| Aiden / Practice helps us explain each idea. | 29.47 | 2.72 | 5.28 |

精确时长以 `evidence/optional-models/smoke.json` 为准；生成前移除该隔离测试的对应缓存，以上调用确实运行模型。两次任务交替切换 GPU 朗读与 CPU 识别，因此均包含进程或模型加载。该记录用于证明链路可运行，并非规范的模型性能对比或低配置电脑规格。

Parakeet 的 BPE token 起点和持续时间聚合成词级范围；缺少持续时间、文本无法对应、时间越界或逆序时返回空时间，禁止用下一词起点/录音结尾补造范围。浮点边界统一到微秒精度。它未提供经过校准的正确概率，记录 `confidence=unavailable`；有转写不代表已验证正确。

源码复现：

```powershell
uv sync --frozen
.venv\Scripts\python.exe scripts/prepare_optional_models.py
.venv\Scripts\python.exe scripts/smoke_optional_models.py
.venv\Scripts\python.exe -m pytest -q
npm.cmd run build
npm.cmd run test:ui
```

冻结 worker 验证由 `scripts/smoke_optional_packaged.py` 执行，实际结果保存在 `evidence/optional-models/packaged.json`。界面截图保存在同一目录。

冻结测试中，另一段输入曾在 180 秒的生成测试上限内未返回，尚未定位原因；随后使用表内 Ryan 输入生成成功（含加载约 24.86 秒）。这也限制了本轮结论：已验证可运行的输入和链路，未验证任意稿件的稳定生成时长。

## 前端文案整改

全量检查 `src`、`index.html` 及 Electron 窗口和对话框文案。删除欢迎页、侧栏、页脚和弹窗的口号、装饰性副标题、示范区重复说明，以及未接入服务的开发计划。保留稿件操作、录音与任务状态、模型选择理由、下载和设备条件、上传与费用确认、存储说明、评分来源及可靠性限制。中英文同步修改；示例练习正文、业务操作和接口保持原行为。

文案相关文件：`src/App.tsx`、`src/ProviderSettings.tsx`、`src/FeedbackPanel.tsx`、`src/modelInfo.ts`、`src/style.css`。同步调整 `tests/ui/studio.spec.ts` 和 `scripts/smoke_desktop.cjs` 的定位名称与截图。欢迎页、新建弹窗、最小桌面窗口（1050×700）、权限错误、评测结果、设置顶部与底部的截图保存在 `evidence/ui-copy` 和 `evidence/optional-models`；评测成功画面使用离线测试数据。

## 尚未验证

没有完成人工声音盲听、中国英语学习者多说话人识别测试、人工词时间标注对照或普通低配置电脑测试。生成音频转写成功不能证明真人口音识别效果、朗读质量提高或纠音有效性。当前仍使用一个串行推理 worker，切换模型可能重新加载；此次没有宣称解决该等待问题。

官方来源：[Parakeet 模型](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)、[ONNX 转换与用法](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/nemo-transducer-models.html)、[Qwen 模型能力表](https://github.com/QwenLM/Qwen3-TTS#released-models-description-and-download)。0.6B 模型卡的语气能力描述与当前推理代码不一致，本轮按当前安装库实际忽略 0.6B `instruct` 的行为提供界面与参数校验。
