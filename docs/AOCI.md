# AOCI 使用说明

本项目通过 `.codex/config.toml` 接入本地 stdio MCP。AOCI 保存可随 Git 版本管理的代码知识索引；模型阅读真实源码后编写语义，AOCI 管理证据、变更和索引对齐。

## 首次使用

1. 重启 Codex 并重新打开 `D:\AI\Speech`，若出现项目信任提示，确认信任此项目。
2. 发送：`先确认 AOCI MCP 已连接且 runtime_repository_root 为 D:/AI/Speech，再建立本项目的完整 AOCI 索引。完成后验证 aligned，并给我 AOCI 面板链接。`
3. 索引完成后，照常提出开发需求。Agent 应在修改和验证完成后增量维护索引。

初始化和 scan 只建立骨架与基线，不表示完整语义索引已建立。MCP 是否已被当前会话加载，应以实际工具调用为准，不能只看配置文件。

## 日常使用

- 了解架构：`通过 AOCI 读取本项目的完整索引，解释前端、Electron 和 Python 后端之间的关系。`
- 开发功能：直接描述功能和验收条件，无需每次补充“维护索引”。
- 检查状态：`检查 AOCI 索引与当前源码是否对齐，报告未完成项。`
- 恢复中断：`按 AOCI 当前 Guide 继续未完成的索引构建。`

索引是辅助理解的知识层，不能代替源码验证和测试；模型对系统的自评也不能当作正确率。

## 本机命令

安装版本：`0.1.0-rc17`，Windows amd64。已完成官方基础校验：发布压缩包 SHA-256 与 `SHA256SUMS` 一致，二进制版本与发布提交一致；未完成签名和完整构建来源验证。

```powershell
$Aoci = 'C:\Users\zhang\.local\tools\aoci\0.1.0-rc17\aoci.exe'
& $Aoci --repo 'D:\AI\Speech' doctor
& $Aoci --repo 'D:\AI\Speech' check
& $Aoci --repo 'D:\AI\Speech' ui --detach --json
```

最后一条命令返回本地面板地址。初次构建前 `check` 报告未完成条目是预期状态。不要用 `scan --force` 跳过治理流程。

## Git 与迁移

- `aoci.txt`、`aoci.meta.txt`、`aoci.code.txt`、AGENTS.md 和 `.aoci` 中白名单放行的正式资产应随项目版本管理，不要整体忽略 `.aoci/`。
- `.codex/config.toml` 包含本机绝对路径，已自动加入忽略规则，不应提交。换电脑需要重新安装并初始化宿主接入。
- `.aoci` 的运行状态和临时事务由其自身 `.gitignore` 管理。
- AOCI 本地服务本身不上传代码；模型仍通过当前 Codex 使用的模型通道阅读代码，不等于整个 AI 工作流离线。

官方资料：[AOCI 仓库](https://github.com/aoci-spec/aoci-code)、[当前安装版本的校验说明](https://github.com/aoci-spec/aoci-code/blob/v0.1.0-rc17/docs/install.md)、[Codex MCP 配置](https://developers.openai.com/codex/mcp)。
