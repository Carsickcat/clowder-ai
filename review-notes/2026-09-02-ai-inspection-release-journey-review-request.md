---
feature_ids: [F257]
topics: [aiops, inspection, offline-demo, release-validation, coverage-gaps, review-request]
doc_kind: review_request
created: 2026-09-02
---

# Review Request: AI Inspection Release Journey Offline Demo

Review-Target-ID: feat-ai-inspection-release-journey
Branch: feat/ai-inspection-release-journey
Review target: exact branch HEAD supplied in the A2A handoff after this note is committed

## What

- Make the first-use entry release-first: a user supplies `CHG-84501` and an optional risk focus instead of configuring metrics from a blank form.
- Compile one CandidateSet-shaped plan and make `PLAN_CONFIRMED` the only normal-path authorization before a locked Run/Report is created.
- Split the declared target into `blockingScope` and declaration-external `coverageGaps`; only an explicitly selected, approved candidate can enter the locked checks.
- Keep every unselected external impact beside the report decision as an uncovered/residual risk, so a scoped pass cannot masquerade as full release coverage.
- Preserve the existing immutable rule → same-source evidence → Run/Report lineage, saved/history/share/export behavior, exact Playbook reuse, offline build, and 390px path.

## Why

The prior Demo made users advance through three confirmation-like screens and silently promoted an `Observed-Superset` entity into the blocking checks. That contradicted the approved product journey: the platform should assemble a small evidence-backed plan, while the user makes one explicit boundary decision. A declaration-external service is useful context, but it is not authorized gate scope until the user adds a trustworthy check.

## Original Requirements

> The product must be understandable through one concrete service-release journey, not through abstract AI architecture terminology.
>
> The existing 1,000+ services, roughly 100,000 inspection tasks, knowledge graph, Trace topology, metric catalog, and alert-diagnosis Agent are inputs to plan generation; the first release should remain out-of-box and avoid per-business metric-by-metric setup.
>
> A normal user starts from a change reference plus optional concern, sees a small candidate plan, confirms once, and then receives an evidence-backed report and diagnosis.
>
> Declaration-external services discovered from runtime/topology facts must be visible as coverage gaps; they cannot silently expand the blocking plan.
>
> CandidateSet / Job / Revision / Case / Run / Report remain the business truth. The Demo must not create a second mutable PlaybookStore or report truth.
>
> Desktop and 390px must both keep uncertainty visible, avoid overflow or obscured actions, and run entirely offline.

Sources:

- Operator implementation authorization: thread `thread_msg13xc7dv3dp4fb`, message `0001788279088845-000288-37e6f9a4`.
- Product/control-plane truth: `docs/features/F257-ai-inspection-real-system.md`.
- Approved implementation contract: `feature-specs/2026-09-02-ai-inspection-release-journey-offline-demo.md`.
- Current journey/design truth: `designs/ai-inspection-copilot-offline-demo/DESIGN-JOURNEY.md`.

Please judge the implementation against the operator experience above, not only against individual test assertions.

## Tradeoff

- Reused the existing compiler, reducer, locked inspection plan, Run/Report and local history instead of rewriting the Demo or adding another state store.
- Kept Playbook and saved-inspection revisit routes, but they still materialize fresh immutable Runs and cannot replace the current CandidateSet facts.
- Kept mock/offline adapters and approved metric bindings; this slice does not add real providers, arbitrary PromQL/SQL, scheduling, approval workflows, or automatic remediation.
- On 390px the final CTA stays in normal document flow instead of floating over content. This gives up an always-visible button to guarantee coverage-gap text is never obscured.

## Architecture Ownership

Architecture cell: observability inspection control plane / AI inspection offline UX projection
Map delta: none
Why: the diff changes deterministic fixtures, CandidateSet projection, reducer transitions, and presentation. It adds no Store, Queue, Router, Adapter, Dispatcher, Binding, production source, or persistence port.

Reviewer checks:

- `activeRequest + change facts` remains the Case view; `committedChecks + candidateChecks + coverageGaps` remains the CandidateSet view.
- `taskInstance.inspectionPlan` remains the immutable Revision projection and `completeInspectionRun` remains the only Run materializer.
- New Runs do not write legacy `executionResults`; report/history/share/export read the same locked report.
- Compatibility events and saved/Playbook entry points cannot reintroduce a second normal-path authorization or another mutable task truth.

## Open Questions

### Technical OQ for reviewer

1. Can any compatibility or direct-run event reach `completeInspectionRun` without the intended authorization/drift checks?
2. Does every accepted external candidate require both an approved rule source and an eligible coverage-gap binding?
3. Does a rejected/unselected external entity remain in the immutable report boundary without manufacturing measurements or a verdict?
4. Do desktop and 390px preserve physical separation between the blocking plan, amber gaps, and report coverage badge?

### Value OQ for operator

None. The product direction and this offline implementation slice were explicitly authorized.

## Next Action

Terra should review the exact committed HEAD in a detached/read-only sandbox, independently run the full Demo check, inspect the release journey at desktop and 390px, and return `APPROVE — <exact SHA>` or reproducible findings. Author-side quality-gate evidence is not approval.

## Formal Review P1 Closure

Terra reproduced a contradiction at the original review SHA: `invoice-worker` and `settlement-db` were correctly recorded as residual coverage gaps, but the selected-context section labelled both `Verified`. The root cause was a domain-model error, not report aggregation: `selectedContextResults()` treated context inclusion as an evidence verdict.

The closure removes verdict semantics from the entire context projection:

- New Runs persist `contextState: referenced | included-in-plan | uncovered`, derived from the locked inspection plan.
- The UI is titled “本次使用的上下文” and labels entries “已引用 / 已纳入计划 / 未覆盖”.
- Legacy snapshots that still carry `status: Verified` render neutrally as “历史上下文”; the old verdict is never replayed.
- Unit, UI-contract and real-Chrome tests prove default `CHG-84501` leaves both declaration-external services uncovered, while an explicitly selected approved candidate alone becomes included in the plan.

The exact closure SHA is supplied in the A2A handoff after this note is committed.

## Review Sandbox

- Logical path: `/tmp/cat-cafe-review/feat-ai-inspection-release-journey/opus`
- Suggested Windows path: `E:\ClowderAI\review-sandboxes\feat-ai-inspection-release-journey\opus-<sha>`
- Static preview port if needed: `4184` (`4310/4311` remain reserved)

```powershell
pnpm --dir designs/ai-inspection-copilot-offline-demo check
node designs/ai-inspection-copilot-offline-demo/tests/record-walkthrough.mjs
python -m http.server 4184 --bind 127.0.0.1 --directory designs/ai-inspection-copilot-offline-demo
```

## Author-Side Quality Gate

```text
pnpm check
  build: exit 0
  Node tests: 112/112 passed
  offline Chrome: release-first gaps, one confirmation, immutable evidence,
                  history, sharing, exact reuse, 390px, edited-rule fail-closed
  HTTP(S) requests: 0
  browser errors: 0

node --check lib,src,scripts,tests/**/*.mjs
  36 files, 0 syntax errors

node tests/record-walkthrough.mjs
  16162ms, 60480 bytes, VP9 WebM

git diff --check
  clean

artifact
  index.html: 255563 bytes
  sha256: EC553EF1FA26AB44FC1B18E26EF8F5157CF8150E8144775F3CB5D040E799716F
```

Visual evidence:

- `evidence/09-release-first-desktop.png`
- `evidence/22-release-candidate-plan.png`
- `evidence/23-release-coverage-honest-report.png`
- `evidence/10-release-gap-mobile-plan.png`
- `evidence/08-release-coverage-mobile-report.png`
- `evidence/24-release-inspection-journey-15s.webm`

Root artifact hygiene: no repository-root media/design files; all evidence is archived in the Demo's formal `evidence/` directory.
