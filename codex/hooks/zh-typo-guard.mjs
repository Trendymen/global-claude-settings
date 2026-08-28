#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const targets = new Set([
    'request_user_input',
    'functions.request_user_input',
    'update_plan',
    'functions.update_plan',
]);

let input;
try {
    input = JSON.parse(readFileSync(0, 'utf-8') || '{}');
} catch {
    process.exit(0);
}

const toolName = String(input?.tool_name ?? input?.toolName ?? '');
if (!targets.has(toolName)) process.exit(0);

let dict = {};
try {
    const primary = join(homedir(), '.codex', 'zh-typos.json');
    const fallback = join(homedir(), '.claude', 'zh-typos.json');
    const path = existsSync(primary) ? primary : fallback;
    const parsed = JSON.parse(readFileSync(path, 'utf-8'));
    dict = parsed.typos ?? {};
} catch {
    process.exit(0);
}

const text = JSON.stringify(input.tool_input ?? input.toolInput ?? {});
const hits = [];
for (const [wrong, correct] of Object.entries(dict)) {
    if (text.includes(wrong)) hits.push({ wrong, correct });
}

if (hits.length === 0) process.exit(0);

const msg = [
    '⚠️ 检测到中文错字, 请重新调用工具修正:',
    ...hits.map(h => `  「${h.wrong}」→「${h.correct}」`),
    '',
    '提醒: JSON 工具参数中的中文请直接写汉字, 不要使用 \\uXXXX 转义',
    '(手写 Unicode 易把相邻码点的字写错, 如「兜」U+515C 与「兑」U+5151)',
].join('\n');

process.stdout.write(JSON.stringify({ systemMessage: msg }));
