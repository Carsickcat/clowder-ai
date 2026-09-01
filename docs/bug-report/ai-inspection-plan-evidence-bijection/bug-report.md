---
feature_ids: [F257]
topics: [aiops, editable-metrics, locked-run, evidence-projection, review-fix]
doc_kind: bug-report
created: 2026-09-01
---

# Locked inspection plan and Run evidence diverged

## Reporter

Terra found both defects during independent review of PR #14 at
`18884c7b136e29cfc71192a099d693efbfdbcf14`.

## Bug diagnosis capsule

| Field | Evidence |
|---|---|
| **1. Symptom** | Expected: every editable rule in the locked plan has one same-source numeric measurement and trend series, and a new Run contains no execution truth outside that plan. Actual: nine fixture rules are missing or qualitative, while rejected `candidate-db-wait` still survives in `run.executionResults`. |
| **2. Evidence** | Editing `fulfillment-service` `redis.command_latency` to `<= 3ms` leaves the report `Verified`; rejecting `candidate-db-wait` removes it from the plan/report but leaves `database: Violated` in the new Run. A source sweep found gaps in order, payment, and generic workspaces. |
| **3. Root cause** | Check `metricRules`, report `measurements`, and legacy `execution` are maintained as independent projections. `materializeCheckResult()` iterates only source measurements, so missing rules disappear; `createInspectionRun()` separately persists unfiltered `workspace.execution`, creating a second Run truth. |
| **4. Diagnostic strategy** | Trace `metricRules -> report.checkResults -> materializeCheckResult -> createInspectionRun`, then audit both directions: plan rules missing evidence and Run evidence outside the plan. Exercise generated, playbook, saved direct-run, and generic entry paths. |
| **5. Timeout strategy** | If a rule has no trustworthy numeric source series, fail closed with explicit `NotEvaluated` evidence; do not fabricate a trend or add a renderer fallback. |
| **6. Warning strategy** | If three fixes reveal another independently persisted execution projection, stop and return to the Run contract instead of filtering each consumer. |
| **7. User-visible correction** | Every editable rule shown in the plan is backed by numeric trend evidence and deterministically affects the locked report. Missing evidence becomes explicit and inconclusive. Rejected checks are absent from every new Run truth surface. |
| **8. Acceptance** | Red tests cover all fixtures, missing-evidence fail-closed behavior, and the four Run entry paths. Targeted suites, product `pnpm check`, repository gate, and cross-individual exact-SHA review must pass. |

## Failure-mode sweep

The two review findings share one failure mode: the locked plan was not the owner of
its evidence projection. Under-coverage appeared in `report.checkResults`, while
over-coverage appeared in the legacy `executionResults` field. The fixture audit
found nine editable-rule gaps: three in order, two in payment, and four in the
generic compiler. One additional qualitative payment measurement (`db.pool.config`)
is contextual evidence rather than a rule and remains valid. Legacy persisted Runs
may still be read through the existing optional fallback, but new Runs must not write
that parallel field.

The first recorded 390px evidence exposed the same ownership leak in the presentation
projection: every measurement card inherited its parent check status. A passing Redis
hit-rate measurement was therefore labelled as violated when the command-latency rule
in the same check failed. Numeric cards now derive their own status from their locked
gate, while an unresolved parent check remains unresolved rather than overstating a
pass.

## Repair direction

- Complete every normal fixture with same-source numeric measurements and persisted
  series for each editable rule.
- Materialize results rule-first: any missing or non-numeric editable rule becomes an
  explicit `NotEvaluated` measurement, so absence can never inherit `Verified`.
- Make the locked report the only execution truth written by new Runs; preserve
  `executionResults` only as a read-only legacy compatibility path.

## Verification

- Red: the fixture invariant enumerated all nine missing/non-numeric rule evidence
  gaps; missing raw evidence did not return explicit `NotEvaluated`; four entry-path
  assertions proved new Runs still wrote `executionResults` (`34/43` passed).
- Green: editable metrics, journeys, and saved-inspection suites passed `43/43` after
  the plan/report projection repair.
- Presentation Red: the multi-rule evidence test showed both Redis cards as
  `Violated` (`6/7` passed); Green derives `Violated` only for command latency and
  `Verified` for hit rate.
- Product gate: build plus the complete Node suite passed `105/105`.
- Dogfood: real offline Chrome edited `fulfillment-service` command latency to
  `<= 3ms`, produced `Violated / Pause`, persisted no parallel execution truth, and
  remained within 390px with 0 HTTP(S) requests and 0 browser errors.
- Evidence: `designs/ai-inspection-copilot-offline-demo/evidence/21-mobile-generic-edited-rule-pause.png`.

[丢丢/gpt-5.6-sol🐾]
