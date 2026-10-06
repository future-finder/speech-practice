# 专注页局部修正

本轮以原版专注页为视觉基线，撤掉上一轮的整句蓝色矩形，保留全文间距优化、真实音频波形、词级播放高亮和直接片段回听。

## 本轮变化

- 当前句使用深色正文，前后文保持灰色。删除整句边框、底色、圆角和容器内边距，保留很轻的背景过渡。背景过渡固定为 110px 高，不随长句膨胀。
- 阅读区保留一个白色外层面板。移除页签下的横线、底部编辑区及其分隔线、播放器内部横线；句子进度线仍表示实际进度。
- 编辑朗读稿与分句入口移至顶部。删除“原文保留”常驻文案，保留可操作的原文查看与音频记录入口。
- 未录音、已有录音但尚无结果时，反馈合并成单一简洁区域。录音后提供分析操作；已有真实结果才显示结果分组，优先复核只在有实际反馈项时出现，缺失指标不再铺成“无数据”行。
- 色彩集中于冷蓝侧栏、导航选中项、右栏外围的轻微冷暖过渡及操作按钮和反馈图标。阅读内容本身保留白色空间。
- 全文的紧凑句间距、原稿段落结构及贴合文字的浅蓝高亮保留。录音词级高亮仍仅依据有效时间戳。

## 同条件截图

[打开上一轮与本轮对照](evidence/practice-polish/comparison.html)

三套截图均保留：`before/` 为原版，`round-one/` 为上一轮蓝框版本，`after/` 为本轮局部修正。

| 状态 | 原版 | 上一轮 | 本轮 |
| --- | --- | --- | --- |
| 专注、分析完成 | [截图](evidence/practice-polish/before/focus-result.png) | [截图](evidence/practice-polish/round-one/focus-result.png) | [截图](evidence/practice-polish/after/focus-result.png) |
| 长句 | [截图](evidence/practice-polish/before/focus-long.png) | [截图](evidence/practice-polish/round-one/focus-long.png) | [截图](evidence/practice-polish/after/focus-long.png) |
| 短句、未录音 | [截图](evidence/practice-polish/before/focus-short-empty.png) | [截图](evidence/practice-polish/round-one/focus-short-empty.png) | [截图](evidence/practice-polish/after/focus-short-empty.png) |
| 全文 | [截图](evidence/practice-polish/before/script.png) | [截图](evidence/practice-polish/round-one/script.png) | [截图](evidence/practice-polish/after/script.png) |

主对照均为 **1468 × 854 CSS px**、中文、关闭动画、默认浏览器缩放，稿件为 The Power of Small Actions。分析完成状态均为同一句、78 分、126 WPM、同一词级反馈，暂停在 3 / 8 秒。录音创建时间显示固定为 10月4日22:00。长句和短句对照均为未录音、无示范音频。

截图中的合成 PCM 音频和评分是离线界面测试夹具，并非真实口语评测结果。生产波形由真实解码采样生成；无法解码时使用进度线。

## 验证

- `npm run build` 通过。
- appearance、native-workspace、practice-prototype、practice-data 共 15 项 Playwright 测试全部通过。
- 补充复查：顶部编辑入口可展开并显示原有编辑控件；未录音时不存在优先复核和其他指标占位卡；截图等待切句后的音源和波形稳定。
- 保留已通过的片段起止时间、暂停清除词级高亮、分析中防重复提交、播放器录音前后位置/高度稳定、原稿段落、超长句、390/760/1050px 窄窗口、连续播放和录音保存检查。

[分析中](evidence/practice-polish/after/analyzing.png) · [录音中](evidence/practice-polish/after/recording.png) · [390px 窄窗口](evidence/practice-polish/after/focus-390.png) · [超长句](evidence/practice-polish/after/extreme-long-1468.png)
