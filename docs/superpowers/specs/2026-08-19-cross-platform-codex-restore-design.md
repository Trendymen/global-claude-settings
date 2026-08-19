# 跨平台 Codex 恢复设计

## 目标与范围

将仓库改为只保存和恢复 Codex 的跨平台配置，支持 macOS（`darwin`）与 Windows（`win32`）。现有 `claude/` 目录、Claude MCP 提取/合并逻辑、Claude 文档和 Claude 恢复行为全部删除；仓库名称保持不变，不影响 Git remote。

可恢复的 Codex 载荷、`codex/` 配置和最终迁移文档不得包含被排除的本机集成；Spec 与测试可为定义和断言边界而提及它们。

保留两个既有 CreatorFramework 专属 hook（AGENTS 提醒、tscheck），并新增规则同步 wrapper 以保留现有规则同步语义；迁移目标项目根目录由可选参数 `--creatorframework-path <绝对路径>` 提供。

## 配置边界

受版本控制并恢复到 `~/.codex/` 的内容：

- `AGENTS.md`；
- 精简后的可移植 `config.toml`；
- `agents/`；
- `hooks/`。

不再备份或恢复：

- Claude 的全部文件；
- `icons/`；
- Computer Use、Node REPL、`notify` 与任何 `/Applications/...` 集成；
- 自定义文件处理器和按路径“打开软件”偏好；
- `projects`、`hooks.state`、marketplace 本地 source/revision、插件启用状态和缓存路径；
- Codex 认证、sessions、worktrees、数据库和其他运行时状态；
- 迁移机的 CreatorFramework 路径文件。

`config.toml` 仅保留跨平台模型、权限、通用 feature、通用 hook、浏览器 MCP 和无路径的桌面偏好。所有全局 hook 命令采用 TOML literal string：

```toml
command = 'node "{{CODEX_HOME}}/hooks/session-zh-reminder.mjs"'
```

恢复器把 `{{CODEX_HOME}}` 替换为目标 home 下的 `.codex` 绝对路径，并统一使用正斜杠。因此即使 Windows 用户目录含空格，Node 脚本路径仍作为一个受引号保护的参数传递。

## CreatorFramework 路径配置

恢复器仅在传入 `--creatorframework-path` 时写入 `~/.codex/creatorframework.json`：

```json
{ "root": "D:\\projects\\CreatorFramework" }
```

该参数使用目标平台路径语义：macOS 仅接受以 `/` 开头的绝对路径；Windows 接受盘符绝对路径（如 `D:\\projects\\CreatorFramework` 或 `D:/projects/CreatorFramework`）及 UNC 路径。写入时以目标平台的原生分隔符规范化；路径不要求已存在，允许先恢复、后克隆项目。未传参数时不创建、不删除也不覆盖已有文件。

`creatorframework-agents-reminder.mjs` 与 `creatorframework-tscheck-reminder.mjs` 读取该文件；配置缺失、JSON 不合法或当前目录不在该 root 内时静默退出。路径存在时，它们维持现有的规则提醒和 TypeScript 检查提醒语义。

新增 `creatorframework-rule-sync-reminder.mjs` 作为包内 wrapper：它使用同一 JSON 判断当前 hook 输入是否属于该项目；未命中时静默退出，命中时用已配置 root 调用 `agent-tools/hooks/check-rule-sync.js --platform=codex`，并透传原始标准输入、标准输出和退出状态。`config.toml` 以该 wrapper 取代原有硬编码项目路径的 PostToolUse 命令，保留原 matcher 和规则同步提醒语义。

`reviewer.toml` 中的审查契约路径改为 `~/.agents/...`，避免固化某一用户目录。

## 恢复器

保留 Node ESM 入口 `install.mjs` / `src/install.mjs` 和 PowerShell wrapper，但重写其实现为仅处理 Codex。

| 调用 | 行为 |
| --- | --- |
| `node install.mjs` | 恢复四项可移植 Codex 内容。 |
| `node install.mjs --creatorframework-path <path>` | 恢复四项内容，并创建或更新本机 CreatorFramework 路径文件。 |
| `node install.mjs --no-overwrite` | 已有文件或目录均跳过；若已存在 `creatorframework.json`，同样跳过并记录。 |
| `node install.mjs --dry-run [...]` | 完成全部校验并打印计划，不写入、不备份。 |
| `node install.mjs --pull-from-home` | 仅同步 `AGENTS.md`、`agents/` 与 `hooks/`；默认直接覆盖仓库中的同名可移植条目且不产生仓库备份，`--no-overwrite` 时跳过已有条目；不复制主机 `config.toml`、图标、运行时状态或 CreatorFramework 路径文件。 |

`--creatorframework-path` 与 `--pull-from-home` 互斥。缺失参数值、空值、相对/非法路径、重复路径参数、未知参数、非 `darwin`/`win32` 平台都返回非零状态。所有参数和平台校验必须在任何备份或写入前完成；失败时零写入。仅 restore 模式的已有内容默认先移动到唯一的 `*.before-restore-<时间戳>-<序号>` 备份，再写入新内容；pull 使用调用表定义的直接覆盖语义。

恢复器以 `os.homedir()` 确定 home，并将 `{{CODEX_HOME}}` 规范化替换为目标平台的 `~/.codex` 路径。它不复制或要求 macOS 专属应用。

## 可测试的跨平台实现边界

实现拆分为两阶段：不写文件的纯函数接收 `{ platform, homeDir, args }`，完成参数校验并返回操作意图、目标路径和模板替换结果；执行层通过可注入的只读文件状态将意图解析为实际 write/skip/backup 计划，再执行写入。CLI 仅负责用 `process.platform` 与 `os.homedir()` 调用这两阶段。

实现新增 `test/install.test.mjs`，仅使用 Node 内置 `node:test`；`package.json` 新增 `npm test`，固定执行 `node --test test/install.test.mjs`，并让 `npm run check` 先做语法检查再执行该测试。单元测试直接调用纯函数，而不通过修改宿主环境来模拟平台：

- `{ platform: 'win32', homeDir: 'C:/Users/Name With Space' }` 必须产生 `C:/Users/Name With Space/.codex` 和完整受引号保护的 hook command；
- `{ platform: 'darwin', homeDir: '/Users/name' }` 必须产生 `/Users/name/.codex`；
- Windows 盘符、UNC、macOS POSIX 路径分别接受；在错误平台或错误格式下拒绝；
- 参数矩阵中的每个错误组合断言没有执行写入计划；预置同名备份时生成 `-<序号>` 后缀。

文件系统集成测试使用临时目录，验证文件与目录备份、同名备份递增、restore/pull 两种模式的 `--no-overwrite`、`--dry-run`、可选路径文件创建及省略路径时保持不变。默认 pull 测试预置仓库的旧 `AGENTS.md`，断言它被 home 源覆盖，且仓库内没有新增 `*.before-restore-*`。

规则同步 wrapper 导出可注入的执行函数供同一测试文件调用。测试以临时 CreatorFramework root 创建假的 `agent-tools/hooks/check-rule-sync.js`：未命中 root 时断言无输出且不启动子进程；命中时断言原始 stdin 被完整传入、stdout 原样转发，并保留子进程非零退出状态。

## Windows 迁移文档

文档提供充分、可执行的 Windows 流程：安装 Node LTS、Git 与 Codex，克隆仓库，选择性准备或克隆 CreatorFramework，执行下列命令，然后独立登录并重启 Codex：

```powershell
node install.mjs --creatorframework-path 'D:\projects\CreatorFramework'
```

macOS 使用相同 Node 命令与 POSIX 路径。

文档明确：省略路径参数不会启用 CreatorFramework 专属提醒；后续可重复运行同一命令写入或更新该路径。文档不描述被排除的本机集成。

## 验收标准

1. 可恢复载荷中没有 `claude/`、`codex/icons/`、Claude 恢复逻辑或被排除的本机软件/状态引用；该检查只扫描 `codex/`、恢复器、package scripts、`.gitignore` 与最终迁移文档，不扫描 Spec 或测试。扫描 `claude|anthropic` 时允许例外为零。
2. `config.toml` 不含被排除的路径/表，所有 hook command 通过 Node 和受引号保护的 `{{CODEX_HOME}}` 运行。
3. `npm test` 执行 `test/install.test.mjs`，覆盖纯函数的 Windows（含空格 home、盘符和 UNC）、macOS、错误平台和全部参数错误组合。
4. 同一测试文件的集成测试证明恢复、目录备份、`--dry-run`、`--no-overwrite`、默认 pull 覆盖且无仓库备份、路径文件写入/省略语义；并覆盖规则同步 wrapper 的 no-op、stdin/stdout/exit status 透传；`npm run check` 必须通过。
5. 未配置路径时三个 CreatorFramework hook 无输出；配置路径并命中项目时保持原有 AGENTS、tscheck 和规则同步行为。
6. Windows 实机验收单列：在 Windows 上恢复后启动 Codex、独立登录并验证 hook/MCP；在完成前不得将静态或模拟测试称为 Windows 运行时完成。
