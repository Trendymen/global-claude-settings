# Codex 配置恢复指南

本指南适用于 macOS 与 Windows。开始前安装 Node.js LTS、Git 和 Codex；Node 用于运行恢复器与 hook，Git 用于克隆仓库。

恢复器只处理可移植的 `AGENTS.md`、`config.toml`、`agents/`、`hooks/`，以及通用 skill `requesting-code-review`（恢复到 `~/.agents/skills/`，按 skill 目录整体覆盖，不影响该目录下的其他 skill）。它不会恢复认证、会话或其他运行时状态。

## Windows PowerShell

```powershell
git clone <仓库地址> "$HOME\codex-settings"
Set-Location "$HOME\codex-settings"

# 仅恢复通用 Codex 配置
node install.mjs
```

如已准备好 CreatorFramework，可同时写入其本机绝对路径：

```powershell
node install.mjs --creatorframework-path 'D:\projects\CreatorFramework'
```

也接受 UNC 路径，例如：

```powershell
node install.mjs --creatorframework-path '\\server\share\CreatorFramework'
```

## macOS shell

```bash
git clone <仓库地址> "$HOME/codex-settings"
cd "$HOME/codex-settings"

# 仅恢复通用 Codex 配置
node install.mjs
```

如已准备好 CreatorFramework，可传入 POSIX 绝对路径：

```bash
node install.mjs --creatorframework-path '/Users/你的用户名/projects/CreatorFramework'
```

省略路径参数时，恢复器不会创建、删除或覆盖已有的 CreatorFramework 路径配置，因此不会启用该项目专属提醒。项目准备完成后，可重复运行带路径参数的命令以创建或更新配置。

## 覆盖与预演

默认恢复会先备份同名目标，再写入新的可移植内容。可用以下选项调整行为：

```bash
# 仅打印计划，不写入或备份
node install.mjs --dry-run

# 保留已有目标，跳过同名文件或目录
node install.mjs --no-overwrite
```

## 从本机同步回仓库

确认本机配置需要保存后，在仓库根目录运行：

```bash
node install.mjs --pull-from-home
git add -A
git diff --cached
git commit -m "chore: 同步 Codex 全局配置"
git push
```

同步只取回可移植的 `AGENTS.md`、`agents/`、`hooks/` 与 `~/.agents/skills/requesting-code-review/`；不会取回本机路径配置或运行时状态。`--pull-from-home` 不能与 `--creatorframework-path` 同时使用。

### config.toml 的同步方式

`config.toml` 是手工维护的可移植模板，脚本刻意不覆盖它（机器路径与个性化默认值无法自动判断）。它的同步依靠人工或 AI 对照判断：

1. 对照本机 `~/.codex/config.toml` 与仓库 `codex/config.toml`，按 [AGENTS.md](../AGENTS.md) 的「config.toml 同步判定」归类每处差异。
2. 行为开关与 hooks 注册补进模板（路径写成 `{{CODEX_HOME}}` 占位符）；机器绑定内容留在本机，不入仓库。
3. 完成后依次运行 TOML 解析检查、`npm run check` 与端到端恢复验证，推送后等待双平台 CI 全绿。

## 登录、重启与验证

恢复之后，请独立完成 Codex 登录，并完全退出后重新启动 Codex，再执行：

```bash
codex --version
codex mcp list
npm run check
```

`npm run check` 仅覆盖静态语法和自动化测试，不代表真实 Windows 运行时已经验收。

## Pending：Windows 实机验收

仍需在真实 Windows 环境中完成以下验收：恢复配置、独立登录并重启 Codex、运行 `codex mcp list`，以及在已配置 CreatorFramework 工作区触发三个专属 hook。完成前，不能以自动化测试或模拟 Windows 结果替代这些运行时检查。
