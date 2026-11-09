#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 按当前输入给出候选提示；不判断授权、门禁或既有任务进度。 */
export function buildReminder(input) {
  const rawPrompt = input?.prompt ?? input?.user_prompt;
  if (typeof rawPrompt !== 'string') return '';
  const prompt = rawPrompt.trim();
  if (!prompt || /^(?:(?:请|帮我)\s*)?(?:解释|介绍|比较|对比|什么是|为什么|如何使用|怎么用|停止|取消|暂停|不用|不要|别|what\b|why\b|explain\b|compare\b)/i.test(prompt)) return '';

  const routes = [
    [/AGENTS\.md|CLAUDE\.md|全局规则|(?:codex|全局|现有|入口).{0,16}\bhooks?\b|\bhooks?\b.{0,12}(?:提醒|配置|规则)|writing-for-agents/i,
      '规则与 Agent 文档参考 writing-for-agents，并做 shuorenhua minimal 自查；分工与约束以全局 AGENTS.md 为准。'],
    [/executing-plans|subagent-driven-development|writing-plans/i,
      '沿用已选 Superpowers 流程、已批准设计和当前计划；复用已确认信息，正式审查走用户级 requesting-code-review。'],
    [/grill-with-docs|\bgrilling\b|domain-modeling|领域模型|领域术语|术语表/i,
      '领域梳理参考 domain-modeling；深入访谈、文档写入和 setup 按用户已选工作流执行，复用已确认信息。'],
    [/排查|调试|报错|故障|修复|\bbug\b|debug/i,
      '技术故障先用 Superpowers systematic-debugging 查因，再按项目规则修复与验证。'],
    [/codebase-design|improve-codebase-architecture|屎山|重构|架构|职责|耦合|refactor|architecture/i,
      '架构与职责设计参考 codebase-design；完整扫描使用用户点名的 improve-codebase-architecture。先核对证据，修改仍走既有设计批准流程。'],
    [/审查|复审|\breview\b/i,
      '正式审查使用用户级 requesting-code-review，沿用现有 reviewer contract，不重复启动插件内审查流程。'],
    [/新增|增加|添加|开发|实现|修改|调整|完善|加(?:一个|个).*?(?:功能|组件|按钮|开关|入口)|\b(?:implement|build|add)\b/i,
      '若涉及功能、组件或行为变更，按 Superpowers brainstorming 判断范围并复用已有批准；纯说明和只读工作不进入实施流程。'],
  ];
  const route = routes.find(([pattern]) => pattern.test(prompt));
  return route ? `[技能分流提醒] ${route[1]}` : '';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
    const systemMessage = buildReminder(input);
    if (systemMessage) process.stdout.write(JSON.stringify({ systemMessage }));
  } catch {
    // Hook 输入异常时静默退出，不能阻断正常工具调用。
  }
}
