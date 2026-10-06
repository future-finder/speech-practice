# 个性化外观与交互升级

启动：在项目根目录运行 `npm.cmd run desktop`。前端生产构建：`npm.cmd run build`。设置 → 外观提供有限的环境素材设置，不修改产品颜色、字体或布局。

## 外观

- 默认纯净模式，关闭装饰时侧栏和当前句均不显示素材。设置中的预览仍可用于选择素材。
- 两个独立区域：侧栏底部与当前句卡片背景；空状态沿用侧栏素材。内置声音线迹、纸张、植物、山水、几何和渐变。
- 每个区域可导入、替换、删除本地图片，调整 cover / contain、水平/垂直位置、不透明度和模糊。右侧背景叠加暖白遮罩，保持句子文字对比度。装饰不接收点击，也不进入辅助技术的内容树。
- 接受 PNG、JPEG、WebP、AVIF、GIF，限制 12 MB / 4000 万像素；最长边缩至 1600px 后保存 WebP。GIF 保存静态帧。原始文件不会上传，也不保存原文件名。替换会删除该区域原导入副本；单个区域恢复默认保留导入图片供重新选择，删除图片和恢复全部默认会删除相应副本。
- 浏览器模式使用 localStorage + IndexedDB，绑定当前站点来源；桌面模式通过已有 preload 桥接保存到默认 `%LOCALAPPDATA%\speech-practice\appearance`（指定 SPEECH_DATA_DIR 时位于该目录下）。桌面动态端口变化不影响外观恢复。
- 桥接只接受有限大小的设置对象与 UUID 图片 ID，不能从渲染页面读取任意路径。图片保存为经过前端解码重绘的 WebP。配置写入按顺序执行并原子替换。

## 状态与动效

`AppearanceProvider` 集中管理配置；`DecorSlot` 管理背景层，`TransportIcon` 管理播放状态切换，`RecordingWaveform` 观察已有麦克风流。

普通过渡 180ms，内容淡入 260ms，统一 easing 为 `cubic-bezier(0.2, 0.8, 0.2, 1)`。简化模式取消呼吸和内容入场动画，缩短过渡；关闭模式与系统 prefers-reduced-motion 停止装饰动画及过渡。真实播放进度和麦克风信号仍更新，因为它们是任务信息。

播放期间按真实 currentTime 连续更新波形进度，播放/暂停图标交叉淡入，其他轨道轻微淡化。录音期间突出陶土色、选句及当前句，录音按钮仅有轻微阴影呼吸。实时波形显示最近约 6 秒实际 PCM 峰值，未归一化、未生成假数据、不能解释为分析结果；停止后保留最后一段轨迹，下一句清除。

句号旁的勾号仅表示该句当前版本已有录音，并不声明发音达标或练习完成。已有反馈淡入，不生成新的分数。装饰切换没有重建音频、重新申请麦克风或改变练习数据。

## 运行验证与证据

- TypeScript / Vite 生产构建通过。
- 完整界面回归包含原 11 项检查与新增 3 项个性化检查。图片验证读取实际背景 URL 并执行图片解码，覆盖 CSP 允许、跨刷新恢复及替换后的旧副本清理，而不只验证配置中存在图片 ID。
- 最终 `npm.cmd run test:ui`：14 项全部通过（约 1.1 分钟）；桌面跨进程恢复检查通过，页面运行错误为 0。图片 CSP 只增加本机 Blob 图片来源，不开放外部图片域名。
- 新增真实图片存储、异常恢复、播放连续进度、实际麦克风流波形、停止定格、动效偏好与系统减少动态效果检查。
- Electron 两次独立 renderer profile 启动：自定义图片和偏好跨进程恢复；恢复默认删除图片；拒绝路径穿越请求；无页面错误。
- 检查 1586、1440、1366、1050、760、390px 布局，并实际读取截图校准。测试麦克风是 Chromium 虚拟设备；连续播放测试用明确的合成 PCM，均不用于证明真人音质或评分。
- 证据目录：`docs/evidence/appearance/`。本轮没有重打上一轮安装包；当前升级通过源码与生产文件运行。

| 内容 | 运行截图 |
| --- | --- |
| 纯净模式 | [练习](evidence/appearance/pure-practice.png) |
| 外观控制 | [设置](evidence/appearance/appearance-settings.png) |
| 自定义图片 | [练习](evidence/appearance/custom-practice.png) |
| 播放 / 录音 / 保存 | [播放](evidence/appearance/playing.png)、[录音](evidence/appearance/recording.png)、[保存](evidence/appearance/recording-saved.png) |
| 窄窗口 | [390px](evidence/appearance/practice-390.png) |
| 桌面跨进程恢复 | [桌面](evidence/appearance/desktop-restored.png)、[验证记录](evidence/appearance/desktop-persistence.json) |
