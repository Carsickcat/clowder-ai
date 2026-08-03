# NOVA Inspection Intelligence — Quality Gate Report

Spec: `feature-specs/2026-08-03-nova-inspection-intelligence-design.md`

Original requirement: current thread message `0001785740169072-000084-c6cd1578`, preserved verbatim in the spec's “Operator direction anchor”.

## Vision coverage

| Operator requirement | Contract | Result |
| --- | --- | --- |
| Preserve the accepted left-history / center-detail / right-CLAW / bottom-plan layout | AC-1, AC-2, INV-1 | ✅ Exact `230px / flexible / 340px` desktop contract; bottom plan spans all columns |
| Make natural language + change guide + business graph improve task generation | AC-3, AC-4 | ✅ Three-source compiler, per-check rationale/confidence/source refs, omissions block confirmation |
| Make task orchestration concrete and legible | AC-5 | ✅ Seven-step plan with dependencies, state-derived status, and evidence counts |
| Make report results intuitive and explainable | AC-6, AC-7 | ✅ Overall score, five dimensions, deductions, remaining risk, recommendation, confidence, citations, CLAW explanation |
| Avoid another divergent shell or truth source | AC-8, INV-2, INV-7, INV-8 | ✅ One reducer case; report intelligence is created in the immutable snapshot; no navigation or production actions added |

## Delivery completeness

- Complete product increment, not a spike or partial shell.
- Source, static distribution, standalone HTML, tests, and browser paths use one journey.
- No unmet AC, deferred item, stub, new runtime dependency, or production integration.
- `tips_exempt`: standalone fixed-mock design prototype; no Hub/runtime capability entry was added.

## Design comparison

- Relevant `.pen` match: none. The only repository `.pen` is unrelated `designs/f070-project-setup-card.pen`.
- Design anchor: exact accepted implementation at commit `75d991ee09d2c31edcfcb44b0f13b5586a598f9b`.
- Intentional changes inside the anchor: historical-task scores, three-source reasoning, CLAW generation workflow, execution plan statuses, scored report.

## Dogfood-Your-Slice

Scope verdict: ✅ required and completed.

End-to-end paths exercised against the committed offline HTML:

1. History task → three sources → confirm → admission → canary risk → remediation → verification → full traffic → acceptance → 98-point report → CLAW explanation.
2. Unknown service → missing guide/graph omissions → no checks → confirmation disabled.
3. Desktop 1440, intermediate 720, mobile 390; no horizontal overflow.

Evidence:

- `npm run test:standalone:browser`: Chrome `file://`, network 0, console 0.
- Full-page Chrome captures visually inspected for request, plan, canary risk, final report, and mobile report.
- 15-second recording generated outside the repository at `%TEMP%/nova-inspection-intelligence-evidence/nova-change-inspection-journey-15s.webm`, network 0.

Dogfood bugs fixed in the same iteration:

- Browser contract used a non-exact heading that collided with “巡检任务执行计划”.
- Evidence recorder required localhost; it now supports the standalone `file://` artifact and asserts network 0.

## Fresh-context closure

Fable 5 scanned exact SHA `5c1a103d58c4edbc5710e0d54f1ed21bd7cbbf8b` as a finding generator and reported three P2s. All were accepted and closed before formal review:

| Finding | Closure |
| --- | --- |
| FC-1: stale/comparability blockers changed the decision but left the next execution step `ready` | The pure selector now maps only the next executable step to `blocked`; historical `passed/resolved/risk` evidence remains unchanged. Unit and browser regressions cover both incomparable admission and stale post-verification states. |
| FC-2: `5/5 风险面已覆盖` treated generated check count as measured risk coverage | Replaced with `5 项检查已生成 · 3 类来源已就绪`; permanent source and browser contracts forbid the old universal-coverage claim. The report dimension is now explicitly `方案覆盖诚实度`. |
| FC-3: report scoring read live plan/comparability/freshness fields | The acceptance Run now persists `reportAssessmentBasis`; score v2 consumes only persisted Runs/Findings/Decisions. Every score dimension and deduction has resolvable evidence refs, and a regression independently reconstructs the exact intelligence object from report-linked evidence. |

Visual dogfood also exposed that the old eight-point deduction did not reconcile with a 98-point weighted score. Score v2 derives each visible deduction from `(100 - dimension score) × weight`; the three deductions total 2.5 points and therefore explain the rounded score of 98 exactly.

## Verification

- Nested product `npm run check`: formatting, 61/61 tests, distribution, standalone Chrome journey — ✅
- Focused intelligence/domain/experience contracts: 35/35 — ✅
- Web full suite: 1865/1865 — ✅. An initial cold concurrent run timed out one unrelated dynamic-import test; focused rerun was 3/3 in 268ms and the full rerun passed.
- MCP suite observed in root run: 73/73 — ✅
- API/shared/MCP/Web production build: `pnpm -r --if-present run build` — ✅
- Root `pnpm lint`: exit 0; only existing warnings outside this diff — ✅
- Root `pnpm check` with Git Bash first on PATH: Biome + feature truth + env/profile + pre-merge contracts — ✅
- Root API build: ✅. The unrestricted API test glob is not a valid Windows isolation gate: it runs stateful config/workspace suites concurrently and produced cross-suite configuration failures outside this diff. Repository-defined Windows smoke remains the merge-gate authority.
- `git diff --check`: ✅
- Lock files changed: none.

## Hygiene and architecture

- Scoped visual evidence was intentionally regenerated under the product's `evidence/` directory; no media or generated artifact escaped the NOVA design slice.
- Architecture cell: `hub-action-surface`.
- Map delta: none.
- Diff adds no Store, Queue, Router, Adapter, Dispatcher, Binding, route, backend connection, or persistence owner.
- Fallback layer scan: no new fallback stack; missing knowledge has one explicit fail-closed branch.
- Permanent drift harness: `tests/experience-contract.test.mjs` freezes both spatial IA and intelligence semantics.
