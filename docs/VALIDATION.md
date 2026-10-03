# 验收记录

0.2.0 的现状审查、实际录音 ASR 等待时间/资源对比、腾讯服务契约、历史兼容和新增验证记录见 [本轮报告](ITERATION_0.2.md)。本轮实际录音包含错读与噪声，意图参考稿不是真值，不用于宣称 ASR 准确率。真实在线评估与真人纠音有效性未验证。

以下是0.1.0的历史验证记录。

# 0.1.0 本地预览版验收记录

测试日期：2026-10-03。这是实际本机构建与运行记录，不是所有发布验收已经完成的声明。

## 环境与版本

- Windows 11 家庭版 x64，build 26200；Intel Core Ultra 9 275HX，32GB 内存。
- NVIDIA GeForce RTX 5060 Laptop，8151MiB 显存，驱动 592.01。
- Python 3.12.13；Electron 44.5.1；electron-builder 26.15.3；React 19；Vite 6.4.3。
- Kokoro ONNX 0.4.9、ONNX Runtime 1.30.0、faster-whisper 1.2.1、CTranslate2 4.8.2、PyAV 16.1.0。
- 高模式：qwen-tts 0.1.1、PyTorch 2.11.0+cu128、Transformers 4.57.3、BF16、SDPA。
- 精确锁定版本：`uv.lock`、`package-lock.json`、`requirements-qwen.lock`。
  模型固定 revision、大小与哈希：`backend/speech_practice/model_manifest.json`。

## 已完成的自动验证

| 验证 | 实际结果 / 证据 |
|---|---|
| 后端单元与 API 测试 | 17 项通过：分句、重复词、缩写数字、版本快照、编辑拆合、WAV/Range、录音限制、重采样、Speechace 缺失字段、鉴权、下载恢复/损坏、取消、整篇声线、下载不阻塞推理、组件危险路径/损坏拒绝 |
| TypeScript 与 Vite | 类型检查和生产构建通过 |
| 浏览器 + 真实后端 | 2 项通过：虚拟麦克风录音、历史、持久化、双语设置、朗读稿显示、麦克风拒绝；`evidence/studio.png` |
| CPU 模型 | Kokoro Sarah/Michael 真实音频，Whisper small.en CPU/int8 转写；`evidence/benchmark.json` |
| GPU 模型 | Ryan/Aiden 真实生成，固定风格句集；`evidence/quality/results.json` |
| 冻结 CPU 后端 | PATH 排除 Python/Node：实际单句 WAV、ASR、整篇合并、Range 206；`evidence/packaged-smoke.json` |
| 冻结 GPU 后端 | 不依赖外部 Python 的真实推理，另通过中文运行目录/模型目录（NTFS junction）及中文输出名复测；`evidence/packaged-qwen.json` |
| 独立组件 ZIP | 完整解压并逐文件 SHA256 校验，实际运行已安装 Aiden 组件；`evidence/component-smoke.json` |
| 桌面闭环 | 打包 Electron：TTS、播放时间推进、虚拟麦克风、原生文件保存、ASR、重载历史；`evidence/desktop-smoke.json` |
| NSIS 安装 | 安装到中文路径的项目隔离目录，退出码 0；安装后的桌面程序验证另见桌面报告 |
| 整篇冻结后端流程 | 328 词、32 句，两种模式全部生成，实际导出 WAV、ASR、重启恢复进度/录音、缓存重用；`evidence/long-e2e.json` |

测试使用真实模型及真实音频文件，没有以占位音频或模拟供应商分数代替推理。
浏览器麦克风是虚拟设备；ASR 内容测试部分使用 TTS 音频，并不代表真人口音识别率。

中文安装目录初测曾暴露 eSpeak 原生库读取路径失败。后端执行文件现声明 UTF-8 进程代码页，
随后中文安装路径、中文录音数据目录与中文 WAV 保存文件全部复测通过；退出后本机后端端口关闭。
该设置不修改系统区域配置。机制见 [Microsoft 文档](https://learn.microsoft.com/en-us/windows/apps/design/globalizing/use-utf8-code-page)。

## 初始性能测量

短句集包含 21 个单词。首条生成包含进程启动与模型加载；后续条目是同一 worker 热运行。
RTF = 生成用时 / 输出音频时长，小于 1 表示比音频播放速度快。

| 模式 / 声线 | 用时 | 音频时长 | RTF | 观测峰值 |
|---|---:|---:|---:|---|
| Kokoro Sarah，冷启动 | 8.15s | 7.25s | 1.12 | 约 684MiB 进程 RSS |
| Kokoro Michael，热运行 | 3.36s | 8.32s | 0.40 | 约 707MiB RSS |
| Whisper CPU/int8 | 4.34s | 输入 7.25s | 0.60 | 约 661MiB RSS |
| Qwen Ryan，自然，冷启动 | 52.06s | 11.20s | 4.65 | 约 4.40GiB RSS / 4983MiB GPU |
| Qwen Ryan，热情，热运行 | 15.61s | 8.32s | 1.88 | 约 2.25GiB RSS / 5305MiB GPU |
| Qwen Aiden，热运行 | 13.47s | 7.12s | 1.89 | 约 2.25GiB RSS / 5305MiB GPU |

RSS 为被监测子进程总和，共享页面可能重复计数；GPU 数值来自整块显卡 `nvidia-smi`，
包含其他进程占用。这里没有专用 GPU 进程计量，也没有证明最低配置。
性能测量与最终固定 seed 风格测试分开保存，不把不同运行条件混为同一比较。

整篇示例实际结果：Kokoro 生成 59.95s，输出 113.88s；Qwen 生成 292.00s，输出 155.62s。
重启后缓存重新生成耗时 0.52s；其复用缓存，没有重新运行模型。该流程使用冻结 CPU 后端、
已安装的独立 GPU 组件与本地权重，音频分别保存为 `evidence/long-kokoro.wav`、`long-qwen.wav`。

## 高模式内容与风格检查

固定 seed=42，对两个文本使用自然、自信、热情三种指令，共生成六条音频。
五条 ASR 词错误率为 0；第一文本的热情版本识别出额外的 `Hahaha`，ASR 词错误率约 4.76%。
这提示模型可能在风格控制时增加非稿件发声，也可能包含识别误差，不能直接当作人工判定。
原始音频与识别结果保留。随后把热情预设收紧为有活力但克制的演讲语气，明确要求只读稿件、
不添加笑声或额外词语。同样两个文本重新实跑，ASR 词错误率均为 0；最终界面采用新预设。
复测证据：`evidence/quality-refined/results.json`。小句集改善不保证任意材料都没有增词。

不同风格的时长与波形确实不同；这不足以证明语气差异可听见，更不足以证明比 Kokoro 自然。
**自然度、演讲表现与“高模式质量更好”尚未通过人工试听验收。**

## 未完成 / 不能据此声明的项目

- 无 Python/Node/Conda 的干净 Windows VM 或独立实机安装；当前只排除了运行进程 PATH 中的开发运行时。
- 4GB 显存、Windows 10、其他 GPU/驱动的兼容性。
- 真人麦克风、无物理设备、不同口音与噪声场景。拒绝权限、空音频和上传错误路径已自动验证。
- 物理断网复测：当前推理启用本地权重与 HF offline，并阻断代理出站；它不是网线拔除测试。
- Speechace 真实付费请求、供应商音素定位和真人片段回放：没有密钥，只验证官方样例解析与错误状态。
- 发布签名、独立第三方许可证/对应源码审计、公开发布页和完整对应源码包。
  当前安装包未签名，第三方许可证不被应用 MIT 许可证覆盖。
- `npm audit --omit=dev` 无漏洞；全依赖审计仍有 8 个 high，属于现有打包工具的传递依赖。
  没有强行覆盖不兼容依赖，也不宣称通过完整供应链安全审计。

## 复现与补充手动验收

开发测试与构建命令见中英文 README。额外运行：

```powershell
.venv\Scripts\python.exe scripts\smoke_packaged.py
node scripts\smoke_desktop.cjs
.venv\Scripts\python.exe scripts\smoke_component.py
.venv\Scripts\python.exe scripts\long_e2e.py
.venv\Scripts\python.exe scripts\quality_check.py
```

1. 在干净 Windows 11 上安装，下载 CPU 模型；测试麦克风拒绝、允许及无设备。
2. 用自己的英文演讲稿完成生成、真人录音、回听、识别、单句和整篇保存、重启恢复。
3. 准备模型后物理断网，重复本地流程；选择包含中文字符的安装/录音/保存目录。
4. 导入高模式组件与模型，试听 `evidence/quality` 的固定句集，比较两种模式及风格。
5. 有 Speechace 密钥时再验收主动上传、成功/失败、音素时间与片段播放。
