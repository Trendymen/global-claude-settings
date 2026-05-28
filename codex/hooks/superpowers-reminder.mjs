#!/usr/bin/env node
import { readFileSync } from 'node:fs';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const text = JSON.stringify(input);
if (!/(superpowers:|using-superpowers|brainstorming|writing-plans|executing-plans|verification-before-completion|subagent-driven-development|systematic-debugging|requesting-code-review|receiving-code-review|finishing-a-development-branch)/i.test(text)) {
  process.exit(0);
}

const msg = [
  '[Superpowers 提醒]',
  '1. 使用 superpowers skill 时，先读对应 SKILL.md，再按 checklist 建 update_plan 并逐项更新。',
  '2. brainstorming / writing-plans 的多方案阶段，如有真实多路径，优先并行生成 2-3 个候选方案；没有可用 subagent 时由主线程给出简明方案与推荐。',
  '3. Claude 的 AskUserQuestion 在 Codex 中迁移为 request_user_input；superpowers 场景一旦判断需要结构化提问，就直接调用 request_user_input，不要先用普通文本试探。',
  '4. request_user_input 不可用时才用一个必要的简短文本问题兜底；能合理假设继续时直接执行。',
  '5. executing-plans 默认不强制创建/切换 worktree，除非用户明确要求或当前任务确实只能隔离完成。',
].join(' ');

process.stdout.write(JSON.stringify({ systemMessage: msg }));
