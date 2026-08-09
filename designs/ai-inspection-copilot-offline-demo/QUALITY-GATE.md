---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [aiops, inspection, quality-gate, acceptance-evidence]
doc_kind: verification
created: 2026-08-09
---

# Quality Gate Report

Spec: `feature-specs/2026-08-06-ai-inspection-copilot-offline-demo.md`

Original request: “输出一份不需要起端口的离线可验收 Demo，要求最少 1-2 个场景可跑完全旅程，数据可以直接 mock。”

Corrected product requirement: “这是一个完成的产品……产品构建用户决定怎么使用，而不是你直接限制住两个场景给用户用。”

Checked implementation: user-driven product commit `09d0fa9` plus Terra P1 repair in the current review delta.

Check time: 2026-08-09

## Vision coverage

| Operator need | Spec coverage | Implementation verdict |
|---|---|---|
| 产品由用户决定如何使用 | AC-02 | Pass：首次打开为空白工作区，用户自由输入目标 |
| 不被两个验收用例限制 | AC-02, AC-03 | Pass：无固定场景导航；示例只填充表单且可编辑 |
| 支持自然语言和电子流 | AC-03 | Pass：自然语言为主输入，电子流 / 发布单为可选 provenance |
| 生成可审阅任务 | AC-04, AC-06 | Pass：四维影响面、计划分类、Check 来源与候选处置 |
| 报告用于行动决策 | AC-07 | Pass：Evidence × Action 分离，风险路径联动 RC Agent |
| 离线且可完整验收 | AC-01, AC-08 | Pass：单文件 `file://`，两条用户驱动路径、network 0 |

## Functional acceptance

| AC | Result | Code | Automated evidence |
|---|---|---|---|
| AC-01 Offline | Pass | `scripts/build.mjs`, `index.html` | deterministic standalone test + browser |
| AC-02 User-defined product | Pass | `render-intake.mjs`, `compiler.mjs` | blank intake; non-fixture `fulfillment-service` full journey |
| AC-03 Composable context | Pass | `InspectionRequest` compiler | optional target service and `REL / CHG` provenance |
| AC-04 Explainable generation | Pass | `domain.mjs`, `render-plan.mjs` | complete Check Contract + resolvable source refs |
| AC-05 Reconciliation | Pass | `reconcileChange`, scope selector | `Observed-Superset` expands actual scope |
| AC-06 Plan readiness | Pass | reducer + selectors | high-risk candidate blocks until accepted/rejected |
| AC-07 Evidence/action | Pass | report renderer | custom `Verified + Proceed`; risk `Violated + Pause + RC` |
| AC-08 Responsive/testable | Pass | CDP browser suite | native 390px risk path, no overflow/errors/network |

## Product-shape guardrails

- Session contains `workspace`, not `scenarioId`.
- `INTENT_SUBMITTED` compiles the current user request.
- Unknown services use the generic mock capability catalog and propagate their entity through scope, metrics, dependencies, Checks and report.
- Generic workspaces are constructed from the normalized request and generic catalogs; they never clone or rewrite a domain fixture.
- A recursive contract test rejects any order/payment fixture residue in a non-fixture workspace.
- Example clicks do not create or switch a workspace; only form submission does.
- `data-scenario-id` and the “验收场景” navigation are forbidden by tests.

## Design evidence

Relevant `.pen` scan (`inspection|copilot|aiops`): none. The high-fidelity source is `DESIGN.md`.

| Requirement | Evidence |
|---|---|
| Blank user-defined product entry | `evidence/00-user-defined-intake.png` |
| Non-fixture `fulfillment-service` request reaches scoped Proceed | `evidence/01-user-defined-proceed.png` |
| Native 390px risk report with RC evidence | `evidence/03-mobile-report.png` |
| 15-second user-directed risk walkthrough | `evidence/06-user-directed-risk-walkthrough-15s.webm` (15.070s) |

## Dogfood-Your-Slice

Scope verdict: required and completed.

Paths executed from the built `file://` artifact:

1. Blank product → custom `fulfillment-service v7.2.0` + optional `REL-FUL-72` → compiled workspace → expand every Check Contract → confirm no order/payment residue → four mock checks → `Verified + Proceed`.
2. Blank product → editable payment example → form submit → Observed-Superset → candidate disposition → four mock checks → `Violated + Pause` → RC Agent.

Dogfood findings fixed in this pass:

- The original product navigation treated acceptance fixtures as user modes. The session and UI now center `InspectionRequest → InspectionWorkspace`.
- CDP evidence capture could hang because WebSocket closing preceded Chrome termination; shutdown order was corrected.
- Recording left `canvas.captureStream()` tracks active; tracks are now explicitly stopped.
- Mid-session viewport switching produced an unreliable blank mobile screenshot; the native 390px path now reloads and reruns the complete risk workflow before capture.
- Terra review P1 found that the generic compiler cloned the order fixture and missed ten domain-bearing fields. The generic branch now constructs every source, Check, execution fact and report field from the current service context.
- Fresh evidence capture exposed Windows Chrome descendants retaining inherited stdio/profile handles. The CDP harness now terminates the exact headless process tree; a child-process timeout regression passed three consecutive runs.

## Fresh verification

```text
pnpm check
  deterministic standalone build: exit 0
  unit/domain/compiler/UI/harness tests: 22/22 pass
  file:// browser paths: 2/2 pass
  HTTP(S) network requests: 0
  browser errors: 0
  native 390px report visible and no horizontal overflow

node --check lib,src,scripts,tests/**/*.mjs
  syntax errors: 0

node tests/record-walkthrough.mjs
  exit 0; 15070ms; 50112 bytes; VP9 WebM

git diff --check
  whitespace errors: 0
```

Artifact:

```text
path: index.html
bytes: 79433
sha256: 24A7E4FE52064AEECD2412D9545208E456BAC47F0203717C7E327F4C766DEA51
```

Artifact hygiene: no media/design files at repository root. Exactly three screenshots and one walkthrough are archived under `evidence/`.

## Delivery completeness

This is a complete user-driven offline product slice with mock adapters. Production integration can replace the request compiler's mock catalog, evidence runner and RC adapter without rewriting the product entry, Inspection Workspace contract or SRE decision path. Independent acceptance remains a reviewer responsibility; this report is the author-side gate.
