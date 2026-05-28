#!/usr/bin/env node

const msg = '[Diagnostics 提醒] 代码已修改。结束本次任务前请使用 mcp__vscode_mcp_server__* 检查本次改动文件的 diagnostics（CLAUDE.md Diagnostics 校验规则）。若 vscode-mcp-server 不可用，需在最终回复中明确说明已跳过及原因。';
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: msg,
  },
  suppressOutput: true,
}));
