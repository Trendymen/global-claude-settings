# Code Reviewer 派发模板

L1/L2/L3 任务审查和最终代码审查都按这个模板派发。

## 必需 header

```text
REVIEW_MODE: <COMBINED_REVIEW | SPEC_COMPLIANCE | CODE_QUALITY>
REVIEW_PHASE: <INITIAL | RE_REVIEW | ESCALATION>
REVIEW_SCOPE_ID: <稳定的任务或分支标识>
```

## 必需材料

- 已实现的行为和有界需求；
- 绑定的项目约束；
- 限定范围的 `BASE..HEAD` diff 或审查包；
- 真实的验证命令与输出；
- 复审另加：`PRIOR_FINDINGS`、`FIX_DIFF`、`VERIFICATION_EVIDENCE`。

不要附带主会话历史、无关 plan 任务、预判的结论或严重度指示。reviewer 不得编辑文件、index、HEAD、分支或 worktree。

## Mode 选择

- L1：一个 `reviewer`，用 `COMBINED_REVIEW`。
- L2/L3：两个独立 `reviewer` thread，一个 `SPEC_COMPLIANCE`，一个 `CODE_QUALITY`。
- COMBINED_REVIEW 只能升级到 `CODE_QUALITY`，升级时另派一个 `SPEC_COMPLIANCE` reviewer。
- 常规修复复审回到原 reviewer thread，mode 保持不变。
- 每次派发都用 `fork_turns: "none"`，把有界审查包放进 prompt，不靠继承历史。

输出契约以 [references/reviewer-contract.md](references/reviewer-contract.md) 为准。

