#!/usr/bin/env bash
# ask-user-question-validator.sh
#
# PreToolUse hook：在 AskUserQuestion 调用瞬间校验输入质量，注入针对性提醒。
# 检查点：
#   1. 单选题（multiSelect:false）的第一个 option label 是否含"推荐"二字
#   2. option.description 长度是否过短（< 15 字符可能没解释 trade-off）
#   3. 互斥度不明显的题目是否漏开 multiSelect（启发式：选项含"和/与/、/+"等并列符号）
#   4. options 是否 < 2（schema 已限制，但兜底）
#
# 输出 hookSpecificOutput.additionalContext，不阻断（permissionDecision: allow）。

set -euo pipefail

INPUT=$(cat)
QUESTIONS=$(echo "$INPUT" | jq -c '.tool_input.questions // []')

# 没问题就静默放行
if [ "$QUESTIONS" = "[]" ] || [ -z "$QUESTIONS" ]; then
  exit 0
fi

# 遍历每道题
echo "$QUESTIONS" | jq -c '.[]' | while IFS= read -r Q; do
  Q_TEXT=$(echo "$Q" | jq -r '.question // ""' | head -c 40)
  MULTI=$(echo "$Q" | jq -r '.multiSelect // false')
  FIRST_LABEL=$(echo "$Q" | jq -r '.options[0].label // ""')

  # 检查1：单选题首项推荐标记
  if [ "$MULTI" = "false" ]; then
    if ! echo "$FIRST_LABEL" | grep -q "推荐\|(Recommended)\|（推荐）"; then
      echo "[校验] 题目「${Q_TEXT}...」首个 option 「${FIRST_LABEL}」缺少『（推荐）』标记 — CLAUDE.md 要求单选题第一项 label 末尾加（推荐）"
    fi
  fi

  # 检查2：description 过短
  SHORT_DESC=$(echo "$Q" | jq -r '[.options[] | select((.description // "" | length) < 15) | .label] | join("、")')
  if [ -n "$SHORT_DESC" ] && [ "$SHORT_DESC" != "" ]; then
    echo "[校验] 题目「${Q_TEXT}...」option 「${SHORT_DESC}」的 description 过短 — 应解释 trade-off / 适用场景 / 代价，而不是重复 label"
  fi

  # 检查3：可能漏开 multiSelect（启发式）
  if [ "$MULTI" = "false" ]; then
    PARALLEL_HINT=$(echo "$Q" | jq -r '.question // ""' | grep -cE "哪些|多个|多项|启用.*功能|采纳.*建议" || true)
    if [ "$PARALLEL_HINT" -gt 0 ]; then
      echo "[校验] 题目「${Q_TEXT}...」题面含「哪些/多个/多项」等并列语义 — 是否应开 multiSelect:true？"
    fi
  fi
done > /tmp/aq-warnings-$$.txt

WARN_TEXT=$(cat /tmp/aq-warnings-$$.txt 2>/dev/null || true)
rm -f /tmp/aq-warnings-$$.txt

if [ -z "$WARN_TEXT" ]; then
  # 通过：静默放行
  exit 0
fi

MSG="[AskUserQuestion 输入校验提醒]
${WARN_TEXT}

参考 CLAUDE.md「用户提问统一走 AskUserQuestion 规则」第 3-5 条。如果是有意为之可忽略；如果是疏漏请重新发起调用修正。"

jq -n --arg msg "$MSG" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "allow",
    permissionDecisionReason: $msg,
    additionalContext: $msg
  },
  suppressOutput: false
}'
