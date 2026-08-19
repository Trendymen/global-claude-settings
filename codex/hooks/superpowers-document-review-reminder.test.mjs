import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildReminder } from './superpowers-document-review-reminder.mjs';
import * as documentReview from './superpowers-document-review-reminder.mjs';

const HOOKS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HOOKS_DIRECTORY, '..', '..');
const CONFIG_PATH = path.join(REPO_ROOT, 'codex', 'config.toml');
const DOCUMENT_REVIEW_HOOK_PATH = path.join(
  HOOKS_DIRECTORY,
  'superpowers-document-review-reminder.mjs',
);

test('要求审查新写入的 Spec 文档', () => {
  const message = buildReminder({
    tool_input: {
      patch: '*** Add File: docs/superpowers/specs/2026-08-18-review-design.md\n+content',
    },
  });

  assert.match(message, /REVIEW_MODE: SPEC_DOCUMENT/);
  assert.match(message, /子代理审查/);
});

test('要求审查新写入的 Plan 文档', () => {
  const message = buildReminder({
    tool_input: {
      patch: '*** Update File: docs/superpowers/plans/2026-08-18-review-plan.md\n+content',
    },
  });

  assert.match(message, /REVIEW_MODE: PLAN_DOCUMENT/);
});

test('识别绝对路径中的 Superpowers 文档', () => {
  const message = buildReminder({
    tool_input: {
      patch: '*** Add File: /workspace/docs/superpowers/specs/2026-08-18-review-design.md\n+content',
    },
  });

  assert.match(message, /REVIEW_MODE: SPEC_DOCUMENT/);
});

test('识别 Windows 风格路径中的 Superpowers 文档', () => {
  const message = buildReminder({
    tool_input: {
      patch: '*** Add File: C:\\workspace\\docs\\superpowers\\plans\\review.md\n+content',
    },
  });

  assert.match(message, /REVIEW_MODE: PLAN_DOCUMENT/);
});

test('忽略不在 Superpowers 文档目录的编辑', () => {
  const message = buildReminder({
    tool_input: {
      patch: '*** Update File: src/example.ts\n+content',
    },
  });

  assert.equal(message, '');
});

test('识别 exec 中带转义换行的 Spec patch', () => {
  const message = buildReminder({
    tool_name: 'exec',
    tool_input: {
      source: 'const patch = "*** Begin Patch\\n*** Add File: /tmp/docs/superpowers/specs/hook-smoke.md\\n+secret";',
    },
  });

  assert.match(message, /REVIEW_MODE: SPEC_DOCUMENT/);
});

test('文档审查 hook 订阅 exec', async () => {
  const config = await readFile(CONFIG_PATH, 'utf8');

  assert.match(
    config,
    /command = 'node "\{\{CODEX_HOME\}\}\/hooks\/superpowers-document-review-reminder\.mjs"'/,
  );
  const matcher = config.match(
    /\[\[hooks\.PostToolUse\]\]\nmatcher = "([^"]+)"\n\[\[hooks\.PostToolUse\.hooks\]\]\ntype = "command"\ncommand = 'node "\{\{CODEX_HOME\}\}\/hooks\/superpowers-document-review-reminder\.mjs"'/,
  )?.[1];
  assert.ok(matcher, '未找到文档审查 hook 的 matcher');
  const runtimeMatcher = matcher.replaceAll('\\\\', '\\');
  assert.equal(new RegExp(runtimeMatcher).test('exec'), true);
  assert.equal(new RegExp(runtimeMatcher).test('functions.exec'), true);
  assert.equal(new RegExp(runtimeMatcher).test('file_change'), false);
});

test('移动进入 Superpowers Plan 目录也触发审查', () => {
  const message = buildReminder({
    tool_name: 'apply_patch',
    tool_input: {
      patch: '*** Update File: README.md\n*** Move to: docs/superpowers/plans/moved.md',
    },
  });

  assert.match(message, /REVIEW_MODE: PLAN_DOCUMENT/);
});

test('exec 的只读 source 不会成为路径、提醒或审计内容', () => {
  const input = {
    tool_name: 'exec',
    tool_input: {
      source: 'TOKEN=top-secret sed -n 1,20p /tmp/docs/superpowers/specs/read-only.md',
    },
  };

  assert.equal(buildReminder(input), '');
  const event = documentReview.buildAuditEvent(input);
  assert.deepEqual(event.paths, []);
  assert.equal(event.emitted, false);
  assert.doesNotMatch(JSON.stringify(event), /top-secret/);
});

test('审计事件只记录触发元数据，不记录 patch 内容', () => {
  assert.equal(typeof documentReview.buildAuditEvent, 'function');
  const event = documentReview.buildAuditEvent({
    tool_name: 'exec',
    session_id: 'session-123',
    tool_input: {
      source: 'const patch = "*** Begin Patch\\n*** Add File: /tmp/docs/superpowers/specs/audit.md\\n+secret-content";',
    },
  });

  assert.deepEqual(event, {
    toolName: 'exec',
    sessionId: 'session-123',
    paths: ['/tmp/docs/superpowers/specs/audit.md'],
    modes: ['SPEC_DOCUMENT'],
    emitted: true,
  });
  assert.doesNotMatch(JSON.stringify(event), /secret-content/);
});

test('CLI 写入可审计的文档审查事件', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'codex-doc-review-'));
  const logPath = path.join(directory, 'audit.jsonl');
  try {
    const result = spawnSync(
      process.execPath,
      [DOCUMENT_REVIEW_HOOK_PATH],
      {
        input: JSON.stringify({
          tool_name: 'exec',
          session_id: 'session-audit',
          tool_input: {
            source: 'const patch = "*** Begin Patch\\n*** Add File: /tmp/docs/superpowers/specs/audit-cli.md\\n+secret-content";',
          },
        }),
        encoding: 'utf8',
        env: { ...process.env, CODEX_SUPERPOWERS_DOCUMENT_REVIEW_LOG: logPath },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    const [event] = (await readFile(logPath, 'utf8')).trim().split('\n').map(JSON.parse);
    const logStat = await stat(logPath);
    assert.equal(event.toolName, 'exec');
    assert.equal(event.sessionId, 'session-audit');
    assert.deepEqual(event.paths, ['/tmp/docs/superpowers/specs/audit-cli.md']);
    assert.equal(event.emitted, true);
    assert.doesNotMatch(JSON.stringify(event), /secret-content/);
    assert.equal(logStat.mode & 0o777, 0o600);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
