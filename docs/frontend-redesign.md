# Speech Practice 前端重构（2026-10-04）

## 运行

在项目根目录运行 `npm.cmd run desktop`，启动使用现有 Python 后端的 Electron 桌面版本；`npm.cmd run build` 生成前端生产文件。原数据目录、后端 API、模型格式与凭据存储方式沿用现有实现。

## 页面与交互

- 所有页面使用全局暖白、墨色、鼠尾草绿与陶土色设计变量，以及本地 Source Serif 4 / Source Sans 3 / Noto Sans SC。装饰图限于侧栏边缘与空状态。
- 练习页采用稿件导航、完整朗读稿、当前句音频与录音三栏。稿件操作菜单保留整篇生成、导出、原文；正文下保留编辑、分句与合并。
- 底部播放栏复用真实音频元素。示范、录音与整篇播放互斥；支持实际进度、定位、倍速与句子循环。波形源于真实音频采样，不能作为评分解释。
- 分析页保留识别差异、问题定位、历史评测、评分依据与原始结果；问题时间轴随所选评测变化。无可靠定位的反馈不提供片段回放。
- 总结页使用每句最新录音及其反馈，不从旧录音补结果；明确标记未录音、未分析、识别不确定、稿件版本变化和评测失败。不同供应商分数不汇总。
- 设置页按示范语音、识别与评测、模型、文件存储组织，保留原设置和任务取消能力。新建、删除、上传确认和浏览器路径输入统一使用可键盘操作的弹窗。Electron 文件选择继续使用系统对话框。
- 录音准备、录音及保存时锁定选句、切稿和离开练习。保存失败保留本次录音预览；用户可回听后重新录音。

## 侧栏

展开时显示完整导航与稿件列表；收起为 72px 图标栏。390px 窗口使用 56px 图标栏，导航名称通过悬停提示与无障碍名称提供，当前页保留背景及细边标记。

切换按钮始终可见，提供 `aria-expanded`、`aria-controls` 与明确名称，Enter / Space 可操作。偏好写入 `speech-sidebar-collapsed`；切换采用 180ms 过渡，尊重减少动态效果设置。切换仅改变 CSS 布局，不重新创建音频、麦克风、稿件或选句状态。

1200px 以下以图标栏和稿件抽屉组织导航，保留桌面展开偏好；窄窗口主动展开后的偏好也在刷新后恢复。900px 以下通过“练习当前句”打开辅助区，选句时可直接打开，长稿不会阻碍访问录音操作。

## 代码组织

`App` 保留业务状态、后端调用和桌面桥接；`Workspace` 提供外壳、全文阅读与练习面板；`PlaybackBar` 共享音频控制；`PracticeReport` 整理已有录音；`LocalFeedback` 呈现证据；`Dialog` 管理焦点、Tab 循环及 Escape。历史 prototype / legacy 查询参数继续打开统一界面。

## 验证与截图

- `npm.cmd run build`：TypeScript 检查与生产构建。
- `npm.cmd run test:ui`：11 项检查，涵盖真实后端、Kokoro 示范、本地识别、整篇播放及 WAV 导出、测试麦克风录音、历史回放、编辑与拆合句、云上传确认、保存失败预览、设置兼容和长稿。
- 侧栏测试检查切换前后音频元素身份和播放连续性、录音继续、选句与稿件滚动位置、键盘切换、持久偏好及不同尺寸布局。
- `node scripts/verify-redesign-desktop.cjs`：使用临时数据和独立 Electron 用户目录检查桌面 IPC、真实后端、练习界面及收起侧栏。
- 截图目录：`docs/evidence/frontend-redesign/`。覆盖 1586×992、1440×900、1366×768，以及 1050、760、390px；包括稿件、练习、分析、总结、设置、侧栏展开/收起、录音、播放、加载、空状态、权限失败和保存失败。

截图比对后将正文从首轮 22px 收紧至 20px，调整段落间距、当前句字号和进度条，使中央完整稿件与右侧操作更接近参考图。材料使用边缘裁切，不覆盖阅读区。

测试麦克风是 Chromium 虚拟设备；本地识别在实际后端执行，不用于证明硬件麦克风质量。发音评测截图明确使用 `UI TEST / OFFLINE FIXTURE`，只验证展示、历史选择与定位，没有调用收费云服务。侧栏连续播放测试使用明确标注的合成 PCM 音频。没有重新打包 Windows 安装器。

素材生成方式与完整提示见 [frontend-assets.md](frontend-assets.md)。

## 关键截图

| 内容 | 截图 |
| --- | --- |
| 1586×992 三栏练习页 | [练习页](evidence/frontend-redesign/practice-1586x992-initial.png) |
| 真实录音与收起侧栏 | [收起侧栏](evidence/frontend-redesign/practice-sidebar-collapsed.png) |
| 独立分析页（离线评测样本） | [分析页](evidence/frontend-redesign/analysis-feedback-fixture.png) |
| 总结报告（离线评测样本） | [总结页](evidence/frontend-redesign/summary-feedback-fixture.png) |
| 稿件与设置 | [稿件](evidence/frontend-redesign/library.png)、[设置](evidence/frontend-redesign/settings.png) |
| 窄窗口稿件与录音辅助区 | [390px 稿件](evidence/frontend-redesign/practice-390.png)、[390px 练习区](evidence/frontend-redesign/practice-panel-390.png) |
| Electron 桌面 | [展开](evidence/frontend-redesign/electron-practice.png)、[收起](evidence/frontend-redesign/electron-sidebar-collapsed.png) |

最新完整界面回归：11 项通过（51.3 秒）；Electron 桥接检查通过，无页面运行错误。桌面截图通过 Electron `capturePage` 获取，测试数据与用户目录均隔离，不改变日常练习数据。
