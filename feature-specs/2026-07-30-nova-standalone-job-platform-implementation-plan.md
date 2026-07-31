# NOVA Standalone Job Platform Implementation Plan

**Feature:** NOVA Change Inspection Journey — standalone job reuse extension  
**Goal:** Deliver one offline HTML that lets a leader demo either a new inspection request or a reusable saved inspection job through the same reviewed change-inspection journey.  
**Acceptance Criteria:** AC-J1 through AC-J8 below  
**Architecture cell:** Prototype-local frontend projection  
**Map delta:** none  
**Map delta why:** This extends the existing prototype-local `ChangeInspectionCase`; it adds no backend, production connector, persistent store, or runtime ownership boundary.  
**Architecture:** Add immutable `InspectionJobTemplate` fixtures and a reducer-owned `JOB_SELECTED` transition that creates a fresh draft Case with a reviewable plan. Project the templates in a left-side job rail inside the existing journey workspace, then rebuild the same checked-in offline HTML.  
**Tech Stack:** React 19, pure frontend reducer, Node test runner, Playwright, Vite standalone builder  
**前端验证:** Yes — domain tests, 1440/720/390 browser journeys, `file://` offline acceptance, console 0, network 0

---

## Finish Line

`NOVA-Ops-Intelligence-Standalone.html` can be copied to an external system and opened directly; the user can choose a saved inspection job, review its plan, complete the full mocked journey, return to the job platform, and start a new blank inspection without any network or localhost dependency.

### What We Are Not Building

- No real LLM, observability backend, deployment integration, scheduling engine, authentication, or production action.
- No job editor, job creation form, deletion, sharing, server persistence, or `localStorage`.
- No reuse of historical Run, Finding, Decision, Baseline, or Report objects.
- No second top-level product or another seven-menu shell.

## Acceptance Criteria

- **AC-J1:** The workspace shows a clearly labelled “作业平台” with at least three saved inspection jobs and their last-run status.
- **AC-J2:** Selecting a saved job creates a fresh `ChangeInspectionCase` whose service, version, plan, checks, frequency, window, and baseline come from that template.
- **AC-J3:** A selected job contains zero Runs, Findings, Decisions, Baselines, and Reports until the user explicitly confirms the plan.
- **AC-J4:** An in-progress Case cannot be silently replaced by another saved job; job switching becomes available again after completion or reset.
- **AC-J5:** “新建巡检” returns to a clean blank Case, and the natural-language input path remains available.
- **AC-J6:** The saved-job path completes the same admission → 25% canary risk → remediation → verification → 100% → post-change report journey.
- **AC-J7:** The checked-in standalone artifact is byte-identical to a rebuild, opens via `file://`, makes zero network requests, and produces zero console/page errors.
- **AC-J8:** The job platform and full journey remain usable without horizontal overflow at 1440, 720, and 390 pixels.

## Terminal Schema

```js
InspectionJobTemplate = deepFreeze({
  kind: "InspectionJobTemplate",
  id,
  name,
  summary,
  service,
  version,
  environment,
  changeId,
  intent,
  frequency,
  window,
  baseline,
  lastRun: {
    finishedAt,
    result, // passed | risk | unknown
    reportId,
  },
});

ChangeInspectionCase = deepFreeze({
  ...existingCaseFields,
  sourceJob:
    null |
    {
      id,
      name,
    },
});
```

The template library is immutable fixture data. `sourceJob` is provenance copied into the newly created Case; it is not an independently mutable selection state.

## Stateful Object Gate

### Object Census

| Object                             | Lifecycle owner              | Storage             | Notes                                                     |
| ---------------------------------- | ---------------------------- | ------------------- | --------------------------------------------------------- |
| `InspectionJobTemplate`            | `change-inspection-jobs.mjs` | Immutable fixture   | Read-only demo catalog                                    |
| `ChangeInspectionCase`             | `changeInspectionReducer`    | React reducer state | Existing state machine, extended with template provenance |
| `InspectionRun` / evidence objects | `changeInspectionReducer`    | Nested in Case      | Never copied from a template or previous Case             |

### State × Event Transition Table

| Current Case state                      | Event                 | Result                                                                                  |
| --------------------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| `draft`                                 | `JOB_SELECTED(jobId)` | Replace with a fresh draft Case whose plan is ready and whose evidence arrays are empty |
| `completed`                             | `JOB_SELECTED(jobId)` | Start a fresh draft Case from the selected template                                     |
| `pre-change` / `canary` / `post-change` | `JOB_SELECTED(jobId)` | Reject/no-op; active evidence cannot be discarded silently                              |
| any                                     | `CASE_RESET`          | Return to a blank draft Case with `sourceJob: null`                                     |
| template-backed `draft`                 | `PLAN_CONFIRMED`      | Create the first admission Run exactly as the existing journey does                     |
| any                                     | unknown `jobId`       | Reject/no-op; never fabricate a template                                                |

### Invariants

- **INV-J1:** Every job template and nested `lastRun` object is deeply frozen.
- **INV-J2:** Selecting a job never copies or creates Run, Finding, Decision, Baseline, or Report evidence.
- **INV-J3:** The first Run can only appear after `PLAN_CONFIRMED`.
- **INV-J4:** Every generated evidence object uses the selected Case service/version; historical job metadata cannot leak into the new run.
- **INV-J5:** `JOB_SELECTED` cannot replace an in-progress Case.
- **INV-J6:** `CASE_RESET` removes template provenance and all evidence.
- **INV-J7:** The offline artifact performs zero HTTP(S) requests.

### Adversarial Test Matrix

| Scenario                                                         | Expected proof                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| Select template, then inspect state before confirmation          | Plan ready; all evidence collections empty             |
| Select template A, start canary, attempt template B              | Reducer returns the same Case                          |
| Complete template A, then select template B                      | New draft Case contains B provenance and no A evidence |
| Select unknown template ID                                       | Reducer returns the same Case                          |
| Mutate template or nested last-run metadata                      | Throws `TypeError`                                     |
| Open standalone at `file://`, use a saved job through completion | Full journey passes; network 0; console 0              |

## Implementation Tasks

### Task 1: RED — Domain Contract

**Files:**

- Create: `designs/nova-ops-observability-platform-v3/lib/change-inspection-jobs.mjs`
- Modify: `designs/nova-ops-observability-platform-v3/tests/change-inspection.test.mjs`

1. Add failing tests for INV-J1 through INV-J6.
2. Run `node --test tests/change-inspection.test.mjs`.
3. Confirm failure is caused by missing job templates/transitions.

### Task 2: GREEN — Reducer-Owned Job Selection

**Files:**

- Modify: `designs/nova-ops-observability-platform-v3/lib/change-inspection.mjs`
- Modify: `designs/nova-ops-observability-platform-v3/lib/change-inspection-actions.mjs`
- Create: `designs/nova-ops-observability-platform-v3/lib/change-inspection-jobs.mjs`

1. Define immutable templates.
2. Add the guarded `JOB_SELECTED` transition.
3. Reuse `createInspectionChecks`; do not duplicate execution or evidence logic.
4. Run the focused domain test until green.

### Task 3: RED/GREEN — Job Platform Projection

**Files:**

- Create: `designs/nova-ops-observability-platform-v3/components/change-inspection/InspectionJobPlatform.js`
- Modify: `designs/nova-ops-observability-platform-v3/components/change-inspection/ChangeInspectionApp.js`
- Modify: `designs/nova-ops-observability-platform-v3/components/change-inspection/JourneyHeader.js`
- Modify: `designs/nova-ops-observability-platform-v3/app/change-inspection.css`
- Modify: `designs/nova-ops-observability-platform-v3/tests/experience-contract.test.mjs`
- Modify: `designs/nova-ops-observability-platform-v3/tests/golden-path.browser.mjs`

1. Add failing source and browser contracts for AC-J1 through AC-J6 and AC-J8.
2. Render the job rail as the first column of the existing workspace.
3. Keep one primary action in the decision surface.
4. Disable job switching while a Case is in progress and explain why.
5. Verify desktop and mobile ordering/overflow.

### Task 4: Rebuild and Verify the Offline Artifact

**Files:**

- Regenerate: `designs/nova-ops-observability-platform-v3/NOVA-Ops-Intelligence-Standalone.html`
- Modify: `designs/nova-ops-observability-platform-v3/tests/standalone.browser.mjs`
- Modify: `designs/nova-ops-observability-platform-v3/README.md`

1. Add a failing `file://` saved-job golden path.
2. Run `npm run build:standalone`.
3. Run `npm test`.
4. Run `npm run test:standalone:browser`.
5. Confirm artifact rebuild equality, network 0, console 0, and all viewports.

### Task 5: Quality Gate and Handoff

1. Run `npm run check`.
2. Open the current worktree preview in Hub Browser.
3. Verify the leader demo path and one blocked path.
4. Commit only owned source, tests, docs, and the standalone artifact.
5. Request cross-individual review; do not include reviewer-owned dirty evidence files.
