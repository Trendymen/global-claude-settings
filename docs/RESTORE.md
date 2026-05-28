# 在新机器上还原 Claude Code / Codex 全局规则配置

## 前置依赖

| 工具 | 用途 | 安装 |
|------|------|------|
| Claude Code | 主程序 | `npm i -g @anthropic-ai/claude-code`（或参考官方文档） |
| Codex | 主程序 | 按当前平台安装 Codex |
| `node` | 运行跨平台恢复脚本与 Node hooks | macOS: `brew install node`；Windows: 安装 Node.js LTS |
| `gh` | 拉私有仓库用（可选） | brew install gh |
| `git` | 必备 | macOS 自带；Windows 建议安装 Git for Windows |

可选（hooks / skills 用到的）：
- `rg`、`fd`、`bat`、`eza`：CLAUDE.md 里推荐的现代化命令行工具

## 步骤一：克隆仓库

```bash
git clone git@github.com:Trendymen/global-claude-settings.git ~/.claude/global-claude-settings
```

如果还没设置 ssh key，先用 https 克隆 + `gh auth login` 后改成 ssh remote。

## 步骤二：一键还原

```bash
cd ~/.claude/global-claude-settings
node install.mjs

# 或使用 npm script：
npm run restore

# macOS / Linux 也可以：
bash install.sh

# Windows PowerShell 也可以：
pwsh ./install.ps1
```

`install.mjs` 做的事：
1. 创建 `~/.claude/` 下所有需要的子目录
2. 把 `claude/` 里的文件复制到 `~/.claude/` 对应位置（已存在的文件先备份成 `*.before-restore-<时间戳>`）
3. 把 `claude/mcp-user-scope.json` 里的 `mcpServers` 合并进 `~/.claude.json`（不覆盖其他字段）
4. 把 `codex/` 里的规则、配置和 hooks 复制到 `~/.codex/`；恢复 `config.toml` 时会把原机器 home 路径替换成当前机器 home 路径
5. 跳过 `*.bak-*` 这类 hook 备份文件

## 步骤三：安装插件

`install.mjs` 不会自动装插件（避免在还没启动 Claude Code 的环境里乱拉 marketplace），需要手动执行：

```bash
# 进入 Claude Code 后执行
/plugin marketplace add anthropics/claude-plugins-official
/plugin install superpowers@claude-plugins-official
/plugin install context7@claude-plugins-official
/plugin install frontend-design@claude-plugins-official
/plugin install code-review@claude-plugins-official
```

清单参考 `claude/plugins/installed_plugins.json`。

## 步骤四：shell 集成（可选）

如果用 zsh，在 `~/.zshrc` 里追加：

```bash
[ -f ~/.claude/claude-mode.zsh ] && source ~/.claude/claude-mode.zsh
```

然后 `source ~/.zshrc`。

`claude-mode.zsh` 由 `switch-claude.js` 维护，用 `node ~/.claude/switch-claude.js official` 可切换到官方模式，`proxy` 切到代理模式（如果有的话）。

## 步骤五：验证

```bash
# 1. 启动 Claude Code，检查是否加载了 CLAUDE.md
claude --version

# 2. 进入任意项目，新会话开头应能看到 superpowers skill 列表
# 3. 触发 hook 测试：尝试编辑文件，Stop hook 应正常工作

# 4. 检查 mcp servers
claude mcp list

# 5. 检查 Codex 全局规则和配置文件
test -f ~/.codex/AGENTS.md && sed -n '1,40p' ~/.codex/AGENTS.md
test -f ~/.codex/config.toml && sed -n '1,40p' ~/.codex/config.toml
```

## 关于 vscode-mcp-server

`settings.json` 引用了 `http://127.0.0.1:3000/mcp`，需要在 VS Code 装好对应扩展并启动监听端口才能工作；缺失时 Claude Code 会忽略并提示，不影响其他功能。

## 项目级配置（不在本仓库）

`CreatorFramework` 项目根的 `.claude/` 以及 `CLAUDE.md` / `AGENTS.md` / `.mcp.json` / `agent-tools/` / `.cursor/rules/` / `docs/superpowers/` 等被 `.git/info/exclude` 本地排除的 AI 工作流文件，**统一由 aigit 工具同步到独立私人 remote** `git@github.com:Trendymen/CreatorFramework-ai.git`。

新机器上还原项目级配置：

```bash
# 1. 准备 aigit 裸仓库（克隆 CreatorFramework-ai 到 ~/.ai-configs 下）
mkdir -p ~/.ai-configs
git clone --bare git@github.com:Trendymen/CreatorFramework-ai.git ~/.ai-configs/CreatorFramework-ai.git

# 2. 把 aigit 追踪的所有 AI 文件 checkout 到 CreatorFramework 工作区
PROJECT_DIR=~/path/to/CreatorFramework
git --git-dir=~/.ai-configs/CreatorFramework-ai.git --work-tree="$PROJECT_DIR" checkout -- .
```

注：`agent-tools/aigit.js` 由 aigit 自己追踪，checkout 后即可用 `node agent-tools/aigit.js status` 验证。

## 同步回仓库（修改了 ~/.claude 或被备份的 ~/.codex 文件之后）

```bash
cd ~/.claude/global-claude-settings
node install.mjs --pull-from-home
# 或：npm run pull
git add -A
git diff --cached
git commit -m "chore: 同步全局 AI 规则"
git push
```

## 排查

| 现象 | 原因 / 处理 |
|------|------|
| hook 没触发 | 检查 `settings.json` / `config.toml` 中 hooks 字段路径；Windows 下 shell hook 需要 Git Bash 或改成 Node hook |
| MCP 连不上 | 看 `claude mcp list` 状态；本仓库只备份用户 scope，项目 scope 的 MCP（如 ben-cocos-mcp）由各项目自己维护 |
| 插件命令不识别 | `enabledPlugins` 需要 marketplace 已经 add + plugin 已经 install；可重新 `/plugin install` |
| 文件没被覆盖 | `install.mjs` 默认会把已有文件备份成 `*.before-restore-*` 然后覆盖；如想保留旧文件改用 `node install.mjs --no-overwrite` |
