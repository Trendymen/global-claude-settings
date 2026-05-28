#!/usr/bin/env bash
# SessionStart hook: 注入"JSON 中文直接写、禁止 Unicode 转义"的提醒到对话上下文,
# 让 AI 在 AskUserQuestion / TaskCreate 等工具调用时不走 \uXXXX 路径。
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"JSON 工具参数(AskUserQuestion / TaskCreate / TaskUpdate 等)的中文字段必须直接写汉字, 禁止使用 \\uXXXX Unicode 转义。手写 Unicode 易把相邻码点的字写错(如「兜」U+515C 与「兑」U+5151)。"}}
JSON
