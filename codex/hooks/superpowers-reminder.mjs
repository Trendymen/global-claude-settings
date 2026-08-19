#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function buildReminder(_input) {
  return [
    '[Superpowers 入口提醒]',
    '每个新用户请求先做 skill 匹配；仅在相关 skill 适用时调用它。',
    '涉及新增功能、组件、能力或行为变更时，先调用 brainstorming，并在实施前分类为 Spike、Bounded、Architectural 且完成对应批准门。',
    '普通问答、状态汇报、只读调查不进入 brainstorming；排障先走 systematic-debugging。',
    'Spike 只产出可行性结论；Bounded 经短设计批准后直接实现；Architectural 经 Spec 批准后才进入 writing-plans。',
  ].join(' ');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
    process.stdout.write(JSON.stringify({ systemMessage: buildReminder(input) }));
  } catch {
    // Hook 输入异常时静默退出，不能阻断正常工具调用。
  }
}
