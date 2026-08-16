---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [aiops, inspection, user-journey, saved-inspection, local-persistence]
doc_kind: implementation_plan
created: 2026-08-16
updated: 2026-08-16
status: implemented
---

# AI Inspection Dual-Entry Journey Implementation Plan

**Feature:** `AI_INSPECTION_COPILOT_OFFLINE_DEMO` — `feature-specs/2026-08-06-ai-inspection-copilot-offline-demo.md`
**Goal:** Deliver one inspection workbench with a conversational first-use journey and a persisted saved-inspection direct-run journey, while every execution creates a fresh immutable run.
**Acceptance Criteria:** AC-J1 through AC-J8 from `designs/ai-inspection-copilot-offline-demo/DESIGN-JOURNEY.md`.
**Architecture cell:** AI inspection offline demo / standalone product artifact
**Map delta:** none
**Map delta why:** This extends the existing offline inspection artifact and does not change runtime ownership boundaries.
**Architecture:** Keep the current pure reducer and selector core. Add a versioned saved-inspection library domain; the browser adapter is the only `localStorage` owner and hydrates/persists immutable snapshots. The UI remains one three-column workbench: the main stage renders saved inspections or the active journey, and the right rail becomes the persistent conversation entry.
**Tech Stack:** Node ESM, vanilla JavaScript/CSS, deterministic standalone bundler, Node test runner, offline Chrome/CDP.
**前端验证:** Yes — reviewer must verify desktop and 390px first-use/direct-run journeys in Chrome.

---

## Finish Line

At completion, a user can describe an inspection in the right-side conversation, select structured current context, review and execute a generated task, see selected-item results plus model risks, rename and save the task, reload the page, and directly run the saved definition without invoking natural-language generation. Every run refreshes current facts, creates a new run/task ID and evidence snapshot, and blocks silent execution on major drift.

Not building: production data connectors, backend persistence, multi-user sharing, team approval workflow replacement, or mutable historical reports. The UI must continue to disclose local mock persistence.

## Terminal Schema

```js
InspectionDraft = {
  request,
  workspace,
  contextOptions: [{ id, kind, label, detail, selected }],
  selectedContextIds,
}

SavedInspectionDefinition = {
  id,
  version,
  name,
  createdAt,
  updatedAt,
  sourceRunId,
  request,
  selectedContext,
  inspectionPlan,       // checks and source references only; never evidence/report
  baseline: { fingerprint, entities, checkIds },
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
  report,
}

InspectionLibraryEnvelope = {
  schemaVersion: 1,
  revision,
  savedInspections,
  runs,
}
```

## Stateful Object Census

1. `DemoSession`: transient active journey; reducer is sole lifecycle owner.
2. `SavedInspectionDefinition`: persisted reusable structure; library reducer functions are sole lifecycle owner.
3. `InspectionRun`: persisted immutable execution result; created once when a task locks and never updated.
4. `InspectionLibraryEnvelope`: browser persistence boundary; storage adapter validates, migrates, merges, and serializes it.
5. `ConversationEntry`: transient read-only acknowledgement trail; reset with the active journey and never treated as the source of structured choices.

## State and Event Transition Table

| Object | Event | Preconditions | Transition | Forbidden side paths |
|---|---|---|---|---|
| DemoSession | `LIBRARY_HYDRATED` | initial intake only | attach validated library | cannot overwrite an active task |
| DemoSession | `INTENT_SUBMITTED` | intake, no workspace | compile request, create task, add acknowledgement, expose selectable context | cannot run or save yet |
| InspectionDraft | `CONTEXT_ITEM_TOGGLED` | intake + compiled workspace | toggle one known option; retain at least one selected item | unknown IDs are no-op |
| DemoSession | `INPUT_CONFIRMED` | draft has selected context | move to context and preserve selection snapshot | cannot silently restore deselected items |
| DemoSession | `SCOPE_ACCEPTED` / `PLAN_CONFIRMED` | existing reconciliation/readiness gates pass | generate and execute plan | high-risk unresolved candidates still block |
| InspectionRun | final `EXECUTION_ADVANCED` | executing task, final step | lock task and append one immutable run | repeated final events are no-op |
| SavedInspectionDefinition | `SAVED_INSPECTION_CREATED` | locked task, non-empty unique name | create active v1 definition from run structure | cannot copy evidence/report; repeated submission is idempotent |
| DemoSession | `SAVED_INSPECTION_RUN_REQUESTED` | known saved definition, intake | refresh facts and classify exact/minor/major drift | cannot call intent/NLP path |
| DemoSession | `SAVED_INSPECTION_RUN_CONFIRMED` | minor drift explicitly acknowledged | create fresh task/run and execute current plan | major drift cannot enter execution |
| DemoSession | `SAVED_INSPECTION_REGENERATED` | major drift | prefill conversation request and route to structured regeneration | cannot reuse stale evidence |
| DemoSession | `RESET` | any phase | clear active journey, preserve library and run ledger | cannot erase saved user state |
| InspectionLibraryEnvelope | browser `storage` event | valid schema | merge definitions/runs by stable ID and newest version; bump revision | malformed or older data cannot delete valid records |

## Invariants

- **INV-1:** A locked `InspectionRun` and locked `taskInstance` are never mutated. Test by snapshotting before save, reset, reload, catalog change, and rerun.
- **INV-2:** A saved definition contains inspection structure only; it never contains evidence values or a report. Test by recursive property scan.
- **INV-3:** Every generated or direct execution receives a new task ID and run ID. Test two runs of one definition.
- **INV-4:** `RESET` preserves saved definitions and run ledger. Test reducer transitions and reload.
- **INV-5:** Direct run never calls the natural-language compiler used by `INTENT_SUBMITTED`; it uses the stored request contract plus current-fact refresh. Test with a throwing NLP compiler spy.
- **INV-6:** Major drift cannot produce an executing task; minor drift requires an explicit acknowledgement audit event. Test forbidden event sequences.
- **INV-7:** Selected context IDs are snapshot into draft, run, report and saved definition; deselected items never reappear in those projections. Test one-to-one IDs.
- **INV-8:** Invalid/corrupt persisted data degrades to an empty valid library and never prevents the workbench from opening. Test malformed JSON and unknown schema.
- **INV-9:** Duplicate save/final execution events are idempotent. Test repeated actions by identity and collection length.
- **INV-10:** Unknown/deleted definition IDs cannot run. Test direct-run events against an absent record.
- **INV-11:** Concurrent storage envelopes merge by stable ID without losing unique runs or definitions. Test A/B envelopes with overlapping and disjoint records.
- **INV-12:** The interface truthfully labels storage as local mock persistence and makes no production claim. Test rendered copy.

## Adversarial Matrix

| Scenario | Expected evidence |
|---|---|
| Browser reload after save | saved definition and immutable run rehydrate; home direct-run CTA is present |
| Corrupt/unknown storage payload | empty state renders; no exception |
| Two tabs save different definitions | storage merge preserves both IDs |
| Two tabs update one definition | higher version/newer timestamp wins deterministically |
| Same saved task runs twice | two new run IDs; first run byte-deep-equal to original snapshot |
| Definition references an unavailable check | classify major drift; no execution action |
| Minor current-fact delta | differences render; only explicit confirmation executes |
| Major current-fact delta | direct-run blocked; regeneration returns to conversation |
| LocalStorage write failure | active journey remains usable; visible local-save failure message, no false success toast |
| 390px keyboard/input layout | fixed composer does not cover primary CTA; no horizontal overflow |

## Implementation Tasks

### Task 1: Lock the dual-entry domain contract

**Files:**
- Create: `designs/ai-inspection-copilot-offline-demo/lib/saved-inspections.mjs`
- Create: `designs/ai-inspection-copilot-offline-demo/tests/saved-inspections.test.mjs`

1. Write failing tests for schema validation, context option selection, save-definition structure, immutable run creation, envelope serialization/hydration, and concurrent envelope merge.
2. Run `node --test tests/saved-inspections.test.mjs`; expect failures for missing module/exports.
3. Implement the smallest pure functions satisfying the terminal schema and invariants.
4. Rerun the focused test; expect green.
5. Commit the domain slice.

### Task 2: Extend the reducer lifecycle

**Files:**
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/reducer.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/selectors.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/tests/journeys.test.mjs`

1. Add failing first-use tests for selectable context, selected-item projection, locked run creation and immediate personal save.
2. Add failing direct-run tests for exact, minor and major drift; prove compiler bypass, new IDs, audit trail and historical immutability.
3. Implement reducer events and selectors without weakening existing reconciliation/playbook gates.
4. Run focused domain/journey suites; expect all green.
5. Commit the state-machine slice.

### Task 3: Add versioned browser persistence

**Files:**
- Create: `designs/ai-inspection-copilot-offline-demo/src/storage.mjs`
- Create: `designs/ai-inspection-copilot-offline-demo/tests/storage.test.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/app.mjs`

1. Write failing adapter tests for hydrate, persist, corrupt payload, quota failure, and storage-event merge.
2. Implement a single storage key and versioned envelope adapter; inject storage into the app boundary only.
3. Make state-changing library actions persist; show failure truth rather than a false success toast.
4. Run focused tests and existing standalone determinism test.
5. Commit the persistence slice.

### Task 4: Implement the high-fidelity dual-entry workbench

**Files:**
- Create: `designs/ai-inspection-copilot-offline-demo/src/render-saved-inspections.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/render-intake.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/render-plan.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/render.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/render-playbook.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/components.css`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/layout.css`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/responsive.css`
- Modify: `designs/ai-inspection-copilot-offline-demo/tests/ui-contract.test.mjs`

1. Write failing UI contract tests for the right-side composer, honest empty state, selectable context cards, saved list/direct-run states, selected-result report, save bar and local-mock disclosure.
2. Implement the design using existing tokens and single-primary-action discipline.
3. Verify existing Playbook exact/minor/major surfaces remain behaviorally available.
4. Run UI contract tests; expect green.
5. Commit the presentation slice.

### Task 5: Build standalone and prove both journeys in Chrome

**Files:**
- Modify: `designs/ai-inspection-copilot-offline-demo/scripts/build.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/tests/offline.browser.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/tests/standalone.test.mjs`
- Regenerate: `designs/ai-inspection-copilot-offline-demo/index.html`
- Add/update evidence screenshots under `designs/ai-inspection-copilot-offline-demo/evidence/`

1. Add new source files to deterministic bundling.
2. Add browser journeys for first visit, deselection echo, save/reload/direct-run, major-drift block, and 390px completion.
3. Run `pnpm check` inside the demo; require zero network requests and zero browser errors.
4. Record desktop and 390px evidence, rebuild, and verify a clean deterministic worktree.
5. Commit the deliverable slice.

### Task 6: Quality and independent review

1. Run the repository quality gate and feature truth checks.
2. Review AC-J1 through AC-J8 against screenshots and browser assertions.
3. Request Kimi design terminal review and Terra independent code review on the exact SHA.
4. Resolve findings with red-green evidence.
5. Enter merge gate only after all required checks and exact-head reviews are current.

## Resolved Questions

- **Technical:** Deterministic IDs survive hydration by advancing counters from persisted definitions, tasks and runs; fixed fixture timestamps keep the standalone artifact reproducible.
- **Value:** Personal saved inspections are immediately available for direct run. Team Playbook approval remains a separate governance layer.

## Delivery Evidence

- Domain and persistence: versioned local library, immutable definitions/runs, corrupt-storage recovery, concurrent merge and exact/minor/major refresh classification.
- First-use journey: right-side request → selectable current context → task draft → execution → report → editable save.
- Revisit journey: saved-inspection home → current-fact refresh → direct execution without intent compilation or task-draft confirmation.
- Automated verification: 67/67 Node tests; offline Chrome journeys pass with zero HTTP(S) requests and zero browser errors.
- Responsive verification: 390px saved-inspection home uses the full content width; the compact composer is fixed to the bottom without obscuring the primary action.
- Visual evidence: `evidence/11-dual-entry-context-selection.png`, `12-saved-inspection-home.png`, `13-saved-direct-run.png`, `14-mobile-saved-home.png`.
- Walkthrough: `evidence/15-dual-entry-inspection-journey-15s.webm` (16+ seconds).

## Close Gate

- Blocking TODO / follow-up / P1 / P2: none in the scoped implementation plan.
- Production data connectors, backend persistence, multi-user sharing and real approval remain explicit non-goals of this offline acceptance product.
- Independent design and code review remain required before merge.
