#!/usr/bin/env node

const msg = '[Diagnostics 提醒] 检测到文件编辑工具调用。结束本次任务前请优先使用 vscode_mcp_server 检查本次改动文件的 diagnostics；如果 VS Code MCP 不可用，最终回复必须说明已跳过及原因。';
process.stdout.write(JSON.stringify({ systemMessage: msg }));
