import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReminder } from './superpowers-reminder.mjs';

test('普通新请求也会收到技能匹配与三路径提醒', () => {
  const message = buildReminder({ user_prompt: '帮我加一个设置开关' });

  assert.match(message, /先做 skill 匹配/);
  assert.match(message, /新增功能、组件、能力或行为变更/);
  assert.match(message, /Spike、Bounded、Architectural/);
});

test('不会把普通问答或只读调查误标为 Brainstorming', () => {
  const message = buildReminder({ user_prompt: '解释这个函数做什么' });

  assert.match(message, /普通问答、状态汇报、只读调查不进入 brainstorming/);
});
