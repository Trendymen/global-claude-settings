#!/usr/bin/env bash
# stop-detect-text-question.sh
#
# Stop hook：AI 结束回复时，扫描最后一条 assistant 消息文本，
# 若发现「纯文本 2-4 选项提问」模式（应改用 AskUserQuestion），通过
# decision="block" + reason 强制 AI 在下一轮自我纠正、改用 AskUserQuestion。
#
# 检测路径（多重证据降误报）：
#   1. 必须以问号结尾（中文 ？/ 英文 ?）
#   2. regex 模式 A/B/C/E 命中（『A 还是 B？』、编号列表、短划线列表、表格选项，2-4 项）
#   3. regex 全 miss → AI fallback：调 Haiku 4.5 二次判别（已收紧标准）
#
# 2026-05-19 调整：删掉模式 D/F（单句"X 吗?"、叠词反问"要不要/能不能"），
# 它们把太多收尾礼貌句误判成决策提问，反向助长 AskUserQuestion 滥用。
# AI fallback prompt 也收紧——只 VIOLATE 真·多选项决策，不抓单一 yes/no 礼貌句。
#
# 关键工程细节：
#   - LC_ALL=C 走字节级处理，绕过 BSD tr/grep 在 zh_CN.UTF-8 locale 下
#     遇到 tail -c 切断 UTF-8 字符产生 orphan bytes 的 "Illegal byte sequence"
#   - jq 取「最后一条含 text 的 assistant entry」（Claude Code 单 turn 拆
#     thinking/text/tool_use 多 entry，直接 last 常拿到 tool_use 空文本）
#   - export CLAUDE_CODE_HOOK_INTERNAL=1 防 claude --print 子 session 递归
#   - perl alarm 5s 兜底（macOS 默认无 timeout 命令，perl 是默认 shipped）

set -euo pipefail

# 防 claude --print 子 session 递归触发本 hook
if [ "${CLAUDE_CODE_HOOK_INTERNAL:-0}" = "1" ]; then
  exit 0
fi

INPUT=$(cat)

# Race fix: Stop hook 触发早于 Claude Code 把当前 turn 最后的 text entry
# 刷到 transcript jsonl 文件。直接读会拿到 stale 的上一次含 text 的 entry。
# 等 500ms 给 transcript flush 一点时间。
sleep 0.5
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // ""')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

# 防递归：hook 触发的 stop 已经在跑
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  exit 0
fi

# 2026-05-19 用户调整: 只在 superpowers skill 上下文里抓选项提问。
# 常规对话/非 superpowers skill 的 2-4 项列表问句不再强转 AskUserQuestion (用户偏好直接给方案 + 让 user 自由文本反馈)。
# 判断当前是否在 superpowers skill: 看 transcript 最后一条 user message 之后, 是否有 Skill tool_use 调用且 skill 名以 "superpowers:" 开头。
IS_SUPERPOWERS_TURN=$(tail -n 300 "$TRANSCRIPT_PATH" \
  | jq -rs '
    . as $all
    | ($all | map(.type == "user") | (length - 1 - (reverse | index(true) // 0))) as $u
    | if ($all | map(.type == "user") | any) then $all[$u:] else $all end
    | map(select(.type == "assistant"))
    | [.[] | .message.content[]? | select(.type == "tool_use" and .name == "Skill" and ((.input.skill // "") | startswith("superpowers:")))]
    | length
  ' 2>/dev/null || echo 0)

if [ "${IS_SUPERPOWERS_TURN:-0}" -eq 0 ]; then
  exit 0
fi

# 取最后一条「含 text 内容」的 assistant 消息
LAST_TEXT=$(tail -n 200 "$TRANSCRIPT_PATH" \
  | jq -rs 'map(select(.type == "assistant" and ((.message.content // []) | any(.type == "text")))) | last | .message.content | map(select(.type == "text") | .text) | join("\n")' 2>/dev/null || echo "")

if [ -z "$LAST_TEXT" ] || [ "$LAST_TEXT" = "null" ]; then
  exit 0
fi

# 去掉代码块（``` 包裹），避免误判代码里的列举
STRIPPED=$(echo "$LAST_TEXT" | awk '
  BEGIN { in_code = 0 }
  /^```/ { in_code = !in_code; next }
  !in_code { print }
')

# 必须以问号结尾才算「提问」（LC_ALL=C 走字节级）
LAST_LINE=$(printf '%s' "$STRIPPED" | LC_ALL=C tail -c 200 | LC_ALL=C tr -d '\n' | LC_ALL=C tail -c 50)
if ! printf '%s' "$LAST_LINE" | LC_ALL=C grep -qE '[?？]\s*$'; then
  exit 0
fi

# 模式 A：『A 还是 B』『要 X 还是 Y』
PATTERN_A=$(echo "$STRIPPED" | grep -cE '(是.*还是|要.*还是|选.*还是).*[?？]' || true)
# 模式 B：编号列表 1. ... 2. ... [3. ...] [4. ...]
#         或 字母编号 A. ... B. ... [C. ...] [D. ...]（大小写均算）
PATTERN_B=$(echo "$STRIPPED" | grep -cE '^\s*[1-4A-Da-d][.、)]\s+' || true)
# 模式 C：短划线列表 - ... - ... 至少 2 行
PATTERN_C=$(echo "$STRIPPED" | grep -cE '^\s*[-*]\s+' || true)
# 模式 D（已禁用 2026-05-19）：中文「X 吗/呢/嘛？」单句 yes/no
# 禁用原因：误报多，把收尾礼貌句和澄清都判成决策提问，反向助长 AskUserQuestion 滥用
# 模式 E：markdown 表格行里粗体字母/数字编号选项「| **A. xxx** | ...」
#         覆盖 `| **A. ` / `| **B、` / `| **1. ` 等。表格行首必以 `|` 开头。
PATTERN_E=$(echo "$STRIPPED" | grep -cE '^\s*\|.*\*\*[1-4A-Da-d][.、) ]' || true)
# 模式 F（已禁用 2026-05-19）：中文叠词反问「要不要 / 能不能 / 需不需要 / 可不可以」
# 禁用原因：这些是中文最自然的礼貌语，强行抓导致所有"要不要... ?"收尾都被强转 AskUserQuestion

HIT=0
REASON=""

if [ "$PATTERN_A" -gt 0 ]; then
  HIT=1
  REASON="检测到「X 还是 Y？」式选项提问"
elif [ "$PATTERN_B" -ge 2 ] && [ "$PATTERN_B" -le 4 ]; then
  HIT=1
  REASON="检测到 ${PATTERN_B} 项编号列表(数字/字母)后接问号"
elif [ "$PATTERN_C" -ge 2 ] && [ "$PATTERN_C" -le 4 ]; then
  HIT=1
  REASON="检测到 ${PATTERN_C} 项短划线列表后接问号"
elif [ "$PATTERN_E" -ge 2 ] && [ "$PATTERN_E" -le 4 ]; then
  HIT=1
  REASON="检测到 ${PATTERN_E} 项 markdown 表格内编号选项后接问号"
fi

if [ "$HIT" -eq 0 ]; then
  # AI fallback：regex 全 miss → Haiku 4.5 二次判别
  if command -v claude >/dev/null 2>&1; then
    TEXT_TAIL=$(printf '%s' "$STRIPPED" | tail -c 800)
    PROMPT=$(cat <<AI_PROMPT_EOF
你是 Claude Code AskUserQuestion 规则检查员。判断这段 assistant 输出末尾是否在向用户**强制要求**做一个能列成 2-4 个明确互斥选项的决策（且必须做决策才能推进下一步），如果是且本可以用 AskUserQuestion 工具但没用 → VIOLATE。

严格标准（避免误报，宁可放过不可错杀）：
- **只 VIOLATE**：assistant 列出了 2-4 个**结构化候选方案/路径**（"方案 A: xxx / 方案 B: yyy / 方案 C: zzz？"）且必须用户选一个才能继续 → VIOLATE
- "要不要 X?" / "X 吗?" / "需不需要 Y?" → **PASS**（单一礼貌确认，不是 2-4 选项）
- "你看是不是 A?" / "推不推送?" → **PASS**（单一 yes/no）
- "请描述你的需求" / "贴日志" / 真·开放题 → **PASS**
- 教学/对比/讲解末尾的反思性问句 → **PASS**

宁可错放 10 个，不可错抓 1 个。只回答 PASS 或 VIOLATE。

[assistant 最后输出]
"""
$TEXT_TAIL
"""
AI_PROMPT_EOF
)
    export CLAUDE_CODE_HOOK_INTERNAL=1
    AI_OUTPUT=$(printf '%s' "$PROMPT" | perl -e 'alarm shift; exec @ARGV' 10 claude --print --model claude-haiku-4-5 2>/dev/null || true)
    unset CLAUDE_CODE_HOOK_INTERNAL
    if printf '%s' "$AI_OUTPUT" | grep -qi 'VIOLATE'; then
      HIT=1
      REASON="AI 判别识别选项决策提问"
    fi
  fi
  if [ "$HIT" -eq 0 ]; then
    exit 0
  fi
fi

MSG="[Stop hook 检测] ${REASON}。CLAUDE.md「用户提问统一走 AskUserQuestion 规则」要求 2-4 选项决策必须用 AskUserQuestion 工具，禁止纯文本提问让用户手敲回复。请立刻用 AskUserQuestion 重发刚才那个问题：首项加「（推荐）」、description 解释 trade-off、选项互斥度低时开 multiSelect。"

# Stop hook 合法字段：decision="block" + reason
jq -n --arg msg "$MSG" '{
  decision: "block",
  reason: $msg
}'
