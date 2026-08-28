# 本仓库协作规则（面向 AI 助手）

本仓库是可移植的 Codex 全局配置备份。任何「同步/更新配置」的请求，按以下规则执行。

## 同步边界：脚本自动 vs 人工/AI 判断

- `AGENTS.md`、`agents/`、`hooks/`：脚本 `--pull-from-home` 会从 `~/.codex` 原样覆盖，无需判断。
- `codex/config.toml`：**脚本刻意不同步**（测试锁定该行为），必须对照本机 `~/.codex/config.toml` 与仓库模板逐段判断，不要因为脚本不覆盖就跳过它。

## config.toml 同步判定

遇到本机 config 与模板差异时，逐项归类：

1. **应同步**：纯行为键与结构段——`[features]`、`[features.multi_agent_v2]`、hooks 注册段（`command` 必须写成 `node "{{CODEX_HOME}}/hooks/..."` 占位符形式）、上下文窗口/压缩/搜索/输出样式等开关、可移植的 `[model_providers.*]` 能力声明。
2. **不同步**：机器绑定内容——用户目录绝对路径（如 `model_catalog_json`、`notify` 里的 App 路径）、凭据与 token、一次性状态（hooks.state、projects 信任列表、marketplaces 缓存）。
3. **需判断或询问**：
   - `model`、`model_reasoning_effort` 等个性化默认值：模板保留自己的默认值，除非用户明确要求对齐。
   - 本机地址：`127.0.0.1` 回环地址可同步；局域网/外网地址先问用户。
   - 用户目录下的文件引用：优先改写成 `{{CODEX_HOME}}/...` 占位符（渲染器支持），无法改写的按机器绑定处理。

## 同步后的必做验证

1. TOML 解析检查（python3 tomllib 或等价方式）。
2. `npm run check` 全绿（含全部用例与可移植性断言：codex/ 内不得出现机器路径）。
3. 端到端恢复一次并用 `scripts/verify-restore.mjs` 验证产物（见 docs/RESTORE.md）。
4. 推送后确认两条 CI（restore-macos / restore-windows）全绿。

