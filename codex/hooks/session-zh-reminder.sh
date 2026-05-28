#!/usr/bin/env bash
set -euo pipefail

cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"JSON 工具参数中的中文字段必须直接写汉字，禁止手写 \\uXXXX Unicode 转义。手写 Unicode 容易把相邻码点写错；涉及 request_user_input、update_plan、MCP 工具参数、hook 输出时尤其注意。"}}
JSON
