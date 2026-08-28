import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CliUsageError,
  buildInstallIntent,
  parseCliArgs,
  renderCodexConfig,
  resolveFilePlan,
} from '../src/install-core.mjs';
import { executePlan, runCli, runInstall } from '../src/install.mjs';
import { isInsideCreatorFramework } from '../codex/hooks/creatorframework-root.mjs';

const FIXED_NOW = () => new Date('2026-08-19T00:00:00.000Z');
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');

function writeCreatorFrameworkConfig(homeDir, root) {
  const configPath = path.join(homeDir, '.codex', 'creatorframework.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ root }));
}

function runHook(scriptName, { homeDir, cwd, input, env = {} }) {
  return spawnSync(process.execPath, [path.join(REPO_ROOT, 'codex', 'hooks', scriptName)], {
    cwd,
    encoding: 'utf8',
    input,
    env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir, ...env },
  });
}

function makeIo() {
  const lines = [];
  const errors = [];
  return {
    lines,
    errors,
    log: (line) => lines.push(line),
    error: (line) => errors.push(line),
  };
}

function writePortablePayload(repoRoot) {
  const codexRoot = path.join(repoRoot, 'codex');
  fs.mkdirSync(path.join(codexRoot, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(codexRoot, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(codexRoot, 'AGENTS.md'), 'repo agents\n');
  fs.writeFileSync(path.join(codexRoot, 'config.toml'), 'command = \'node "{{CODEX_HOME}}/hooks/a.mjs"\'\n');
  fs.writeFileSync(path.join(codexRoot, 'agents', 'reviewer.toml'), 'reviewer\n');
  fs.writeFileSync(path.join(codexRoot, 'hooks', 'a.mjs'), 'export {};\n');
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-install-'));
  const repoRoot = path.join(root, 'repo');
  const homeDir = path.join(root, 'home');
  writePortablePayload(repoRoot);
  return { root, repoRoot, homeDir, codexHome: path.join(homeDir, '.codex') };
}

function withFixture(callback) {
  const fixture = makeFixture();
  try {
    return callback(fixture);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function install(context, argv = []) {
  return runInstall({
    platform: 'darwin',
    argv,
    io: makeIo(),
    fs,
    now: FIXED_NOW,
    ...context,
  });
}

test('包脚本提供稳定的检查与测试入口', () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));

  assert.equal(pkg.scripts.test, 'node --test test/install.test.mjs codex/hooks/creatorframework-agents-reminder.test.mjs');
  assert.match(pkg.scripts.check, /node --check/);
  assert.match(pkg.scripts.check, /npm test/);
  assert.match(pkg.scripts.check, /verify-restore\.mjs/);
});

test('win32 含空格 home 渲染受引号保护的 hook 路径', () => {
  const args = parseCliArgs([]);
  const intent = buildInstallIntent({
    platform: 'win32',
    homeDir: 'C:/Users/Name With Space',
    repoRoot: '/repo',
    args,
  });

  assert.equal(intent.codexHome, 'C:/Users/Name With Space/.codex');
  const rendered = renderCodexConfig(
    'command = \'node "{{CODEX_HOME}}/hooks/x.mjs"\'',
    intent.codexHome,
  );
  assert.equal(
    rendered,
    'command = \'node "C:/Users/Name With Space/.codex/hooks/x.mjs"\'',
  );
});

test('拒绝 pull 与 CreatorFramework 路径同时使用且没有写入计划', () => {
  assert.throws(
    () => parseCliArgs(['--pull-from-home', '--creatorframework-path', 'D:/projects/CreatorFramework']),
    /不能与 --pull-from-home 同时使用/,
  );
});

test('接受并按目标平台规范化 CreatorFramework 绝对路径', () => {
  const windowsDrive = buildInstallIntent({
    platform: 'win32',
    homeDir: 'C:\\Users\\Name',
    repoRoot: '/repo',
    args: parseCliArgs(['--creatorframework-path', 'D:/projects/./CreatorFramework']),
  });
  assert.equal(windowsDrive.creatorFrameworkRoot, 'D:\\projects\\CreatorFramework');
  assert.equal(windowsDrive.creatorFrameworkPath, 'C:/Users/Name/.codex/creatorframework.json');

  const windowsUnc = buildInstallIntent({
    platform: 'win32',
    homeDir: 'C:/Users/Name',
    repoRoot: '/repo',
    args: parseCliArgs(['--creatorframework-path', '\\\\server\\share\\work\\..\\CreatorFramework']),
  });
  assert.equal(windowsUnc.creatorFrameworkRoot, '\\\\server\\share\\CreatorFramework');

  const macos = buildInstallIntent({
    platform: 'darwin',
    homeDir: '/Users/name',
    repoRoot: '/repo',
    args: parseCliArgs(['--creatorframework-path', '/Users/name/work/../CreatorFramework']),
  });
  assert.equal(macos.codexHome, '/Users/name/.codex');
  assert.equal(macos.creatorFrameworkRoot, '/Users/name/CreatorFramework');
});

test('在目标平台拒绝相对或错误形式的 CreatorFramework 路径', () => {
  for (const [platform, creatorFrameworkPath] of [
    ['win32', 'D:relative'],
    ['win32', 'projects/CreatorFramework'],
    ['darwin', 'Users/name/CreatorFramework'],
    ['darwin', 'C:/projects/CreatorFramework'],
  ]) {
    assert.throws(
      () => buildInstallIntent({
        platform,
        homeDir: platform === 'win32' ? 'C:/Users/name' : '/Users/name',
        repoRoot: '/repo',
        args: parseCliArgs(['--creatorframework-path', creatorFrameworkPath]),
      }),
      (error) => error instanceof CliUsageError && /绝对路径/.test(error.message),
    );
  }
});

test('拒绝所有错误 CLI 参数组合并标记为 usage error', () => {
  const cases = [
    [[], ''],
    [['--unknown'], '未知参数'],
    [['--creatorframework-path'], '缺少参数值'],
    [['--creatorframework-path', ''], '不能为空'],
    [['--creatorframework-path', 'D:/one', '--creatorframework-path', 'D:/two'], '重复'],
    [['--pull-from-home', '--pull-from-home'], '重复'],
    [['--dry-run', '--dry-run'], '重复'],
    [['--no-overwrite', '--no-overwrite'], '重复'],
  ];

  for (const [argv, expectedMessage] of cases) {
    if (argv.length === 0) continue;
    assert.throws(
      () => parseCliArgs(argv),
      (error) => error instanceof CliUsageError
        && error.exitCode === 2
        && error.message.includes(expectedMessage),
      argv.join(' '),
    );
  }
});

test('非字符串 CreatorFramework 参数值一律返回 usage error', () => {
  for (const value of [null, 42, {}, false]) {
    assert.throws(
      () => parseCliArgs(['--creatorframework-path', value]),
      (error) => error instanceof CliUsageError && error.exitCode === 2,
      `value: ${String(value)}`,
    );
  }
});

test('buildInstallIntent 拒绝不完整或非法的 args 形状', () => {
  const invalidArgs = [
    undefined,
    null,
    {},
    { mode: 'invalid', dryRun: false, noOverwrite: false },
    { mode: 'restore', dryRun: 'false', noOverwrite: false },
    { mode: 'restore', dryRun: false, noOverwrite: 0 },
    { mode: 'restore', dryRun: false, noOverwrite: false, creatorFrameworkPath: '' },
    { mode: 'restore', dryRun: false, noOverwrite: false, creatorFrameworkPath: null },
    {
      mode: 'pull',
      dryRun: false,
      noOverwrite: false,
      creatorFrameworkPath: 'D:/projects/CreatorFramework',
    },
  ];

  for (const args of invalidArgs) {
    assert.throws(
      () => buildInstallIntent({
        platform: 'win32',
        homeDir: 'C:/Users/name',
        repoRoot: '/repo',
        args,
      }),
      (error) => error instanceof CliUsageError && error.exitCode === 2,
    );
  }
});

test('拒绝 linux 平台且不产生意图或写入计划', () => {
  assert.throws(
    () => buildInstallIntent({
      platform: 'linux',
      homeDir: '/home/name',
      repoRoot: '/repo',
      args: parseCliArgs([]),
    }),
    (error) => error instanceof CliUsageError
      && error.exitCode === 2
      && /仅支持 darwin 与 win32/.test(error.message),
  );
});

test('restore 为已有目标产生唯一备份后写入', () => {
  const intent = buildInstallIntent({
    platform: 'darwin',
    homeDir: '/Users/name',
    repoRoot: '/repo',
    args: parseCliArgs(['--creatorframework-path', '/projects/CreatorFramework']),
  });
  const hooks = '/Users/name/.codex/hooks';
  const firstBackup = `${hooks}.before-restore-20260819000000000-1`;
  const plan = resolveFilePlan(intent, {
    timestamp: '20260819000000000',
    paths: {
      [hooks]: true,
      [firstBackup]: true,
    },
  });

  const hooksBackup = plan.find((action) => action.type === 'backup' && action.from === hooks);
  assert.deepEqual(hooksBackup, {
    type: 'backup',
    from: hooks,
    to: `${hooks}.before-restore-20260819000000000-2`,
  });
  assert.ok(plan.some((action) => action.type === 'write' && action.target === hooks));
  assert.deepEqual(
    plan.find((action) => action.target === '/Users/name/.codex/config.toml'),
    {
      type: 'write',
      source: '/repo/codex/config.toml',
      target: '/Users/name/.codex/config.toml',
      transform: 'render-codex-config',
    },
  );
  assert.ok(plan.some((action) => action.type === 'write'
    && action.target === '/Users/name/.codex/creatorframework.json'
    && action.content === '{\n  "root": "/projects/CreatorFramework"\n}\n'));
});

test('pull 默认直接覆盖且 --no-overwrite 对两种模式都生成 skip', () => {
  const pullIntent = buildInstallIntent({
    platform: 'darwin',
    homeDir: '/Users/name',
    repoRoot: '/repo',
    args: parseCliArgs(['--pull-from-home']),
  });
  const pullPlan = resolveFilePlan(pullIntent, {
    timestamp: '20260819000000000',
    paths: { '/repo/codex/AGENTS.md': true },
  });
  assert.ok(pullPlan.some((action) => action.type === 'write'
    && action.source === '/Users/name/.codex/AGENTS.md'
    && action.target === '/repo/codex/AGENTS.md'));
  assert.equal(pullPlan.some((action) => action.type === 'backup'), false);

  const restoreNoOverwrite = buildInstallIntent({
    platform: 'darwin',
    homeDir: '/Users/name',
    repoRoot: '/repo',
    args: parseCliArgs(['--no-overwrite']),
  });
  const restorePlan = resolveFilePlan(restoreNoOverwrite, {
    timestamp: '20260819000000000',
    paths: { '/Users/name/.codex/AGENTS.md': true },
  });
  assert.deepEqual(restorePlan.find((action) => action.target === '/Users/name/.codex/AGENTS.md'), {
    type: 'skip',
    reason: 'target-exists',
    source: '/repo/codex/AGENTS.md',
    target: '/Users/name/.codex/AGENTS.md',
  });

  const pullNoOverwrite = buildInstallIntent({
    platform: 'darwin',
    homeDir: '/Users/name',
    repoRoot: '/repo',
    args: parseCliArgs(['--pull-from-home', '--no-overwrite']),
  });
  const pullNoOverwritePlan = resolveFilePlan(pullNoOverwrite, {
    timestamp: '20260819000000000',
    paths: { '/repo/codex/hooks': true },
  });
  assert.equal(
    pullNoOverwritePlan.find((action) => action.target === '/repo/codex/hooks').type,
    'skip',
  );
});

test('渲染替换所有 token 并将反斜杠统一为正斜杠', () => {
  const rendered = renderCodexConfig(
    'a = "{{CODEX_HOME}}/hooks/a.mjs"\nb = "{{CODEX_HOME}}/hooks/b.mjs"',
    'C:\\Users\\Name With Space\\.codex',
  );
  assert.equal(rendered.includes('{{CODEX_HOME}}'), false);
  assert.match(rendered, /C:\/Users\/Name With Space\/.codex\/hooks\/a\.mjs/);
  assert.match(rendered, /C:\/Users\/Name With Space\/.codex\/hooks\/b\.mjs/);
});

test('restore 先备份目录再恢复四项可移植载荷', () => withFixture(({ repoRoot, homeDir, codexHome }) => {
  fs.mkdirSync(path.join(codexHome, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(codexHome, 'hooks', 'local-only.mjs'), 'local\n');

  install({ repoRoot, homeDir });

  const backup = `${path.join(codexHome, 'hooks')}.before-restore-20260819000000000-1`;
  assert.equal(fs.readFileSync(path.join(backup, 'local-only.mjs'), 'utf8'), 'local\n');
  assert.equal(fs.readFileSync(path.join(codexHome, 'hooks', 'a.mjs'), 'utf8'), 'export {};\n');
  assert.deepEqual(
    fs.readdirSync(codexHome).filter((name) => !name.includes('.before-restore-')).sort(),
    ['AGENTS.md', 'agents', 'config.toml', 'hooks'],
  );
}));

test('restore 备份已有文件且同名备份按 sequence 递增', () => withFixture(({ repoRoot, homeDir, codexHome }) => {
  fs.mkdirSync(codexHome, { recursive: true });
  const target = path.join(codexHome, 'AGENTS.md');
  const firstBackup = `${target}.before-restore-20260819000000000-1`;
  fs.writeFileSync(target, 'local agents\n');
  fs.writeFileSync(firstBackup, 'previous backup\n');

  install({ repoRoot, homeDir });

  assert.equal(fs.readFileSync(`${target}.before-restore-20260819000000000-2`, 'utf8'), 'local agents\n');
  assert.equal(fs.readFileSync(firstBackup, 'utf8'), 'previous backup\n');
  assert.equal(fs.readFileSync(target, 'utf8'), 'repo agents\n');
}));

test('省略路径参数时不触碰已有 creatorframework.json', () => withFixture(({ repoRoot, homeDir, codexHome }) => {
  fs.mkdirSync(codexHome, { recursive: true });
  const existing = '{"root":"/keep/me","extra":true}\n';
  fs.writeFileSync(path.join(codexHome, 'creatorframework.json'), existing);

  install({ repoRoot, homeDir });

  assert.equal(fs.readFileSync(path.join(codexHome, 'creatorframework.json'), 'utf8'), existing);
}));

test('传入有效路径时创建 CreatorFramework 路径文件', () => withFixture(({ repoRoot, homeDir, codexHome }) => {
  install({ repoRoot, homeDir }, ['--creatorframework-path', '/projects/CreatorFramework']);

  assert.equal(
    fs.readFileSync(path.join(codexHome, 'creatorframework.json'), 'utf8'),
    '{\n  "root": "/projects/CreatorFramework"\n}\n',
  );
}));

test('dry-run 不产生文件变化', () => withFixture(({ repoRoot, homeDir, root }) => {
  const io = makeIo();
  const result = runInstall({
    platform: 'darwin',
    homeDir,
    repoRoot,
    argv: ['--dry-run'],
    io,
    fs,
    now: FIXED_NOW,
  });

  assert.equal(fs.existsSync(homeDir), false);
  assert.equal(result.some((action) => action.type === 'write'), true);
  assert.equal(io.lines.length > 0, true);
  assert.equal(fs.readdirSync(root).includes('home'), false);
}));

test('restore 与 pull 的 no-overwrite 都保留已有目标', () => withFixture(({ repoRoot, homeDir, codexHome }) => {
  fs.mkdirSync(codexHome, { recursive: true });
  fs.writeFileSync(path.join(codexHome, 'AGENTS.md'), 'local agents\n');
  install({ repoRoot, homeDir }, ['--no-overwrite']);
  assert.equal(fs.readFileSync(path.join(codexHome, 'AGENTS.md'), 'utf8'), 'local agents\n');
  assert.equal(fs.existsSync(`${path.join(codexHome, 'AGENTS.md')}.before-restore-20260819000000000-1`), false);

  fs.writeFileSync(path.join(codexHome, 'AGENTS.md'), 'home agents\n');
  fs.writeFileSync(path.join(repoRoot, 'codex', 'AGENTS.md'), 'repo old agents\n');
  install({ repoRoot, homeDir }, ['--pull-from-home', '--no-overwrite']);
  assert.equal(fs.readFileSync(path.join(repoRoot, 'codex', 'AGENTS.md'), 'utf8'), 'repo old agents\n');
}));

test('默认 pull 直接覆盖仓库可移植项且不建立仓库备份', () => withFixture(({ repoRoot, homeDir, codexHome }) => {
  fs.mkdirSync(path.join(codexHome, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(codexHome, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(codexHome, 'AGENTS.md'), 'home agents\n');
  fs.writeFileSync(path.join(codexHome, 'agents', 'home.toml'), 'home reviewer\n');
  fs.writeFileSync(path.join(codexHome, 'hooks', 'home.mjs'), 'export const home = true;\n');
  fs.writeFileSync(path.join(repoRoot, 'codex', 'AGENTS.md'), 'repo old agents\n');

  install({ repoRoot, homeDir }, ['--pull-from-home']);

  assert.equal(fs.readFileSync(path.join(repoRoot, 'codex', 'AGENTS.md'), 'utf8'), 'home agents\n');
  assert.equal(fs.readFileSync(path.join(repoRoot, 'codex', 'agents', 'home.toml'), 'utf8'), 'home reviewer\n');
  assert.equal(fs.readFileSync(path.join(repoRoot, 'codex', 'hooks', 'home.mjs'), 'utf8'), 'export const home = true;\n');
  assert.equal(fs.readdirSync(path.join(repoRoot, 'codex')).some((name) => name.includes('.before-restore-')), false);
}));

test('非法参数在扫描和执行前保持 home 目录未写入', () => withFixture(({ repoRoot, homeDir }) => {
  assert.throws(
    () => install({ repoRoot, homeDir }, ['--creatorframework-path', 'relative/path']),
    (error) => error instanceof CliUsageError && error.exitCode === 2,
  );
  assert.equal(fs.existsSync(homeDir), false);
}));

test('空 repo restore 会跳过缺失源且不移动已有 home 目标', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-install-empty-repo-'));
  try {
    const repoRoot = path.join(root, 'repo');
    const homeDir = path.join(root, 'home');
    const target = path.join(homeDir, '.codex', 'AGENTS.md');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'local agents\n');

    const plan = install({ repoRoot, homeDir });

    assert.deepEqual(plan.map((action) => action.type), ['skip', 'skip', 'skip', 'skip']);
    assert.equal(fs.readFileSync(target, 'utf8'), 'local agents\n');
    assert.equal(fs.existsSync(`${target}.before-restore-20260819000000000-1`), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('空 home pull 不创建 repo/codex', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-install-empty-home-'));
  try {
    const repoRoot = path.join(root, 'repo');
    const homeDir = path.join(root, 'home');

    const plan = install({ repoRoot, homeDir }, ['--pull-from-home']);

    assert.deepEqual(plan.map((action) => action.type), ['skip', 'skip', 'skip']);
    assert.equal(fs.existsSync(path.join(repoRoot, 'codex')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('源在执行前消失时不会移动现有 restore 目标', () => withFixture(({ root }) => {
  const target = path.join(root, 'home', '.codex', 'AGENTS.md');
  const source = path.join(root, 'missing-source');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, 'local agents\n');

  executePlan([
    { type: 'backup', from: target, to: `${target}.before-restore-1-1` },
    { type: 'write', source, target },
  ], fs, makeIo());

  assert.equal(fs.readFileSync(target, 'utf8'), 'local agents\n');
  assert.equal(fs.existsSync(`${target}.before-restore-1-1`), false);
}));

test('未配置 CreatorFramework 路径时两个既有 hook 静默退出', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creatorframework-hooks-empty-'));
  try {
    const homeDir = path.join(fixtureRoot, 'home');
    const cwd = path.join(fixtureRoot, 'outside');
    fs.mkdirSync(cwd, { recursive: true });
    const input = JSON.stringify({
      cwd,
      tool_input: { patch: '*** Update File: src/example.ts' },
    });

    for (const scriptName of [
      'creatorframework-agents-reminder.mjs',
      'creatorframework-tscheck-reminder.mjs',
    ]) {
      const result = runHook(scriptName, { homeDir, cwd, input });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, '');
    }
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('Windows CreatorFramework 路径判断忽略盘符与目录大小写，并支持盘符根', () => {
  assert.equal(
    isInsideCreatorFramework(
      'c:\\projects\\creatorframework\\Assets',
      'C:\\Projects\\CreatorFramework',
      { platform: 'win32' },
    ),
    true,
  );
  assert.equal(
    isInsideCreatorFramework('C:\\Projects\\CreatorFramework', 'c:\\projects\\creatorframework', {
      platform: 'win32',
    }),
    true,
  );
  assert.equal(isInsideCreatorFramework('c:\\workspace', 'C:\\', { platform: 'win32' }), true);
  assert.equal(
    isInsideCreatorFramework('C:\\Projects\\CreatorFrameworkBackup', 'C:\\Projects\\CreatorFramework', {
      platform: 'win32',
    }),
    false,
  );
});

test('配置的 CreatorFramework root 命中后保留 AGENTS 与 tscheck 提醒', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creatorframework-hooks-configured-'));
  try {
    const homeDir = path.join(fixtureRoot, 'home');
    const root = path.join(fixtureRoot, 'CreatorFramework');
    const cwd = path.join(root, 'assets');
    fs.mkdirSync(cwd, { recursive: true });
    writeCreatorFrameworkConfig(homeDir, root);

    const agentsResult = runHook('creatorframework-agents-reminder.mjs', {
      homeDir,
      cwd,
      input: JSON.stringify({ cwd }),
    });
    assert.equal(agentsResult.status, 0, agentsResult.stderr);
    assert.match(agentsResult.stdout, /CreatorFramework AGENTS 提醒/);
    assert.match(agentsResult.stdout, new RegExp(root.replaceAll('\\', '\\\\')));

    const tscheckResult = runHook('creatorframework-tscheck-reminder.mjs', {
      homeDir,
      cwd,
      input: JSON.stringify({
        cwd,
        tool_input: { patch: '*** Update File: assets/example.ts' },
      }),
    });
    assert.equal(tscheckResult.status, 0, tscheckResult.stderr);
    assert.match(tscheckResult.stdout, /tscheck 提醒/);
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('规则同步 wrapper 在 root 未命中时不启动子进程', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creatorframework-rule-sync-miss-'));
  try {
    const homeDir = path.join(fixtureRoot, 'home');
    const root = path.join(fixtureRoot, 'CreatorFramework');
    const outside = path.join(fixtureRoot, 'outside');
    const marker = path.join(fixtureRoot, 'spawned');
    const targetHook = path.join(root, 'agent-tools', 'hooks', 'check-rule-sync.js');
    fs.mkdirSync(path.dirname(targetHook), { recursive: true });
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(targetHook, "require('node:fs').writeFileSync(process.env.MARKER, 'spawned');");
    writeCreatorFrameworkConfig(homeDir, root);

    const result = runHook('creatorframework-rule-sync-reminder.mjs', {
      homeDir,
      cwd: outside,
      input: JSON.stringify({ cwd: outside, tool_input: { patch: '*** Update File: a.ts' } }),
      env: { MARKER: marker },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(fs.existsSync(marker), false);
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('规则同步 wrapper 命中 root 时完整透传 stdin、stdout 与非零退出状态', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creatorframework-rule-sync-hit-'));
  try {
    const homeDir = path.join(fixtureRoot, 'home');
    const root = path.join(fixtureRoot, 'CreatorFramework');
    const targetHook = path.join(root, 'agent-tools', 'hooks', 'check-rule-sync.js');
    const receivedPath = path.join(fixtureRoot, 'received.json');
    fs.mkdirSync(path.dirname(targetHook), { recursive: true });
    fs.writeFileSync(targetHook, [
      "const { readFileSync, writeFileSync } = require('node:fs');",
      "const received = readFileSync(0, 'utf8');",
      "writeFileSync(process.env.RECEIVED_PATH, JSON.stringify({ received, args: process.argv.slice(2) }));",
      "process.stdout.write(`forwarded:${received}`);",
      'process.exitCode = 17;',
    ].join('\n'));
    writeCreatorFrameworkConfig(homeDir, root);
    const input = '{"cwd":"' + root.replaceAll('\\', '\\\\') + '","tool_input":{"patch":"*** Update File: a.ts"}}\n';

    const result = runHook('creatorframework-rule-sync-reminder.mjs', {
      homeDir,
      cwd: root,
      input,
      env: { RECEIVED_PATH: receivedPath },
    });
    assert.equal(result.status, 17, result.stderr);
    assert.equal(result.stdout, `forwarded:${input}`);
    assert.deepEqual(JSON.parse(fs.readFileSync(receivedPath, 'utf8')), {
      received: input,
      args: ['--platform=codex'],
    });
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('可移植 config 不含机器绑定集成且全部 hook 通过 CODEX_HOME 启动', () => {
  const config = fs.readFileSync(path.join(REPO_ROOT, 'codex', 'config.toml'), 'utf8');
  const agents = fs.readFileSync(path.join(REPO_ROOT, 'codex', 'AGENTS.md'), 'utf8');
  assert.doesNotMatch(config, /\/Applications|computer-use|custom_file_handlers|open-in-target-preferences|icons\//i);
  assert.match(config, /command = 'node "\{\{CODEX_HOME\}\}\/hooks\//);
  assert.doesNotMatch(agents, /\/Users\/liuzhuo/);
  assert.match(agents, /git rev-parse --git-common-dir/);
  assert.match(agents, /<当前 CreatorFramework 根>/);
});

test('help 只允许单独使用，混合参数返回 usage error', () => {
  const standaloneIo = makeIo();
  assert.equal(runCli({ argv: ['--help'], io: standaloneIo }), 0);
  assert.match(standaloneIo.lines.join('\n'), /--creatorframework-path/);

  for (const argv of [
    ['--help', '--unknown'],
    ['-h', '-h'],
    ['--help', '--pull-from-home'],
    ['-h', '--creatorframework-path', '/projects/CreatorFramework'],
  ]) {
    const io = makeIo();
    assert.equal(
      runCli({
        argv,
        platform: 'darwin',
        homeDir: '/Users/test',
        repoRoot: '/repo',
        io,
      }),
      2,
      argv.join(' '),
    );
    assert.equal(io.lines.length, 0, argv.join(' '));
    assert.equal(io.errors.length, 1, argv.join(' '));
  }
});
