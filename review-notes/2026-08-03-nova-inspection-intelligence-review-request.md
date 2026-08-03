# Review Request: NOVA Inspection Intelligence Workbench

Review-Target-ID: `nova-inspection-intelligence`

Branch: `feat/nova-inspection-intelligence`

Review target: the final commit containing this note; the exact SHA is supplied in the cross-cat handoff.

Behavioral range: `origin/main..review target`

## What

This slice deliberately returns NOVA to the operator-approved `75d991e` workbench and deepens only the two requested AI product cores:

- left: reusable historical inspection tasks and report scores;
- center: the selected task, explainable plan, current evidence, decision and scored report;
- right: CLAW's live conversational generation/explanation workflow;
- bottom: the concrete execution plan, dependencies, statuses and immutable evidence timeline;
- task generation: natural-language intent + synthetic change guide + synthetic business graph compile into sourced checks and orchestration;
- report intelligence: a five-dimensional score, mathematically reconciled weighted deductions, residual risks, recommendation and citations reconstructed only from immutable Runs/Findings/Decisions.

The reviewed artifact is also generated as one offline HTML file:
`designs/nova-ops-observability-platform-v3/NOVA-Ops-Intelligence-Standalone.html`.

## Why

Later NOVA concepts had drifted away from the clearest accepted workbench and toward broader dashboards/product shells. The operator explicitly corrected the direction: preserve the task-detail-CLAW-execution-plan information architecture, then make AI improve task generation/orchestration accuracy and report scoring/interpretation. This change treats that correction as the product boundary rather than adding another shell.

## Original Requirements

> “75d991e.html 的设计最符合我的预期：右侧是 CLAW 实时对话工作流，左侧是历史巡检任务，中间是选中的巡检任务详情，下方是具体执行计划列表状态。请重点细化自然语义、变更指导书、业务知识图谱如何让巡检任务生成和编排更准确，以及巡检报告生成、评分、解读如何更直观；后面的方案已经越来越偏离原来的方向。”

Source: co-creator message `0001785740169072-000084-c6cd1578` in thread `thread_mrrzdymcf3z6bx77`; preserved in `feature-specs/2026-08-03-nova-inspection-intelligence-design.md` under “Operator direction anchor”.

**Please judge the diff against this exact experience and explicitly reject any renewed shell/layout drift.**

## Tradeoffs and boundaries

- This is a deterministic fixed-Mock prototype: no real LLM, guide connector, graph database, telemetry source or production action plane.
- Unknown services expose missing guide/graph omissions and produce no executable checks.
- `ExecutionStepView` is never persisted; it is a pure selector from the one reducer case. Comparability/freshness invalidation blocks only the next executable step and never rewrites historical evidence.
- “5 generated checks” is not presented as “all risk covered”. The UI reports generated scope; the report dimension is explicitly “方案覆盖诚实度”.
- The final acceptance Run persists `reportAssessmentBasis`. Score v2 then consumes only report-linked immutable Runs/Findings/Decisions; every dimension and deduction has resolvable evidence refs.
- Weighted deductions total 2.5 points and exactly explain the rounded score of 98; no hidden or contradictory deduction path remains.
- CLAW can submit intent and explain an existing report, but it cannot deploy, advance canary, accept, rollback or mutate the report.

## Architecture Ownership

Architecture cell: `hub-action-surface`

Map delta: `none`

Why: this evolves an existing first-party, standalone design surface without changing route ownership, backend/runtime integration, external connectors or canonical persistence boundaries. It adds no Store, Queue, Router, Adapter, Dispatcher or Binding.

Please verify that the diff matches `Map delta: none`, keeps one reducer/report truth, and does not smuggle in a second selection, execution or scoring store.

## Fresh-context findings and closure

Fable 5 scanned exact pre-fix SHA `5c1a103d58c4edbc5710e0d54f1ed21bd7cbbf8b` as a finding generator and reported 0 P1 / 3 P2. None were dismissed:

| Finding | Closure in review target |
| --- | --- |
| FC-1: stale/comparability blockers left the next execution step `ready` | Selector now projects that one step as `blocked`; unit + browser regressions cover incomparable admission and stale post-verification. |
| FC-2: generated check count was presented as universal risk coverage | Copy now reports generated checks and input-source classes; source/browser contracts forbid `风险面已覆盖`. |
| FC-3: report dimensions read live reducer plan/comparability/freshness | Acceptance Run persists the basis; exact score v2 is independently reconstructed from immutable report-linked records in tests. |

Visual dogfood then found an adjacent inconsistency: an eight-point deduction accompanied a 98-point score. The review target derives and displays each weighted deduction, with evidence refs and exact score reconciliation.

## Self-check evidence

- Quality report: `review-notes/2026-08-03-nova-inspection-intelligence-quality-gate.md`
- Spec/state census: `feature-specs/2026-08-03-nova-inspection-intelligence-design.md`
- Nested product `npm run check`: formatting + 61/61 + distribution + standalone browser — PASS
- Focused intelligence/domain/experience: 35/35 — PASS
- Offline real Chrome: `file://`, network 0, console 0; task history, three-source plan, incomparable blocker, full execution, score/deductions, 720px and 390px — PASS
- Versioned screenshots: `designs/nova-ops-observability-platform-v3/evidence/01-*.png` through `06-*.png`, regenerated from the exact standalone artifact
- Root Web suite: 1865/1865 — PASS
- MCP observed in root test: 73/73 — PASS
- Root lint/check/build and exact-head `pnpm gate`: will be rerun after the final review-target commit; results are supplied in the handoff
- `git diff --check`: PASS
- Lock files changed: none
- Root media/design artifact gate: empty; all intentional screenshots remain inside the scoped NOVA `evidence/` directory

## Open Questions

### Technical OQ for reviewer

1. Can execution-step projection still show a future step as ready while comparability or freshness makes the case unknown?
2. Can any displayed coverage/score claim be produced without a resolvable immutable evidence reference?
3. Can the report intelligence change when live reducer fields change after the snapshot, or fail independent reconstruction from report-linked records?
4. Does the visual hierarchy preserve the accepted left-history / center-detail / right-CLAW / bottom-plan shell at desktop, 720px and mobile?
5. Are the generated source cards, per-check rationale/confidence and weighted deduction band legible enough to explain AI value without turning the page into a dashboard?

### Value OQ for operator

None. The operator already supplied the direction and layout anchor; this review should verify fidelity, not reopen the product shape.

## Review sandbox

- Suggested path: `E:/ClowderAI/review-sandboxes/nova-inspection-intelligence/siamese`
- Primary browser target: committed standalone `file://` artifact (no port, API or Redis required)
- Optional source build: run `npm ci`, `npm run build:standalone`, and `npm run check` inside `designs/nova-ops-observability-platform-v3`

## Next action

Please perform a formal cross-family review of the exact handoff SHA and give an explicit `APPROVE` or `REQUEST CHANGES`. Every finding must carry P1/P2/P3 severity. Independently open the standalone artifact and exercise at least the explainable-plan, incomparable-baseline and scored-report states instead of relying only on author screenshots.

---

[丢丢/gpt-5.6-sol🐾]
