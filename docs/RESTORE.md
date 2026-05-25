# 在新机器上还原 Claude Code 全局配置

## 前置依赖

| 工具 | 用途 | 安装 |
|------|------|------|
| Claude Code | 主程序 | `npm i -g @anthropic-ai/claude-code`（或参考官方文档） |
| `node` | 跑 hook 脚本里的 node 命令 | brew install node |
| `jq` | 解析 / 合并 JSON | brew install jq |
| `gh` | 拉私有仓库用（可选） | brew install gh |
| `git` | 必备 | macOS 自带 |

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
bash install.sh
```

`install.sh` 做的事：
1. 创建 `~/.claude/` 下所有需要的子目录
2. 把 `dotclaude/` 里的文件复制到 `~/.claude/` 对应位置（已存在的文件先备份成 `*.before-restore-<时间戳>`）
3. 把 `mcp-user-scope.json` 里的 `mcpServers` 合并进 `~/.claude.json`（不覆盖其他字段）
4. 给 `hooks/` 下所有 `.sh` 加可执行权限
5. 打印插件清单，提示用 Claude Code 内的 `/plugin install` 命令安装

## 步骤三：安装插件

`install.sh` 不会自动装插件（避免在还没启动 Claude Code 的环境里乱拉 marketplace），需要手动执行：

```bash
# 进入 Claude Code 后执行
/plugin marketplace add anthropics/claude-plugins-official
/plugin install superpowers@claude-plugins-official
/plugin install context7@claude-plugins-official
/plugin install frontend-design@claude-plugins-official
/plugin install code-review@claude-plugins-official
```

清单参考 `dotclaude/plugins/installed_plugins.json`。

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
```

## 关于 vscode-mcp-server

`settings.json` 引用了 `http://127.0.0.1:3000/mcp`，需要在 VS Code 装好对应扩展并启动监听端口才能工作；缺失时 Claude Code 会忽略并提示，不影响其他功能。

## 同步回仓库（修改了 ~/.claude 之后）

```bash
cd ~/.claude/global-claude-settings
bash install.sh --pull-from-home
git add -A
git diff --cached
git commit -m "chore: sync from ~/.claude"
git push
```

## 排查

| 现象 | 原因 / 处理 |
|------|------|
| hook 没触发 | 检查 `chmod +x ~/.claude/hooks/*.sh`；查看 `settings.json` 中 hooks 字段路径 |
| MCP 连不上 | 看 `claude mcp list` 状态；本仓库只备份用户 scope，项目 scope 的 MCP（如 ben-cocos-mcp）由各项目自己维护 |
| 插件命令不识别 | `enabledPlugins` 需要 marketplace 已经 add + plugin 已经 install；可重新 `/plugin install` |
| 文件没被覆盖 | install.sh 默认会把已有文件备份成 `*.before-restore-*` 然后覆盖；如想保留旧文件改用 `bash install.sh --no-overwrite` |
