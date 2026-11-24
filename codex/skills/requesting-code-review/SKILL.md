---
name: requesting-code-review
description: 实现任务、重大功能或合并候选需要有界代码审查、修复后复审，或需要留下书面审查结论时使用。
---

# 请求代码审查（Requesting Code Review）

使用此技能的审查规则。只向 reviewer 提供本次审查范围内的证据，主会话历史不得作为输入。

本次上游同步基线为 `obra/superpowers v7.0.2 @22f0b463e7a5e579904dd6211a520321035526f7`。

## 选择审查门禁

1. **L0**——单文件、机械、低风险的改动，不涉及公共 API、共享数据、网络、异步、安全、构建或资源路径：由主线程完成结构化审查。
2. **L1**——在低风险包络内（单模块、最多两个代码文件、最多 100 行改动、不触碰上述高危边界），但达不到 L0：派一个 `reviewer`，用 `COMBINED_REVIEW`。
3. **L2/L3**——其余所有实现任务：分别派独立的 `SPEC_COMPLIANCE` 和 `CODE_QUALITY` 两个 reviewer。

L1/L2/L3 先读 [code-reviewer.md](code-reviewer.md) 和 [reviewer contract](references/reviewer-contract.md)。`INITIAL` 派独立只读 `reviewer`，`RE_REVIEW` 复用原 reviewer 会话。两种情况都只传有界审查包。Codex 和 Antigravity 的派发方式见 code-reviewer.md「Mode 选择」。

## 修复循环

先修完所有 Critical 和 Important finding 再继续。L1/L2/L3 的修复发回原 reviewer 会话，沿用原 mode，带上 `REVIEW_PHASE: RE_REVIEW`、完整的 `PRIOR_FINDINGS`、限定范围的 `FIX_DIFF` 和真实 `VERIFICATION_EVIDENCE`。只允许 `COMBINED_REVIEW -> CODE_QUALITY` 这一种升级，升级时另派一个 `SPEC_COMPLIANCE` reviewer。

标有 `plan-mandated` 或与 Plan 正文冲突的 finding，由主线程先按 Spec 裁定并记入账本，再决定修复或保留。Plan 明文要求不构成忽略 finding 的理由。派发与 Plan 冲突的修改前，必须记录裁定。

整分支合并前审查有待修项时，只安排一轮自动修复和一轮有界 `RE_REVIEW`。一次派发覆盖全部待修项，再按原 mode 分别交回有待修项的原 reviewer 会话。复审仍有 Critical 或 Important finding 时，保留 `FAIL`、暂停合并，逐项记录裁定并向用户报告。已有审查账本时，把裁定记入账本。

L0 在主线程审查里记下需求核对、改动路径、验证证据和 residual risk，再继续。

## 排除项裁定

主线程在继续当前 Task 或合并前，必须逐项裁定 reviewer 的 `Declined to judge` 是否纳入当前 Task、另行处理或接受排除，并记录理由和必要验证。纳入当前 Task 时，把该项并入 `PRIOR_FINDINGS`，更新有界审查包后按原 `REVIEW_MODE` 交原 reviewer 会话复审。「修复循环」中的材料要求和 mode 升级限制同样适用。
