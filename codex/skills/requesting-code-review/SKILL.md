---
name: requesting-code-review
description: Use when an implementation task, major feature, or merge candidate needs a bounded code review, a fix re-review, or a documented review decision.
---

# Requesting Code Review

Use the local review policy, not the disabled plugin copy. Review evidence is scoped; the main-session history is never reviewer input.

## Select the gate

1. **L0** — one-file, mechanical, low-risk change with no public API, shared data, network, async, security, build, or resource impact: the main thread performs the structured review.
2. **L1** — inside the low-risk envelope (single module, at most two code files, at most 100 changed lines, no listed high-risk boundary) but not L0: dispatch one `reviewer` with `COMBINED_REVIEW`.
3. **L2/L3** — all other implementation tasks: dispatch independent `SPEC_COMPLIANCE` and `CODE_QUALITY` reviewers.

For L1/L2/L3, read [code-reviewer.md](code-reviewer.md) and [the reviewer contract](references/reviewer-contract.md). Dispatch a fresh, read-only `reviewer` with `fork_turns: "none"`; never pass full main-thread history.

## Fix loop

Fix every Critical and Important finding before proceeding. For L1/L2/L3, send the fix back to the same reviewer thread with the unchanged mode, `REVIEW_PHASE: RE_REVIEW`, complete prior findings, a scoped fix diff, and real verification output. Only `COMBINED_REVIEW -> CODE_QUALITY` escalation is allowed; start an additional `SPEC_COMPLIANCE` reviewer then.

For L0, record the requirement check, changed paths, verification evidence, and residual risk in the main-thread review before proceeding.
