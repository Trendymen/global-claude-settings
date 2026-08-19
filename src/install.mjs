import defaultFs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CliUsageError,
  buildInstallIntent,
  parseCliArgs,
  renderCodexConfig,
  resolveFilePlan,
} from './install-core.mjs';

const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function formatTimestamp(value) {
  return value.toISOString().replace(/[-:.TZ]/g, '');
}

function fileExists(fs, target) {
  return fs.existsSync(target);
}

/**
 * Read only the paths needed to derive a deterministic write plan.
 * This must remain free of mkdir, copy, rename and write operations.
 */
export function collectFileState({ fs = defaultFs, intent, now = new Date() }) {
  const timestamp = formatTimestamp(now);
  const paths = {};
  const sources = {};

  for (const entry of intent.entries) {
    if (entry.source !== undefined) {
      const exists = fileExists(fs, entry.source);
      sources[entry.source] = exists
        ? { exists: true, isDirectory: fs.statSync(entry.source).isDirectory() }
        : { exists: false };
    }

    if (!fileExists(fs, entry.target)) continue;
    paths[entry.target] = { exists: true, isDirectory: fs.statSync(entry.target).isDirectory() };

    if (intent.mode !== 'restore' || intent.noOverwrite) continue;
    let sequence = 1;
    while (true) {
      const backup = `${entry.target}.before-restore-${timestamp}-${sequence}`;
      if (!fileExists(fs, backup)) break;
      paths[backup] = { exists: true, isDirectory: fs.statSync(backup).isDirectory() };
      sequence += 1;
    }
  }

  return { timestamp, paths, sources };
}

function resolveExecutionPlan(intent, fileState) {
  const sourceMissingEntries = new Map(
    intent.entries
      .filter((entry) => entry.source !== undefined && !fileState.sources[entry.source]?.exists)
      .map((entry) => [entry.target, entry]),
  );
  if (sourceMissingEntries.size === 0) return resolveFilePlan(intent, fileState);

  const skippedTargets = new Set();
  return resolveFilePlan(intent, fileState).flatMap((action) => {
    const entry = sourceMissingEntries.get(action.type === 'backup' ? action.from : action.target);
    if (entry === undefined) return [action];
    if (action.type === 'backup') return [];
    if (skippedTargets.has(entry.target)) return [];
    skippedTargets.add(entry.target);
    return [{ type: 'skip', source: entry.source, target: entry.target, reason: 'source-missing' }];
  });
}

function log(io, message) {
  if (typeof io?.log === 'function') io.log(`[install] ${message}`);
}

function actionLabel(action) {
  if (action.type === 'backup') return `backup ${action.from} -> ${action.to}`;
  if (action.type === 'skip') return `skip ${action.target} (${action.reason})`;
  return `write ${action.source ?? 'inline content'} -> ${action.target}`;
}

export function printPlan(plan, io = console) {
  for (const action of plan) log(io, `[dry-run] ${actionLabel(action)}`);
  return plan;
}

function ensureParentDirectory(fs, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
}

function removeExistingTarget(fs, target) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

function writeAction(action, fs) {
  if (action.content !== undefined) {
    ensureParentDirectory(fs, action.target);
    fs.writeFileSync(action.target, action.content);
    return true;
  }

  if (!fs.existsSync(action.source)) return false;
  const sourceState = fs.statSync(action.source);
  ensureParentDirectory(fs, action.target);
  removeExistingTarget(fs, action.target);
  if (sourceState.isDirectory()) {
    fs.cpSync(action.source, action.target, { recursive: true });
    return true;
  }

  if (action.transform === 'render-codex-config') {
    fs.writeFileSync(action.target, renderCodexConfig(fs.readFileSync(action.source, 'utf8'), path.dirname(action.target)));
  } else {
    fs.copyFileSync(action.source, action.target);
  }
  fs.chmodSync(action.target, sourceState.mode);
  return true;
}

export function executePlan(plan, fs = defaultFs, io = console) {
  const sourceMissingTargets = new Set();
  for (let index = 0; index < plan.length; index += 1) {
    const action = plan[index];
    if (action.type === 'skip') {
      log(io, `跳过: ${action.target}`);
      continue;
    }
    if (action.type === 'backup') {
      const writeActionAfterBackup = plan[index + 1];
      if (writeActionAfterBackup?.type === 'write'
        && writeActionAfterBackup.target === action.from
        && writeActionAfterBackup.source !== undefined
        && !fs.existsSync(writeActionAfterBackup.source)) {
        sourceMissingTargets.add(action.from);
        log(io, `跳过: ${action.from} (source-missing)`);
        continue;
      }
      ensureParentDirectory(fs, action.to);
      fs.renameSync(action.from, action.to);
      log(io, `已备份: ${action.from} -> ${action.to}`);
      continue;
    }
    if (sourceMissingTargets.has(action.target)) continue;
    if (writeAction(action, fs)) log(io, `已写入: ${action.target}`);
    else log(io, `跳过: ${action.target} (source-missing)`);
  }
  return plan;
}

export function runInstall({
  platform,
  homeDir,
  repoRoot,
  argv = [],
  io = console,
  fs = defaultFs,
  now = () => new Date(),
} = {}) {
  const args = parseCliArgs(argv);
  const intent = buildInstallIntent({ platform, homeDir, repoRoot, args });
  const fileState = collectFileState({ fs, intent, now: now() });
  const plan = resolveExecutionPlan(intent, fileState);
  if (args.dryRun) return printPlan(plan, io);
  return executePlan(plan, fs, io);
}

export function printUsage(io = console) {
  const usage = `Usage:
  node install.mjs [--creatorframework-path <absolute-path>]
  node install.mjs --pull-from-home [--no-overwrite] [--dry-run]
  node install.mjs --no-overwrite
  node install.mjs --dry-run

仅恢复 Codex 的 AGENTS.md、config.toml、agents/ 和 hooks/。`;
  if (typeof io?.log === 'function') io.log(usage);
}

export function runCli({
  argv = process.argv.slice(2),
  platform = process.platform,
  homeDir = os.homedir(),
  repoRoot = DEFAULT_REPO_ROOT,
  io = console,
  fs = defaultFs,
  now = () => new Date(),
} = {}) {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
    printUsage(io);
    return 0;
  }

  try {
    runInstall({ platform, homeDir, repoRoot, argv, io, fs, now });
    return 0;
  } catch (error) {
    if (error instanceof CliUsageError) {
      if (typeof io?.error === 'function') io.error(`[install] 参数错误: ${error.message}`);
      return error.exitCode;
    }
    throw error;
  }
}
