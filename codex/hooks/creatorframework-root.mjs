import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export function loadCreatorFrameworkRoot({ homeDir = homedir(), readFile = readFileSync } = {}) {
  try {
    const configPath = path.join(homeDir, '.codex', 'creatorframework.json');
    const config = JSON.parse(readFile(configPath, 'utf8'));
    return typeof config?.root === 'string' && config.root.trim() ? config.root.trim() : '';
  } catch {
    return '';
  }
}

export function readHookInput(rawInput) {
  try {
    return rawInput ? JSON.parse(rawInput) : {};
  } catch {
    return {};
  }
}

export function getHookCwd(input, fallback = process.cwd()) {
  return input?.cwd
    ?? input?.current_working_directory
    ?? input?.currentWorkingDirectory
    ?? input?.project_root
    ?? input?.projectRoot
    ?? fallback;
}

export function isInsideCreatorFramework(cwd, root, { platform = process.platform } = {}) {
  if (typeof cwd !== 'string' || typeof root !== 'string' || !root) return false;

  const pathApi = platform === 'win32' ? path.win32 : path;
  const normalizedCwd = pathApi.resolve(cwd);
  const normalizedRoot = pathApi.resolve(root);
  const comparableCwd = platform === 'win32' ? normalizedCwd.toLowerCase() : normalizedCwd;
  const comparableRoot = platform === 'win32' ? normalizedRoot.toLowerCase() : normalizedRoot;
  const relative = pathApi.relative(comparableRoot, comparableCwd);
  return relative === '' || (!relative.startsWith('..') && !pathApi.isAbsolute(relative));
}
