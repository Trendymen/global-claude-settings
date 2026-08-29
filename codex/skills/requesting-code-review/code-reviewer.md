# Code Reviewer Dispatch Template

Use this template for L1/L2/L3 task reviews and final code review.

## Required header

```text
REVIEW_MODE: <COMBINED_REVIEW | SPEC_COMPLIANCE | CODE_QUALITY>
REVIEW_PHASE: <INITIAL | RE_REVIEW | ESCALATION>
REVIEW_SCOPE_ID: <stable task or branch identifier>
```

## Required materials

- implemented behavior and bounded requirements;
- binding project constraints;
- scoped `BASE..HEAD` diff or review package;
- real verification commands and output;
- for re-review: `PRIOR_FINDINGS`, `FIX_DIFF`, and `VERIFICATION_EVIDENCE`.

Do not include main-session history, unrelated plan tasks, a predicted verdict, or severity instructions. The reviewer must not edit files, index, HEAD, branch, or worktree.

## Mode selection

- L1: one `reviewer`, `COMBINED_REVIEW`.
- L2/L3: two independent `reviewer` threads, one `SPEC_COMPLIANCE`, one `CODE_QUALITY`.
- A combined review can escalate only to `CODE_QUALITY`; add a new `SPEC_COMPLIANCE` reviewer.
- Ordinary fix re-review resumes the original reviewer thread and preserves its mode.
- Every reviewer dispatch uses `fork_turns: "none"`; carry the bounded review package in the prompt instead of inherited history.

Use the exact output contracts in [references/reviewer-contract.md](references/reviewer-contract.md).
