#!/usr/bin/env node
// 恢复产物验证器：restore 后在目标 CODEX_HOME 内核对可移植载荷。
// 零依赖（仅 node:xxx），供 CI 与本机验收共用。

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_HOOK_FILES = [
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

const EXPECTED_AGENTS = ['architect.toml', 'explorer.toml', 'general.toml', 'reviewer.toml'];

const JUNK_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

function usageError(message) {
  console.error('[verify-restore] ' + message);
  process.exit(2);
}

function readCodexHome() {
  const value = process.env.CODEX_HOME;
  if (!value) usageError('缺少 CODEX_HOME 环境变量');
  if (!path.isAbsolute(value)) usageError('CODEX_HOME 必须是绝对路径: ' + value);
  return path.resolve(value);
}

function readCreatorFrameworkRoot() {
  const raw = process.env.VERIFY_CREATORFRAMEWORK_ROOT;
  if (raw === undefined) return undefined;
  if (raw.trim() === '') usageError('VERIFY_CREATORFRAMEWORK_ROOT 不能为空字符串');
  if (!path.isAbsolute(raw)) usageError('VERIFY_CREATORFRAMEWORK_ROOT 必须是绝对路径: ' + raw);
  return path.resolve(raw);
}

function isJunk(name) {
  return JUNK_FILES.has(name);
}

function listBaseline(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !isJunk(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function verify(codexHome, expectedCreatorFrameworkRoot) {
  const expectedTop = ['AGENTS.md', 'agents', 'config.toml', 'hooks'];
  if (expectedCreatorFrameworkRoot !== undefined) expectedTop.push('creatorframework.json');
  expectedTop.sort();
  const actualTop = fs
    .readdirSync(codexHome, { withFileTypes: true })
    .filter((entry) => !entry.name.includes('.before-restore-') && !isJunk(entry.name))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(actualTop, expectedTop, 'CODEX_HOME 顶层载荷应为恢复四项（忽略 restore 备份）');

  const configPath = path.join(codexHome, 'config.toml');
  const config = fs.readFileSync(configPath, 'utf8');
  assert.doesNotMatch(config, /\{\{CODEX_HOME\}\}/, 'config.toml 不应残留占位符');
  const hooksPrefix = 'node "' + codexHome.replaceAll('\\', '/') + '/hooks/';
  assert.ok(config.includes(hooksPrefix), 'config.toml 应包含渲染后的 hook 路径前缀: ' + hooksPrefix);

  assert.equal(fs.existsSync(path.join(codexHome, 'AGENTS.md')), true);

  const agentsDir = path.join(codexHome, 'agents');
  assert.deepEqual(listBaseline(agentsDir), EXPECTED_AGENTS, 'agents/ 文件清单不符');

  const hooksDir = path.join(codexHome, 'hooks');
  const extra = fs
    .readdirSync(hooksDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.endsWith('.test.mjs') && !isJunk(entry.name))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(extra, EXPECTED_HOOK_FILES, 'hooks/ 基线清单不符');

  const creatorFrameworkPath = path.join(codexHome, 'creatorframework.json');
  if (expectedCreatorFrameworkRoot === undefined) {
    assert.equal(fs.existsSync(creatorFrameworkPath), false, '未传 root 时不应产生 creatorframework.json');
  } else {
    const parsed = JSON.parse(fs.readFileSync(creatorFrameworkPath, 'utf8'));
    assert.equal(parsed.root, expectedCreatorFrameworkRoot, 'creatorframework.json root 不符');
  }

  if (process.env.VERIFY_EXPECT_BACKUP === '1') {
    const hasBackup = fs
      .readdirSync(codexHome)
      .some((name) => name.includes('.before-restore-'));
    assert.equal(hasBackup, true, '预期存在 .before-restore-* 备份产物，但未找到');
  }
}

const codexHome = readCodexHome();
const expectedCreatorFrameworkRoot = readCreatorFrameworkRoot();
verify(codexHome, expectedCreatorFrameworkRoot);
console.log('[verify-restore] OK: ' + codexHome);
