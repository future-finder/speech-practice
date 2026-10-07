# ELOVERIS 开发基线与实现边界

本文描述当前 ELOVERIS 的 canonical implementation 与长期开发规则，不固定工作树路径、分支名、HEAD 或发行版本。Git HEAD 与当前源码（含未提交变更）是最终事实源；用户明确选择决定采用哪条产品实现线。开始任务时必须重新核对，文档、聊天记忆、目录名和版本号不能替代源码核验。实现说明不等于运行验收。

## 1. canonical、legacy 与 alternative 的判定

| 实现类别 | 判定依据 | 开发边界 |
|---|---|---|
| canonical implementation | 用户已选择的 ELOVERIS 产品实现，且由当前入口和引用链证明 | 产品任务沿本文第 3 节的 Electron / React / FastAPI 实现推进 |
| legacy implementation | 已被明确替代的历史实现，结合 Git 历史与当前引用链核验 | 不以旧提交、旧品牌展示或旧安装包作为当前开发基线 |
| alternative implementation | 尚未采用的分叉实现，如 Oracy 工作台 | 不直接套用其组件关系或视觉架构；切换或整合需用户明确要求 |

分支名称、版本号大小、工作树目录和安装包文件名都不能证明实现已被采用或替代。未合入的分叉不自动属于 legacy；当前入口仍引用的文件也不能仅因名称或历史关系被标为废弃。

当前源码没有独立的 `legacy/` 页面目录。`src/App.tsx`、`src/style.css`、`src/FeedbackPanel.tsx`、`src/ProviderSettings.tsx` 都在有效引用链中。安装产物须核对源码快照与构建证据，不能仅凭文件名认定为当前版本。

## 2. 当前核心实现

品牌显示统一为 ELOVERIS，侧栏展开/折叠、欢迎界面、关于模态、HTML 页签、Electron 窗口、NSIS 图标均已接入认可素材。`Brand.tsx` 直接引用轮廓字标及河流符号；没有运行时字标字体或重新绘制 Logo。

使用品牌语义令牌与轻动效，原有 `--green` 等布局色变量映射品牌蓝。亮暗主题由 `App` 管理，默认跟随系统；应用内与系统减少动态均有适配。录音波形来自真实 `MediaStream` 的 `AnalyserNode`；分析提示绑定当前录音的实际任务；保存成功提示在上传成功并刷新后触发。上传失败保留当前内存 Blob 的回听与下载入口。

提供稿件、逐句编辑、示范音频、单句录音、历史与反馈流程。类别色保持独立；缺失评分显示横线，来源、量表、历史与原始证据继续保留。ASR 内容差异不是发音评分。

显示名为 ELOVERIS，`package.json` / Python 项目名仍为 `speech-practice`，appId 仍为 `org.speechpractice.desktop`。Electron Chromium profile 保留 `appData/speech-practice`，后端默认 `LOCALAPPDATA/speech-practice`，支持 `SPEECH_DATA_DIR`。未实施包身份、旧数据目录或更新渠道迁移。

## 3. 当前入口、页面和目录

桌面 `npm run desktop` 先构建再执行 Electron；`npm run package` 构建 NSIS。`electron/main.cjs` 启动后端，获得本机随机端口与令牌，以 `win.loadURL(connection.base + '/')` 加载 HTTP 页面。生产前端来自后端静态目录，开发 Vite 命令单独存在；相对 `base: './'` 不表示 Electron 用 `file://` 加载。

渲染链是 `index.html` 的 `#root` → `src/main.tsx` 的 `StrictMode` → `App`。没有路由器、`AppearanceProvider` 或 `Workspace` 外壳。样式依次为 `brand.tokens.css` → `style.css` → `brand.motion.css`。

| 目录 / 文件 | 当前职责 |
|---|---|
| `src/App.tsx` | 稿件侧栏、无稿欢迎界面、句子列表、朗读编辑、示范播放、录音历史、反馈与任务栏；新建、设置、关于均是模态界面 |
| `src/Brand.tsx`、`public/brand/` | 展开组合字标、折叠独立符号、主题素材、页签与应用图标 |
| `src/RecordingWaveform.tsx` | 真实录音信号可视化；减少动态时显示静态条并停止动画帧 |
| `src/FeedbackPanel.tsx`、`segment.ts` | 评测证据与历史、缺失值、可靠区间的回听 |
| `src/ProviderSettings.tsx`、`modelInfo.ts`、`types.ts` | ASR/评测分别配置、模型说明、前端契约 |
| `src/brand.tokens.css`、`style.css`、`brand.motion.css` | 语义色、当前工作台布局、品牌显隐、焦点和状态动效 |
| `electron/` | 生命周期、权限、受限 IPC、本机后端与用户目录兼容 |
| `backend/server.py`、`backend/speech_practice/` | FastAPI、SQLite/WAV、任务与 SSE、独立推理进程、模型和云适配 |
| `scripts/`、`tests/`、`packaging/` | 构建、验证、发行资源；`build/`、`dist/`、`release/` 为产物，不作为开发源码 |
| `docs/brand/` | 品牌规则、接入清单与字体许可；规范要求不能冒充已实现能力 |

`/api/jobs` 和 SSE 隐藏完整 payload，提供 `recording_id`；`App` 用它筛选当前录音的 analyze/assess 队列及运行状态，兼容旧 payload 字段。下载进度来自字节数，整篇任务进度来自完成句数；未知推理时长不伪造百分比。录音前前端保存句子，后端上传开始时再读取版本快照；并发改稿时的开始版本锁定仍是能力差距报告中的待完善项，不能宣称已经完全解决。

## 4. 视觉架构和未采用边界

当前基础色为品牌蓝 `#2457D6`、深蓝文字 `#172139`、浅背景 `#F7F9FD`，暗色由 `data-elv-theme` 令牌覆盖。应用内减少动态使用 `data-elv-reduced-motion`，系统偏好使用 `prefers-reduced-motion`。朗读正文与 Logo 保持稳定，反馈进入、完成与忙碌标记只由实际状态触发；模态有焦点进入、循环、Escape 关闭和返回焦点。

Oracy 工作台属于 alternative implementation；其 `AppearanceProvider`、`Workspace`、`Sidebar`、`PracticePrototype` 等不在当前 ELOVERIS 入口链中。其他实现线中的界面、资源与能力，只有经过用户明确选择并完成源码接入后，才能记为 ELOVERIS 的已采用实现。

没有采用 Logo 动画/重绘、字标字体替代、模拟波形或虚构评分/进度。持久录音草稿、失败重传、自动推理超时、稿件库管理、整篇用户录音、语言教练等出现在 `FEATURE_GAP_REPORT_2026-10-06.md` 的建议中，不是已经完成的实现；不能为恢复认知而顺带实现。

历史构建和自动测试记录仅代表当时的输入、提交与环境。带日期的 `FEATURE_GAP_REPORT_2026-10-06.md` 可以保留当时的 commit 和版本信息，其结论须结合当前源码重新核验。当前运行能力须由相应测试证据支持；治理对齐不能替代真实硬件录音、安装兼容或云服务验收。

## 5. 后续任务的核验与认知维护

先核对根目录、分支、HEAD、工作区，再读根 `AGENTS.md`、本文及 `ARCHITECTURE.md`。按当前 AOCI 正式流程读取认知并验证源码。开发当前产品时沿第 3 节入口链推进，不把其他实现线组件或规划报告当作已采用实现。若用户明确要求切换或整合，先审计实现差异与数据兼容，再单独推进。

AOCI cognition 必须跟随当前源码维护。服务运行根由当前 `.codex/config.toml` 与服务返回的仓库身份核验，历史 Section 绝对坐标不能代替该身份。遵循当前 Rules、Overview、Guide 和机器签发的维护候选，通过正式维护与批量更新入口处理受影响认知；不手改正式 cognition、Baseline 或缩小治理范围。文件稳定后维护认知，再执行 Verify / Check / Guide，区分治理 aligned 与模型严格认知证明。
