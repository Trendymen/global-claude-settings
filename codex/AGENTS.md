# 全局规则

## 语言

永远使用中文简体回答。

## 与 CLAUDE.md 对齐原则

- `~/.codex/AGENTS.md` 是 Codex 侧全局规则；`~/.claude/CLAUDE.md` 是 Claude Code 侧全局规则。
- 两边共享的行为偏好保持一致，但工具名必须按平台运行时真实名称书写，不要互相硬搬。
- Codex 端规则里当前使用的 MCP / 工具名以 `codex mcp list` 与当前会话工具列表为准；规则中涉及浏览器与 diagnostics 时统一写 `chrome-devtools`、`playwright`、`vscode_mcp_server`。
- Claude 专属项包括 `AskUserQuestion`、`TaskCreate` / `TaskUpdate`、`Agent`、`TeamCreate`、`Monitor`、`ScheduleWakeup`、Claude Code hooks。
- Codex 对应迁移为 `request_user_input`（可用时）、`update_plan`、`spawn_agent` / `tool_search`、`exec_command` session + `write_stdin`、Codex lifecycle hooks。
- 当规则需要同步时，先判断它是“行为偏好”还是“平台工具实现”；行为偏好两边同步，平台工具实现只写入对应平台文件。

## 大文件读取限制规则

禁止为了了解全貌而直接完整读取超过 **2500 行**的代码文件。非代码的配置、JSON、Markdown、日志和文本类文件不受此限制，但仍应按任务需要控制范围。

替代方式：

1. 优先用 `rg` / `rg --files` 搜索关键词、函数名、类名或文件名。
2. 定位行号后，只读取相关行范围。
3. 需要看结构时，先用符号、目录、`rg` 或小范围片段建立地图，再继续深入。

例外：用户明确要求“读取完整文件”“给我看完整内容”时可以完整读取；“参考这个文件”“这是相关文件”等间接提及不算明确要求。

## Shell 命令使用规则

- 文件搜索优先用 `rg --files`，内容搜索优先用 `rg`。
- 必须通过 shell 搜索时，可使用系统原生命令 `find` / `grep` / `cat` / `ls`，也可使用本机现代工具 `fd` / `bat` / `eza`。
- 并行读取多个独立文件或运行多个互不依赖的只读命令时，优先使用 `multi_tool_use.parallel`，不要用 `echo "===="`、分号串联等方式制造噪音。
- 写脚本时默认优先 Node ESM JS；见“脚本语言优先级规则”。

## 脚本语言优先级规则

适用范围：CLI 内联脚本、一次性批处理、落盘脚本、辅助工具、数据处理、文件转换、批量操作等。

### 默认规则

1. 默认使用 Node ESM JS：`node -e`、`node --input-type=module -e`、`.mjs`，或已有 `"type": "module"` 项目里的 `.js`。
2. 脚本超过约 150 行、职责明显不止一个、需要较多外部依赖、或可能复用时，升级为小型 npm 工程，包含 `package.json` 和 `src/` 拆分。
3. 依赖优先 Node 生态：zip/xml/图像/PDF/爬虫/CLI parsing 优先考虑 `yauzl`、`yazl`、`fast-xml-parser`、`sharp`、`pdf-lib`、`playwright`、`cheerio`、`commander`/`yargs` 等。
4. 简单计算或验证也优先用 Node，不默认写 `python3 -c`。

### Python 例外

只有以下情形优先使用 Python：

- 用户明确指定 Python。
- 当前任务是在成熟 Python 项目内扩展功能。
- 任务强依赖 Python 生态，例如 PyTorch、TensorFlow、Pandas、NumPy、SciPy、Scrapy、特定科学计算或 Python-only 库。

如果坚持使用 Python，应在回复中简短说明命中了哪条例外。

## Subagent 默认规则

- 所有通过 `spawn_agent` 创建的 subagent，默认都必须使用 `gpt-5.5`。
- 所有通过 `spawn_agent` 创建的 subagent，默认都必须使用 `high` 推理强度。
- 调用 `spawn_agent` 时显式传入 `model = "gpt-5.5"` 与 `reasoning_effort = "high"`，不要只依赖继承默认值。
- 只有用户明确指定其他模型/推理强度，或当前工具能力不支持时，才允许偏离；如需偏离，先向用户说明原因。
- 如果当前会话没有暴露 `spawn_agent`，先用 `tool_search` 查找多 agent 工具；仍不可用时，说明工具不可用，并用当前线程或 `multi_tool_use.parallel` 完成能并行的只读探索。

## 多 Agent 与并行规则

收到任务后先评估复杂度、依赖关系和写入冲突。

### 适合并行

- 任务包含 2 个及以上独立子任务。
- 需要同时探索多个目录、模块、假设或实现路径。
- 多个只读检查、文件读取、日志分析可互不依赖地运行。
- 用户明确要求并行或高效完成。

### 执行策略

1. 无数据依赖、无写入冲突的探索任务可以并行。
2. 文件写入任务默认由主线程统一落盘；只有隔离 worktree 或明确无冲突时才交给多个 subagent 并行修改。
3. 设计/方案任务可并行产出候选方案，再由主线程横向对比并给推荐。
4. 单次并行上限默认 5 个 agent 或 5 组工具调用，避免资源争抢。
5. 派发前简短说明每个 agent 或并行任务的职责；完成后由主线程汇总、去重、解决冲突。

### Codex 工具适配

- 有 `spawn_agent` 时按上面的模型与推理强度规则显式传参。
- 没有 `spawn_agent` 但有 deferred multi-agent 工具时，先用 `tool_search` 查询 schema。
- 只读 shell / 文件读取优先用 `multi_tool_use.parallel`。
- 有依赖的步骤保持串行，不为了并行而牺牲正确性。

## 浏览器工具选择

当存在多个浏览器相关 MCP 可用时，必须先根据任务类型选择工具，不要随意切换。Codex 端当前规则涉及的浏览器 MCP server 名为 `chrome-devtools` 和 `playwright`。

### 默认优先级

- 默认优先使用 `chrome-devtools` 处理当前默认用户目录浏览器里的页面和标签页。
- 当任务需要全新、隔离的浏览器会话，不复用当前用户浏览器时，优先使用 `playwright`。
- 只有 `chrome-devtools`、`playwright` 都明显无法完成任务时，才允许继续寻找其他替代方案。

### 必须优先使用 `playwright` 的场景

- 需要全新、隔离的浏览器会话，避免污染当前浏览器状态。
- 需要稳定执行可重复的自动化流程，且不依赖当前浏览器已有页面或登录态。
- 需要批量表单测试、脚本化回归、独立打开页面并按固定步骤执行。
- 抓取新闻网站、论坛、社区、博客、文档站等公开网页内容。
- 需要以固定步骤反复访问页面、提取内容或执行自动化检查的任务。
- 凡是不需要复用当前浏览器上下文的任务，默认都走 `playwright`。

### 必须优先使用 `chrome-devtools` 的场景

- 读取、分析、继续操作当前已经打开的浏览器页面或标签页。
- 依赖当前浏览器登录态、Cookie、本地存储、已有会话的任务。
- 用户明确提到“当前浏览器”“默认浏览器”“现有标签页”“我已经打开了页面”“默认用户目录”等场景。
- 以人工浏览后的页面为基础继续提取内容、排查问题或复用现有上下文。

### 回退规则

- 当前用户浏览器上下文任务优先 `chrome-devtools`。
- 只有确实需要隔离会话时才切到 `playwright`。
- 如果必须切换浏览器工具，先用一句话说明原因。

## Diagnostics 校验规则

1. 只要 AI 代理改动了代码文件，在结束任务前必须优先使用 `vscode_mcp_server` 检查 diagnostics，默认先检查本次修改过的文件。
2. 如果 diagnostics 中存在由本次改动引入、或与本次改动直接相关的问题，AI 代理必须继续尝试修复，不能在未处理的情况下直接结束任务。
3. 当改动范围较大、涉及公共类型、基础工具、跨模块调用链或用户明确要求时，除了文件级 diagnostics，还应追加工作区级或相关目录级 diagnostics 检查。
4. 如果 `vscode_mcp_server`、VS Code 工作区或对应 MCP 会话未启动、不可连接、无响应，允许跳过 diagnostics 步骤；但最终回复中必须明确说明已跳过以及跳过原因。
5. diagnostics 默认按当前 Codex/Claude 会话绑定的工作区判断项目；优先依据当前 `cwd` 或当前已打开工作区解析相对路径。
6. 若存在多工作区、路径归属不清、或用户同时提供了多个仓库上下文，优先使用绝对路径；必要时先确认当前工作区根目录，再获取 diagnostics，避免串项目。
7. 默认只修复本次任务涉及范围内的 diagnostics；对于仓库中原有且与本次改动无关的问题，应说明存在历史问题，但不要无边界扩散修改。

## Superpowers 与交互工具适配

### Superpowers 特殊偏好

- 当用户明确要求：在使用 `using-superpowers` 系列 skill 时，不执行 `executing-plans` 里“必须在 worktree 改代码”或“必须先用 `using-git-worktrees` 建立隔离工作区”的要求，必须按用户指令覆盖该默认流程。
- 在该偏好生效时，可以继续使用 `executing-plans` 的其余审阅、执行、验证步骤，但默认直接在当前工作区完成实现，不主动创建或切换到 worktree。
- 只有当用户随后再次明确要求使用 worktree，或当前任务确实只能在隔离工作区安全完成时，才允许重新进入 worktree 流程；如属后者，需先向用户说明原因。

### Checklist / Todo 迁移

- Claude 的 `TodoWrite` / `TaskCreate` 规则在 Codex 中迁移为 `update_plan`。
- 对 superpowers skill 中明确写有 checklist、step-by-step、或 “You MUST create a task for each” 的流程，进入后应建立 `update_plan` 清单。
- 清单一次只保留一个 `in_progress`，完成一项及时更新，不要只在最后批量标记。
- 不适用的步骤在说明里写清跳过原因。

### 用户提问迁移

- Claude 的 `AskUserQuestion` 规则在 Codex 中迁移为：`request_user_input` 可用且场景适合时优先使用。
- 若 `request_user_input` 不可用，按当前 Codex 模式要求处理：能合理假设就继续推进；必须问时只问 1 个简短问题。
- 不要为了模拟结构化按钮，在普通文本里写复杂多选题。
- 真开放题、路径/URL/数字等具体值、贴日志等问题仍用普通文本。

### Brainstorming 多方案规则

- `brainstorming` / `writing-plans` 需要比较 2-3 条真实技术路径时，优先并行生成候选方案。
- 如果可用，用 `spawn_agent` 创建独立 Plan agent；不可用时可用当前线程给出 2-3 个简明方案，但要明确推荐项和取舍。
- 方案明显只有一条合理路径、或用户已经指定方向时，不强行制造多个方案。

## 长任务后台化规则

适用范围：预计执行时间超过 2 分钟的命令或子任务，例如全量测试/构建、`tsc -b` 大项目、长时间安装、批量脚本、爬虫、复杂 subagent 调研。

### Codex 处理方式

1. 使用 `exec_command` 时设置合适的 `yield_time_ms`，拿到 session id 后用 `write_stdin` 继续读取输出。
2. 不用 `sleep 300` 这类长等待占住上下文。
3. 需要稍后继续本线程时，使用 Codex app 的 heartbeat automation，而不是手写轮询。
4. 如果长任务必须同步等结果，先确认这是用户当前需要的交互形态。
5. 结束当前回复前，不要留下仍需本次任务处理的后台 session 无人跟进。

## Codex Hook 迁移规则

- Codex hook 与 Claude hook 的生命周期名称相近，但 payload 和输出字段不同；Claude hook 脚本不能直接复制使用。
- Codex hooks 默认可用；若配置中显式声明，使用 `[features].hooks = true`，不要再使用废弃的 `codex_hooks`。
- 优先把 hook 放在 `~/.codex/config.toml` 的 inline `[hooks]` 表，或放在 `~/.codex/hooks.json`；同一层不要两种形式混用。
- Hook 输出优先使用 Codex 支持的 `systemMessage` 或 `hookSpecificOutput.additionalContext`。
- 避免在 `PreToolUse` 中返回 Codex 当前不支持的 `continue`、`stopReason`、`suppressOutput` 等字段。
- 新增或修改 hook 后，下一次 Codex 启动可能要求 review/trust；这是正常安全流程，不要绕过，除非用户明确要求一次性 `--dangerously-bypass-hook-trust` 验证。

## 项目级 AGENTS 加载顺序（CreatorFramework 主工作区 + 所有 worktree）

### 适用范围

当当前工作目录属于 **CreatorFramework 项目**时，包括：

- 主工作区：`/Users/liuzhuo/webstorm_project/company-projects/CreatorFramework`
- 项目内 worktree：`/Users/liuzhuo/webstorm_project/company-projects/CreatorFramework/.worktrees/<任意名字>`
- Codex 托管 worktree：`/Users/liuzhuo/.codex/worktrees/<任意哈希>/CreatorFramework`
- 其他位置的 git worktree

判定方法：在会话开始时跑 `git rev-parse --git-common-dir`，如果输出指向 `<...>/CreatorFramework/.git`，就视为当前会话在 CreatorFramework 项目里，本规则生效。

### 加载顺序（从高到低）

1. `<当前 worktree 根>/AGENTS.local.md`：用户私人扩展规则，由 aigit 单独追踪，不入主仓库。必须主动读取；与团队规则冲突时以它为准。
2. `<当前 worktree 根>/AGENTS.md`：团队公共规范。在不与 `AGENTS.local.md` 冲突时遵守。
3. 本文件其他段落：全局基线。

当前 worktree 根通过 `git rev-parse --show-toplevel` 获取，不要写死主工作区路径。

### 补充约定

- 本规则只适用于 CreatorFramework 项目；其他项目目录不需要查找 `AGENTS.local.md`。
- 如果当前 worktree 里 `AGENTS.local.md` 不存在，按团队 `AGENTS.md` + 本文件全局规则正常工作，不报错。
- `CLAUDE.local.md` 与 `AGENTS.local.md` 内容互为镜像；改一处通常需要同步另一处。

### 主动 Read 清单（弥补 Codex 不解析 inline @import）

当判定当前会话在 CreatorFramework 项目里时，除读取 `AGENTS.local.md` 外，还必须主动读取以下文件作为高优先级补充规则：

1. `<当前 worktree 根>/.cursor/rules/cocos_creator.mdc`
2. `<当前 worktree 根>/.cursor/rules/pre-commit-review.mdc`
3. `<当前 worktree 根>/.cursor/rules/git-merge-to-develop.mdc`
4. `<当前 worktree 根>/.cursor/rules/mcp-use.mdc`
5. `<当前 worktree 根>/docs/ai/agent-reference.md`

文件不存在时跳过，不报错。优先级低于 `AGENTS.local.md`，但高于团队 `AGENTS.md`。

如果 `AGENTS.local.md` §9 入口段的引用清单变动，必须同步修改本清单。
