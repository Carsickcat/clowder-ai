---
feature_ids: [F257]
topics: [aiops, editable-metrics, review-fix, quality-gate, dogfood]
doc_kind: quality_gate
created: 2026-09-01
---

# Quality Gate: locked plan / Run evidence projection repair

Spec: `feature-specs/2026-08-31-ai-inspection-editable-golden-metrics.md`
Original requirements: `review-notes/2026-09-01-ai-inspection-editable-golden-metrics-review-request.md`
Formal review base: `18884c7b136e29cfc71192a099d693efbfdbcf14`

## Vision and delivery scope

This gate covers the complete offline editable-metrics slice requested by the
operator, not the broader F257 provider-integration work that is explicitly excluded
from this implementation plan.

| Requirement | Verdict | Evidence |
|---|---|---|
| Every visible editable golden rule has real same-source evidence | Pass | Order, payment, and generic fixture invariant; nine former gaps are closed. |
| Edited thresholds deterministically change the locked report | Pass | Parameterized test changes every editable rule; exact Terra reproduction changes Redis latency to `<= 3ms` and yields `Violated / Pause`. |
| Missing raw evidence cannot inherit `Verified` | Pass | Rule-first materialization creates explicit `NotEvaluated` evidence and an inconclusive report. |
| Rejected checks cannot survive in a new Run | Pass | Generated, playbook, generic, and saved direct-run paths write no `executionResults`; legacy fallback remains read-only. |
| Report evidence stays truthful at measurement granularity | Pass | Passing Redis hit rate remains green when sibling latency violates. |
| Offline and responsive continuity | Pass | Real Chrome at 390px; 0 HTTP(S) requests and 0 browser errors. |

Delivery completeness: this repair extends the terminal offline contract and requires
no later rewrite. The broader F257 external endpoint/auth dependency is a separate,
pre-existing product boundary, not a deferred item from this review fix.

## Close gate and tail scan

| Finding | Disposition |
|---|---|
| Terra P1: editable rules without numeric evidence | Immediate — closed with fixtures, invariant, rule-first materialization, and fail-closed defense. |
| Terra P2: unfiltered `executionResults` in new Runs | Immediate — closed by removing the parallel write and preserving legacy read compatibility only. |
| Dogfood adjunct: passing measurement labelled violated | Immediate — closed with measurement-owned numeric status projection. |

No P1/P2, follow-up, next-PR, stub, or waiver tail remains in this review scope.

## Architecture and mechanical checks

- Architecture cell: observability inspection control plane / AI inspection offline demo.
- Map delta: none. The diff changes the existing immutable Run/Report projection; it
  adds no Store, Queue, Router, Adapter, Dispatcher, Binding, external dependency, or
  production data boundary.
- Fallback layer audit: no new compatibility fallback. One fail-closed projection
  replaces silent omission; legacy `executionResults` stays a single read-only path.
- Hotfix audit: this is a root-cause/TDD repair, not a temporary or conditional patch.
- This checkout does not contain the newer `check-hotfix-pattern.mjs`,
  `check-fallback-layers.mjs`, or `check:architecture-ownership` commands; those checks
  were performed by source/diff inspection and are not misreported as automated runs.
- Tips: exempted by the active plan because this refines the existing offline journey
  and adds no new entry point.
- `.pen` glob: no matching design file.
- Root media hygiene: no root-level media/design artifact in worktree or committed diff.

## Dogfood-Your-Slice

Scope verdict: required and passed.

Path: offline Chrome → generic `fulfillment-service` request → edit
`redis.command_latency` to `<= 3ms` → one-shot execute → inspect immutable Run →
390px report.

Observed result: `Violated / Pause`; locked measurement gate `3ms`; new Run has no
`executionResults`; Redis hit rate is green while latency is red; no horizontal
overflow, HTTP(S) request, or browser error.

Evidence:
`designs/ai-inspection-copilot-offline-demo/evidence/21-mobile-generic-edited-rule-pause.png`.

## Fresh verification

```text
Red targeted suites
  34/43 passed; failures exactly matched 9 fixture gaps, missing-evidence handling,
  and new-Run parallel truth.

Green targeted suites
  43/43 passed.

Adjacent presentation Red → Green
  report-share: 6/7 → 7/7.
  combined edited-metrics + journeys + report-share: 41/41 passed.

Product build + Node tests
  105/105 passed.

Offline Chrome with --evidence
  edited-rule fail-closed journey passed;
  0 network requests; 0 browser errors.

git diff --check
  clean.
```

The repository `pnpm gate` requires a clean worktree by design. It will run against
the exact local commit before push; its exit status and exact SHA belong in the
review handoff so the report does not invent a pre-commit SHA.

[丢丢/gpt-5.6-sol🐾]
