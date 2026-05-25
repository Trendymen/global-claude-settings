#!/usr/bin/env bash
# prefer-node-script.sh
#
# PreToolUse hook：当 AI 试图用 Python 写脚本/装 Python 依赖/写 Python 项目文件时，
# 注入 system-reminder 提醒优先用 Node ESM JS 实现。不阻断。
#
# 触发条件（任一即触发）：
#   - Bash: command 启动 python/python3/pip/pip3，或包含 -m/-c 启动，或运行 *.py
#   - Write|Edit|MultiEdit: file_path 后缀属于 Python 生态
#
# 共用入口，由 tool_name 分派。matcher 在 settings.json 里设。

set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')

REASON=""

case "$TOOL" in
  Bash)
    CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
    # 命令以 python/python3/pip/pip3 起头（含管道/&&/; 分隔后的子命令），或者 python -m/-c 调用，或者运行 .py 文件
    if echo "$CMD" | grep -qE '(^|[[:space:];&|]|\$\(\s*)(python3?|pip3?)([[:space:]]|$)' \
       || echo "$CMD" | grep -qE '(^|[[:space:];&|])[A-Za-z0-9_./-]*\.py([[:space:]]|$)'
    then
      REASON="检测到 Python 命令调用"
    fi
    ;;
  Write|Edit|MultiEdit)
    FP=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')
    BN=$(basename "$FP" 2>/dev/null || echo "")
    case "$BN" in
      *.py|*.pyi|*.pyx|*.pyw)
        REASON="检测到 Python 源文件 ($BN)"
        ;;
      pyproject.toml|setup.py|setup.cfg|Pipfile|Pipfile.lock|poetry.lock|requirements.txt|requirements-*.txt|conda.yml|conda.yaml|environment.yml|environment.yaml)
        REASON="检测到 Python 工程文件 ($BN)"
        ;;
    esac
    ;;
esac

if [ -z "$REASON" ]; then
  exit 0
fi

MSG="[脚本语言优先级] ${REASON}。按全局规则：CLI 短期内联脚本与落盘脚本默认优先 Node ESM JS（.mjs 或 \"type\":\"module\" 的 .js）；必要时升级为 npm 工程（package.json + src/）。例外仅限：① 用户明确指定 Python；② 当前已在成熟 Python 项目中扩展功能；③ 任务强依赖 Python 生态（PyTorch/Pandas/Scrapy/特定科学计算库等）。若例外不成立，请改用 Node 实现并向用户简述切换理由。"

jq -nc --arg msg "$MSG" '{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": $msg
  },
  "suppressOutput": true
}'
