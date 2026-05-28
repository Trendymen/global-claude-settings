#!/usr/bin/env node

const msg = 'JSON 工具参数(AskUserQuestion / TaskCreate / TaskUpdate 等)的中文字段必须直接写汉字, 禁止使用 \\uXXXX Unicode 转义。手写 Unicode 易把相邻码点的字写错(如「兜」U+515C 与「兑」U+5151)。';
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: msg,
  },
}));
