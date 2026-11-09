import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReminder } from './superpowers-reminder.mjs';

for (const prompt of ['', '继续', '好的，按这个来', '看一下进度', '解释这个函数做什么', '介绍 Matt codebase-design 怎么用']) {
  test(`普通问答和跟进保持静默：${prompt || '空输入'}`, () => {
    assert.equal(buildReminder({ prompt }), '');
  });
}

for (const [prompt, expected] of [
  ['分析 Chat 屎山的重构切入点', /codebase-design/],
  ['用 $grill-with-docs 梳理领域术语', /domain-modeling/],
  ['调整全局 AGENTS.md 和 hooks 提醒', /writing-for-agents/],
  ['使用 $superpowers:executing-plans 继续已有计划', /沿用.*计划/],
  ['帮我加一个设置开关', /brainstorming/],
  ['新增 Webhook 接口', /brainstorming/],
  ['实现 React hooks 组件', /brainstorming/],
  ['排查切房后的聊天报错', /systematic-debugging/],
  ['排查重构后报错的原因', /systematic-debugging/],
  ['审查这批代码', /requesting-code-review/],
]) {
  test(`按请求给出单一分工提示：${prompt}`, () => {
    const message = buildReminder({ prompt });
    assert.match(message, expected);
    assert.ok(message.length <= 240, '提醒保持简短');
  });
}

test('兼容已有 user_prompt 字段', () => {
  assert.equal(
    buildReminder({ user_prompt: '帮我加一个设置开关' }),
    buildReminder({ prompt: '帮我加一个设置开关' }),
  );
});

test('异常输入不生成提醒', () => {
  for (const input of [undefined, null, {}, { prompt: 123 }]) {
    assert.equal(buildReminder(input), '');
  }
});
