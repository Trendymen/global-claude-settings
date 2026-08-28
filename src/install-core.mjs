import path from 'node:path';

const RESTORE_ENTRIES = ['AGENTS.md', 'config.toml', 'agents', 'hooks'];
const PULL_ENTRIES = ['AGENTS.md', 'agents', 'hooks'];

export class CliUsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CliUsageError';
    this.exitCode = 2;
  }
}

function usageError(message) {
  return new CliUsageError(message);
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw usageError(`${name} 不能为空`);
  }
  return value;
}

function validateInstallArgs(args) {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw usageError('args 必须是对象');
  }
  if (args.mode !== 'restore' && args.mode !== 'pull') {
    throw usageError('args.mode 必须是 restore 或 pull');
  }
  if (typeof args.dryRun !== 'boolean') {
    throw usageError('args.dryRun 必须是 boolean');
  }
  if (typeof args.noOverwrite !== 'boolean') {
    throw usageError('args.noOverwrite 必须是 boolean');
  }
  if (args.creatorFrameworkPath !== undefined) {
    requireString(args.creatorFrameworkPath, 'args.creatorFrameworkPath');
  }
  if (args.mode === 'pull' && args.creatorFrameworkPath !== undefined) {
    throw usageError('--creatorframework-path 不能与 --pull-from-home 同时使用');
  }
  return args;
}

function normalizeWindowsAbsolutePath(value, name) {
  const isDriveAbsolute = /^[A-Za-z]:[\\/]/.test(value);
  const isUnc = /^(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+/.test(value);
  if (!isDriveAbsolute && !isUnc) {
    throw usageError(`${name} 必须是 Windows 盘符或 UNC 绝对路径`);
  }
  return path.win32.normalize(value);
}

function normalizeAbsolutePath(platform, value, name) {
  requireString(value, name);
  if (platform === 'win32') return normalizeWindowsAbsolutePath(value, name);
  if (platform === 'darwin') {
    if (!path.posix.isAbsolute(value)) {
      throw usageError(`${name} 必须是 macOS POSIX 绝对路径`);
    }
    return path.posix.normalize(value);
  }
  throw usageError(`仅支持 darwin 与 win32 平台，收到: ${platform}`);
}

function targetPath(platform, ...segments) {
  const implementation = platform === 'win32' ? path.win32 : path.posix;
  const joined = implementation.join(...segments);
  return platform === 'win32' ? joined.replaceAll('\\', '/') : joined;
}

function formatBackupTimestamp(value) {
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new TypeError('fileState.timestamp 必须是有效的 Date、ISO 时间或数字时间戳');
  }
  return date.toISOString().replace(/[-:.TZ]/g, '');
}

function pathExists(fileState, target) {
  const paths = fileState?.paths;
  if (paths instanceof Set) return paths.has(target);
  if (Array.isArray(paths)) return paths.includes(target);
  if (paths instanceof Map) return Boolean(paths.get(target));
  if (paths && typeof paths === 'object') {
    const state = paths[target];
    return typeof state === 'object' && state !== null ? Boolean(state.exists) : Boolean(state);
  }
  return false;
}

function makeAction(type, entry) {
  if (entry.content !== undefined) {
    return { type, target: entry.target, content: entry.content };
  }
  const action = { type, source: entry.source, target: entry.target };
  if (entry.template) action.transform = 'render-codex-config';
  return action;
}

export function parseCliArgs(argv) {
  if (!Array.isArray(argv)) throw usageError('参数必须是数组');

  const args = {
    mode: 'restore',
    dryRun: false,
    noOverwrite: false,
  };
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (typeof arg !== 'string') throw usageError('参数必须是字符串');
    if (seen.has(arg)) throw usageError(`参数重复指定: ${arg}`);

    switch (arg) {
      case '--pull-from-home':
        seen.add(arg);
        args.mode = 'pull';
        break;
      case '--dry-run':
        seen.add(arg);
        args.dryRun = true;
        break;
      case '--no-overwrite':
        seen.add(arg);
        args.noOverwrite = true;
        break;
      case '--creatorframework-path': {
        seen.add(arg);
        const value = argv[index + 1];
        if (value === undefined) {
          throw usageError('--creatorframework-path 缺少参数值');
        }
        if (typeof value !== 'string') {
          throw usageError('--creatorframework-path 参数值必须是字符串');
        }
        if (value.trim().length === 0) throw usageError('--creatorframework-path 参数不能为空');
        if (value.startsWith('--')) throw usageError('--creatorframework-path 缺少参数值');
        args.creatorFrameworkPath = value;
        index += 1;
        break;
      }
      default:
        throw usageError(`未知参数: ${arg}`);
    }
  }

  if (args.mode === 'pull' && args.creatorFrameworkPath !== undefined) {
    throw usageError('--creatorframework-path 不能与 --pull-from-home 同时使用');
  }
  return args;
}

export function renderCodexConfig(template, codexHome) {
  return template.replaceAll('{{CODEX_HOME}}', codexHome.replaceAll('\\', '/'));
}

export function buildInstallIntent({ platform, homeDir, repoRoot, args }) {
  validateInstallArgs(args);
  if (platform !== 'darwin' && platform !== 'win32') {
    throw usageError(`仅支持 darwin 与 win32 平台，收到: ${platform}`);
  }
  requireString(repoRoot, 'repoRoot');
  const normalizedHome = normalizeAbsolutePath(platform, homeDir, 'homeDir');
  const codexHome = targetPath(platform, normalizedHome, '.codex');
  const sourceRoot = targetPath(platform, repoRoot, 'codex');
  const targetRoot = codexHome;
  const entries = (args.mode === 'pull' ? PULL_ENTRIES : RESTORE_ENTRIES).map((name) => ({
    name,
    source: args.mode === 'pull' ? targetPath(platform, targetRoot, name) : targetPath(platform, sourceRoot, name),
    target: args.mode === 'pull' ? targetPath(platform, sourceRoot, name) : targetPath(platform, targetRoot, name),
    template: name === 'config.toml',
  }));

  let creatorFrameworkRoot;
  let creatorFrameworkPath;
  if (args.creatorFrameworkPath !== undefined) {
    creatorFrameworkRoot = normalizeAbsolutePath(
      platform,
      args.creatorFrameworkPath,
      '--creatorframework-path',
    );
    creatorFrameworkPath = targetPath(platform, codexHome, 'creatorframework.json');
    entries.push({
      name: 'creatorframework.json',
      target: creatorFrameworkPath,
      content: `${JSON.stringify({ root: creatorFrameworkRoot }, null, 2)}\n`,
    });
  }

  return {
    platform,
    mode: args.mode,
    dryRun: args.dryRun,
    noOverwrite: args.noOverwrite,
    repoRoot,
    homeDir: platform === 'win32' ? normalizedHome.replaceAll('\\', '/') : normalizedHome,
    codexHome,
    sourceRoot,
    targetRoot,
    creatorFrameworkRoot,
    creatorFrameworkPath,
    entries,
  };
}

export function resolveFilePlan(intent, fileState) {
  const plan = [];
  const timestamp = formatBackupTimestamp(fileState?.timestamp);

  for (const entry of intent.entries) {
    const targetExists = pathExists(fileState, entry.target);
    if (intent.noOverwrite && targetExists) {
      plan.push({ ...makeAction('skip', entry), reason: 'target-exists' });
      continue;
    }

    if (intent.mode === 'restore' && targetExists) {
      let sequence = 1;
      let backup;
      do {
        backup = `${entry.target}.before-restore-${timestamp}-${sequence}`;
        sequence += 1;
      } while (pathExists(fileState, backup));
      plan.push({ type: 'backup', from: entry.target, to: backup });
    }

    plan.push(makeAction('write', entry));
  }

  return plan;
}
