---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO, AI_INSPECTION_PLAYBOOK_REUSE]
topics: [aiops, inspection, quality-gate, acceptance-evidence]
doc_kind: verification
created: 2026-08-09
updated: 2026-09-02
---

# Quality Gate Report

Spec: `feature-specs/2026-09-02-ai-inspection-release-journey-offline-demo.md`

Original request: “输出一份不需要起端口的离线可验收 Demo，要求最少 1-2 个场景可跑完全旅程，数据可以直接 mock。”

Current product requirement: release/change reference first → CandidateSet plan → one explicit confirmation → immutable evidence report and diagnosis; declaration-external services remain visible coverage gaps unless the user explicitly adds an approved rule.

Checked implementation: `feat/ai-inspection-release-journey` worktree, pending independent review.

Check time: 2026-09-02

## Vision coverage

| Operator need | Spec coverage | Implementation verdict |
|---|---|---|
| 产品由用户决定如何使用 | AC-02 | Pass：首次打开为空白工作区，用户自由输入目标 |
| 不被两个验收用例限制 | AC-02, AC-03 | Pass：无固定场景导航；示例只填充表单且可编辑 |
| 发布入口开箱即用 | AC-03 | Pass：变更单 / 发布单为主输入，风险关注点可选 |
| 生成可审阅任务 | AC-04, AC-06 | Pass：CandidateSet 显示阻断检查、可选观察与 coverage gaps |
| 报告用于行动决策 | AC-07 | Pass：Evidence × Action 分离，风险路径联动 RC Agent |
| 离线且可完整验收 | AC-01, AC-08 | Pass：单文件 `file://`，两条用户驱动路径、network 0 |

## Functional acceptance

| AC | Result | Code | Automated evidence |
|---|---|---|---|
| AC-01 Offline | Pass | `scripts/build.mjs`, `index.html` | deterministic standalone test + browser |
| AC-02 User-defined product | Pass | `render-intake.mjs`, `compiler.mjs` | release-first intake; non-fixture `fulfillment-service` full journey |
| AC-03 Composable context | Pass | `InspectionRequest` compiler | required `REL / CHG` reference with optional intent |
| AC-04 Explainable generation | Pass | `domain.mjs`, `render-plan.mjs` | complete Check Contract + resolvable source refs |
| AC-05 Reconciliation | Pass | `reconcileChange`, scope selector | `Observed-Superset` splits blocking scope from coverage gaps |
| AC-06 Plan readiness | Pass | reducer + selectors | optional gaps do not block; only approved candidates can be included |
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
| Release-first product entry | `evidence/00-user-defined-intake.png` |
| Non-fixture `fulfillment-service` request reaches scoped Proceed | `evidence/01-user-defined-proceed.png` |
| Coverage-honest release report | `evidence/23-release-coverage-honest-report.png` |
| Native 390px release plan/report | `evidence/10-release-gap-mobile-plan.png`, `evidence/08-release-coverage-mobile-report.png` |
| 16-second release journey | `evidence/24-release-inspection-journey-15s.webm` |

## Dogfood-Your-Slice

Scope verdict: required and completed.

Paths executed from the built `file://` artifact:

1. Blank product → `CHG-84501` + optional focus → CandidateSet → leave both declaration-external entities unselected → one `PLAN_CONFIRMED` → `Verified + Proceed` with both gaps preserved beside the decision.
2. Blank product → `CHG-84501` → explicitly include the approved `settlement-db` check → one `PLAN_CONFIRMED` → locked three-check report → `Violated + Pause` + RC Agent; `invoice-worker` remains an unresolved coverage gap.
3. Save the completed inspection → revisit it from the release-first home → create a fresh direct Run without mutating the prior locked report.

Dogfood findings fixed in this pass:

- The original product navigation treated acceptance fixtures as user modes. The session and UI now center `InspectionRequest → InspectionWorkspace`.
- CDP evidence capture could hang because WebSocket closing preceded Chrome termination; shutdown order was corrected.
- Recording left `canvas.captureStream()` tracks active; tracks are now explicitly stopped.
- Mid-session viewport switching produced an unreliable blank mobile screenshot; the native 390px path now reloads and reruns the complete risk workflow before capture.
- Terra review P1 found that the generic compiler cloned the order fixture and missed ten domain-bearing fields. The generic branch now constructs every source, Check, execution fact and report field from the current service context.
- Fresh evidence capture exposed Windows Chrome descendants retaining inherited stdio/profile handles. The CDP harness now terminates the exact headless process tree; a child-process timeout regression passed three consecutive runs.
- Visual review caught the 390px sticky confirmation button overlapping the coverage-gap card even though the browser suite was green. A geometry regression now proves the CTA remains in document flow and never intersects the gap surface.

## Fresh verification

```text
pnpm check
  deterministic standalone build: exit 0
  unit/domain/compiler/UI/harness tests: 110/110 pass
  file:// browser: release-first gaps, one confirmation, immutable evidence, history, sharing, exact reuse, 390px, edited-rule fail-closed
  HTTP(S) network requests: 0
  browser errors: 0
  native 390px plan/report visible, no overlap and no horizontal overflow

node --check lib,src,scripts,tests/**/*.mjs
  syntax errors: 0

node tests/record-walkthrough.mjs
  exit 0; 16182ms; 60475 bytes; VP9 WebM

git diff --check
  whitespace errors: 0
```

Artifact:

```text
path: index.html
bytes: 254419
sha256: EA93ED1B8A7B8C8728F31AD1BCADCEDC396C2D44B5871EAEA3410A4B0F180A39
```

Artifact hygiene: no media/design files at repository root. Screenshots and the current walkthrough are archived under `evidence/`.

## Delivery completeness

This is a complete user-driven offline product slice with mock adapters. Production integration can replace the request compiler's mock catalog, evidence runner and RC adapter without rewriting the product entry, Inspection Workspace contract or SRE decision path. Independent acceptance remains a reviewer responsibility; this report is the author-side gate.

## 2026-08-13 Playbook reuse addendum

Design truth: `DESIGN-PLAYBOOK.md`，由烁烁主导。Implementation plan: `feature-specs/2026-08-13-ai-inspection-playbook-reuse-implementation.md`。

| AC | Author-side result | Evidence |
|---|---|---|
| AC-P1 无匹配零打扰 | Pass | unmatched UI contract + browser journey |
| AC-P2 精准匹配直跑 | Pass | exact reducer/UI/browser journey；新任务与新证据 |
| AC-P3 小幅差异确认 | Pass | diff IDs 写入 audit；amber card；适配计划 |
| AC-P4 重大漂移重生成 | Pass | 直跑 no-op；差异确认门禁；`risk-api` 进入 scope/Check |
| AC-P5 审计不可变 | Pass | locked task deep-equality；proposal pending approval |
| AC-P6 空白入口主权 | Pass | 未新增 dashboard；可 dismiss 走普通生成 |
| AC-P7 390px | Pass | major drawer/report；overflow 0 |
| AC-P8 RESET 隔离 | Pass | 新 task ID；match/decision/reference/proposal 全清空 |

Fresh author evidence:

```text
pnpm test: 44/44 pass
offline browser: unmatched/exact/minor/major pass
HTTP(S) requests: 0
browser errors: 0
390px horizontal overflow: 0
walkthrough: 15074ms, 53272 bytes, VP9 WebM
root `pnpm gate`: exit 0 (Biome, feature truth, lint, build, tests, public startup acceptance)
```

Visual evidence: `evidence/06-playbook-exact-match.png`, `07-playbook-exact-report.png`, `04-impact-dimensions.png`, `09-playbook-major-desktop.png`, `10-playbook-major-mobile-drawer.png`, `08-playbook-major-mobile-report.png`。

Kimi-led design review: **DESIGN APPROVE** on 2026-08-13, with no P1/P2. The single P3 ambiguity was closed in the same round: the unconfirmed S4 gate now uses neutral “确认已查看 N 项差异” copy, while the completed state remains green with a `✓`; this keeps pending and completed semantics distinct.

Fresh-context findings on `b3c6ec7` were closed before formal review:

- FC-1 (P2): the generated `index.html` checkout is now pinned to LF by a package-local `.gitattributes` contract; a regression test verifies the attribute, and two consecutive builds leave identical bytes.
- FC-2 (P3): runtime selection now consumes structured catalog `matchRules`, chooses the latest applicable version, and leaves a known service unmatched when its intent signals do not qualify. The request compiler remains the workspace compiler rather than a second playbook matcher.
- FC-3 (P3): implementation-plan trailing whitespace and the extra EOF line were removed; `git diff --check origin/main...HEAD` is clean.

Formal review P2 closure: catalog `checkIds` now resolve, in catalog order, to current-workspace Check Contracts; exact/minor acceptance freezes that structure into the new Task Instance `inspectionPlan`. A revised catalog version changes only the next task plan, while a completed historical task remains deeply equal. Unresolved approved checks downgrade to major drift, and catalog timestamps now drive snapshot freshness metadata instead of a hard-coded label.

Final artifact: `107938` bytes, SHA-256 `77C0332F1330778A4EF7EBA54CC5E0AFD34CB353B4AB4B45B05BA22DCC5CC0FA`; two consecutive builds produced the same bytes.

Design draft scan: the only repository `.pen` is `designs/f070-project-setup-card.pen`, unrelated to this feature. Playbook design truth is the Kimi-led `DESIGN-PLAYBOOK.md` plus browser screenshots. Root artifact hygiene checks returned no matches. Capability tips are explicitly exempt because this is a standalone offline acceptance artifact, not a Cat Café runtime capability or guide.

## 2026-08-16 Dual-entry journey addendum

Design truth: `DESIGN-JOURNEY.md`, led by Kimi. Implementation truth: `feature-specs/2026-08-16-ai-inspection-dual-entry-journey.md`.

| AC | Author-side result | Evidence |
|---|---|---|
| AC-J1 First-use journey | Pass | conversation request → selectable context → plan → execution → report → editable save |
| AC-J2 Selection echo | Pass | selected context IDs project one-to-one into plan, run and report |
| AC-J3 Cross-refresh persistence | Pass | versioned localStorage adapter and reload browser journey |
| AC-J4 Direct-run bypass | Pass | saved definition executes without intent compiler or draft confirmation; new run/task IDs |
| AC-J5 Drift guard | Pass | exact runs directly, minor requires acknowledgement, major cannot execute |
| AC-J6 Copy discipline | Pass | UI contract rejects slogans, decorative module labels and assistant self-introduction |
| AC-J7 390px | Pass | full-width saved card, compact bottom composer, no horizontal overflow |
| AC-J8 Honest empty state | Pass | no fabricated saved inspection; directs the user to the right-side conversation |

Fresh author evidence:

```text
pnpm check
  Node tests: 67/67 pass
  offline Chrome: first-use, save/reload, saved direct-run, exact/minor/major Playbook paths pass
  HTTP(S) requests: 0
  browser errors: 0

node tests/record-walkthrough.mjs
  16+ seconds, VP9 WebM

git diff --check
  whitespace errors: 0
```

Dogfood finding closed before review: the desktop sticky `top` constraint leaked into the 390px fixed composer, while the desktop home grid had higher specificity than the mobile one-column rule. Browser geometry assertions now require a compact bottom bar, a full-width saved-inspection stage/card and no overflow; the responsive rules explicitly reset `top` and the home grid.

Core evidence: `evidence/11-dual-entry-context-selection.png`, `12-saved-inspection-home.png`, `13-saved-direct-run.png`, `14-mobile-saved-home.png`, and `15-dual-entry-inspection-journey-15s.webm`.

Boundary: this proves the offline product journey and local mock persistence. It does not claim production data connectivity, server persistence, real team approval or multi-user sharing.
