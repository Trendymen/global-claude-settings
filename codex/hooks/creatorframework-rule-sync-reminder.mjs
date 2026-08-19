#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getHookCwd,
  isInsideCreatorFramework,
  loadCreatorFrameworkRoot,
  readHookInput,
} from './creatorframework-root.mjs';

export function runCreatorFrameworkRuleSyncReminder({
  rawInput,
  cwd,
  homeDir,
  execute = spawnSync,
  write = process.stdout.write.bind(process.stdout),
  error = process.stderr.write.bind(process.stderr),
} = {}) {
  const root = loadCreatorFrameworkRoot({ homeDir });
  const input = readHookInput(rawInput);
  const hookCwd = cwd ?? getHookCwd(input);
  if (!root || !isInsideCreatorFramework(hookCwd, root)) return 0;

  const target = path.join(root, 'agent-tools', 'hooks', 'check-rule-sync.js');
  if (!existsSync(target)) return 0;

  const result = execute(process.execPath, [target, '--platform=codex'], {
    cwd: root,
    encoding: 'utf8',
    input: rawInput ?? '',
  });
  if (result.stdout) write(result.stdout);
  if (result.stderr) error(result.stderr);
  if (result.error) return 1;
  return typeof result.status === 'number' ? result.status : 1;
}

function main() {
  const rawInput = readFileSync(0, 'utf8');
  process.exitCode = runCreatorFrameworkRuleSyncReminder({ rawInput });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
