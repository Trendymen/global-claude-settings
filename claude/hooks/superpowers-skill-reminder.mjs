#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const event = process.argv[2] || 'PostToolUse';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

const skill = String((input.tool_input ?? input.toolInput ?? {}).skill ?? '');
const short = skill.includes(':') ? skill.split(':').pop() : skill;
const known = new Set([
  'using-superpowers',
  'brainstorming',
  'writing-plans',
  'executing-plans',
  'verification-before-completion',
  'subagent-driven-development',
  'systematic-debugging',
  'dispatching-parallel-agents',
  'finishing-a-development-branch',
  'receiving-code-review',
  'requesting-code-review',
  'test-driven-development',
  'using-git-worktrees',
  'writing-skills',
]);

if (!known.has(short)) process.exit(0);

const common = `[Superpowers 硬性提醒｜${event}] ① 任何 2-4 选项决策必须走 AskUserQuestion 工具，禁止纯文本提问，第一选项末尾加（推荐）；② skill 内部 checklist/步骤列表必须先用一句普通可见文本说明正在进入哪个 skill/为什么建任务，然后立即建 TaskCreate，每项一个 todo，逐项 in_progress→completed 实时更新（禁止静默建任务/心算/批量）。`;

const specifics = {
  'brainstorming': '【brainstorming】禁止纯文本『OK 吗？』『可以吗？』收尾段落确认。每段段落确认必须走 AskUserQuestion 4 选项：通过继续/X 部分要改/Y 部分要改/整段重做。多方案对比阶段必须并行派发 2-3 个 Plan agent 生成独立方案，禁止串行思考三个方案。',
  'writing-plans': '【writing-plans】多实现路径必须并行派发 Plan agent 出 2-3 个方案 → 横向对比表 → AskUserQuestion 让用户选。Plan 模式下『方案是否通过』必须走 ExitPlanMode，禁用 AskUserQuestion 问审批。',
  'executing-plans': '【executing-plans】CLAUDE.md 第 11 节豁免：禁止『必须 worktree』『先 using-git-worktrees』要求，默认当前工作区改代码；只保留计划审阅 + 逐步执行 + 验证收尾约束。除非用户当前对话明确点名补测试，禁止主动新增/修改/运行程序化测试。',
  'verification-before-completion': '【verification】证据先于断言：必须先跑命令（test/build/lint/diagnostics）拿到输出，才能说『完成/通过/修好』。禁止『应该没问题』『预计通过』『理论上没问题』类断言。',
  'subagent-driven-development': '【subagent-driven】预计 >2 分钟的子任务必须 run_in_background:true + Monitor 跟进；并行上限 5 个；派发后必须立即告知用户『已派发 N 个 agent，分别负责 …』，禁止干等空白屏幕。',
  'systematic-debugging': '【debugging】多个假设并行验证：同时派发 subagent 排查不同方向（如网络/数据/渲染），禁止串行试一个等一个。先定位根因再改代码，禁止盲改。',
  'dispatching-parallel-agents': '【并行派发】无依赖子任务必须『单条消息』内多 Agent 工具调用并行（不是多条消息各发一个）；有依赖才串行；并行上限 5；写入冲突用 worktree 隔离或改串行。',
  'finishing-a-development-branch': '【finishing-branch】merge / 开 PR / 仅清理 三选一必须走 AskUserQuestion 多选项（推荐方案 + 三个具体方案），第一项末尾加（推荐）。禁止纯文本『要 merge 吗？』收尾。',
  'receiving-code-review': '【receiving-review】每条 review 反馈必须走 AskUserQuestion 三选项：接受/拒绝/改写后接受。禁止表演式同意或盲目实施，技术上有疑虑必须先验证再决定。',
  'requesting-code-review': '【requesting-review】提交 review 时必须包含完整 context：变更目的 + 关键文件路径 + 潜在风险点；不要让 reviewer 反向猜动机。',
  'test-driven-development': '【TDD｜CLAUDE.md 第 11 节豁免】除非用户当前对话明确点名 TDD/补测试/跑测试，否则禁止主动新增/修改/运行程序化测试；本 skill 默认不应被自动触发，被触发到时应核实用户是否真的要求测试。',
  'using-git-worktrees': '【worktree】CLAUDE.md 第 11 节豁免不适用于用户主动调用：用户既然显式调用了本 skill，按 skill 流程执行 worktree 创建，不要再以『豁免』为由跳过。',
  'using-superpowers': '【入口 skill】本 skill 是元提醒。回复前再扫一遍是否有更具体的 superpowers skill 适用（brainstorming/writing-plans/debugging/verification 等），若有应优先 invoke 那个具体 skill 而非停在元 skill。',
  'writing-skills': '【writing-skills】新 skill 完成后必须 dry-run 验证触发条件；frontmatter description 必须写清『何时触发』『何时不触发』，便于 Claude 自动判断。',
};

const msg = `${common} ${specifics[short] ?? ''}`;
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: event,
    additionalContext: msg,
  },
  suppressOutput: true,
}, null, 2));
