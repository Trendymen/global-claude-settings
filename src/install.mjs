#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homeDir = os.homedir();
const sourceHome = process.env.GLOBAL_SETTINGS_SOURCE_HOME ?? '/Users/liuzhuo';
const dryRun = process.argv.includes('--dry-run');
const noOverwrite = process.argv.includes('--no-overwrite');
const pullMode = process.argv.includes('--pull-from-home');
const restoreMode = !pullMode;
const help = process.argv.includes('-h') || process.argv.includes('--help');

const configs = [
  {
    name: 'Claude',
    repoDir: path.join(repoRoot, 'claude'),
    homeDir: path.join(homeDir, '.claude'),
    entries: [
      'CLAUDE.md',
      'settings.json',
      'settings.local.json',
      'claude-mode.zsh',
      'switch-claude.js',
      'agents',
      'hooks',
      'skills',
      'plugins/installed_plugins.json',
      'plugins/known_marketplaces.json',
    ],
  },
  {
    name: 'Codex',
    repoDir: path.join(repoRoot, 'codex'),
    homeDir: path.join(homeDir, '.codex'),
    entries: ['AGENTS.md', 'config.toml', 'hooks'],
  },
];

function log(message) {
  console.log(`[install] ${message}`);
}

function usage() {
  console.log(`Usage:
  node install.mjs                  Restore repo -> home
  node install.mjs --pull-from-home Pull current home config -> repo
  node install.mjs --no-overwrite   Restore without replacing existing files
  node install.mjs --dry-run        Print actions without changing files`);
}

function run(label, fn) {
  if (dryRun) {
    log(`[dry-run] ${label}`);
    return;
  }
  fn();
}

function ensureDir(dir) {
  run(`mkdir -p ${dir}`, () => fs.mkdirSync(dir, { recursive: true }));
}

function backupIfNeeded(target) {
  if (!fs.existsSync(target) || noOverwrite) return !fs.existsSync(target);
  if (!fs.statSync(target).isFile()) return true;
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const backup = `${target}.before-restore-${stamp}`;
  run(`backup ${target} -> ${backup}`, () => fs.copyFileSync(target, backup));
  return true;
}

function shouldCopyHook(src) {
  const base = path.basename(src);
  return !base.includes('.bak-');
}

function transformContent(relative, content) {
  if (relative !== 'config.toml') return content;
  const homeForToml = homeDir.split(path.sep).join('/');
  return content.split(sourceHome).join(homeForToml);
}

function copyFile(source, target, relative) {
  if (!fs.existsSync(source)) {
    log(`跳过（源不存在）: ${source}`);
    return;
  }
  if (noOverwrite && fs.existsSync(target)) {
    log(`跳过（目标已存在 + --no-overwrite）: ${target}`);
    return;
  }
  ensureDir(path.dirname(target));
  if (restoreMode) backupIfNeeded(target);
  run(`copy ${source} -> ${target}`, () => {
    const text = fs.readFileSync(source, 'utf8');
    fs.writeFileSync(target, transformContent(relative, text));
    fs.chmodSync(target, fs.statSync(source).mode);
  });
  log(`已写入: ${target}`);
}

function copyDirectory(source, target, entry) {
  if (!fs.existsSync(source)) {
    log(`跳过（源不存在）: ${source}`);
    return;
  }
  if (noOverwrite && fs.existsSync(target)) {
    log(`跳过（目标已存在 + --no-overwrite）: ${target}`);
    return;
  }
  ensureDir(path.dirname(target));
  run(`sync dir ${source} -> ${target}`, () => {
    fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(source, target, {
      recursive: true,
      filter: entry === 'hooks' ? shouldCopyHook : undefined,
    });
    if (entry === 'skills') {
      fs.mkdirSync(target, { recursive: true });
      fs.closeSync(fs.openSync(path.join(target, '.gitkeep'), 'a'));
    }
  });
  log(`已写入: ${target}`);
}

function copyEntry(sourceRoot, targetRoot, entry) {
  const source = path.join(sourceRoot, entry);
  const target = path.join(targetRoot, entry);
  if (fs.existsSync(source) && fs.statSync(source).isDirectory()) {
    copyDirectory(source, target, entry);
  } else {
    copyFile(source, target, entry);
  }
}

function pullEntries(config) {
  for (const entry of config.entries) {
    copyEntry(config.homeDir, config.repoDir, entry);
  }
}

function restoreEntries(config) {
  ensureDir(config.homeDir);
  for (const entry of config.entries) {
    copyEntry(config.repoDir, config.homeDir, entry);
  }
}

function pullClaudeMcp() {
  const source = path.join(homeDir, '.claude.json');
  const target = path.join(repoRoot, 'claude', 'mcp-user-scope.json');
  if (!fs.existsSync(source)) return;
  run(`extract mcpServers ${source} -> ${target}`, () => {
    const data = JSON.parse(fs.readFileSync(source, 'utf8'));
    ensureDir(path.dirname(target));
    fs.writeFileSync(target, `${JSON.stringify({ mcpServers: data.mcpServers ?? {} }, null, 2)}\n`);
  });
  log(`已刷新: ${target}`);
}

function restoreClaudeMcp() {
  const source = path.join(repoRoot, 'claude', 'mcp-user-scope.json');
  const target = path.join(homeDir, '.claude.json');
  if (!fs.existsSync(source)) return;
  run(`merge mcpServers ${source} -> ${target}`, () => {
    const current = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : {};
    const incoming = JSON.parse(fs.readFileSync(source, 'utf8'));
    fs.writeFileSync(target, `${JSON.stringify({ ...current, ...incoming }, null, 2)}\n`);
  });
  log(`已合并 MCP user-scope: ${target}`);
}

if (help) {
  usage();
  process.exit(0);
}

if (pullMode) {
  log('模式: pull (home -> repo)');
  configs.forEach(pullEntries);
  pullClaudeMcp();
  log('完成。建议接着跑: git status && git diff');
} else {
  log('模式: restore (repo -> home)');
  configs.forEach(restoreEntries);
  restoreClaudeMcp();
  if (process.platform === 'win32') {
    log('Windows 提醒：shell hook 需要 Git Bash 或改成 Node hook；Codex config.toml 里的应用内置路径可能还需按本机安装位置调整。');
  }
  log('完成。');
}
