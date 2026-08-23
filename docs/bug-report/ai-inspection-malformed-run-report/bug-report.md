---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [aiops, inspection, run-history, persistence-boundary, review-fix]
doc_kind: bug-report
created: 2026-08-23
---

# Malformed persisted Run report bypassed history isolation

## Reporter

Terra found the defect during independent review of `b46a1253d9741134c66febfbacb491d816a81c61` by replacing one otherwise valid persisted Run report with `{}` and opening its saved-inspection history.

## Bug diagnosis capsule

| Field | Evidence |
|---|---|
| **1. Symptom** | Expected: the malformed Run is quarantined, the card says `历史暂不可用`, and the saved Definition remains directly runnable. Actual: hydration reports `available`, retains the Run, and history rendering throws `Cannot read properties of undefined (reading 'toLowerCase')`. |
| **2. Evidence** | `validRun()` accepts any object-valued `report`; `renderHistoricalReportSnapshot()` immediately calls `report.action.toLowerCase()` and renders nested report fields. Review reproduction is stable on exact `b46a125`. |
| **3. Root cause** | The persistence boundary validates the Run envelope only shallowly and does not enforce the report shape required by its renderer. |
| **4. Diagnostic strategy** | Trace the malformed value from localStorage parsing through `validRun()` into the history selector and renderer; compare against compiler-produced Proceed and Pause report fixtures. |
| **5. Timeout strategy** | If the compiler contract has incompatible legacy variants, stop after the fixture/source sweep and document the variant instead of adding renderer fallbacks. |
| **6. Warning strategy** | If three repair attempts expose new report shapes, treat the schema boundary as underspecified and return to the design contract. |
| **7. User-visible correction** | A damaged historical Run is omitted; the card/history page shows a degraded-history notice while direct execution stays available. |
| **8. Acceptance** | Journey regression must fail before repair and pass after repair; the offline browser must open degraded history and start a direct run with zero browser errors; full `pnpm check` must pass. |

## Reproduction

1. Persist a valid library containing one Definition and one completed Run.
2. Replace only that Run's `report` with `{}`.
3. Hydrate the library and open the Definition history.
4. Before repair, the Run is retained and the historical report renderer throws.

## Root cause

`parseInspectionLibraryWithDiagnostics()` correctly isolates records rejected by `validRun()`, but `validRun()` only requires `report` to be an object. The report renderer requires action/status strings, evidence counts, string arrays, and—when present—a structured RC Agent. The persistence contract and consumer contract therefore disagree at the trust boundary.

## Repair

- Added one canonical `validReportContract()` beside the existing action/evidence vocabularies in `lib/domain.mjs`.
- Changed persisted Run validation to require the complete renderer-safe report contract instead of accepting any object.
- Kept `executionResults` optional at hydration so legitimate legacy Run snapshots remain readable.
- Replaced the browser's shallow `{ id: 'half-run' }` fixture with the real failure shape: an otherwise valid sole Run whose `report` is `{}`.
- Exercised degraded home, history navigation, and direct execution through the same recovered Definition.

## Verification

- Red: `node --test tests/journeys.test.mjs` produced 22 passes and 1 expected failure: malformed `report: {}` hydrated as `available` with zero rejected runs.
- Green: the same journey suite produced 23/23 passes after the persistence-boundary repair.
- Refactor regression: domain, saved-inspection, and journey suites produced 38/38 passes after moving the contract out of the oversized persistence module.
- Product gate: `pnpm check` produced 82/82 Node tests plus offline Chrome acceptance with 0 HTTP(S) requests and 0 browser errors.
- Repository gate: `pnpm check` passed after adding the installed Git Bash directory to this process's `PATH`; repository lint and build exited 0 with pre-existing warnings only.

## Failure-mode sweep

This review round contains one isolated failure mode: a shallow trust-boundary check admitted a value that its downstream consumer could not render. The adjacent persisted Run fields already use structural validators, and no second report ingestion path exists. The repair therefore centralizes one report contract and adds no renderer fallback.

[丢丢/gpt-5.6-sol🐾]
