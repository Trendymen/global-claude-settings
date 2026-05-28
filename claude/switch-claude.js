#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const home = os.homedir();
const claudeDir = path.join(home, '.claude');
const modeFile = path.join(claudeDir, 'claude-mode.zsh');
const command = process.argv[2];
const CCR_START_TIMEOUT_MS = 15000;

function run(commandName, args = []) {
  return execFileSync(commandName, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function hasCommand(commandName) {
  try {
    run('which', [commandName]);
    return true;
  } catch {
    return false;
  }
}

function isCcrRunning() {
  try {
    return /Status:\s+Running/.test(run('ccr', ['status']));
  } catch {
    return false;
  }
}

function startCcr() {
  if (!hasCommand('ccr')) {
    throw new Error('未找到 ccr 命令，无法切换到 router。');
  }
  if (!isCcrRunning()) {
    const child = spawn('ccr', ['start'], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    const start = Date.now();
    while (Date.now() - start < CCR_START_TIMEOUT_MS) {
      if (isCcrRunning()) {
        return;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }

    throw new Error('CCR 启动超时，请执行 `ccr status` 检查服务状态。');
  }
}

function stopCcr() {
  if (!hasCommand('ccr')) {
    return;
  }
  if (isCcrRunning()) {
    run('ccr', ['stop']);
  }
}

function writeModeFile(mode) {
  fs.mkdirSync(claudeDir, { recursive: true });

  const content = mode === 'router'
    ? [
        '# Managed by ~/.claude/switch-claude.js',
        getRouterEnvScript().trim(),
        'export CLAUDE_RUNTIME_MODE="router"',
        '',
      ].join('\n')
    : [
        '# Managed by ~/.claude/switch-claude.js',
        'unset ANTHROPIC_BASE_URL',
        'unset ANTHROPIC_AUTH_TOKEN',
        'unset ANTHROPIC_MODEL',
        'unset API_TIMEOUT_MS',
        'unset NO_PROXY',
        'unset DISABLE_TELEMETRY',
        'unset DISABLE_COST_WARNINGS',
        'unset CLAUDE_CODE_USE_BEDROCK',
        'export CLAUDE_RUNTIME_MODE="official"',
        '',
      ].join('\n');

  fs.writeFileSync(modeFile, content, 'utf8');
}

function readMode() {
  if (!fs.existsSync(modeFile)) {
    return 'official';
  }

  const content = fs.readFileSync(modeFile, 'utf8');
  const match = content.match(/CLAUDE_RUNTIME_MODE="([^"]+)"/);
  return match ? match[1] : 'official';
}

function getRouterBaseUrl() {
  try {
    const match = getRouterEnvScript().match(/ANTHROPIC_BASE_URL="([^"]+)"/);
    return match ? match[1] : 'http://127.0.0.1:3456';
  } catch {
    return 'http://127.0.0.1:3456';
  }
}

function getRouterEnvScript() {
  try {
    return run('ccr', ['activate']);
  } catch {
    return [
      'export ANTHROPIC_AUTH_TOKEN="test"',
      'export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"',
      'export NO_PROXY="127.0.0.1"',
      'export DISABLE_TELEMETRY="true"',
      'export DISABLE_COST_WARNINGS="true"',
      'export API_TIMEOUT_MS="600000"',
      'unset CLAUDE_CODE_USE_BEDROCK',
      '',
    ].join('\n');
  }
}

function printStatus() {
  const mode = readMode();
  console.log(`Claude mode: ${mode}`);
  if (mode === 'router') {
    console.log(`ANTHROPIC_BASE_URL=${getRouterBaseUrl()}`);
    console.log(`CCR running: ${isCcrRunning() ? 'yes' : 'no'}`);
  } else {
    console.log('ANTHROPIC_BASE_URL=(official default)');
  }
}

function switchOfficial() {
  writeModeFile('official');
  stopCcr();
  console.log('已切换到 Claude 官方订阅模式。');
  console.log('当前 shell 若要立即生效，请执行: source ~/.zshrc');
}

function switchRouter() {
  startCcr();
  writeModeFile('router');
  console.log('已切换到 Claude Code Router 模式。');
  console.log('当前 shell 若要立即生效，请执行: source ~/.zshrc');
}

if (!['official', 'router', 'status'].includes(command)) {
  console.log('用法:');
  console.log('  node ~/.claude/switch-claude.js official');
  console.log('  node ~/.claude/switch-claude.js router');
  console.log('  node ~/.claude/switch-claude.js status');
  process.exit(1);
}

try {
  if (command === 'official') {
    switchOfficial();
  } else if (command === 'router') {
    switchRouter();
  } else {
    printStatus();
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
