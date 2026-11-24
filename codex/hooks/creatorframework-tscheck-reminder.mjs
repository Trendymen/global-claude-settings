#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

import {
  getHookCwd,
  isInsideCreatorFramework,
  loadCreatorFrameworkRoot,
  readHookInput,
} from './creatorframework-root.mjs';

function collectEditedPaths(value, key = '', paths = []) {
  if (typeof value === 'string') {
    if (/(?:file|path|source|target|destination)/i.test(key)) paths.push(value);

    const patchFilePattern = /^\*\*\* (?:Add|Update|Delete) File:\s*(.+?)\s*$/gm;
    let match;
    while ((match = patchFilePattern.exec(value)) !== null) paths.push(match[1]);
    return paths;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectEditedPaths(item, key, paths);
    return paths;
  }

  if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectEditedPaths(childValue, childKey, paths);
    }
  }

  return paths;
}

export function hasTypeScriptEdit(input) {
  const toolInput = input?.tool_input ?? input?.toolInput ?? {};
  return collectEditedPaths(toolInput).some(filePath => /\.ts$/i.test(filePath.trim()));
}

function gitCommonDir(cwd) {
  if (typeof cwd !== 'string' || !cwd) return '';
  let actualCwd;
  try {
    actualCwd = realpathSync.native(cwd);
  } catch {
    return '';
  }
  const result = spawnSync('git', ['rev-parse', '--git-common-dir'], {
    cwd: actualCwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_DIR: undefined, GIT_COMMON_DIR: undefined, GIT_WORK_TREE: undefined },
    timeout: 1000,
    windowsHide: true,
  });
  const commonDir = result.status === 0 ? result.stdout.trim() : '';
  if (!commonDir) return '';
  try {
    return realpathSync.native(path.resolve(actualCwd, commonDir));
  } catch {
    return '';
  }
}

function sharesGitCommonDir(cwd, root) {
  const commonDir = gitCommonDir(cwd);
  if (!commonDir) return false;
  const projectCommonDir = gitCommonDir(root);
  return Boolean(projectCommonDir) && path.relative(projectCommonDir, commonDir) === '';
}

export function buildCreatorFrameworkTscheckReminder({ input, homeDir } = {}) {
  const root = loadCreatorFrameworkRoot({ homeDir });
  if (!root || !hasTypeScriptEdit(input)) return '';
  const cwd = getHookCwd(input);
  if (!isInsideCreatorFramework(cwd, root) && !sharesGitCommonDir(cwd, root)) return '';

  return '[tscheck 提醒] 检测到 CreatorFramework 的 TypeScript 文件编辑。结束任务前运行 `node agent-tools/tscheck.mjs --changed`；如需裁剪输出，使用 `--tail=30`。如果 `--changed` 命中 0 个文件，改用显式文件路径检查。';
}

function main() {
  const message = buildCreatorFrameworkTscheckReminder({
    input: readHookInput(readFileSync(0, 'utf8')),
  });
  if (message) process.stdout.write(JSON.stringify({ systemMessage: message }));
}

main();
