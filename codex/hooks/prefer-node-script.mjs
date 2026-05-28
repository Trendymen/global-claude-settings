#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const tool = String(input.tool_name ?? input.toolName ?? '');
const toolInput = input.tool_input ?? input.toolInput ?? {};
const haystack = JSON.stringify(toolInput);

let reason = '';

const command = String(toolInput.command ?? toolInput.cmd ?? '');
if (command) {
  if (/(^|[\s;&|]|\$\(\s*)(python3?|pip3?)([\s]|$)/.test(command) || /(^|[\s;&|])[A-Za-z0-9_./-]+\.py([\s]|$)/.test(command)) {
    reason = '检测到 Python 命令调用';
  }
}

const paths = [
  toolInput.file_path,
  toolInput.filePath,
  toolInput.path,
  toolInput.targetPath,
  toolInput.sourcePath,
].filter(Boolean).map(String);

for (const path of paths) {
  const name = basename(path);
  if (/\.(py|pyi|pyx|pyw)$/.test(name)) {
    reason ||= `检测到 Python 源文件 (${name})`;
  }
  if (/^(pyproject\.toml|setup\.py|setup\.cfg|Pipfile|Pipfile\.lock|poetry\.lock|requirements(?:-.+)?\.txt|conda\.ya?ml|environment\.ya?ml)$/.test(name)) {
    reason ||= `检测到 Python 工程文件 (${name})`;
  }
}

if (!reason && /\*\*\* (Add|Update) File: .+\.(py|pyi|pyx|pyw)\b/.test(haystack)) {
  reason = '检测到 patch 中写入 Python 源文件';
}

if (!reason && /\*\*\* (Add|Update) File: .+\/(pyproject\.toml|setup\.py|setup\.cfg|Pipfile|Pipfile\.lock|poetry\.lock|requirements(?:-.+)?\.txt|conda\.ya?ml|environment\.ya?ml)\b/.test(haystack)) {
  reason = '检测到 patch 中写入 Python 工程文件';
}

if (!reason) process.exit(0);

const msg = `[脚本语言优先级] ${reason}。按全局规则，CLI 内联脚本与落盘脚本默认优先 Node ESM JS（node --input-type=module、.mjs 或 type=module 的 .js）；必要时升级为 npm 工程。例外仅限：用户明确指定 Python、当前是在成熟 Python 项目内扩展、或任务强依赖 Python 生态。若例外不成立，请改用 Node；若坚持 Python，请在回复中简述命中的例外。`;

process.stdout.write(JSON.stringify({ systemMessage: msg }));
