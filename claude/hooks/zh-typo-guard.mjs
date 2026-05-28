#!/usr/bin/env node
/**
 * PreToolUse hook: 拦截 AskUserQuestion / TaskCreate / TaskUpdate 等工具调用中
 * 出现的已知中文错字, 阻断并提示 AI 重新调用工具修正。
 *
 * 词典: ~/.claude/zh-typos.json
 * exit 2 + stderr = block + 反馈给 AI
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const TARGET_TOOLS = new Set([
    'AskUserQuestion',
    'TaskCreate',
    'TaskUpdate',
]);

// stdin: PreToolUse hook payload
let input;
try {
    const raw = readFileSync(0, 'utf-8');
    input = JSON.parse(raw);
} catch {
    process.exit(0);
}

if (!input || !TARGET_TOOLS.has(input.tool_name)) {
    process.exit(0);
}

let dict = {};
try {
    const path = join(homedir(), '.claude', 'zh-typos.json');
    const parsed = JSON.parse(readFileSync(path, 'utf-8'));
    dict = parsed.typos ?? {};
} catch {
    process.exit(0);
}

const text = JSON.stringify(input.tool_input ?? {});
const hits = [];
for (const [wrong, correct] of Object.entries(dict)) {
    if (text.includes(wrong)) hits.push({ wrong, correct });
}

if (hits.length === 0) process.exit(0);

const lines = [
    '⚠️ 检测到中文错字, 请重新调用工具修正:',
    ...hits.map(h => `  「${h.wrong}」→「${h.correct}」`),
    '',
    '提醒: JSON 工具参数中的中文请直接写汉字, 不要使用 \\uXXXX 转义',
    '(手写 Unicode 易把相邻码点的字写错, 如「兜」U+515C 与「兑」U+5151)',
];
console.error(lines.join('\n'));
process.exit(2);
