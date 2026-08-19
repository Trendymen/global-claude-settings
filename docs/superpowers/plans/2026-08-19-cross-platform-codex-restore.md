# 跨平台 Codex 恢复器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将仓库改为仅包含可在 macOS 与 Windows 恢复的 Codex 配置，并为可选 CreatorFramework 目标路径提供安全、可测试的迁移入口。

**Architecture:** 把参数解析、平台路径验证、模板渲染和恢复计划生成抽到无副作用的 `src/install-core.mjs`；`src/install.mjs` 仅调用该核心并执行文件计划。`codex/config.toml` 成为带 `{{CODEX_HOME}}` 的可移植模板，CreatorFramework 路径单独写入目标机的 `creatorframework.json`。

**Tech Stack:** Node.js ESM、Node 内置 `node:test`、`node:assert/strict`、`node:fs` / `node:path`。

**Spec:** `docs/superpowers/specs/2026-08-19-cross-platform-codex-restore-design.md`

## Global Constraints

- 仅支持 `darwin` 与 `win32`；其他平台在写入前以非零状态失败。
- 仓库删除全部 `claude/` 内容与 Claude 恢复/同步逻辑。
- 最终可恢复载荷、恢复器、package scripts、`.gitignore` 和迁移文档中不得出现 `claude` 或 `anthropic`。
- 可恢复 Codex 载荷仅为 `AGENTS.md`、`config.toml`、`agents/`、`hooks/`。
- 不备份或恢复 icons、机器特定打开软件、应用内置二进制、插件/marketplace/项目/信任/认证/运行时状态。
- `--creatorframework-path` 可选且只能用于 restore；与 `--pull-from-home` 互斥。
- 校验必须先于任意备份或写入；`--dry-run` 不得写入；`--no-overwrite` 跳过已有目标。
- 不提交、不推送；Git 提交由用户单独决定。
- 实施前记录当前脏工作区的 `git status --short` 与 scoped diff；保留既有改动，最终验证相对该基线核对，不将非空 status 当成失败或通过依据。

---

## 文件结构

- Create: `src/install-core.mjs` — 无副作用的参数、路径、模板与计划函数。
- Modify: `src/install.mjs` — 调用核心函数，执行或打印恢复/同步计划。
- Modify: `install.mjs`、`install.sh`、`install.ps1` — 保持仅转发新入口，删去 Claude 描述。
- Create: `test/install.test.mjs` — core 单元测试与临时目录恢复集成测试。
- Modify: `package.json` — 新增稳定的 `npm test` 并将其加入 `npm run check`。
- Modify: `codex/config.toml` — 改成可移植模板。
- Modify: `codex/AGENTS.md`、`codex/agents/reviewer.toml`、`codex/hooks/creatorframework-*.mjs`、`codex/hooks/zh-typo-guard.mjs` — 消除硬编码用户/项目路径与 Claude 逻辑。
- Create: `codex/hooks/creatorframework-rule-sync-reminder.mjs` — 在目标项目内调用规则同步脚本的跨平台 wrapper。
- Delete: `codex/icons/`、`claude/`。
- Modify: `.gitignore` — 删除 Claude 专用忽略规则。
- Modify: `README.md`、`docs/RESTORE.md` — 只记录 Codex 的 macOS/Windows 迁移。

### Task 1: 实现并测试无副作用的跨平台计划核心

**Files:**

- Create: `src/install-core.mjs`
- Create: `test/install.test.mjs`

**Interfaces:**

- Produces: `parseCliArgs(argv)`, `buildInstallIntent(options)`, `resolveFilePlan(intent, fileState)`、`renderCodexConfig(template, codexHome)`。
- `parseCliArgs(argv)` 返回 `{ mode: 'restore' | 'pull', dryRun: boolean, noOverwrite: boolean, creatorFrameworkPath?: string }`，或抛出带退出码 2 的 `CliUsageError`。
- `buildInstallIntent({ platform, homeDir, repoRoot, args })` 不访问文件系统，只返回经参数校验的操作意图；`resolveFilePlan(intent, fileState)` 根据注入的只读存在性快照生成实际 `write`、`skip` 与唯一 `backup` action。

- [ ] **Step 0: 记录脏工作区基线**

Run: `git status --short && git diff -- README.md docs/RESTORE.md src/install.mjs codex .gitignore package.json`

Expected: 记录当前已存在的同步改动；后续实施不得重置、checkout 或丢弃它们。若某个计划文件与基线改动重叠，先将其内容纳入新实现，而不是覆盖。

- [ ] **Step 1: 写出失败的参数和路径单元测试**

在 `test/install.test.mjs` 先添加以下覆盖：

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInstallIntent, parseCliArgs, renderCodexConfig } from '../src/install-core.mjs';

test('win32 含空格 home 渲染受引号保护的 hook 路径', () => {
  const args = parseCliArgs([]);
  const intent = buildInstallIntent({
    platform: 'win32', homeDir: 'C:/Users/Name With Space', repoRoot: '/repo', args,
  });
  assert.equal(intent.codexHome, 'C:/Users/Name With Space/.codex');
  const rendered = renderCodexConfig('command = \'node "{{CODEX_HOME}}/hooks/x.mjs"\'', intent.codexHome);
  assert.equal(rendered, 'command = \'node "C:/Users/Name With Space/.codex/hooks/x.mjs"\'');
});

test('拒绝 pull 与 CreatorFramework 路径同时使用且没有写入计划', () => {
  assert.throws(
    () => parseCliArgs(['--pull-from-home', '--creatorframework-path', 'D:/projects/CreatorFramework']),
    /不能与 --pull-from-home 同时使用/,
  );
});
```

补充盘符绝对路径、UNC、macOS POSIX 路径、相对路径、缺失参数、重复参数、未知参数与 `linux` 平台的断言。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/install.test.mjs`

Expected: FAIL，提示 `../src/install-core.mjs` 或所需导出不存在。

- [ ] **Step 3: 实现最小可测试核心**

在 `src/install-core.mjs` 实现：

```js
export class CliUsageError extends Error {
  constructor(message) { super(message); this.exitCode = 2; }
}

export function renderCodexConfig(template, codexHome) {
  return template.replaceAll('{{CODEX_HOME}}', codexHome.replaceAll('\\\\', '/'));
}

export function buildInstallIntent({ platform, homeDir, repoRoot, args }) {
  // 先校验 platform 与 args，再产生不依赖文件状态的操作意图。
}

export function resolveFilePlan(intent, fileState) {
  // 只读状态决定 restore 的备份/跳过与 pull 的覆盖/跳过，不写文件。
}
```

用 `path.win32` 判定/规范化 Windows 盘符与 UNC，用 `path.posix` 判定/规范化 macOS 路径。对不支持平台和非法参数抛出 `CliUsageError`；对合法的可选路径生成 `creatorframework.json` 意图。`resolveFilePlan` 为 restore 生成 `*.before-restore-<timestamp>-<sequence>`，为 pull 生成直接覆盖 action，`--no-overwrite` 则对两种模式生成 skip。

- [ ] **Step 4: 扩展断言并运行核心测试**

Run: `node --test test/install.test.mjs`

Expected: 纯函数测试 PASS；渲染后的 Windows/macOS config 对所有 hook command 均无未替换 token，Windows UNC 与含空格 home 保持完整引用。

### Task 2: 重写 CLI 执行层并验证文件安全性

**Files:**

- Modify: `src/install.mjs`
- Modify: `install.mjs`
- Modify: `install.sh`
- Modify: `install.ps1`
- Modify: `test/install.test.mjs`

**Interfaces:**

- Consumes: Task 1 的 `parseCliArgs`、`buildInstallIntent`、`resolveFilePlan` 和 `renderCodexConfig`。
- Produces: `runInstall({ platform, homeDir, repoRoot, argv, io, fs, now })`，供 CLI 与集成测试调用；`fs` 默认 `node:fs`，`now` 默认 `() => new Date()`。

- [ ] **Step 1: 写出失败的临时目录恢复测试**

在现有测试文件中用 `mkdtemp` 创建 repo/home fixture，验证：

```js
test('restore 先备份目录再恢复四项可移植载荷', async () => {
  // 预置 home/.codex/hooks/local-only.mjs，调用 runInstall。
  // 断言 hooks.before-restore-* 中保留 local-only.mjs，新 hooks 已复制。
});

test('省略路径参数时不触碰已有 creatorframework.json', async () => {
  // 预置 JSON，restore 后字节完全一致。
});
```

另外覆盖文件和目录两种 restore 备份、同名备份已存在时递增 sequence、`--dry-run` 无文件变化、restore/pull 两种 `--no-overwrite`、传入有效路径时创建 JSON、非法参数时 home 目录保持未写入。默认 pull 必须用 home 的 `AGENTS.md` 覆盖 repo 中预置旧内容，且 repo 中不生成 `*.before-restore-*`。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/install.test.mjs`

Expected: FAIL，因为 `runInstall` 尚未导出或仍在执行 Claude/全量 home 同步。

- [ ] **Step 3: 实现执行器与仅 Codex 的同步边界**

重写 `src/install.mjs`，严格按“零写入校验 → 零写入扫描 → 计划解析 → dry-run/执行”顺序：

```js
export function runInstall(context) {
  const args = parseCliArgs(context.argv);
  const intent = buildInstallIntent({ ...context, args });
  const fileState = collectFileState({ fs: context.fs, intent, now: context.now() });
  const plan = resolveFilePlan(intent, fileState);
  if (args.dryRun) return printPlan(plan, context.io);
  return executePlan(plan, context.fs);
}
```

`collectFileState` 只调用 `existsSync`/`statSync`，并用注入的固定 `now` 枚举候选备份名直到不存在；不得创建目录、备份或写文件。`executePlan` 对 restore 的四个条目执行“存在则移动到唯一备份名、再复制”；对 `pull` 只复制 `AGENTS.md`、`agents/`、`hooks/` 并直接覆盖 repo 目标、不建立 repo 备份。集成测试传入固定 `now: () => new Date('2026-08-19T00:00:00.000Z')`，断言同名备份从 `-1` 递增。移除 `configs` 中 Claude 条目、`pullClaudeMcp`、`restoreClaudeMcp`、旧 home 字符串替换逻辑和 Windows 特殊提示。wrapper 只转发 Node 入口，文本改为 Codex。

- [ ] **Step 4: 运行完整安装器测试与 CLI 冒烟检查**

Run: `npm test && node install.mjs --dry-run && node install.mjs --help`

Expected: 测试全部 PASS；dry-run 只列出 Codex 四项；help 列出可选路径、pull、dry-run、no-overwrite。

### Task 3: 创建可移植 Codex 载荷并保留 CreatorFramework 语义

**Files:**

- Modify: `codex/config.toml`
- Modify: `codex/AGENTS.md`
- Modify: `codex/agents/reviewer.toml`
- Modify: `codex/hooks/creatorframework-agents-reminder.mjs`
- Modify: `codex/hooks/creatorframework-tscheck-reminder.mjs`
- Create: `codex/hooks/creatorframework-rule-sync-reminder.mjs`
- Modify: `codex/hooks/zh-typo-guard.mjs`
- Delete: `codex/icons/trae-cn.png`
- Delete: `codex/icons/vscodium.png`
- Delete: `claude/`
- Modify: `.gitignore`
- Modify: `test/install.test.mjs`

**Interfaces:**

- Consumes: Task 1 模板渲染和 Task 2 写入的 `~/.codex/creatorframework.json`。
- Produces: 所有 Codex hook 在 Windows/macOS 都用 `node "{{CODEX_HOME}}/..."` 调用；两个既有 hook 与新增 rule-sync wrapper 都从 JSON 读取 root。

- [ ] **Step 1: 添加失败的 hook 与载荷扫描测试**

测试两个既有 CreatorFramework hook：配置文件缺失时标准输出为空；注入带项目 root 的临时 `creatorframework.json` 且 cwd 命中时分别包含现有 AGENTS/tscheck 提醒。为 rule-sync wrapper 创建临时 root 下的假 `agent-tools/hooks/check-rule-sync.js`，断言 root 未命中时不 spawn，命中时完整透传 stdin、stdout 与非零 exit status。再对 `codex/config.toml` 断言：

```js
assert.doesNotMatch(config, /\/Applications|computer-use|custom_file_handlers|open-in-target-preferences|icons\//i);
assert.match(config, /command = 'node "\{\{CODEX_HOME\}\}\/hooks\//);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`

Expected: FAIL，因为现有 hooks 仍硬编码 macOS CreatorFramework root、无 rule-sync wrapper，现有 config 仍含机器绑定表。

- [ ] **Step 3: 精简配置并改造 hooks**

把 `config.toml` 重写为仅包含 Spec 允许表；移除所有被排除的表与运行时路径。所有 hook command 采用 literal string `command = 'node "{{CODEX_HOME}}/hooks/<file>.mjs"'`。

为两个既有 hook 与 rule-sync wrapper 抽出共享的 `loadCreatorFrameworkRoot({ homeDir })`：读取 `<homeDir>/.codex/creatorframework.json`，解析 `root` 字符串，失败返回空字符串。wrapper 在命中时运行 `<root>/agent-tools/hooks/check-rule-sync.js --platform=codex` 并透传输入/输出/状态；未命中时 no-op。将 reviewer 的绝对契约路径替换为 `~/.agents/skills/requesting-code-review/references/reviewer-contract.md`，移除 `zh-typo-guard` 的 `.claude` fallback，删除 `AGENTS.md` 中的 Claude 对齐/镜像规则、`.gitignore` 中 Claude 专用规则、`codex/icons/` 和整个 `claude/`。

- [ ] **Step 4: 运行载荷与 hook 回归验证**

Run: `npm test && rg -n -i 'claude|anthropic|computer-use|vscodium|trae|icons/|/Applications|custom_file_handlers|open-in-target-preferences' codex README.md docs/RESTORE.md src install.mjs install.sh install.ps1 package.json .gitignore`

Expected: 测试 PASS；搜索对最终载荷/迁移文档无命中（Spec 与 test 目录不在此扫描范围）。

### Task 4: 完成 Windows/macOS 迁移文档和包入口

**Files:**

- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/RESTORE.md`
- Modify: `test/install.test.mjs`

**Interfaces:**

- Consumes: Task 2 的 CLI 参数和 Task 3 的可移植载荷。
- Produces: 可在 PowerShell 和 macOS shell 直接执行的迁移说明及稳定测试命令。

- [ ] **Step 1: 添加 package script 断言**

在 `test/install.test.mjs` 读取 `package.json` 并断言：

```js
assert.equal(pkg.scripts.test, 'node --test test/install.test.mjs');
assert.match(pkg.scripts.check, /node --check/);
assert.match(pkg.scripts.check, /npm test/);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`

Expected: FAIL，因为 package scripts 尚未定义规定的测试入口。

- [ ] **Step 3: 修改 package 与文档**

将 `package.json` 改为：

```json
"scripts": {
  "restore": "node install.mjs",
  "pull": "node install.mjs --pull-from-home",
  "test": "node --test test/install.test.mjs",
  "check": "node --check install.mjs && node --check src/install.mjs && node --check src/install-core.mjs && npm test"
}
```

重写 README 和 RESTORE：只描述 Codex；给出 Windows PowerShell 的安装前置条件、克隆、可选路径与省略路径命令、独立登录/重启、`codex --version`/`codex mcp list`/`npm run check` 验证；给出 macOS 等价命令。不要在最终文档中写入被排除的本机集成名称。

- [ ] **Step 4: 运行最终静态与测试验证**

Run: `npm run check && git diff --check && git status --short`

Expected: 检查和测试全部通过；diff 无空白错误；相对 Task 1 基线仅出现本计划定义的 Codex 恢复器、可移植载荷、测试、文档、根配置和 Claude 删除改动。

- [ ] **Step 5: 记录 Windows 运行时验收仍待完成**

在最终交付中单列 `Pending`：必须在真实 Windows 上恢复、独立登录/重启 Codex、运行 `codex mcp list`，并在配置了目标路径的 CreatorFramework 工作区触发三个专属 hook。不得以 `npm run check` 或模拟 win32 结果替代该运行时验收。
