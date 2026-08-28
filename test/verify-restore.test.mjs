import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERIFY_SCRIPT = path.join(REPO_ROOT, 'scripts', 'verify-restore.mjs');

const AGENT_FILES = ['architect.toml', 'explorer.toml', 'general.toml', 'reviewer.toml'];

const HOOK_FILES = [
  'ask-user-question-validator.mjs',
  'creatorframework-agents-reminder.mjs',
  'creatorframework-root.mjs',
  'creatorframework-rule-sync-reminder.mjs',
  'creatorframework-tscheck-reminder.mjs',
  'prefer-node-script.mjs',
  'session-zh-reminder.mjs',
  'superpowers-document-review-reminder.mjs',
  'superpowers-reminder.mjs',
  'zh-typo-guard.mjs',
];

function makeCodexHome({ withBackup = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-restore-fixture-'));
  const codexHome = path.join(root, '.codex');
  fs.mkdirSync(path.join(codexHome, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(codexHome, 'hooks'), { recursive: true });
  const hooksPrefix = 'node "' + codexHome.replaceAll('\\', '/') + '/hooks/';
  fs.writeFileSync(path.join(codexHome, 'AGENTS.md'), 'agents\n');
  fs.writeFileSync(path.join(codexHome, 'config.toml'), hooksPrefix + 'session-zh-reminder.mjs"\n');
  for (const name of AGENT_FILES) fs.writeFileSync(path.join(codexHome, 'agents', name), '');
  for (const name of HOOK_FILES) fs.writeFileSync(path.join(codexHome, 'hooks', name), '');
  if (withBackup) fs.mkdirSync(path.join(codexHome, 'AGENTS.md.before-restore-20260819000000000-1'));
  return { root, codexHome };
}

function runVerify(env) {
  return spawnSync(process.execPath, [VERIFY_SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('合法恢复产物通过验证且容忍系统杂物文件', () => {
  const fixture = makeCodexHome();
  try {
    fs.writeFileSync(path.join(fixture.codexHome, '.DS_Store'), '');
    fs.writeFileSync(path.join(fixture.codexHome, 'hooks', 'Thumbs.db'), '');
    const result = runVerify({ CODEX_HOME: fixture.codexHome });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('hooks 基线漂移会被拦截', () => {
  const fixture = makeCodexHome();
  try {
    fs.rmSync(path.join(fixture.codexHome, 'hooks', 'session-zh-reminder.mjs'));
    const result = runVerify({ CODEX_HOME: fixture.codexHome });
    assert.equal(result.status, 1);
    assert.match(result.stderr + result.stdout, /基线清单不符/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('config.toml 残留占位符会被拦截', () => {
  const fixture = makeCodexHome();
  try {
    fs.writeFileSync(
      path.join(fixture.codexHome, 'config.toml'),
      `command = 'node "{{CODEX_HOME}}/hooks/a.mjs"'\n`,
    );
    const result = runVerify({ CODEX_HOME: fixture.codexHome });
    assert.equal(result.status, 1);
    assert.match(result.stderr + result.stdout, /占位符/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('creatorframework.json 按 VERIFY_CREATORFRAMEWORK_ROOT 校验有无与内容', () => {
  const fixture = makeCodexHome();
  try {
    const matchedRoot = path.join(fixture.root, 'CreatorFramework');
    fs.writeFileSync(
      path.join(fixture.codexHome, 'creatorframework.json'),
      JSON.stringify({ root: matchedRoot }, null, 2) + '\n',
    );

    const withoutSentinel = runVerify({ CODEX_HOME: fixture.codexHome });
    assert.equal(withoutSentinel.status, 1);

    const matched = runVerify({
      CODEX_HOME: fixture.codexHome,
      VERIFY_CREATORFRAMEWORK_ROOT: matchedRoot,
    });
    assert.equal(matched.status, 0, matched.stderr);

    const mismatchedRoot = path.join(fixture.root, 'Other');
    const mismatched = runVerify({
      CODEX_HOME: fixture.codexHome,
      VERIFY_CREATORFRAMEWORK_ROOT: mismatchedRoot,
    });
    assert.equal(mismatched.status, 1);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('VERIFY_EXPECT_BACKUP 哨兵正向断言备份产物', () => {
  const plain = makeCodexHome();
  try {
    const withoutBackup = runVerify({ CODEX_HOME: plain.codexHome, VERIFY_EXPECT_BACKUP: '1' });
    assert.equal(withoutBackup.status, 1);
  } finally {
    fs.rmSync(plain.root, { recursive: true, force: true });
  }

  const withBackup = makeCodexHome({ withBackup: true });
  try {
    const result = runVerify({ CODEX_HOME: withBackup.codexHome, VERIFY_EXPECT_BACKUP: '1' });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(withBackup.root, { recursive: true, force: true });
  }
});

test('缺少或非法环境变量返回 usage 错误码 2', () => {
  const missing = runVerify({});
  assert.equal(missing.status, 2);

  const relativeHome = runVerify({ CODEX_HOME: 'relative/.codex' });
  assert.equal(relativeHome.status, 2);

  const fixture = makeCodexHome();
  try {
    const relativeRoot = runVerify({
      CODEX_HOME: fixture.codexHome,
      VERIFY_CREATORFRAMEWORK_ROOT: 'relative/CreatorFramework',
    });
    assert.equal(relativeRoot.status, 2);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});
