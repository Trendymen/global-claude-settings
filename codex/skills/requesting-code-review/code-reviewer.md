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
- 绑定需求与项目约束，附已有 Spec / Task brief 等材料的真实路径；列出覆盖待审文件的适用全局、仓库与目录级 `AGENTS.md` / `AGENTS.override.md` 等规则路径及关键约束；
- 对应 Task 或整分支的 `Review Focus`，附实际 Plan 路径与相关段落；无 Plan 时注明「不适用（无 Plan）」；
- 审查基准类型与限定范围的 diff 或审查包；Git 审查提供实际基准 SHA，非 Git 审查提供修改前快照或备份的真实路径及内容哈希；
- 真实的验证命令与输出；
- 复审另加：`PRIOR_FINDINGS`、`FIX_DIFF`、`VERIFICATION_EVIDENCE`。

不要附带主会话历史、无关 plan 任务、预判的结论或严重度指示。reviewer 不得编辑文件、index、HEAD、分支或 worktree。

## 审查基准

- Task 审查使用该 Task 的实际起点，不能机械地用 `HEAD~1`；多次提交和未提交实现都要包含在当前 Task 范围内。
- 整分支审查以 `git merge-base <目标分支> HEAD` 的结果为基准，目标分支必须真实已知，不能写死为 `main`。
- 审查范围包含 working-tree 改动时，提供真实的 staged / unstaged diff，并在审查包中包含相关未跟踪文件内容；不能用空的 `BASE..HEAD` diff 代替未提交改动。
- 非 Git 文件以真实的修改前快照或备份为基准，提供其路径、内容哈希及相对当前文件的限定范围 diff；Git SHA 不适用，不得伪造 `HEAD`。

## Mode 选择

- L1：一个 `reviewer`，用 `COMBINED_REVIEW`。
- L2/L3：两个独立 `reviewer` thread，一个 `SPEC_COMPLIANCE`，一个 `CODE_QUALITY`。
- COMBINED_REVIEW 只能升级到 `CODE_QUALITY`，升级时另派一个 `SPEC_COMPLIANCE` reviewer。
- 常规修复复审回到原 reviewer thread，mode 保持不变。
- INITIAL 派发都用 `fork_turns: "none"`，把有界审查包放进 prompt，不靠继承历史；RE_REVIEW 复用原 reviewer thread，同样只带审查包。

输出契约以 [references/reviewer-contract.md](references/reviewer-contract.md) 为准。
