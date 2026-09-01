---
feature_ids: [F257]
topics: [aiops, inspection, offline-demo, release-validation, user-journey]
doc_kind: implementation-plan
status: approved-for-implementation
created: 2026-09-02
---

# AI Inspection Release Journey Offline Demo Implementation Plan

**Feature:** F257 UX truth — release-driven offline Copilot projection  
**Goal:** Rework the existing offline demo so a user can experience one coherent release-validation journey: `change reference + optional intent → candidate plan → one explicit confirmation → immutable evidence report / diagnosis`.  
**Acceptance Criteria:**

- The primary entry asks for a release/change reference and optional risk intent, not a blank metric configuration form.
- A standard known release reaches a reviewable candidate plan without a separate scope-confirmation screen; the only normal-path authorization is `确认并执行`.
- The plan shows a small, source-backed set of blocking checks, optional add-on checks, and any declaration-external service as a visible coverage gap.
- A declaration-external entity never enters the blocking plan silently. It only becomes a check after explicit inclusion and only when it has an approved source; otherwise it remains an unresolved coverage gap in the final report.
- The existing locked-rule / same-source-evidence / immutable Run-Report lineage, history, share/export, exact playbook, and saved direct-run paths remain valid.
- The desktop and 390px offline browser path remains zero-network and zero-console-error.

**Architecture cell:** Offline-demo UX projection of F257 CandidateSet → Job/Revision → Run/Report lineage  
**Map delta:** none  
**Map delta why:** This changes the offline product projection and its deterministic fixtures; it adds no production source, persistence port, router, or control-plane ownership cell.  
**Architecture:** The compiler produces a CandidateSet-shaped workspace view. The reducer owns one authorization transition that snapshots the selected checks into the existing immutable inspection-plan/Run contract. Rendering projects the plan, its explicit coverage gaps, and the already-locked report without creating a second business store.  
**Tech Stack:** Vanilla ES modules, deterministic fixture compiler, Node test runner, offline file browser acceptance  
**前端验证:** Yes — desktop + 390px browser acceptance, zero network and zero browser errors

---

## Finish line and exclusions

The finish line is a user who pastes `CHG-84501`, optionally writes “关注扣款成功和 Redis 客户端”, sees why six or fewer checks were selected, optionally adds an approved extra check, clicks one confirmation, and receives a report that states both the decision and any remaining coverage gap.

This change does **not** add a real provider, arbitrary query editing, background scheduling, automatic remediation, auto-approval, new persistent `PlaybookStore`, or a new report/runtime truth. It also does not turn saved-inspection direct run into the main release entry; that path remains a clearly labelled revisit shortcut.

## Terminal object model

| Existing demo object | Final product meaning | Owner | Storage truth |
| --- | --- | --- | --- |
| `activeRequest + workspace.declaredChange/observedChange` | `Case` / immutable change and topology snapshot view | compiler + reducer | input snapshot only |
| `workspace.committedChecks + candidateChecks + coverageGaps` | `CandidateSet` view | compiler | deterministic fixture/view; no new store |
| `taskInstance.inspectionPlan` | locked `Revision` view | reducer | immutable per Run |
| `library.runs[].inspectionPlan` | Run's locked Job/Revision snapshot | `completeInspectionRun` | existing local demo history |
| `library.runs[].report` | immutable `Report` | existing report materialization | existing local demo history |

`coverageGaps` is a pure projection from declared-versus-observed scope and available approved bindings. It is never a second task list and is never silently converted into a check.

## Stateful-object census

| Object | Lifecycle owner | States | Prohibited bypass |
| --- | --- | --- | --- |
| `DemoSession` | reducer | `intake → plan → report → intake` | Old `INPUT_CONFIRMED` / `SCOPE_ACCEPTED` may not create a Run or act as a second authorization step. |
| `CandidateSetView` | compiler, then reducer for user inclusion | generated → optionally augmented → locked | A coverage gap or model suggestion cannot enter `committedChecks` without an explicit inclusion action and approved rule source. |
| `taskInstance.inspectionPlan` | reducer | absent → executing snapshot → locked | After `PLAN_CONFIRMED`, later rule/candidate/UI mutations cannot alter its checks. |
| `Run/Report` | `completeInspectionRun` and existing report materializer | created → completed, immutable | Share/history/comparison/export must project the locked report, never a current workspace recomputation. |
| Saved inspection / playbook reference | existing saved/playbook handlers | read-only reference → new run or replan | Neither becomes a mutable template store; direct-run must still lock a fresh run snapshot. |

### State × event transition table

| Current state | Event | Next state | Required effect |
| --- | --- | --- | --- |
| `intake` | `INTENT_SUBMITTED` | `plan` | Compile one CandidateSet view from change reference and optional intent; show source freshness, blocking scope, candidates, and gaps. |
| `plan` | `CANDIDATE_INCLUDED` | `plan` | Append only that eligible approved candidate to the plan projection; retain why it was added. |
| `plan` | `CANDIDATE_EXCLUDED` | `plan` | Retain the item as an unselected coverage gap / residual risk; do not require a reason merely to proceed. |
| `plan` | `CHECK_RULE_UPDATED` | `plan` | Alter only allowed editable rule values in the pending plan. |
| `plan` | `PLAN_CONFIRMED` | `report` | Atomically snapshot selected checks as the locked plan, create exactly one new Run, and materialize its Report. |
| `report` | `RESET` | `intake` | Start a new draft without mutating prior Run/Report. |
| `intake` | saved exact direct-run | `report` | Preserve the existing bypass only after current-fact validation, with a new Run and locked snapshot. |

## Invariants and adversarial scenarios

- **INV-1 — One normal authorization:** from a normal release intake, no event other than `PLAN_CONFIRMED` creates a Run. Test the former `INPUT_CONFIRMED` and `SCOPE_ACCEPTED` events as inert/compatibility no-ops for this path.
- **INV-2 — Scope integrity:** `Observed-Superset` entities appear in `coverageGaps`; they do not appear in `committedChecks` or blocking counts unless the user explicitly includes an eligible candidate. Test both inclusion and non-inclusion.
- **INV-3 — No false all-green:** a non-included declared-external entity stays visible in the report's scope statement/residual risks. A report may say the locked scope passed, never that the release is fully covered.
- **INV-4 — Evidence bijection:** every editable locked rule has same-source numeric value and persisted series; missing evidence is `NotEvaluated`/`Inconclusive`, not `Verified`. Keep all existing editable-golden-metrics regressions.
- **INV-5 — Locked lineage:** new Run, report, comparison, share, export, and saved history all derive from the same locked plan/report snapshot; no new `executionResults` writer or mutable package truth.
- **INV-6 — Direct-run parity:** exact playbook and saved direct-run routes still create fresh Runs but cannot skip drift validation or overwrite prior Reports.

Adversarial cases: stale/ambiguous change reference (ask one focused clarification, no invented service), coverage-gap candidate with no approved rule (cannot add), an optional approved candidate left unselected (run proceeds but report records residual risk), a rule edited after confirmation (old report stays unchanged), and a saved direct-run with material drift (no new Run).

## Implementation tasks

### Task 1: Write the release-journey red tests

**Files:**

- Modify: `designs/ai-inspection-copilot-offline-demo/tests/journeys.test.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/tests/ui-contract.test.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/tests/offline.browser.mjs`

1. Add failing reducer tests for `INTENT_SUBMITTED → plan`, exactly one `PLAN_CONFIRMED` authorization, coverage gaps not becoming committed checks, explicit inclusion, and residual-risk report text.
2. Add failing UI-contract assertions for a change-reference-first entry, one formal CTA, an amber coverage-gap card, and no copy equivalent to “已扩大巡检范围”.
3. Add a browser journey for `CHG-84501`: submit, optionally add one check, confirm once, see report/diagnosis/coverage gap; retain 390px, zero-network and zero-error assertions.
4. Run the three tests and verify they fail because the old three-step / automatic-scope contract is still present.

### Task 2: Compile explicit blocking scope and coverage gaps

**Files:**

- Modify: `designs/ai-inspection-copilot-offline-demo/lib/domain.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/compiler.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/scenarios.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/selectors.mjs`

1. Evolve reconciliation projection so the declared release target is the default blocking scope and declaration-external observed entities are explicit `coverageGaps`.
2. Update the payment fixture to the PRD's `CHG-84501` release story; make the shared-configuration impact an eligible candidate only when it has a source-backed rule. Remove all static silent inclusion of `invoice-worker`/other declaration-external entities from committed checks.
3. Make low-authority/missing-binding candidates visibly non-blocking. `selectPlanReadiness` must only block true unresolved authority/freshness errors, not an optional candidate that has not been clicked.
4. Preserve generic/free-text fixture behaviour, but allow a change reference to be the primary source and natural language to be optional risk emphasis.
5. Run compiler/domain/journey tests until the new cases pass.

### Task 3: Collapse the primary state machine to one confirmation

**Files:**

- Modify: `designs/ai-inspection-copilot-offline-demo/lib/reducer.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/selectors.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/saved-inspections.mjs` only if report materialization needs `coverageGaps` projection

1. Transition normal `INTENT_SUBMITTED` directly to the plan view; retain compatibility handlers only if another saved/playbook path needs them, but they must not produce an extra confirmation in the normal path.
2. Replace mandatory high-candidate disposition with explicit inclusion/exclusion semantics that leave an unselected item as a reportable residual risk.
3. Centralize the pre-run path as “validate authorization → snapshot plan/Revision view → create exactly one Run → materialize Report”; route generic and any plan-mediated path through it.
4. Add the coverage-gap summary to the report projection using only locked-plan facts and residual risks. Do not manufacture a measurement, a gate verdict, or a second report field.
5. Run journey, saved-inspection, report-share, and editable-evidence tests.

### Task 4: Rebuild the visible release journey without changing the visual language

**Files:**

- Modify: `designs/ai-inspection-copilot-offline-demo/src/render-intake.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/render.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/render-plan.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/render-report.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/app.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/components.css`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/responsive.css`

1. Make the primary entry visibly release-first: `变更单 / 发布单号` is the prominent field; “本次关注什么” is optional. Example `CHG-84501` fills both.
2. Replace the separate “确认巡检信息 / 范围对账” page with a compact read-only change/context strip inside the candidate plan. It must show source, freshness, target scope, and the reason a check is selected.
3. Make the plan page the decision surface: headline states `N 项阻断 + M 项观察`, one primary `确认并执行` CTA, optional add-on controls, and a distinct amber “影响面缺口” card with `加入检查` only when eligible.
4. Keep the existing token set, report evidence cards, trends, diagnosis sections, save/history/share controls, and responsive shell. Do not introduce a dashboard, a chat-first wall, a health score, or a second sidebar.
5. At 390px stack source/context/coverage information before the CTA, keep every touch target at least 44px, and ensure the fixed composer never overlays the confirmation button.

### Task 5: Update contracts, build artifact, and acceptance evidence

**Files:**

- Modify: `designs/ai-inspection-copilot-offline-demo/README.md`
- Modify: `designs/ai-inspection-copilot-offline-demo/DESIGN-JOURNEY.md`
- Generated: `designs/ai-inspection-copilot-offline-demo/index.html`
- Generated evidence: `designs/ai-inspection-copilot-offline-demo/evidence/` only through the existing recorder when final screenshots change

1. Rewrite direct-acceptance instructions for the new one-confirmation release journey and coverage-gap branch.
2. Update the journey design truth to remove the old three-screen confirmation contract and record the no-silent-scope-expansion rule.
3. Run `pnpm check`, then `node tests/offline.browser.mjs --evidence` after product assertions pass.
4. Inspect the desktop and 390px evidence visually; verify no network requests, browser errors, hidden CTA, clipped long labels, or accidental “all green” language.

## Completion gate

The implementation is ready for independent acceptance only when the full `pnpm check` is green, the browser journey verifies the single confirmation and coverage-gap semantics at desktop and 390px, generated `index.html` matches source, and a fresh reviewer can trace every report claim back to the locked Run evidence.

## Open questions

**Technical OQ — resolve during implementation:** Whether existing exact-playbook and saved direct-run UI needs a visible “one confirmation” label, or whether its existing post-drift confirmation remains the correct distinct reuse path. This is not a normal-release second confirmation.

**Value OQ:** none. The co-creator explicitly approved the product direction and delegated implementation scope.

