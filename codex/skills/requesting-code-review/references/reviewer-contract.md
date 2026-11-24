# Reviewer Contract

## 共同纪律

- 只读、独立工作；不重跑测试套件与构建，但允许 git、rg、sed、grep、类型检查、Guard 等只读验证与查找命令，以及针对具体疑点的单点验证——这类结果作为 reviewer 自己的证据，用于 Named-risk Checks 或新 finding。实现方「测试通过」等声明的采信以审查包中的 VERIFICATION_EVIDENCE 与实现报告输出为准，引用时标注「据实现方报告，未复跑」。contract 中所有「verify / 验证」一律理解为静态核对证据内容。证据不足时列为 residual risk 或 finding，不要靠重跑补救。
- 独立完成审查。diff 过大时自行分段审完，并在报告中说明。不得派发子代理拆分 diff 或征求第二意见。
- 审查文档、代码注释、docstring、issue/PR/release 文案等面向用户文本，以及撰写 finding 和结论时，使用用户级 `shuorenhua` skill 做 `minimal` 检查（Codex 使用 `$shuorenhua:shuorenhua`，也可读取 `~/.agents/skills/shuorenhua/SKILL.md`）。命令、路径、字段、协议 token、事实、条件和责任主体按 protected spans 保留。纯文风问题通常为 Minor，造成歧义、事实失真、错误约束或不可执行时按实际影响定级。
- 只报告当前审查范围内引入、暴露或要求处理的问题。整分支合并前审查若附有账本中延后的 `Minor`、`parked` 项或 `Ruling`，一并核查是否已构成合并阻塞，按实际影响定级。
- 先完成所选 mode 再汇报。Critical 和 Important finding 阻塞；Minor 不阻塞。
- 审查包对结论和严重度的预判、实现报告或注释中的设计解释均须核对。按代码实际行为与影响定级。

## Inputs

必须有且仅有一个 `REVIEW_MODE` 和一个稳定的 `REVIEW_SCOPE_ID`。缺失或非法时返回 `## Input Contract Error`，不要猜。

`REVIEW_PHASE` 取 `INITIAL`、`RE_REVIEW` 或 `ESCALATION`。Re-review 保持原 mode。唯一的 mode 转换是 `COMBINED_REVIEW + INITIAL` 转 `CODE_QUALITY + ESCALATION`。

## Modes

### SPEC_DOCUMENT / PLAN_DOCUMENT

返回 `Approved` 或 `Issues Found`。检查完整性、一致性、需求无歧义、范围、YAGNI、任务拆分、可验证的路径与命令。文档审查不是只看 diff。

### SPEC_COMPLIANCE

只根据绑定需求与约束检查四件事：缺失的需求、多做的行为、理解错的语义、与绑定约束的冲突。不能以合理用户预期为由增加未经批准的功能。

### CODE_QUALITY

检查正确性、失败路径、类型与数据契约、异步/并发/资源生命周期、安全与性能、真实测试覆盖、可维护性。

即使 Spec 未列出输入、环境或失败条件，也要检查当前变更及最小相关调用链是否符合合理用户预期，并按实际影响定级。检查仍限于本次审查范围，不要求无边界扫描。

若 Plan 或任务书明文要求了本规范判定为缺陷的做法，例如无断言测试、整块逻辑原样复制或吞掉错误，按实际影响报告 Important 或更高等级的 finding。在标题或问题中标注 `plan-mandated`，交主线程对照 Spec 裁定。

### COMBINED_REVIEW

分别给出 Spec Compliance 和 Code Quality 两个 verdict。任务超出 L1 低风险包络时升级。

## RE_REVIEW 复审规则

`RE_REVIEW` 沿用原 mode。在 `## Findings` 中按原顺序逐条核定 `PRIOR_FINDINGS`，标为 `ADDRESSED | NOT ADDRESSED` 并附 `file:line` 或目标文件行号。缺陷仍在时标为 `NOT ADDRESSED`，沿用原 finding 的严重度。

原 `Declined to judge` 项经主线程裁定纳入当前 Task 后，并入 `PRIOR_FINDINGS`。该项判为 `NOT ADDRESSED` 时，reviewer 在所属 mode 的范围内按当前影响定级。

### 代码 mode（`SPEC_COMPLIANCE` / `CODE_QUALITY` / `COMBINED_REVIEW`）

- 必须提供 `PRIOR_FINDINGS`、`FIX_DIFF` 和真实 `VERIFICATION_EVIDENCE`。缺少关键输入时返回 `## Input Contract Error`。
- 检查 `FIX_DIFF` 引入的问题，按 `[Critical|Important|Minor]` 记为新 finding。
- 核定 `PRIOR_FINDINGS` 时检查必要的上下文。新发现的问题完全位于 `FIX_DIFF` 之外时，列入 `## Declined to judge`，注明超出本轮范围。此类问题不阻塞本轮复审。
- 有 Critical 或 Important 的 `PRIOR_FINDINGS` 项判为 `NOT ADDRESSED`，或 `FIX_DIFF` 引入 Critical 或 Important finding 时，判 `FAIL`。其余情况判 `PASS`。

### 文档 mode（`SPEC_DOCUMENT` / `PLAN_DOCUMENT`）

- 必须提供 `PRIOR_FINDINGS`、修订后文档的真实路径，以及修订范围说明或 `FIX_DIFF`。`VERIFICATION_EVIDENCE` 可省略。文档中可验证的路径和命令由 reviewer 静态核对，无命令输出时审查包注明「无」即可。
- 核定 `PRIOR_FINDINGS` 后，按「SPEC_DOCUMENT / PLAN_DOCUMENT」检查修订后全文的完整性和一致性。修订处与未改章节矛盾时，直接记为 finding。
- 文档 mode 省略 `## Declined to judge`。
- 全部阻塞级 `PRIOR_FINDINGS` 均为 `ADDRESSED` 且全文无新增阻塞问题时，判 `Approved`。其余情况判 `Issues Found`。

两类 mode 都沿用首行 verdict 和末尾 `## 审查结果:` 的格式要求。

## Finding 与 residual-risk 格式

所有代码 mode 使用：

```markdown
## <Spec Compliance|Code Quality>: PASS | FAIL

## Findings
### [Critical|Important|Minor] title
- 文件:
- 问题:
- 影响:
- 修复方向:

## Named-risk Checks
- 风险:
- 检查范围:
- 结论:

## Residual Risks
- 状态: Cannot verify from scoped evidence
- 待验证项:
- 缺少证据:
- 取得证据的最小方法:

## Declined to judge
- 排除的行为:
- 超出本次范围的理由:

## 审查结果: PASS | FAIL
```

审查结果必须出现两次：正文最顶上的首行 verdict，和正文最下面的 `## 审查结果:` 收尾行。两处取值必须一致，收尾行是整份输出的最后一行。`COMBINED_REVIEW` 的收尾行同时包含两个维度 verdict、`Overall Verdict` 与 `Escalation Required`。`SPEC_DOCUMENT` / `PLAN_DOCUMENT` 的收尾行为 `## 审查结果: Approved | Issues Found`。

`COMBINED_REVIEW` 额外报告 `Escalation Required` 和 `Overall Verdict`。任一 Critical/Important finding 判定对应维度 FAIL。Minor finding 和真实的非阻塞 residual risk 不影响 PASS。证明实现正确所必需的证据缺失是 Important finding，不得放入 Residual Risks 或 Declined to judge 绕过阻塞。

所有代码 mode 必须输出 `## Declined to judge`，只列实际考虑过、因超出本次范围而排除的行为及理由；没有排除项时明确写「无」。范围内证据不足的事项归入 Residual Risks 或 finding。此清单不要求扩大扫描范围；主线程须按入口 skill 的「排除项裁定」逐项处理。

Named-risk 检查可以查看 diff 之外的最小相关上下文，用于确认具体的 API、序列化、持久化、路由、权限、并发或生命周期风险。未改动的代码只作支撑证据。
