#!/usr/bin/env node
import { readFileSync } from 'node:fs';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

const toolInput = input.tool_input ?? input.toolInput ?? {};
const questions = Array.isArray(toolInput.questions) ? toolInput.questions : [];
if (questions.length === 0) process.exit(0);

const warnings = [];
for (const q of questions) {
  const questionText = String(q?.question ?? '').slice(0, 40);
  const multiSelect = q?.multiSelect === true;
  const options = Array.isArray(q?.options) ? q.options : [];
  const firstLabel = String(options[0]?.label ?? '');

  if (!multiSelect && !/(推荐|\(Recommended\)|（推荐）)/.test(firstLabel)) {
    warnings.push(`[校验] 题目「${questionText}...」首个 option 「${firstLabel}」缺少『（推荐）』标记 — 规则要求单选题第一项 label 末尾加（推荐）`);
  }

  const shortDescLabels = options
    .filter(option => String(option?.description ?? '').length < 15)
    .map(option => String(option?.label ?? ''));
  if (shortDescLabels.length > 0) {
    warnings.push(`[校验] 题目「${questionText}...」option 「${shortDescLabels.join('、')}」的 description 过短 — 应解释 trade-off / 适用场景 / 代价，而不是重复 label`);
  }

  if (!multiSelect && /哪些|多个|多项|启用.*功能|采纳.*建议/.test(String(q?.question ?? ''))) {
    warnings.push(`[校验] 题目「${questionText}...」题面含「哪些/多个/多项」等并列语义 — Codex request_user_input 当前不支持 multiSelect；如确需多选，请改用普通文本提问。`);
  }
}

if (warnings.length === 0) process.exit(0);

const msg = [
  '[request_user_input 输入校验提醒]',
  ...warnings,
  '',
  '参考 Codex 全局规则的用户提问约束。如果是有意为之可忽略；如果是疏漏请重新发起调用修正。',
].join('\n');

process.stdout.write(JSON.stringify({ systemMessage: msg }));
