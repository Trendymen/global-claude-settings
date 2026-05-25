# global-claude-settings

我个人的 Claude Code 全局配置备份，含规则、hooks、agents、settings、MCP user-scope、已装插件清单。

> ⚠️ 本仓库**只备份配置**，不备份 sessions / projects / tasks / telemetry / paste-cache 等运行时与隐私数据。

## 目录结构

```
.
├── dotclaude/                  # 与 ~/.claude/ 一一对应的可还原文件
│   ├── CLAUDE.md               # 全局规则（中文，所有项目共享）
│   ├── AGENTS.md               # 全局 agents 指引
│   ├── settings.json           # 主设置（hook / statusLine / mcpServers / enabledPlugins / theme）
│   ├── settings.local.json     # 本地小补丁（权限白名单等）
│   ├── claude-mode.zsh         # shell 集成（switch-claude.js 生成）
│   ├── switch-claude.js        # 在 official/proxy 模式间切换的脚本
│   ├── mcp-user-scope.json     # user-scope MCP 配置（从 ~/.claude.json 抽出来的 mcpServers）
│   ├── agents/                 # 自定义 sub-agent（如 code-reviewer）
│   ├── hooks/                  # PreToolUse / PostToolUse / Stop 钩子脚本
│   ├── skills/                 # 自定义 skill（当前为空）
│   └── plugins/                # 插件清单（不含源码，新机用 /plugin 命令重装）
├── projects/                   # 项目级 .claude/ 配置备份（每个项目一个子目录）
│   └── CreatorFramework/
│       └── .claude/
│           ├── settings.local.json   # 项目级 MCP 权限、hooks、enabledMcpjsonServers
│           └── skills/               # 项目专属 skills（cocos-web-debugging 等）
├── docs/
│   └── RESTORE.md              # 详细还原步骤
├── install.sh                  # 一键还原脚本
└── README.md                   # 本文件
```

> 项目级 `.claude/` 在 `CreatorFramework` 仓库里被 `.git/info/exclude` 本地排除（不入团队 remote），所以集中在本仓库里备份。新机器上克隆完项目后手动 `cp -R projects/CreatorFramework/.claude <项目路径>/.claude` 即可。
>
> 项目里其他被 exclude 的 AI 工作流文件（`CLAUDE.md` / `AGENTS.md` / `.mcp.json` / `agent-tools/` / `docs/superpowers/` 等）由 **aigit** 工具同步到独立私人 remote `Trendymen/CreatorFramework-ai`，本仓库不重复备份。

## 在新机器上还原

```bash
# 1. 克隆
git clone git@github.com:Trendymen/global-claude-settings.git ~/.claude/global-claude-settings
cd ~/.claude/global-claude-settings

# 2. 一键还原
bash install.sh
```

详细步骤见 [docs/RESTORE.md](./docs/RESTORE.md)。

## 何时更新

修改了 `~/.claude/` 下任意被备份的文件后：

```bash
cd ~/.claude/global-claude-settings
bash install.sh --pull-from-home   # 把 ~/.claude/ 里的最新文件抓回本仓库
git add -A
git commit -m "chore: sync from ~/.claude"
git push
```

## 安全说明

- **不包含**：`~/.claude.json`（含 oauth token / 项目历史 / 各种缓存）—— 只抽了里面的 `mcpServers` 子节点
- **不包含**：sessions / projects / tasks / telemetry / history.jsonl / paste-cache / shell-snapshots / file-history / session-env / output / downloads / ide / backups / cache / usage-data
- **不包含**：hooks 目录里的 `*.bak-*` 备份文件
- **包含**：所有 hook 脚本本体（纯 shell 逻辑，不含密钥）
