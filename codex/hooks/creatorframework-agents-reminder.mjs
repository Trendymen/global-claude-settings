#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import {
  getHookCwd,
  isInsideCreatorFramework,
  loadCreatorFrameworkRoot,
  readHookInput,
} from './creatorframework-root.mjs';

export function buildCreatorFrameworkAgentsReminder({ input, homeDir } = {}) {
  const root = loadCreatorFrameworkRoot({ homeDir });
  const cwd = getHookCwd(input);
  if (!root || !isInsideCreatorFramework(cwd, root)) return '';

  return [
    '[CreatorFramework AGENTS 提醒]',
    `当前目录属于 ${root} 项目；回答或动手前先读取 <当前 worktree 根>/AGENTS.local.md（如存在），再读取 <当前 worktree 根>/AGENTS.md。`,
    'AGENTS.local.md 的优先级高于 AGENTS.md；两者冲突时必须按 AGENTS.local.md 执行。',
  ].join(' ');
}

function main() {
  const message = buildCreatorFrameworkAgentsReminder({
    input: readHookInput(readFileSync(0, 'utf8')),
  });
  if (message) process.stdout.write(JSON.stringify({ systemMessage: message }));
}

main();
