---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [nova, inspection, copilot, offline-demo, observability]
doc_kind: plan
created: 2026-08-06
tips_exempt:
  reason: This is an isolated, fixed-mock acceptance prototype under designs/ and adds no runtime capability.
---

# AI Inspection Copilot Offline Demo Implementation Plan

**Feature:** AI 巡检任务生成与解读 Copilot — offline acceptance slice
**Goal:** 交付一个无需端口、无需网络、双击即可运行的自包含 HTML，完整演示自然语言与电子流两类输入如何生成可审阅巡检任务并形成证据化结论。
**Acceptance Criteria:** AC-1 至 AC-8（见下文）。
**Architecture cell:** `hub-action-surface`
**Map delta:** none
**Map delta why:** 这是现有 NOVA inspection control-plane 语义的离线投影，不新增产品路由、后端所有权或生产集成。
**Architecture:** 复用 NOVA 的风险假设、Check Contract、证据与行动分离语义；用不可变 scenario fixtures + 单一 reducer 驱动两个确定性 mock 旅程。构建器将 HTML、CSS、JS 和场景数据内联为一个文件，浏览器通过 `file://` 运行且不发起网络请求。
**Tech Stack:** 原生 ES modules、Node test runner、Chrome DevTools Protocol file:// acceptance、零依赖静态单文件构建。
**前端验证:** Yes — desktop 与 mobile，两个 golden path、一个 blocker 状态、console 0、network 0、horizontal overflow 0。

---

## Finish line

SRE 直接打开 `index.html`，可以分别跑通：

1. **自然语言巡检**：输入服务升级意图 → 确认实体与范围 → 查看业务图谱/Trace/指标目录如何生成检查 → 审阅并确认任务 → 执行 mock 巡检 → 阅读 scoped Pass 报告。
2. **电子流巡检**：载入变更单 → 对账声明变更与实际配置 hash → 发现 Observed-Superset 并扩大影响面 → 生成检查 → 执行 mock 巡检 → 发现数据库连接等待风险 → 联动 RC Agent → 输出 Pause 建议与证据链。

离线 artifact 不依赖 localhost、CDN、字体、图片或 API；源码和测试保留为最终交付的一部分，不做一次性手写 HTML。

## Product / design gates

- **入口层级：** isolated acceptance surface，不进入 Console L1/L2/L3 导航；由本地文件直接打开。
- **用户对象：** 负责服务发布或变更验收的一线 SRE。
- **首屏决策：** 当前旅程、声明/实际变更对账、计划准备度、建议行动。
- **视觉约束：** token-first；复用 NOVA 深色运维工作台语义，不引用外部设计资产。
- **状态矩阵：** `intake / context / plan / execution / report`；自然语言 happy path + 电子流 risk path；desktop / mobile。

## Acceptance criteria

- **AC-1 — Offline:** 构建产物是单一 HTML；`file://` 下 network 0，运行不需要端口。
- **AC-2 — Two complete journeys:** 两个场景都可从输入走到最终报告，Reset 后无状态串线。
- **AC-3 — Explainable generation:** 每个正式检查包含目的、实体、能力、窗口/基线、规则、严重级别、失败动作、理由和来源。
- **AC-4 — Change reconciliation:** 电子流场景显式区分 Declared Change 与 Observed Change；superset 必须扩展 scope，不能静默 Pass。
- **AC-5 — Plan readiness:** LLM 候选在被接受/拒绝前不进入 Check；高关键度候选未处置时不得确认计划。
- **AC-6 — Evidence/action separation:** 证据使用 `Verified / Violated / Inconclusive / NotEvaluated`，行动使用 `Proceed / Proceed-with-conditions / Pause / Rollback`；UI 不将 Unknown 洗成 Pass。
- **AC-7 — Decision-oriented report:** 首屏优先给行动、关键证据、具名缺口和下一步；risk path 可展开 RC Agent 诊断结果。
- **AC-8 — Responsive and testable:** 1440px 与 390px 无横向溢出；browser console 0；领域、构建和两条旅程均有自动化测试。

## Not building

- 不接生产指标、真实电子流、真实知识图谱或 RC Agent。
- 不生成或执行 SQL、PromQL、脚本、发布、回滚或修复动作。
- 不创建服务端、数据库、用户登录、持久配置或后台轮询。
- 不做全局知识图谱/指标语义重建，不声明 mock 分数代表真实准确率。
- 不用一个总健康分覆盖关键失败或缺失证据。

## Terminal schema

```js
Scenario = {
  id, entryKind, title, prompt, declaredChange, observedChange,
  reconciliation, contextSources, hypotheses, candidateChecks,
  committedChecks, execution, report
}

CheckContract = {
  id, priority, purpose, entity, capability, metric,
  window, baseline, rule, severity, failureAction,
  rationale, sourceRefs
}

DemoSession = {
  scenarioId,
  phase: "intake" | "context" | "plan" | "execution" | "report",
  candidateDisposition,
  executionStep,
  rcExpanded
}
```

`planReadiness`、`coverageSummary`、`currentAction` 与最终 view model 都是纯 selector，不独立存储。

## Stateful object gate

### Lifecycle census

| Object | Owner | Storage | Lifecycle |
|---|---|---|---|
| `Scenario` | fixture module | immutable source | process lifetime, never mutated |
| `DemoSession` | `demoReducer` | browser memory only | selected → progressed → reset |
| `candidateDisposition` | `DemoSession` | browser memory only | proposed → accepted/rejected |
| `planReadiness` | selector | never stored | derived from required dispositions and formal checks |
| `ReportView` | selector | never stored | derived from scenario evidence + phase |

### State × event transitions

| Current | Event | Guard | Next |
|---|---|---|---|
| any | `SCENARIO_SELECTED` | known scenario | fresh `intake` session |
| `intake` | `INPUT_CONFIRMED` | declared context complete | `context` |
| `context` | `SCOPE_ACCEPTED` | reconciliation not conflict/unverifiable | `plan` |
| `plan` | `CANDIDATE_DISPOSED` | known candidate | same phase, update disposition |
| `plan` | `PLAN_CONFIRMED` | `planReadiness === ready` | `execution` |
| `execution` | `EXECUTION_ADVANCED` | steps remain | next deterministic step |
| last execution step | `EXECUTION_ADVANCED` | all evidence terminal | `report` |
| `report` | `RC_TOGGLED` | scenario has RC evidence | same phase, toggle explanation |
| any | `RESET` | none | fresh session for selected scenario |

### Invariants

- **INV-1:** Scenario fixtures stay deeply immutable; switching/resetting cannot leak candidate or execution state.
- **INV-2:** A formal Check always carries every terminal `CheckContract` field and resolvable source refs.
- **INV-3:** A proposed candidate is not a Check and never appears as executed evidence before acceptance.
- **INV-4:** Any unresolved high-criticality candidate makes `planReadiness=blocked`.
- **INV-5:** `Observed-Superset` contributes every observed entity to the resolved scope.
- **INV-6:** Report action and evidence verdict are separate fields; a report cannot infer `Proceed` from absence of violations alone.
- **INV-7:** Report and RC explanation are projections; opening explanation cannot rewrite evidence or action.
- **INV-8:** The built artifact contains no external asset references and performs no HTTP(S) requests.

## Implementation tasks

### Task 1: Freeze domain contracts with RED tests

**Files:**
- Create: `designs/ai-inspection-copilot-offline-demo/tests/domain.test.mjs`
- Create: `designs/ai-inspection-copilot-offline-demo/tests/journeys.test.mjs`

1. Write tests for Check Contract completeness, observed-superset scope expansion, candidate readiness, evidence/action separation and reset isolation.
2. Run `node --test tests/domain.test.mjs tests/journeys.test.mjs`.
3. Expected RED: missing `lib/domain.mjs`, `lib/scenarios.mjs`, and `lib/reducer.mjs`.

### Task 2: Implement immutable scenarios and reducer

**Files:**
- Create: `designs/ai-inspection-copilot-offline-demo/lib/domain.mjs`
- Create: `designs/ai-inspection-copilot-offline-demo/lib/scenarios.mjs`
- Create: `designs/ai-inspection-copilot-offline-demo/lib/reducer.mjs`
- Create: `designs/ai-inspection-copilot-offline-demo/lib/selectors.mjs`

1. Implement terminal schemas and deep-freeze fixtures.
2. Implement the state transitions and pure selectors required by INV-1..8.
3. Run focused tests; expected GREEN.

### Task 3: Build the offline UI from the contracts

**Files:**
- Create: `designs/ai-inspection-copilot-offline-demo/src/index.html`
- Create: `designs/ai-inspection-copilot-offline-demo/src/app.mjs`
- Create: `designs/ai-inspection-copilot-offline-demo/src/render.mjs`
- Create: `designs/ai-inspection-copilot-offline-demo/src/tokens.css`
- Create: `designs/ai-inspection-copilot-offline-demo/src/layout.css`
- Create: `designs/ai-inspection-copilot-offline-demo/src/components.css`
- Create: `designs/ai-inspection-copilot-offline-demo/src/responsive.css`

1. Render the Product Gate information hierarchy: scenario rail, context/reconciliation, task plan, execution/report, Copilot rationale.
2. Wire keyboard-safe buttons for phase progress, candidate disposition, evidence drill-down, RC explanation and reset.
3. Keep all source files below the 350-line hard split threshold.

### Task 4: Produce a deterministic single-file artifact

**Files:**
- Create: `designs/ai-inspection-copilot-offline-demo/scripts/build.mjs`
- Create: `designs/ai-inspection-copilot-offline-demo/tests/standalone.test.mjs`
- Create: `designs/ai-inspection-copilot-offline-demo/index.html`
- Create: `designs/ai-inspection-copilot-offline-demo/package.json`

1. Write RED assertions for one HTML file, inline CSS/JS, no external refs, embedded scenario labels and deterministic rebuild.
2. Implement build-time module bundling for the small local import graph and raw-text terminator escaping.
3. Rebuild and confirm byte-identical checked artifact.

### Task 5: Verify both file:// journeys

**Files:**
- Create: `designs/ai-inspection-copilot-offline-demo/tests/offline.browser.mjs`
- Create: `designs/ai-inspection-copilot-offline-demo/README.md`

1. Use the local Chrome executable through a zero-dependency CDP client; no runtime server or package install.
2. Run browser journeys against `file://.../index.html`.
3. Assert natural-language final `Proceed`, electronic-flow final `Pause`, RC explanation, network 0, console 0, 1440px/390px no overflow.
4. Run `pnpm test`, `pnpm test:browser`, build reproducibility, and repository focused checks.

## Verification evidence

- Unit RED/Green logs for INV-1..8.
- Deterministic standalone build test.
- Browser transcript for both golden paths and mobile overflow check.
- Checked-in standalone artifact and README opening instructions.
