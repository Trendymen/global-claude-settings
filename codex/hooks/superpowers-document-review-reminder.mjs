#!/usr/bin/env node
import { appendFileSync, chmodSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import path from 'node:path';

const docPattern = /(?:^|\/)docs\/superpowers\/(specs|plans)\/.+\.md$/i;
const auditLogPath = process.env.CODEX_SUPERPOWERS_DOCUMENT_REVIEW_LOG
  ?? path.join(homedir(), '.codex', 'logs', 'superpowers-document-review-hook.jsonl');

function collectPaths(value, key = '', paths = []) {
  if (typeof value === 'string') {
    if (/(?:file|path|target|destination)/i.test(key)) paths.push(value);

    const patchPathPatterns = [
      /(?:^|\r?\n|\\n)\*\*\* (?:Add|Update|Delete) File:\s*(.+?)(?=\r?\n|\\n|$)/gm,
      /(?:^|\r?\n|\\n)\*\*\* Move to:\s*(.+?)(?=\r?\n|\\n|$)/gm,
    ];
    for (const pattern of patchPathPatterns) {
      let match;
      while ((match = pattern.exec(value)) !== null) paths.push(match[1]);
    }
    return paths;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectPaths(item, key, paths);
  } else if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectPaths(childValue, childKey, paths);
    }
  }
  return paths;
}

function normalizePath(value) {
  return String(value).replace(/^\.\//, '').replaceAll('\\', '/');
}

function inspectDocumentReview(input) {
  const toolInput = input?.tool_input ?? input?.toolInput ?? {};
  const paths = collectPaths(toolInput).map(normalizePath);
  const documents = new Map();
  for (const filePath of paths) {
    const kind = docPattern.exec(filePath)?.[1];
    if (kind) documents.set(filePath, kind);
  }
  const modes = [];
  if ([...documents.values()].includes('specs')) modes.push('SPEC_DOCUMENT');
  if ([...documents.values()].includes('plans')) modes.push('PLAN_DOCUMENT');
  return { paths: [...documents.keys()], modes };
}

export function buildReminder(input) {
  const { modes } = inspectDocumentReview(input);

  if (modes.length === 0) return '';

  const reviewModes = modes.map(mode => `REVIEW_MODE: ${mode}`);

  return [
    '[Superpowers 文档审查提醒]',
    '检测到 docs/superpowers 下的 Spec 或 Plan 编辑。写入后必须派只读 reviewer 子代理审查；修复 Critical/Important 后复用同一 reviewer 做 RE_REVIEW。',
    ...reviewModes,
    '派发只携带文档路径、所需的关联 Spec/Plan 与约束；不要传主会话历史或预判结论。',
  ].join('\n');
}

export function buildAuditEvent(input) {
  const { paths, modes } = inspectDocumentReview(input);
  const event = {
    toolName: String(input?.tool_name ?? input?.toolName ?? ''),
    paths,
    modes,
    emitted: modes.length > 0,
  };
  const sessionId = input?.session_id ?? input?.sessionId ?? input?.thread_id ?? input?.threadId;
  if (sessionId) event.sessionId = String(sessionId);
  return event;
}

function appendAuditEvent(event) {
  if (!event.emitted) return;
  try {
    mkdirSync(path.dirname(auditLogPath), { recursive: true, mode: 0o700 });
    chmodSync(path.dirname(auditLogPath), 0o700);
    appendFileSync(auditLogPath, `${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`);
    chmodSync(auditLogPath, 0o600);
  } catch {
    // 审计失败不能阻断正常工具调用。
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
    const systemMessage = buildReminder(input);
    appendAuditEvent(buildAuditEvent(input));
    if (systemMessage) process.stdout.write(JSON.stringify({ systemMessage }));
  } catch {
    // Hook 输入异常时静默退出，不能阻断正常工具调用。
  }
}
