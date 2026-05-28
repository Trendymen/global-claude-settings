#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

const tool = String(input.tool_name ?? input.toolName ?? '');
const toolInput = input.tool_input ?? input.toolInput ?? {};
let reason = '';

if (tool === 'Bash') {
  const command = String(toolInput.command ?? toolInput.cmd ?? '');
  if (/(^|[\s;&|]|\$\(\s*)(python3?|pip3?)([\s]|$)/.test(command) || /(^|[\s;&|])[A-Za-z0-9_./-]*\.py([\s]|$)/.test(command)) {
    reason = '检测到 Python 命令调用';
  }
}

if (['Write', 'Edit', 'MultiEdit'].includes(tool)) {
  const path = String(toolInput.file_path ?? toolInput.filePath ?? '');
  const name = basename(path);
  if (/\.(py|pyi|pyx|pyw)$/.test(name)) {
    reason = `检测到 Python 源文件 (${name})`;
  } else if (/^(pyproject\.toml|setup\.py|setup\.cfg|Pipfile|Pipfile\.lock|poetry\.lock|requirements(?:-.+)?\.txt|conda\.ya?ml|environment\.ya?ml)$/.test(name)) {
    reason = `检测到 Python 工程文件 (${name})`;
  }
}

if (!reason) process.exit(0);

const msg = `[脚本语言优先级] ${reason}。按全局规则：CLI 短期内联脚本与落盘脚本默认优先 Node ESM JS（.mjs 或 "type":"module" 的 .js）；必要时升级为 npm 工程（package.json + src/）。例外仅限：① 用户明确指定 Python；② 当前已在成熟 Python 项目中扩展功能；③ 任务强依赖 Python 生态（PyTorch/Pandas/Scrapy/特定科学计算库等）。若例外不成立，请改用 Node 实现并向用户简述切换理由。`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    additionalContext: msg,
  },
  suppressOutput: true,
}));
