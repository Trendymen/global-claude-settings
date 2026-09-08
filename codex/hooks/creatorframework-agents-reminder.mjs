#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  getHookCwd,
  isInsideCreatorFramework,
  loadCreatorFrameworkRoot,
  readHookInput,
} from './creatorframework-root.mjs';

function worktreeRoot(cwd) {
  try {
    const root = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return root ? path.resolve(root) : '';
  } catch {
    return '';
  }
}

export function buildAgentsReminder({ input, homeDir } = {}) {
  const root = loadCreatorFrameworkRoot({ homeDir });
  const cwd = getHookCwd(input);
  const gitRoot = worktreeRoot(cwd);
  const hasLocalAgents = Boolean(gitRoot) && existsSync(path.join(gitRoot, 'AGENTS.local.md'));
  const creatorFramework = Boolean(root) && isInsideCreatorFramework(cwd, root);
  if (!creatorFramework && !hasLocalAgents) return '';

  return [
    creatorFramework ? '[CreatorFramework AGENTS 提醒]' : '[项目 AGENTS 提醒]',
    hasLocalAgents
      ? `当前 worktree 根为 ${gitRoot}；回答或动手前先读取 <当前 worktree 根>/AGENTS.local.md，再读取 <当前 worktree 根>/AGENTS.md。`
      : `当前目录属于 ${root} 项目；回答或动手前先读取 <当前 worktree 根>/AGENTS.local.md（如存在），再读取 <当前 worktree 根>/AGENTS.md。`,
    'AGENTS.local.md 的优先级高于 AGENTS.md；两者冲突时必须按 AGENTS.local.md 执行。',
    '修改或审查文件前，沿当前 worktree 根到目标文件所在目录逐级查找并读取尚未加载的 AGENTS.md，存在 AGENTS.override.md 时按同级覆盖约定处理；新增修改目录、移动文件或扩大审查范围时补查，规则变化后重读。',
    '审查包必须列出覆盖全部待审查文件的适用规则路径及关键约束，包含目录级规则；审查者核对并补读遗漏，不能只列根目录规则。',
    '本 hook 仅作提醒，不拒绝工具调用、不阻断提交、不增加审批；收到提醒不能代替实际读取。',
  ].join(' ');
}

function main() {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    raw = '';
  }
  const input = readHookInput(raw);
  const message = buildAgentsReminder({ input });
  if (message) process.stdout.write(JSON.stringify({ systemMessage: message }));
}

let entryHref = '';
try {
  entryHref = pathToFileURL(realpathSync(process.argv[1])).href;
} catch {
  entryHref = '';
}
if (entryHref && import.meta.url === entryHref) {
  main();
}
