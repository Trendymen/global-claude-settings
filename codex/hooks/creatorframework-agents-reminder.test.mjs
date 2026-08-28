import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const hookPath = fileURLToPath(new URL('./creatorframework-agents-reminder.mjs', import.meta.url));

function makeFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'ocx-agents-local-hook-'));
  const homeDir = path.join(root, 'home');
  const projectRoot = path.join(root, 'CreatorFramework');
  return { root, homeDir, projectRoot };
}

function writeCreatorFrameworkRoot(homeDir, root) {
  const configPath = path.join(homeDir, '.codex', 'creatorframework.json');
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify({ root }), 'utf8');
}

function runHook({ homeDir, cwd, input }) {
  return spawnSync(process.execPath, [hookPath], {
    cwd,
    encoding: 'utf8',
    input: JSON.stringify(input),
    env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir },
  });
}

test('未配置 CreatorFramework 根时静默退出', () => {
  const fixture = makeFixture();
  try {
    execFileSync('git', ['init', '--quiet', fixture.root]);
    const result = runHook({ homeDir: fixture.homeDir, cwd: fixture.root, input: { cwd: fixture.root } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('CreatorFramework 内提醒读取 AGENTS.local 与 AGENTS', () => {
  const fixture = makeFixture();
  try {
    writeCreatorFrameworkRoot(fixture.homeDir, fixture.projectRoot);
    const cwd = path.join(fixture.projectRoot, 'assets');
    mkdirSync(cwd, { recursive: true });
    execFileSync('git', ['init', '--quiet', fixture.projectRoot]);

    const result = runHook({ homeDir: fixture.homeDir, cwd, input: { cwd } });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.match(output.systemMessage, /CreatorFramework AGENTS 提醒/);
    assert.match(output.systemMessage, /AGENTS.local.md/);
    assert.match(output.systemMessage, /AGENTS.md/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('任意含 AGENTS.local.md 的 git worktree 都触发项目提醒', () => {
  const fixture = makeFixture();
  try {
    execFileSync('git', ['init', '--quiet', fixture.root]);
    writeFileSync(path.join(fixture.root, 'AGENTS.local.md'), '# local rules\n', 'utf8');

    const result = runHook({ homeDir: fixture.homeDir, cwd: fixture.root, input: { cwd: fixture.root } });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.match(output.systemMessage, /项目 AGENTS 提醒/);
    assert.match(output.systemMessage, /当前 worktree 根/);
    assert.match(output.systemMessage, /AGENTS.local.md/);
    assert.match(output.systemMessage, /AGENTS.md/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
