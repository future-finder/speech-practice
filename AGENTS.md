# 当前产品开发基线

使用中文协作，先推进任务，再简要解释关键决策；区分源码事实、历史验收和未验证事项。

开始产品任务时先核对 `git rev-parse --show-toplevel`、分支、HEAD 和工作区状态，再读 `docs/DEVELOPMENT_BASELINE.md` 与 `docs/ARCHITECTURE.md`。以当前源码及用户明确选择的分支为事实源，不能只继承聊天记忆、版本号或目录名。

当前 canonical implementation 是 ELOVERIS 的 Electron / React / FastAPI 实现，入口为 `electron/main.cjs` → 本机 HTTP → `index.html` → `src/main.tsx` → `src/App.tsx`。当前 `App.tsx`、`style.css`、`FeedbackPanel.tsx`、`ProviderSettings.tsx` 均在使用，不能标为废弃。Git HEAD 与当前源码（含未提交变更）是最终事实源；路径、分支名、版本号和文档中的快照不能替代源码核验。

canonical implementation 由用户明确选择的产品实现及其实际入口、引用链确定。legacy 指已被替代的历史实现；alternative 指尚未采用的分叉实现，不能仅因未合入就认定为废弃。Oracy 工作台是 alternative implementation，其 `AppearanceProvider`、`Workspace`、`Sidebar`、`PracticePrototype` 等组件关系不得直接套入 ELOVERIS。除非用户明确要求切换或整合，不在其他实现线继续本产品任务，不自行合并。

品牌资源直接引用 `public/brand/` 的认可 SVG/ICO；显示名 ELOVERIS 与技术标识 `speech-practice`、`org.speechpractice.desktop` 分开。更名不授权迁移用户数据、包标识或更新渠道。业务状态、波形、评分和保存反馈必须来自真实数据。

AOCI 服务的运行根应核对当前 `.codex/config.toml` 与服务返回的仓库身份，不以历史 Section 绝对坐标判断。cognition 必须跟随当前源码维护。遵循当前服务的 Rules、Overview、Guide 和签发的维护候选，使用正式维护及批量更新入口；不得手改正式 cognition、Baseline 或缩小治理范围来通过检查。源文件稳定后维护受影响认知，再执行 Verify / Check / Guide。治理 aligned 与模型严格认知证明是不同指标，不得混报。
