# 前端素材记录

## 植物、纸面与光影

- 项目文件：`public/images/practice-botanical.png`
- 生成日期：2026-10-04
- 来源：本会话内置 `image_gen.imagegen`；通过 `imagegen` 技能生成，未使用外部摄影作品。
- 原始输出：`C:/Users/zhang/.codex/generated_images/01a1053c-877e-72c0-8591-0c2d18f09f04/exec-09c4010b-46b7-44d0-93cb-3b8c774063a7.png`
- 用途：侧栏底部和空状态。仅 CSS 裁切，不向主阅读区域铺图；图片无文字，不承载功能信息。
- 确认：已查看原图与应用内运行截图，检查自然光、低饱和植物、细微纹理及无文字要求。

完整生成提示：

> Use case: photorealistic-natural. Asset type: subtle sidebar edge photograph for a mature English speech practice desktop workspace. Create a portrait editorial photograph of a few restrained olive/sage green indoor plant leaves entering from the lower right edge, with warm afternoon window light and soft plant shadows falling on warm ivory textured paper / plaster. Mostly quiet negative space, warm white and pale beige, muted sage foliage, natural fine paper grain, delicate soft shadows. Composition suitable for cropping into a 300px wide by 220px high sidebar footer, leaves mostly at right edge, no pots needed. No text, no letters, no typography, no logos, no watermark, no UI. Save final image to D:/AI/Speech/public/images/practice-botanical.png if filesystem saving is supported.

## 字体

Source Serif 4、Source Sans 3、Noto Sans SC 使用已有 Fontsource 包，在 Vite 构建时自托管。保留 `public/notices/fonts/` 内的 OFL 许可及上游版权记录。运行时无需请求字体服务。

## 历史山景

`public/images/practice-mountains.jpg` 及其原始来源记录保留，新的活动界面不再引用。其许可与摄影者记录见 `THIRD_PARTY_NOTICES.md`。
## 个性化素材补充

`public/images/decor/voice-trace.svg`、`paper.svg`、`landscape.svg`、`geometry.svg` 为本次在项目内手工编写的 SVG。声音线迹为纯装饰曲线，与实际音频无关；纸张使用静态 SVG 噪声；山水与几何为简单路径。柔和渐变由本地 CSS 实现。这些素材不依赖外部图库或运行时网络，沿用项目 MIT 许可。植物素材继续使用上文记录的已生成图片，不新增 AI 插画。

