# 全局规则

## 语言

永远使用中文简体回答。

## 与 CLAUDE.md 对齐原则

- `~/.codex/AGENTS.md` 是 Codex 侧全局规则；`~/.claude/CLAUDE.md` 是 Claude Code 侧全局规则。
- 两边共享的行为偏好保持一致，但工具名必须按平台运行时真实名称书写，不要互相硬搬。
- Codex 端规则里当前使用的 MCP / 工具名以 `codex mcp list` 与当前会话工具列表为准；规则中涉及浏览器时统一写 `chrome-devtools`、`playwright`。
- Codex 侧的交互、计划、多 Agent、长任务与 hooks 分别使用当前运行时提供的 `request_user_input`（可用时）、`update_plan`、`spawn_agent` / `tool_search`、`exec_command` session + `write_stdin`、Codex lifecycle hooks。
- 当规则需要同步时，先判断它是“行为偏好”还是“平台工具实现”；行为偏好两边同步，平台工具实现只写入对应平台文件。

## 主线程消息转发

- 用户明确说“发消息给主线程”“转告主线程”或同义表达时，立即定位当前关联主任务，并使用 Codex 的 thread message 工具发送简洁、可执行的 follow-up；不得要求用户重复确认。
- 侧会话不得操作或调度子 agent，但这不限制向主线程发送用户明确要求的消息。若主线程无法识别或消息工具不可用，先做一次只读定位；仍失败时一次性说明具体阻塞。
- 转发后必须明确告知用户已发送的目标任务和内容要点；不得声称已经修改主线程代码或完成主线程任务。

## 大文件读取限制规则

禁止为了了解全貌而直接完整读取超过 **2500 行**的代码文件。非代码的配置、JSON、Markdown、日志和文本类文件不受此限制，但仍应按任务需要控制范围。

替代方式：

1. 优先用内置 `grep` 工具搜索关键词、函数名、类名，用内置 `glob` 工具按文件名查找；不默认用 Bash 的 `rg`/`find`。
2. 定位行号后，用内置 `read` 工具的 `offset`/`limit` 只读取相关行范围。
3. 需要看结构时，先用符号、目录、内置 `grep` 或小范围片段建立地图，再继续深入。

例外：用户明确要求“读取完整文件”“给我看完整内容”时可以完整读取；“参考这个文件”“这是相关文件”等间接提及不算明确要求。

## Shell 命令使用规则

- 默认优先使用内置工具：文件搜索用内置 `glob` 工具（不用 Bash `find`/`ls`），内容搜索用内置 `grep` 工具（不用 Bash `grep`/`rg`），读文件用内置 `read` 工具（不用 Bash `cat`/`head`/`tail`）。
- 以下场景才适合用 Shell：统计计数（`wc`/`grep -c`）、管道组合、git 历史与对象操作、二进制/结构化数据处理、环境探测、运行测试/构建。此时可用 `rg`/`fd`/`bat`/`eza` 等高效命令。
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

- 通过 `spawn_agent` 创建 subagent 时，模型和effort选择优先选择能够继承主会话上下文的方案。
- 首轮 code review、复杂架构判断、跨模块调研等高风险任务应使用较高推理强度；首轮 review 后已修复、只做再次复核的任务，或简单只读探索，可以适当降低。
- 只有用户明确指定其他模型/推理强度，或当前工具能力不支持上述设置时，才允许偏离；如需偏离，先向用户说明原因。
- 如果当前会话没有暴露 `spawn_agent`，先用 `tool_search` 查找多 agent 工具；仍不可用时，说明工具不可用，并用当前线程或 `multi_tool_use.parallel` 完成能并行的只读探索。

### 用户级角色路由

- `~/.codex/agents/general.toml`：执行、根因判断和修复，固定 `gpt-5.6-terra` + `high`。
- `~/.codex/agents/explorer.toml`：只读定位文件、符号和调用链，固定 `gpt-5.6-luna` + `max`。
- `~/.codex/agents/reviewer.toml`：只读审查，不覆写模型或 effort，继承主线程；派发时不得携带完整主会话历史。
- `~/.codex/agents/architect.toml`：Brainstorming 并行候选方案探索，不覆写模型或 effort，继承主线程；可执行一次性研究脚本，默认不实现功能、不写最终 Spec/Plan。
- 已禁用插件内置的 `superpowers:requesting-code-review`。涉及实现 Task、重大功能或合并前审查时使用用户级 `$requesting-code-review` skill。

### 子代理上下文路由

- `general` 与 `explorer` 必须以 `fork_turns: "3"` 派发：只继承最近 3 个主线程回合，既保留当前任务约束，也允许其固定模型/effort 生效。禁止用 `fork_turns: "all"`。
- `reviewer` 与 `architect` 必须以 `fork_turns: "none"` 派发：不继承主线程历史，只接收有界审查包或方案探索 brief；两者的模型/effort 仍按各自 agent 定义继承主线程。
- 若 `general` 或 `explorer` 需要早期决策，主线程必须把相关事实压缩写入派发 prompt；不得改用完整历史 fork 规避这一规则。

### 默认探索到实现路由

- 未知范围的文件定位、符号检索或调用链事实收集，默认先派 `explorer`；主线程不得先无边界阅读业务代码再形式化派发。
- `explorer` 只返回可验证证据、绝对路径、影响范围与风险，不修改文件，也不直接给出实现补丁或最终审查结论。
- 已取得证据后，跨模块根因判断、实质修改和审查 finding 修复才派 `general`；范围或风险仍不明确时，继续用 `explorer` 收敛。
- 仅当目标文件、位置、改法和验证方式都明确，且不涉及跨文件联动、公共 API、共享数据、网络、异步、安全、资源路径或构建链时，主线程可直接完成单文件机械改动；该例外不免除验证与对应 review gate。

### 代码审查门禁

- L0：仅一文件、机械、低风险且不涉及公共 API、共享数据、网络、异步、安全、构建或资源路径的变更，可由主线程完成结构化审查；必须记录需求核对、变更路径、验证证据和 residual risk。
- L1：仍满足单模块、最多 2 个代码文件、改动不超过 100 行且不存在前述高风险边界，但不满足 L0 的任务，派一个 `reviewer`，使用 `COMBINED_REVIEW`。
- L2/L3：其余实现 Task 必须分别派 `SPEC_COMPLIANCE` 与 `CODE_QUALITY` 两个独立 `reviewer`。任一 Critical/Important finding 均阻塞后续。
- L1/L2/L3 修复后必须复用该 Task 原 reviewer thread，保持原 `REVIEW_MODE`，以 `REVIEW_PHASE: RE_REVIEW` 携带完整 `PRIOR_FINDINGS`、`FIX_DIFF` 与真实 `VERIFICATION_EVIDENCE`。唯一允许转换为 `COMBINED_REVIEW -> CODE_QUALITY` escalation，同时另起 `SPEC_COMPLIANCE` reviewer。
- 审查包只能包含当前 Task 的 brief、绑定约束、scoped diff/review package、必要实现报告与验证证据；禁止传主会话历史、无关 Task、完整 Plan 或预判 verdict。输出按 `$requesting-code-review` 的 reviewer contract。

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

## Superpowers 与交互工具适配

### Superpowers 特殊偏好

- 当用户明确要求：在使用 `using-superpowers` 系列 skill 时，不执行 `executing-plans` 里“必须在 worktree 改代码”或“必须先用 `using-git-worktrees` 建立隔离工作区”的要求，必须按用户指令覆盖该默认流程。
- 在该偏好生效时，可以继续使用 `executing-plans` 的其余审阅、执行、验证步骤，但默认直接在当前工作区完成实现，不主动创建或切换到 worktree。
- 只有当用户随后再次明确要求使用 worktree，或当前任务确实只能在隔离工作区安全完成时，才允许重新进入 worktree 流程；如属后者，需先向用户说明原因。

### Superpowers 触发与 Brainstorming 分类

- 每个新对话或用户启动独立新任务时，先按 `using-superpowers` 做 skill 匹配；仅在相关 skill 适用时调用它。
- `brainstorming` 仅用于创建功能/组件、增加能力或改变行为；普通问答、状态汇报、只读调查不进入它，技术故障先走 `systematic-debugging`。
- 调用 `brainstorming` 后，在第一个澄清问题前声明分类：Spike 是只产出可行性结论的探针；Bounded 是既有流程内的小范围改动，经短设计批准后直接实现、不写 Spec/Plan；Architectural 是新系统、重组关系或影响消费者接口的改动，经设计与 Spec 批准后才进入 `writing-plans`。
- 复杂度一旦超过当前路径的边界，只能升级到更重路径；每个路径都保留对应的用户批准门。

### Superpowers Spec / Plan 审查门禁

- 写入或修订 `docs/superpowers/specs/*.md` 后，必须立即派 `reviewer` 执行 `REVIEW_MODE: SPEC_DOCUMENT`；Spec 未获 `Approved` 禁止进入 `writing-plans` 或写入对应 Plan。
- 写入或修订 `docs/superpowers/plans/*.md` 后，必须立即派 `reviewer` 执行 `REVIEW_MODE: PLAN_DOCUMENT`；Plan 未获 `Approved` 禁止进入 `subagent-driven-development`、`executing-plans` 或实现阶段。
- 文档审查的 Critical / Important finding 必须修复；修订后使用原 reviewer 的 `REVIEW_PHASE: RE_REVIEW`。用户审阅不能替代独立 reviewer。
- `superpowers-document-review-reminder` 只负责检测、提醒和审计，不会自行派发 reviewer；收到提醒后由主线程执行上述门禁。Codex CLI 的 UI/JSON 可能把编辑显示为 `file_change`，但受信任的 hook 生命周期可实际收到 `apply_patch`；匹配的审计事件是触发的正向证据，日志缺失不能单独否定触发，需结合 hook stderr 或运行时诊断，不能只看 UI 工具标签或 agent 的口头回报。

### Architectural 任务的 SDD 恢复材料

- 所有经 `brainstorming` 判定为 **Architectural** 的任务，在 Spec 和 Plan 获批并进入实施后，无论用户选择 `Inline Execution` 还是 `subagent-driven-development`，都必须按 SDD 的恢复机制维护当前 Plan 专属的本地 workspace；Inline 只决定由主线程实现，不得作为省略 ledger 或过程材料的理由，也不得因为创建 SDD workspace 自动改成子代理执行。
- 第一次实施动作前，优先运行当前 `subagent-driven-development` skill 提供的 `scripts/sdd-workspace <PLAN_FILE>` 获取 workspace，禁止手写猜测目录；workspace 必须与 Plan 一一对应，其他 Plan 的目录和旧的 `.superpowers/sdd/progress.md` 不得复用。若接手的是已经开始但缺少 workspace 的 Architectural 任务，必须在下一次代码动作前补建，并只根据 Git、当前 Review 和真实验证证据回填；无法核实的内容明确标为未知，禁止伪造完成记录。
- workspace 至少维护以下本地过程材料：
  - `progress.md`：首行严格写为 `# SDD ledger — plan: <plan file path>`；持续记录每个 Task 的 `pending / in progress / fix round / complete`、提交 SHA、Review scope 与 patch hash、验证命令和结果、未关闭 finding、residual risk、暂停原因及恢复入口。只有提交与门禁证据真实存在时才能写 `complete`。
  - 每个 Task 的有界 brief：只包含该 Task 的需求、约束、文件范围、依赖和验收，不复制整段主会话或无关 Plan 内容。
  - implementation report：记录实际改动、偏离与原因、验证证据、未验证项和交接信息。
  - review package 与 reviewer verdict 摘要：记录审查模式、范围、基准、patch hash、findings、修复轮次和最终 Gate；不得用摘要替代 reviewer 的真实结论。
- `update_plan` 与 SDD ledger 必须同步：`update_plan` 用于当前会话的可见任务状态，`progress.md` 用于压缩、重启和跨会话恢复；二者冲突时先依据 Git、Review 指纹和验证输出纠正状态，不能凭记忆覆盖 ledger。
- SDD workspace 默认必须 Git ignored、untracked、unstaged，不得混入生产提交；除非用户明确要求提交这些材料。维护进度、测试数量、patch hash或修复轮次时只更新 workspace。

### 执行方式选择不得自动降级

- 当 skill 要求在 inline execution、subagent-driven 等执行方式之间让用户选择时，必须在普通可见回复中展示选项并等待用户明确选择；不得自行决定。
- “未获 subagent 授权”只表示不得直接调用 `spawn_agent`，不表示用户已经授权 inline execution，也不得据此自动退化为当前线程执行。
- 用户回复“继续”只表示通过当前正在等待的 review gate；除非同一条消息明确指定执行方式，否则不能把“继续”解释为选择 inline。即使 `request_user_input` 不可用，也必须用普通文本提出一个简短问题；“能合理假设就继续推进”不适用于 skill 明确要求的执行方式选择。

### Visual Companion 询问可见性

- `superpowers:brainstorming` 触发 Visual Companion / 视觉伴侣询问时，不照搬 skill 里的英文原句；必须用中文询问，并明确说明它是浏览器可视化辅助、需要打开本地 URL、可能更耗 token。
- 这类询问必须作为普通可见的用户消息发送；不要只放在可能被 Codex 折叠的导入对话、工具输出、内部状态或英文原文里。
- 如果因为 skill 要求“单独消息”导致询问在 Codex 完成后被折叠，后续第一条可见回复必须用中文回显刚才的问题和当前默认处理，例如“刚才是在问是否启用视觉伴侣；你没明确同意前我按纯文本继续”。
- 用户未明确同意前，默认不启用 Visual Companion；后续确实需要视觉辅助时，再用中文重新征询。

### Superpowers 用户可见输出

- 使用任何 `superpowers:*` skill 时，凡是需要用户阅读、确认、选择或审阅的内容，都必须出现在普通可见的助手回复里；不要只放在 Codex 可能折叠的“已处理/已导入对话”、工具输出、内部状态、执行日志或中间进度里。
- 这包括但不限于：澄清问题、2-3 个方案比较、推荐方案、设计草案、用户 review gate、实现方式选择、执行计划摘要、关键风险和验收标准。
- 若这些内容已经在中间进度里说过，最终回复或等待用户输入前的可见回复必须用中文重新给出完整要点，不能只写“如上”“已在上面说明”。
- 只有纯流程状态可以放在可折叠区域，例如正在读取哪个 skill、正在扫哪些文件、某个只读命令是否完成；任何会影响用户决策的内容都要在可见回复里重复。

### Checklist / 计划管理

- Codex 中的任务清单统一使用 `update_plan`。
- 对 superpowers skill 中明确写有 checklist、step-by-step、或 “You MUST create a task for each” 的流程，进入后应建立 `update_plan` 清单。
- 清单一次只保留一个 `in_progress`，完成一项及时更新，不要只在最后批量标记。
- 不适用的步骤在说明里写清跳过原因。

### 用户提问

- `request_user_input` 可用且场景适合时优先使用。
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

- 主工作区：`<当前 CreatorFramework 根>`
- 项目内 worktree：`<当前 CreatorFramework 根>/.worktrees/<任意名字>`
- Codex 托管 worktree：`<Codex worktree>/CreatorFramework`
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
3. `<当前 worktree 根>/.cursor/rules/mcp-use.mdc`
4. `<当前 worktree 根>/.cursor/rules/cocos-visual-verification.mdc`
5. `<当前 worktree 根>/docs/ai/agent-reference.md`

文件不存在时跳过，不报错。优先级低于 `AGENTS.local.md`，但高于团队 `AGENTS.md`。

如果 `AGENTS.local.md` §10 入口段的引用清单变动，必须同步修改本清单。

## 项目级 AGENTS 加载顺序（OpenCodex Relay）

### 适用范围

当当前工作目录属于 `~/webstorm_project/opencodex-relay`，或属于该仓库的任意 git worktree 时，本规则生效。当前 worktree 根通过 `git rev-parse --show-toplevel` 获取，不要写死到子目录。

### 加载顺序（从高到低）

1. `<当前 worktree 根>/AGENTS.local.md`：必须主动读取；与仓库或全局规则冲突时优先遵循。
2. `<当前 worktree 根>/AGENTS.md`：仓库团队规则。
3. 本文件其余全局规则：仅作为基线。

### 补充约定

- `AGENTS.local.md` 不存在时，按仓库 `AGENTS.md` 与本文件全局基线执行，不报错。
- 该项目的本地规则应包含专项测试文件隔离，以及相对官方版本最小修改面的实现与审查约束；后者是每次代码审查的必查项。
