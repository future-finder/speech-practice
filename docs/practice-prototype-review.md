> 本文保留上一版原型的审查记录。当前默认入口、参考图视觉实现与验证说明见 [practice-reference-implementation.md](practice-reference-implementation.md)。

# Practice 原型验证与设计审查

本轮只实现练习页面。方向沿用「以编辑排版组织文本，以音频工具组织操作」，没有搜索新的设计参考，也没有把原型推广到其他页面。

## 运行与范围

- 原型入口：`?practice=prototype`。旧版练习页提供入口，新版提供返回旧版链接。
- 当前独立现场：http://127.0.0.1:55181/?practice=prototype ，已在 Codex 浏览器打开。该实例使用隔离的测试稿件与数据目录，不修改日常用户稿件。
- 复用 App 的录音、保存、历史、示范生成、识别、评测、片段回放与设置逻辑；没有修改后端数据结构。
- 原型布局、音频组件与样式分别位于 `src/PracticePrototype.tsx`、`src/PracticeAudio.tsx`、`src/practice-prototype.css`。旧版样式文件没有修改，旧版只增加原型入口并复用抽出的编辑/配置内容。

## 视觉语言如何落实

当前句使用 Source Serif 4，界面文字使用 Source Sans 3 与 Noto Sans SC。暖白背景、墨色正文、深绿操作与克制的错误红沿用既定方向。按目录、当前句、示范、录音、局部反馈建立阅读顺序，不使用卡片划分所有内容。

示范与录音共用播放、进度、时间与波形控件。波形由实际音频解码后的振幅生成，没有随机数据，也不表达发音质量。两条音频使用一致的秒数刻度，保留实际长度差异；这不是词级对齐，不能据此判断节奏准确度。

配置与总分退到展开区域，局部问题先于总分。没有时间信息的问题明确禁止片段回放，避免虚构定位能力。动效只用于短暂状态反馈，尊重减少动态效果偏好。普通文本配色在背景上的对比度均超过 4.5:1。

字体以 Fontsource 自托管，保留 SIL OFL 许可证及上游版权声明，记录于 `THIRD_PARTY_NOTICES.md` 与 `public/notices/fonts/`，可随开源项目分发并保留相应声明。本轮没有新增装饰图片、纹理或图标库。

## 同一稿件的新旧对比

对比使用同一测试稿件与录音记录，避免内容差异影响判断。

| 观察点 | 旧版 | 新版 |
| --- | --- | --- |
| 第一视觉中心 | 稿件标题、多个区域与控件竞争 | 当前练习句成为主标题 |
| 页面结构 | 三列和多个容器，内容区较窄 | 目录与连续练习工作区 |
| 示范操作 | 配置与播放同时常驻 | 先播放，配置按需展开 |
| 录音回放 | 与示范采用不同呈现，回放更靠下 | 统一时间轴与播放语言，历史在录音区选择 |
| 问题定位 | 反馈信息较密集 | 先选择局部问题，再看证据、建议与可用片段 |
| 窄窗口 | 多列布局压缩主要内容 | 目录默认折叠，句子和操作单列排列 |

新版：

![新版：同一稿件与历史录音](D:/AI/Speech/docs/evidence/practice-prototype/03-history.png)

旧版：

![旧版：同一稿件与历史录音](D:/AI/Speech/docs/evidence/practice-prototype/04-original.png)

## 实际验证与证据

`npm run build` 通过。完整 Playwright 检查曾通过 7 项（包括已有 Studio 检查）；最终的加载状态与失败文案修改后，原型 2 项再次通过。测试文件为 `tests/ui/practice-prototype.spec.ts`。

| 状态 | 验证方法 | 截图 |
| --- | --- | --- |
| 短句 | 真实本地 Kokoro 示范生成、播放 | [01-short](D:/AI/Speech/docs/evidence/practice-prototype/01-short.png) |
| 长句 | 长文本完整显示，不裁切练习内容 | [05-long-no-example](D:/AI/Speech/docs/evidence/practice-prototype/05-long-no-example.png) |
| 无示范音频 | 空状态与生成动作，录音可用 | [06-no-example](D:/AI/Speech/docs/evidence/practice-prototype/06-no-example.png) |
| 录音中 | 浏览器虚拟麦克风实际进入 MediaRecorder，停止与上传保存 | [02-recording](D:/AI/Speech/docs/evidence/practice-prototype/02-recording.png) |
| 历史录音 | 保存两条、选择历史、实际回放 | [03-history](D:/AI/Speech/docs/evidence/practice-prototype/03-history.png) |
| 有评测反馈 | 明确标注离线 fixture；问题选择、片段回放、无时间禁用、手动拖动取消片段停止边界 | [08-feedback-fixture](D:/AI/Speech/docs/evidence/practice-prototype/08-feedback-fixture.png) |
| 评测失败 | fixture 失败展示及真实服务未启用响应；保留录音与恢复信息 | [09-failure-fixture](D:/AI/Speech/docs/evidence/practice-prototype/09-failure-fixture.png)、[10-real-assessment-failure](D:/AI/Speech/docs/evidence/practice-prototype/10-real-assessment-failure.png) |
| 窄屏 | 1050、760、390px 检查横向溢出；390px 目录折叠 | [07-narrow](D:/AI/Speech/docs/evidence/practice-prototype/07-narrow.png) |

核心路径「听一句 → 录一句 → 回放」使用真实本地示范与浏览器录音链路跑通。「定位问题」使用有明确标记的测试反馈验证界面行为。成功评测截图中的分数与问题不是对真实录音的评判，也没有写入现场实例。未验证物理麦克风音质、真实云端评测准确性或真实用户首次使用效率。

## AI UI smell audit

已去除本页对大面积卡片、配置常驻、重复播放器与汇总分数优先的依赖。没有增加渐变、玻璃效果、feature cards、营销副标题、装饰性 badge 或伪波形。句子、实际音频、时间和问题证据承担了视觉内容，因此不需要靠填充装饰维持页面。

但页面还不能视为打磨完成，仍有以下问题：

1. **桌面音轨跨度偏长。** 正文保持约 740px 阅读宽度，音频工作区更宽，右侧速度、历史与下载离播放动作较远。画面有呼吸感，但部分控制的关系显得松散。下一轮可收拢共享工作宽度，保持时间轴与操作的关系。
2. **反馈与文本距离仍然较远。** 长句和录音历史会把反馈推到下方。选择局部问题时，正文、轨道与问题难以同时看到。下一轮应先验证把选中的局部反馈放在正文或轨道邻近位置的方案，避免新增整列结果卡片。
3. **片段定位的视觉闭环不完整。** 回放停止边界已验证，但轨道只显示播放头，没有清楚标出本次选中的时间范围；拖动也缺少当前位置预览。可增加有真实时间依据的功能性选区，不能推断不存在的逐词对齐。
4. **展开配置仍有旧版控件的密度。** 本轮复用现有配置内容，以保证设置与业务行为一致。展开后的标签、选择器与说明还没有完全融入新版节奏，属于后续局部整理范围。
5. **长文本选择器仍有系统控件感。** 原生稿件与历史选择器可靠，但窄窗口中长标题和时间信息的呈现仍受可用宽度限制。没有横向溢出不等于每项信息都易于扫读，需要用更多真实稿件长度验证。

## 第二轮判断

这套视觉语言在首屏层级与音频操作统一性上已经成立，值得继续验证；尚不能据此断言已达到长期打磨的独立软件品质。

建议第二轮仍只改本页，优先处理共享工作宽度、局部反馈位置、真实片段选区三个问题，再复查长句与窄屏。此轮停在原型与审查交付，没有开始第二轮修改或全局推广。
