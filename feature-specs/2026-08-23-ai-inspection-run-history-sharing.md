---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [aiops, inspection, run-history, trend-comparison, report-sharing, offline-demo]
doc_kind: implementation_plan
created: 2026-08-23
status: implementation
---

# AI Inspection Run History & Sharing Implementation Plan

**Feature:** `AI_INSPECTION_COPILOT_OFFLINE_DEMO`
**Goal:** Turn saved inspections from one-click launchers into durable operational assets with immutable history, structured run comparison, and offline-safe sharing.
**Acceptance Criteria:** AC-V1 through AC-V8 in `designs/ai-inspection-copilot-offline-demo/DESIGN-V2-RUN-HISTORY.md`.
**Architecture cell:** AI inspection offline demo / standalone product artifact
**Map delta:** none
**Map delta why:** The change extends the existing reducer, immutable local library, selectors, renderers, and browser adapter without introducing another store, router, queue, or production boundary.
**Tech stack:** Node ESM, vanilla JavaScript/CSS, deterministic standalone bundler, Node test runner, offline Chrome/CDP.
**Front-end verification:** Yes — desktop and 390px journeys must be inspected in Chrome with zero network requests and zero browser errors.

## Finish Line

A returning operator can scan recent outcomes on each saved-inspection card, open a complete reverse-chronological history, expand immutable report snapshots, rerun the definition, compare the latest structured check results with the preceding run, copy a five-line summary, and export a self-contained offline HTML report. Corrupt run-history records degrade the history surface while preserving valid definitions and direct-run ability.

This slice does not add production connectors, backend persistence, team approval, scheduled execution, mutable history, or a general-purpose chatbot. It is the complete P0 product capability defined by the V2 design, not a placeholder for those later layers.

## Terminal Schema

```js
InspectionExecutionResult = {
  id,
  label,
  status, // 'Verified' | 'Inconclusive' | 'Violated'
  fact,
}

InspectionRun = {
  id,
  taskInstanceId,
  definitionId,
  startedAt,
  completedAt,
  status: 'locked',
  selectedContextResults,
  inspectionPlan,
  executionResults?, // immutable; required for newly created runs, optional for legacy runs
  report,
}

RunHistoryDiagnostics = {
  status: 'available' | 'degraded' | 'unavailable',
  rejectedRunCount,
}

RunComparison = {
  previousRunId,
  previousCompletedAt,
  summary: 'changed' | 'stable' | 'unavailable',
  items: [{ id, label, kind: 'improved' | 'worsened' | 'stable' | 'added' | 'removed', before, after }],
}
```

`SavedInspectionDefinition` remains unchanged and immutable. The canonical relationship is derived from `run.definitionId === definition.id` or `run.id === definition.sourceRunId`; no `runs[]` field is persisted on a definition.

## Stateful Object Census

1. `InspectionLibraryEnvelope`: persisted canonical definitions and immutable runs; existing library functions remain sole lifecycle owner.
2. `InspectionRun`: append-only audit snapshot. New runs include deep-frozen structured execution results; legacy runs remain readable.
3. `DemoSession.activeHistoryDefinitionId`: transient navigation state owned by the reducer; never persisted.
4. `RunHistoryDiagnostics`: transient hydration evidence owned by the storage boundary and reducer view; never serialized.
5. Share drawer/toast: transient browser presentation state; it cannot mutate a run or definition.

## State and Event Transitions

| Object | Event | Preconditions | Transition | Forbidden side paths |
|---|---|---|---|---|
| DemoSession | `LIBRARY_HYDRATED` | initial intake | attach valid definitions/runs plus diagnostics | malformed runs cannot erase valid definitions |
| DemoSession | `SAVED_INSPECTION_HISTORY_OPENED` | known definition, intake | set active history definition | cannot run or mutate a historical snapshot |
| DemoSession | `SAVED_INSPECTION_HISTORY_CLOSED` | history open | clear active history definition | cannot reset the library |
| InspectionRun | final `EXECUTION_ADVANCED` | final step | append one deep-frozen run including `executionResults` | repeated final events remain no-op |
| Share UI | copy/export action | current locked report | derive text or standalone HTML from current run | historical snapshots expose no share action |
| Storage | hydrate payload with invalid runs | envelope and definitions valid | retain valid definitions/runs; emit degraded diagnostics | invalid history cannot block direct run |

## Invariants

- **INV-V1:** Definitions and runs stay canonical and append-only; history is selector-derived.
- **INV-V2:** Every newly created run snapshots structured execution results. Existing runs without them remain valid and only lose item-level comparison.
- **INV-V3:** Comparison is computed from structured result IDs and statuses, never parsed from prose.
- **INV-V4:** Opening, expanding, closing, copying, or exporting history never mutates the library.
- **INV-V5:** Historical snapshots contain no save/share controls and are explicitly labeled read-only.
- **INV-V6:** One malformed run cannot erase a valid definition or block its direct-run action.
- **INV-V7:** Exported HTML is self-contained and contains no external URL, script, font, stylesheet, or network dependency.
- **INV-V8:** Sharing is available only for the current report; copied text is exactly five readable lines.

## Adversarial Matrix

| Scenario | Expected evidence |
|---|---|
| Definition has source run plus two direct runs | selector returns all three once, newest first |
| Same check moves Violated → Verified | comparison classifies improved |
| Same check moves Verified → Violated | comparison classifies worsened |
| Result IDs added or removed | comparison emits coverage changes |
| Two runs have identical results | comparison collapses to stable summary |
| Previous legacy run lacks execution results | current report renders; comparison is absent/unavailable without invented detail |
| One persisted run is structurally corrupt | valid definition and remaining runs hydrate; card shows degraded history; direct run works |
| Historical report expanded | immutable banner present; save/share absent |
| Export opened offline | content matches current report; zero HTTP(S) requests |
| 390px full journey | no horizontal overflow or obscured controls |

## Implementation Tasks

### Task 1 — Domain snapshots and history selectors

Add failing tests for immutable execution-result snapshots, definition/run association, reverse ordering, mini-history projection, comparison classification, stable collapse, and legacy-run degradation. Implement the smallest pure domain and selector functions that satisfy them.

### Task 2 — Partial history recovery

Add failing storage tests proving valid definitions survive individual malformed runs. Introduce a diagnostic parse path while keeping the existing parser compatible. Hydrate diagnostics into session state and preserve direct-run behavior.

### Task 3 — History navigation and immutable report projection

Add failing reducer and UI contract tests for opening/closing a saved definition’s history, expanding read-only snapshots, preserving library identity, limiting the first page to 20 runs, and hiding historical save/share controls. Implement transient navigation plus reusable report-body rendering.

### Task 4 — Structured comparison and sharing

Add failing tests for current-versus-previous comparison, exact five-line summary, safe filenames, escaped self-contained HTML, clipboard feedback, and download behavior. Implement pure serializers and keep browser side effects in `app.mjs`.

### Task 5 — Responsive product surface

Implement mini-history dots, task detail timeline, comparison block, share drawer, toast, and 390px layout using existing design tokens and CTA hierarchy. Keep the conversation entry, five-stage flow, and Playbook matching behavior unchanged.

### Task 6 — Offline acceptance and review

Extend deterministic build inputs and offline Chrome journeys for two-run history, comparison, copy/export, corrupt-history direct run, and 390px layout. Run package and repository gates, capture desktop/mobile evidence, request Kimi terminal design review, then request independent code review from Terra on the exact SHA.

## Verification Commands

```powershell
pnpm check
node --test tests/saved-inspections.test.mjs tests/storage.test.mjs tests/journeys.test.mjs tests/ui-contract.test.mjs
git diff --check
```

## Close Gate

- AC-V1 through AC-V8 demonstrated by automated contracts and offline Chrome evidence.
- No external asset or request in the standalone artifact.
- No mutation path for historical runs or definitions.
- No blocking P1/P2 from independent review.
