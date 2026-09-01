---
name: requesting-code-review
description: 实现任务、重大功能或合并候选需要有界代码审查、修复后复审，或需要留下书面审查结论时使用。
---

# 请求代码审查（Requesting Code Review）

用本地的审查策略，不要用已禁用的插件副本。审查证据必须限定范围；主会话历史永远不作为 reviewer 的输入。

## 选择审查门禁

1. **L0**——单文件、机械、低风险的改动，不涉及公共 API、共享数据、网络、异步、安全、构建或资源路径：由主线程完成结构化审查。
2. **L1**——在低风险包络内（单模块、最多两个代码文件、最多 100 行改动、不触碰上述高危边界），但达不到 L0：派一个 `reviewer`，用 `COMBINED_REVIEW`。
3. **L2/L3**——其余所有实现任务：分别派独立的 `SPEC_COMPLIANCE` 和 `CODE_QUALITY` 两个 reviewer。

L1/L2/L3 先读 [code-reviewer.md](code-reviewer.md) 和 [reviewer contract](references/reviewer-contract.md)。每次都派全新的只读 `reviewer`，`fork_turns: "none"`；绝不把完整主会话历史传进去。

## 修复循环

先修完所有 Critical 和 Important finding 再继续。L1/L2/L3 的修复发回原 reviewer thread，mode 不变，带上 `REVIEW_PHASE: RE_REVIEW`、完整的 prior findings、限定范围的修复 diff 和真实验证输出。只允许 `COMBINED_REVIEW -> CODE_QUALITY` 这一种升级，升级时另派一个 `SPEC_COMPLIANCE` reviewer。

L0 在主线程审查里记下需求核对、改动路径、验证证据和 residual risk，再继续。

