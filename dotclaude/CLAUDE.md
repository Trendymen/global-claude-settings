# 全局规则

## 语言

永远使用中文简体回答。

## 大文件读取限制规则

禁止直接读取超过 **2500 行**的代码文件（非代码的配置/JSON/文本类文件不限）。必须改用以下替代方式：

1. **优先用 Grep 搜索**：通过关键词、函数名、类名等定位目标内容所在行号
2. **按需指定行范围**：确认目标行号后，用 `offset` + `limit` 参数读取对应片段
3. **禁止"为了了解文件全貌"而完整读取**：先用 Grep 扫描结构，再按需读取局部

**例外**：用户主动、明确地说"读取/查看这个文件"或"给我看完整内容"时，可完整读取。"参考这个文件"、"这是相关文件"等间接提及**不算**主动要求，仍须遵守限制。

---

## Shell 命令使用规则

`find`、`grep`、`cat`、`ls` 均为系统原生命令（未被别名覆盖），可直接使用标准语法。

**规则**：

1. **文件搜索优先使用内置 Glob 工具**，内容搜索优先使用内置 Grep 工具
2. 必须通过 Bash 搜索时，可使用 `find` 标准语法或 `fd`（已安装的现代替代工具）
3. 本机额外可用的现代工具：`fd`（find 替代）、`rg`（grep 替代）、`bat`（cat 替代）、`eza`（ls 替代）

---

## Diagnostics 校验规则

1. 只要 AI 代理改动了代码文件，在结束任务前必须优先使用 `vscode-mcp-server` 检查 diagnostics，默认先检查本次修改过的文件。
2. 如果 diagnostics 中存在由本次改动引入、或与本次改动直接相关的问题，AI 代理必须继续尝试修复，不能在未处理的情况下直接结束任务。
3. 当改动范围较大、涉及公共类型、基础工具、跨模块调用链或用户明确要求时，除了文件级 diagnostics，还应追加工作区级或相关目录级 diagnostics 检查。
4. 如果 `vscode-mcp-server`、VS Code 工作区或对应 MCP 会话未启动、不可连接、无响应，允许跳过 diagnostics 步骤；但最终回复中必须明确说明已跳过以及跳过原因。
5. diagnostics 默认按当前 Codex/Claude 会话绑定的工作区判断项目；优先依据当前 `cwd` 或当前已打开工作区解析相对路径。
6. 若存在多工作区、路径归属不清、或用户同时提供了多个仓库上下文，优先使用绝对路径；必要时先确认当前工作区根目录，再获取 diagnostics，避免串项目。
7. 默认只修复本次任务涉及范围内的 diagnostics；对于仓库中原有且与本次改动无关的问题，应说明存在历史问题，但不要无边界扩散修改。

---

## 多 Agent 智能分配规则

收到用户任务后，必须先评估任务复杂度和可并行性，主动拆分并分配多个 Agent 并行执行，而非串行逐步完成。

### 何时必须使用多 Agent

1. **任务包含 2 个及以上独立子任务**：如"修改 A 模块 + 修改 B 模块"、"调研 X + 实现 Y"
2. **需要同时探索/调研多个方向**：如"找出所有相关文件 + 分析架构 + 检查测试"
3. **实现计划包含可并行的步骤**：如多个文件的独立修改、多个模块的独立开发
4. **用户明确要求并行或高效完成**

### 分配策略

1. **分析阶段**：收到任务后，先识别出所有可并行的子任务
2. **分配原则**：
   - 无数据依赖的子任务 → 并行启动多个 Agent
   - 有依赖关系的子任务 → 前置任务完成后再启动后续 Agent
   - 探索/调研类任务 → 优先用 `subagent_type: "Explore"` 并行搜索
   - 实现类任务 → 用 `subagent_type: "general-purpose"` 或 worktree 隔离
   - 规划类任务 → 用 `subagent_type: "Plan"` 先出方案
3. **Agent 类型选择**：
   - 代码搜索/架构理解 → Explore agent
   - 方案设计/架构决策 → Plan agent
   - 代码实现/文件修改 → general-purpose agent（复杂独立模块用 worktree 隔离）
   - 代码审查 → code-reviewer agent
4. **并行上限**：单次最多并行 5 个 Agent，避免资源争抢
5. **结果汇总**：所有 Agent 完成后，主线程负责汇总结果、解决冲突、向用户报告

### 禁止行为

- ❌ 明显可并行的任务却串行逐个完成
- ❌ 主线程重复执行已分配给 Agent 的工作
- ❌ 不向用户说明分配了哪些 Agent 及其职责
- ❌ Agent 之间存在文件写入冲突时仍强行并行（应改用 worktree 隔离或串行）

### 汇报格式

分配 Agent 前，简要告知用户：
```
任务拆分为 N 个并行子任务：
1. [Agent名] - 职责描述
2. [Agent名] - 职责描述
...
```

---

## 工作模式

根据任务复杂度自动选择最合适的执行模式，无需用户指定。

### Agent Team 模式（使用 `TeamCreate` 工具创建）

当遇到以下情况时，**必须主动使用 `TeamCreate` 工具**创建 Agent Team 并行协作：

- 任务涉及 **3 个以上独立模块**的修改
- 需要同时处理**多个层面**（如框架层 + 业务层 + UI 层）
- 需要**多个假设并行验证**的 debug 场景（如同时排查网络/数据/渲染三个方向）
- 大规模重构或迁移，涉及多个目录和文件的协同修改
- 需要同时**调研 + 实现 + 测试**的完整交付

**具体操作**：
1. 先用 `TeamCreate` 创建团队，为每个成员定义明确的 `name` 和 `role`
2. 团队成员之间通过 `SendMessage` 互相通信协调
3. 任务完成后用 `TeamDelete` 清理团队
4. `TeamCreate` 是延迟加载工具（deferred tool），使用前先通过 `ToolSearch` 查询 `select:TeamCreate,TeamDelete,SendMessage` 获取完整 schema

### 普通 Subagent 模式（使用 `Agent` 工具派发）

适用于中等复杂度任务：

- 涉及 1-2 个模块的修改
- 需要探索代码库后再实现
- 单一方向的调研或分析
- 多个独立的一次性子任务并行执行

**具体操作**：用 `Agent` 工具在单条消息中并行派发多个 subagent，每个 subagent 独立完成后向主线程汇报。

### 直接处理模式

适用于简单任务：

- 单文件修改或小范围编辑
- 明确知道修改位置和内容
- 简单的问答或代码解释
- 配置文件调整

### 模式选择决策树

```
收到任务
  ├─ 简单（单文件/问答）→ 直接处理
  ├─ 中等（1-2 模块/需探索）→ Agent 工具派发 subagent
  └─ 复杂（3+ 模块/多层面/需持续协作）→ TeamCreate 创建 Agent Team
```

### 模式升级规则

执行过程中如果发现任务比预期更复杂，**必须主动升级**执行模式：
- 直接处理 → 发现涉及多文件 → 切换到 `Agent` 工具 Subagent 模式
- Subagent 模式 → 发现涉及多模块且需要成员间协作 → 用 `TeamCreate` 升级到 Agent Team 模式

---

## 用户提问统一走 AskUserQuestion 规则

**适用范围**：**所有 skill**（包括但不限于 superpowers 系列 `brainstorming` / `finishing-a-development-branch` / `receiving-code-review` / `requesting-code-review` / `writing-plans` 等；以及非 superpowers 的 `update-config` / `i18n-xlsx-export` / `frontend-design` / 任意项目级或自定义 skill）在执行过程中**需要向用户提问的环节**，以及**普通对话中**（未进入任何 skill 时）AI 自发面对 2-4 选项决策的场景。本规则**覆盖** skill 内部「用普通文本一次问一题」的默认描述（superpowers 自身已声明 CLAUDE.md > skill；非 superpowers skill 同理优先服从本规则）。

> **注**：hook 层硬性提醒目前只覆盖 superpowers 系列 skill（`~/.claude/hooks/superpowers-skill-reminder.sh`）。非 superpowers skill 与普通对话依赖 CLAUDE.md 全局规则的 instruction following，没有 skill 调用瞬间的 system-reminder 注入。

### 强制规则

1. **凡是能列出 2-4 个候选选项的问题，必须使用 `AskUserQuestion` 工具**，禁止用普通文本提问让用户手敲回复。典型场景：
   - 方案 A/B/C 三选一（brainstorming 提案阶段）
   - merge / 开 PR / 仅清理（finishing-a-development-branch）
   - 接受 / 拒绝 / 改写后接受 某条 review 反馈（receiving-code-review）
   - **分段确认题**（brainstorming「§N 这段 OK 吗？」「这段架构通过吗？」「这部分设计认可吗？」）—— 这是 brainstorming 最高频的提问模式，**绝对禁止用纯文本「OK 吗？」收尾**。标准 4 选项模板：
     - 「通过，继续下一段（推荐）」
     - 「这段的 X 部分要改」（X 替换为该段最可能被改的子项）
     - 「这段的 Y 部分要改」（Y 替换为另一可能被改的子项）
     - 「整段重做」
   - 任何「是否启用 X 功能」「优先级 high/medium/low」「选择实现路径」类问题

2. **可一次性合并提问的，合并提交**：`AskUserQuestion` 单次最多支持 4 个独立 question，互相独立、不相互依赖的问题应放在**同一次** `AskUserQuestion` 调用中，避免一问一答多轮往返。

3. **多选题用 `multiSelect: true`**：选项之间不互斥时（如「想启用哪些功能」「采纳哪几条 review 建议」），必须开启多选，不要拆成多个是/否问题。

4. **推荐项放第一位并加「（推荐）」后缀**：当我有明确推荐时，第一个 option 的 label 末尾加「（推荐）」，让用户一眼看到默认建议。

5. **option 描述要解释 trade-off**：每个 option 的 `description` 字段必须说明「选这个会发生什么 / 适合什么场景 / 代价是什么」，而不是重复 label。

### 例外情况（仍用普通文本提问）

- **真·开放题**：如「请描述这个功能要解决什么用户痛点」「贴一下相关报错日志」，硬凑选项反而别扭
- **需要用户提供具体值**：如文件路径、URL、具体数字、自然语言描述
- **澄清歧义而非做决策**：如「你说的『重构』是指改文件结构还是改 API？」可文本，但若能列出 2-3 种常见解释也优先用 AskUserQuestion

### Plan 模式特例

在 plan 模式下，**禁止**用 `AskUserQuestion` 问「方案是否通过」「是否开始实施」类问题——必须用 `ExitPlanMode` 走计划审批通道。`AskUserQuestion` 在 plan 模式下仅用于**计划制定前**澄清需求或在多种实现路径间选择。

---

## superpowers checklist 强制 TodoWrite 规则

**适用范围**：所有 superpowers skill 中明确写有「checklist」「You MUST create a task for each」「step-by-step」的步骤列表。典型 skill：`brainstorming`（9 步）、`writing-plans`、`executing-plans`、`verification-before-completion`、`subagent-driven-development`。

### 强制规则

1. **进入 skill 立即建 TodoWrite**：识别到 skill 内部的 checklist/步骤列表，第一动作是 `TodoWrite`，每一项 checklist 对应一个 todo。**不允许心算走完**。
2. **逐项实时更新**：完成一项立即标记 `completed`，正在做的标记 `in_progress`，**不允许批量更新**（一次只能有 1 个 in_progress）。
3. **跳过项必须显式写明**：如果某 checklist 项在当前场景不适用，todo 仍要建，状态写 `cancelled` 并在 content 里标注原因，不能默默跳过。
4. **stale 主动清理**：skill 完成或场景切换后，旧 todo 列表立即清理或归档，避免下一次 skill 看到污染状态。

### 例外

- 单步任务（如「读这个文件」「跑一条命令」）不需要 todo
- 用户明确说「不用 todo」「直接做」时尊重用户

---

## 长任务强制后台化规则

**适用范围**：所有预计执行时间 **> 2 分钟** 的命令或子任务，包括但不限于：
- `npm test` / `npm run build` / `vitest run`（全量）
- `tsc -b` 大型项目
- 长时间 `git clone` / `npm install`
- 长循环脚本、爬虫、批量处理
- subagent 派发的复杂研究/实现任务

### 强制规则

1. **Bash 命令长跑必须 `run_in_background: true`**：禁止用默认 timeout 阻塞主线程等结果。例外：用户明确要求同步等待结果。
2. **后台任务用 `Monitor` 流式跟进**：派发后立即用 `Monitor` 工具盯输出（`Monitor` 是 deferred tool，先 `ToolSearch` 拿 schema）。每条 stdout 行作为 notification，不需要主动 sleep/poll。
3. **subagent 长任务也用 `run_in_background: true`**：`Agent` 工具支持后台模式，复杂调研类 agent 派发后让它跑，主线程继续做别的，完成时系统自动通知。
4. **禁止用 `sleep` 等长任务**：300s 以上 sleep 会击穿 prompt cache，禁止 `sleep 600` 然后查结果这种写法。要等就用 `Monitor` 或 `ScheduleWakeup(delaySeconds: 1200+)`。

### 决策树

```
任务预计耗时
  ├─ < 2 分钟 → 同步 Bash 直接跑
  ├─ 2-10 分钟 → run_in_background + Monitor
  ├─ 10-30 分钟 → run_in_background + ScheduleWakeup(1200s)
  └─ > 30 分钟 → run_in_background + PushNotification（如可用）+ ScheduleWakeup
```

### 反面模式

- ❌ 同步跑 `npm test` 把主线程卡 8 分钟
- ❌ 后台跑了任务，然后 `sleep 300 && check_result` 死等
- ❌ 派发 subagent 后干等空白屏幕，不告诉用户「已派发，预计 X 分钟」

---

## brainstorming 多方案并行生成规则

**适用范围**：`brainstorming` skill 第 4 步「Propose 2-3 approaches with trade-offs」、`writing-plans` 中需要对比多个实现路径的环节。

### 强制规则

1. **2-3 个候选方案必须并行生成**：不要串行思考方案 A、再思考 B、再思考 C。在同一条消息中并行派发 N 个 `subagent_type: "Plan"` agent，每个负责出一种独立方案。
2. **每个 Plan agent 的 prompt 必须互相独立**：明确告知每个 agent「你只负责方案 X（如：服务端渲染路径 / 客户端 SPA 路径 / 混合渲染路径）」，避免 agent 之间互相参考导致方案趋同。
3. **主线程负责对比汇总**：所有 Plan agent 返回后，主线程做横向对比表（维度：复杂度/性能/可维护性/工期/风险），并标注我的推荐项。
4. **最终通过 `AskUserQuestion` 让用户选**：把方案列为 options（每个方案一个 option），description 写 trade-off 摘要，第一个 option 标「（推荐）」。

### 何时适用

- 设计可走多条技术路径（前端选库、状态管理方案、数据库选型）
- 重构有多种切入角度（自顶向下 / 自底向上 / 中间层抽象）
- 性能优化有多套打法（缓存 / 索引 / 异步化）

### 何时不适用

- 方案明显只有一条合理路径（如 bug 修复通常只有一种正确改法）
- 用户已经指定了实现方向，只让你出细节

---

## 脚本语言优先级规则

**适用范围**：所有需要写脚本的场景 —— CLI 短期内联（`bash -c`、`python3 -c`、一次性命令）、落盘脚本（`/tmp/foo.py`、`scripts/foo.py`）、辅助工具、数据处理、文件转换、批量操作等。

### 强制规则

1. **默认 Node ESM JS**：CLI 短期内联脚本与落盘脚本一律优先用 Node ESM JS（`.mjs` 或 `"type":"module"` 的 `.js`）。理由：本机 Node 22+ 现代化、`node --experimental-strip-types`/`tsx` 也可直接跑 TS、生态成熟、依赖管理（npm）成熟。
2. **必要时工程化**：当脚本超过 ~150 行、涉及多个职责模块、需要外部依赖（zip/xml/sharp/playwright 等）、或可能被重复使用时，**必须**升级为 npm 工程（独立目录 + `package.json` + `src/` 模块拆分 + `.gitignore`）。不要把多模块塞进单文件。
3. **依赖优先 Node 生态**：需要 zip/xml/图像处理/PDF/爬虫/CLI parsing 时，优先找 npm 包（如 `yauzl`/`yazl`、`fast-xml-parser`、`sharp`、`pdf-lib`、`playwright`、`cheerio`、`commander`/`yargs`）。
4. **CLI 内联也用 node**：临时跑一段计算/验证逻辑，`node -e "..."` 或 `node --input-type=module -e "..."` 优于 `python3 -c "..."`。

### 例外情况（仅在以下情形可用 Python）

- **用户明确指定 Python**（包括"用 Python 写"、"用 pandas 做"等显式表达）
- **当前已在成熟 Python 项目中扩展功能**（cwd 含 `pyproject.toml`/`setup.py`/`requirements.txt` 且任务是扩展现有功能而非新建脚本）
- **任务强依赖 Python 生态**：PyTorch/TensorFlow/Pandas/NumPy/SciPy/Scrapy/Selenium with PyPI-only lib、AI/ML 模型推理、特定科学计算库（Node 无等价或差距大）

### 决策树

```
需要写脚本
  ├─ 用户点名 Python？ → 用 Python
  ├─ 当前在 Python 项目里扩展？ → 用 Python
  ├─ 强依赖 Python-only 生态？ → 用 Python（并向用户说明理由）
  └─ 以上都不是 → Node ESM JS
       ├─ 估算 < 150 行单职责？ → 单文件 .mjs 或 node -e
       └─ 多模块/重复使用/依赖多？ → npm 工程化（package.json + src/）
```

### Hook 自动执行

- **PreToolUse(Bash)** + **PreToolUse(Write|Edit|MultiEdit)**：`~/.claude/hooks/prefer-node-script.sh` 在检测到 `python`/`python3`/`pip` 命令调用、或写 `.py`/`.pyi`/`pyproject.toml`/`requirements.txt`/`setup.py`/`Pipfile`/`poetry.lock`/`environment.yml` 等文件时，注入 system-reminder。
- Hook 不阻断，只提醒。最终用 Python 还是 Node 由 AI 结合上下文判断；但只要触发了提醒，回复里**必须明确说明**为什么坚持 Python（命中哪条例外）或确认改用 Node。

### 反面模式

- ❌ `python3 -c "print(sum(range(100)))"` 这种一句话内联用 Python（用 `node -e "console.log([...Array(100).keys()].reduce((a,b)=>a+b,0))"`）
- ❌ 「我熟悉 Python 所以默认用 Python」（CLAUDE.md 是用户偏好，不是 AI 偏好）
- ❌ Node 项目里写 `.py` 辅助脚本（统一栈优先 .mjs）
- ❌ 单文件 Node 脚本写到 300+ 行还不拆模块（应该早些工程化）
