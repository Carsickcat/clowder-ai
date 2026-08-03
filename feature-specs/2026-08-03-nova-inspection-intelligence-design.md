# NOVA Inspection Intelligence Design Implementation Plan

**Feature:** NOVA Inspection Intelligence — thread-scoped product increment
**Goal:** Preserve the operator-approved `75d991e` inspection workbench while making task generation/orchestration and report scoring/interpretation the two visible AI product cores.
**Acceptance Criteria:** AC-1 through AC-8 below.
**Architecture cell:** `hub-action-surface`
**Map delta:** none
**Map delta why:** This evolves an existing first-party prototype surface without changing route, runtime ownership, external integrations, or canonical backend boundaries.
**tips_exempt:** This is a standalone, fixed-mock product prototype under `designs/`; it adds no Hub/runtime capability, guide entry, or user-discoverable action that can be launched from Console.
**Architecture:** Keep the original three-column workbench and bottom execution board. Add one deterministic inspection-intelligence compiler that projects natural-language intent, a synthetic change guide, and a synthetic business knowledge graph into an explainable plan; add one immutable report-intelligence projection sourced only from persisted runs/findings/decisions. UI state remains a pure projection of the existing case reducer.
**Tech Stack:** React, reducer-based domain model, Node test runner, static standalone build, browser contract.
**前端验证:** Passed — desktop, 720px, and 390px offline browser journeys; console 0, network 0, horizontal overflow 0.
**Implementation status:** Complete in `feat/nova-inspection-intelligence`; pending cross-model review and merge.

---

## Operator direction anchor

> “75d991e.html 的布局最符合预期：右侧是 CLAW 实时对话工作流，左侧是历史巡检任务，中间是选中任务详情，下方是具体执行计划列表状态。请重点细化自然语义、变更指导书、业务知识图谱如何提升任务生成编排准确性，以及巡检报告生成、评分和解读如何更直观；不要继续偏离这个方向。”

## Finish line

The delivered standalone HTML opens directly into the `75d991e` information architecture:

```text
┌────────────────────────────────────────────────────────────────────┐
│ Change context + three-stage journey                               │
├───────────────┬──────────────────────────────┬─────────────────────┤
│ Inspection    │ Selected inspection task     │ CLAW live workflow  │
│ task history  │ plan / evidence / report     │ conversation        │
├───────────────┴──────────────────────────────┴─────────────────────┤
│ Execution plan: steps, dependencies, status, evidence              │
└────────────────────────────────────────────────────────────────────┘
```

The page must make two AI contributions inspectable rather than merely claiming that “AI generated/explained” something:

1. Task generation shows how natural-language intent, change-guide sections, and business-graph nodes/edges produced each check, order, threshold, omission, and confidence value.
2. Report intelligence shows a reproducible score, dimension deductions, evidence citations, residual uncertainty, and a plain-language interpretation.

### Not building

- No real LLM invocation, retrieval service, guide connector, or graph database.
- No production deploy, canary, rollback, or write action.
- No new product shell, route family, global navigation, dashboard, or presentation deck.
- No second source of truth beside the existing reducer case and immutable report snapshot.

## Acceptance criteria

- **AC-1 — Layout anchor:** desktop keeps `230px / flexible / 340px` task-detail-CLAW columns; execution plan spans beneath all three. Mobile stacks task → detail → CLAW → execution plan.
- **AC-2 — Historical task context:** the left rail is explicitly a history of inspection tasks, with selected, active, completed, risk, and report-score semantics; it is not presented as a generic capability menu.
- **AC-3 — Explainable task generation:** the plan exposes all three input sources and every generated check has rationale, confidence, and source references.
- **AC-4 — Coverage honesty:** missing required guide/graph coverage becomes an explicit omission and blocks confirmation; the AI cannot fabricate a complete plan.
- **AC-5 — Visible orchestration:** the bottom list shows the concrete plan steps, dependencies, current status, and linked evidence, derived from the case state.
- **AC-6 — Report score:** the immutable report carries an overall score plus coverage, evidence integrity, comparability, freshness, and risk-closure dimensions with deductions.
- **AC-7 — Report interpretation:** CLAW explains what changed, why the score moved, residual risks, recommendation, confidence, and citations that resolve to immutable snapshot evidence.
- **AC-8 — One product:** source app, static build, standalone HTML, tests, and screenshots all tell the same selected-task journey; no later shell may replace the layout anchor without changing the contract test.

## Terminal schema

```js
InspectionPlan = {
  status,
  version,
  intent,
  generation: {
    sources: [
      { id, kind: "natural_language", title, summary, freshness },
      { id, kind: "change_guide", title, summary, matchedSections },
      { id, kind: "knowledge_graph", title, summary, nodes, edges },
    ],
    confidence,
    omissions: [{ id, severity, title, action }],
  },
  checks: [{
    id, name, metric, rule, phase, priority,
    rationale, confidence, sourceRefs,
  }],
  orchestration: [{
    id, label, phase, dependencyIds, evidenceKind,
  }],
}

ReportSnapshot = {
  ...existingImmutableFields,
  intelligence: {
    score: {
      overall,
      grade,
      modelVersion,
      dimensions: [{ id, label, score, weight, explanation, evidenceRefs }],
      deductions: [{ id, points, reason, evidenceRefs }],
    },
    interpretation: {
      executiveSummary,
      keyEvidence: [{ statement, evidenceRefs }],
      residualRisks: [{ statement, evidenceRefs }],
      recommendation,
      confidence,
      citations,
    },
  },
}
```

The final acceptance `InspectionRun` persists `reportAssessmentBasis` (plan source/check/omission snapshot, comparability contract, and freshness). The score is then reproducible from the report-linked immutable `runs/findings/decisions` alone; it never rereads live reducer fields.

`ExecutionStepView` is a pure selector from `plan.orchestration + stage + runs + findings + decisions`; it is never separately persisted.

## Stateful object gate

### Lifecycle census

| Object | Lifecycle owner | Storage rule |
|---|---|---|
| `ChangeInspectionCase` | `changeInspectionReducer` | Existing deeply frozen reducer state remains canonical. |
| `InspectionPlan` | Intent/compiler transition before execution | Frozen into the case once execution starts; no in-place mutation. |
| `ExecutionStepView` | Pure selector | Never stored; derived on every render. |
| `ReportSnapshot.intelligence` | `createReportSnapshot` | Created once with the immutable report; explanation reads it but cannot rewrite it. |
| Selected task | The current case/source task | No second selection store; selected styling projects from `state.sourceJob`. |

### State × event transitions

| Current | Event | Guard | Next | Visible result |
|---|---|---|---|---|
| `draft/empty` | `INTENT_SUBMITTED` | service + version resolved | `draft/ready` | Three inputs compiled, checks and orchestration visible. |
| `draft/empty` | `INTENT_SUBMITTED` | context incomplete | `draft/clarification` | CLAW names missing context; no fabricated checks. |
| `draft/ready` | `PLAN_CONFIRMED` | no blocker omission + comparable + fresh | `pre-change` | Plan locks; admission step becomes passed. |
| `draft/ready` | `PLAN_CONFIRMED` | blocker omission | unchanged | Confirmation disabled with corrective action. |
| `pre-change` | `CANARY_APPROVED` | passed admission | `canary/risk` | Canary step risk and evidence appear. |
| `canary/risk` | `REMEDIATION_RECORDED` | risk exists | `canary/working` | Remediation decision recorded; verification queued. |
| `canary/working` | `VERIFICATION_RAN` | evidence fresh | `canary/passed` | Verification passes; risk-closure score improves only in final report. |
| `canary/passed` | `CANARY_ADVANCED` | fresh evidence | `post-change` | 100% observation passed. |
| `post-change` | `POST_CHANGE_RAN` | acceptance executed | `completed` | Immutable report and intelligence projection created together. |
| `completed` | `REPORT_EXPLANATION_REQUESTED` | report exists | unchanged | CLAW appends interpretation projected from snapshot. |

### Invariants

- **INV-1:** The layout anchor contains exactly one task-history region, selected-task region, CLAW region, and full-width execution-plan region.
- **INV-2:** Selected task, center detail, CLAW context, execution steps, and report share one case/service/version truth.
- **INV-3:** A ready plan uses all three source kinds; every check has at least one resolvable `sourceRef` and a confidence value.
- **INV-4:** Any blocker omission disables `PLAN_CONFIRMED`; incomplete context cannot produce ready status.
- **INV-5:** Execution step status is a pure selector and cannot disagree with case stage/runs.
- **INV-6:** Report score dimensions and deductions are deterministic from immutable evidence; citations must resolve to run/finding/decision/report IDs.
- **INV-7:** Report explanation changes conversation only; report score, evidence, and conclusion remain bit-for-bit unchanged.
- **INV-8:** CLAW may submit intent and request explanation, but cannot issue deploy/rollback/canary/acceptance production actions.

## Implementation tasks

### Task 1: Freeze the operator-approved product anchor

**Files:**
- Modify: `designs/nova-ops-observability-platform-v3/tests/experience-contract.test.mjs`

1. Add failing assertions for the three desktop columns, full-width execution region, task-history labels, all three generation inputs, score dimensions, and report citations.
2. Run `npm test -- --test-name-pattern="operator-approved|inspection intelligence"` and confirm RED for missing intelligence semantics, while existing layout assertions remain green.
3. Keep these assertions as the permanent drift guard.

### Task 2: Compile explainable inspection plans

**Files:**
- Create: `designs/nova-ops-observability-platform-v3/lib/change-inspection-intelligence.mjs`
- Modify: `designs/nova-ops-observability-platform-v3/lib/change-inspection-intent.mjs`
- Modify: `designs/nova-ops-observability-platform-v3/lib/change-inspection-jobs.mjs`
- Test: `designs/nova-ops-observability-platform-v3/tests/change-inspection-intelligence.test.mjs`

1. Write RED unit tests for three-source compilation, per-check provenance/confidence, blocker omissions, and service truth.
2. Implement a deterministic synthetic guide/graph catalog and plan compiler.
3. Make manual intent and history-task selection use the same compiler.
4. Refactor only after unit tests and existing domain tests are green.

### Task 3: Project execution plan status from the case

**Files:**
- Modify: `designs/nova-ops-observability-platform-v3/lib/change-inspection-intelligence.mjs`
- Create: `designs/nova-ops-observability-platform-v3/components/change-inspection/ExecutionPlanBoard.js`
- Modify: `designs/nova-ops-observability-platform-v3/components/change-inspection/ChangeInspectionApp.js`
- Test: `designs/nova-ops-observability-platform-v3/tests/change-inspection-intelligence.test.mjs`

1. Write RED tests covering queued/running/passed/risk/blocked projections across the case journey.
2. Implement the pure selector and full-width board.
3. Replace the generic timeline placement without moving or removing the three columns.

### Task 4: Make task-generation reasoning visible

**Files:**
- Create: `designs/nova-ops-observability-platform-v3/components/change-inspection/InspectionTaskHistory.js`
- Modify: `designs/nova-ops-observability-platform-v3/components/change-inspection/DecisionSurface.js`
- Modify: `designs/nova-ops-observability-platform-v3/components/change-inspection/ClawPanel.js`
- Modify: `designs/nova-ops-observability-platform-v3/app/change-inspection.css`

1. Write RED experience-contract assertions for task history, source cards, check rationale/confidence, and CLAW workflow events.
2. Relabel the left rail as inspection-task history while preserving its width and selection behavior.
3. Add source/provenance UI to the center plan and live compilation workflow to CLAW.
4. Verify empty, ready, blocker, running, and completed states remain visually distinct.

### Task 5: Score and interpret immutable reports

**Files:**
- Modify: `designs/nova-ops-observability-platform-v3/lib/change-inspection-records.mjs`
- Modify: `designs/nova-ops-observability-platform-v3/lib/change-inspection-actions.mjs`
- Create: `designs/nova-ops-observability-platform-v3/components/change-inspection/ReportIntelligence.js`
- Modify: `designs/nova-ops-observability-platform-v3/components/change-inspection/DecisionSurface.js`
- Test: `designs/nova-ops-observability-platform-v3/tests/change-inspection-intelligence.test.mjs`

1. Write RED tests for deterministic score dimensions/deductions and resolvable citations.
2. Create intelligence in the report snapshot, never on explanation request.
3. Render overall score, dimension bars, deductions, residual risks, recommendation, and confidence.
4. Make CLAW explanation quote the snapshot interpretation without mutation.

### Task 6: Build and verify the one-file experience

**Files:**
- Modify only if contracts require: `designs/nova-ops-observability-platform-v3/tests/golden-path.browser.mjs`
- Generated: `designs/nova-ops-observability-platform-v3/NOVA-Ops-Intelligence-Standalone.html`
- Generated: `designs/nova-ops-observability-platform-v3/static/index.html`

1. Run unit and experience tests.
2. Rebuild static and standalone artifacts from source.
3. Run the real browser journey at desktop: select history task → generate plan → inspect three sources → confirm → risk → remediation → complete → inspect score → ask CLAW to explain.
4. Run one blocker journey and one mobile stack check.
5. Capture evidence outside the versioned product tree and inspect the rendered images. Hub Browser Preview was unavailable because this host rejected background localhost process creation; the same committed standalone artifact was instead exercised directly in real Chrome through `file://` with network 0 and console 0.

## Verification evidence

- Domain + product + distribution tests: `61/61` passed.
- Offline browser acceptance: standalone launch, full journey, task reuse, unmapped-service blocker, desktop/720/mobile, console 0, network 0.
- Visual inspection: request, explainable plan, canary risk, scored final report, and mobile completed state reviewed from full-page Chrome captures.
- Permanent drift guard: `tests/experience-contract.test.mjs` freezes the `230px / flexible / 340px` layout and both AI value axes.
