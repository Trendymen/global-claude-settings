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
