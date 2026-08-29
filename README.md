# Codex 全局配置恢复

本仓库保存可移植的 Codex 全局配置，并提供 macOS 与 Windows 的恢复、同步和检查入口。

恢复到用户目录下 `.codex` 的内容只有四项：`AGENTS.md`、`config.toml`、`agents/` 与 `hooks/`。此外，通用 skill `requesting-code-review` 会恢复到 `~/.agents/skills/`（按 skill 目录整体覆盖，不影响其他 skill）。认证、会话及其他运行时状态不会被保存或恢复。

## 快速开始

先安装 Node.js LTS、Git 和 Codex，然后克隆本仓库。请将 `<仓库地址>` 替换为实际 Git 地址。

### Windows PowerShell

```powershell
git clone <仓库地址> "$HOME\codex-settings"
Set-Location "$HOME\codex-settings"

# 不启用 CreatorFramework 专属提醒
node install.mjs

# 或：设置 CreatorFramework 的绝对路径并启用专属提醒
node install.mjs --creatorframework-path 'D:\projects\CreatorFramework'
```

Windows 路径可使用盘符绝对路径或 UNC 路径。省略 `--creatorframework-path` 不会创建、删除或覆盖已有的本机路径配置；以后可带该参数再次运行以创建或更新它。

### macOS shell

```bash
git clone <仓库地址> "$HOME/codex-settings"
cd "$HOME/codex-settings"

# 不启用 CreatorFramework 专属提醒
node install.mjs

# 或：设置 CreatorFramework 的绝对路径并启用专属提醒
node install.mjs --creatorframework-path '/Users/你的用户名/projects/CreatorFramework'
```

## 恢复后验证

恢复完成后，独立完成 Codex 登录，并完全退出后重新启动 Codex。随后运行：

```bash
codex --version
codex mcp list
npm run check
```

`npm run check` 只验证脚本语法和自动化测试。真实 Windows 上的恢复、独立登录及重启、MCP 检查，以及在已配置 CreatorFramework 工作区触发三个专属 hook，仍须单独验收（Pending）。

更多步骤、覆盖策略和同步方式见 [docs/RESTORE.md](./docs/RESTORE.md)。
