---
feature_ids: [F257]
topics: [aiops, inspection, offline-prototype, golden-metrics, rule-editing, parallel-execution, trend-evidence]
doc_kind: plan
created: 2026-08-31
tips_exempt:
  reason: refines the existing offline Copilot journey and adds no new product entry point
---

# Editable Golden Metrics and Parallel Inspection — Implementation Plan

**Feature:** F257 — `docs/features/F257-ai-inspection-real-system.md`  
**Goal:** 把离线 Copilot 的检查计划升级为可由 SRE 编辑的结构化黄金指标规则，并让一次确认并行完成全部独立检查，报告、历史和导出都从同一份带趋势证据的不可变 Run 快照投影。  
**Acceptance Criteria:** AC-G1～AC-G8（见下文）  
**Architecture cell:** observability inspection control plane  
**Map delta:** none  
**Map delta why:** 只演进既有 Check Contract、Demo reducer 与 immutable report projection，不新增 Store、Queue、Router 或生产数据边界。  
**Architecture:** `MetricCatalogEntry → Check.metricRules → locked InspectionPlan → deterministic evaluator → immutable Run/Report` 是唯一规则与证据链。编辑态只保存 override；确认时物化进计划，此后页面、历史、复制与导出只读同一 Run 快照。  
**Tech Stack:** ES modules、Node test runner、原生 DOM/CSS、内联 SVG、离线单文件构建。  
**前端验证:** Yes — 必须用真实离线 Chrome 覆盖桌面、390px、规则编辑、并行直跑、趋势图、历史与导出。

---

## Finish Line

SRE 在“将执行的检查”中能看到具体业务/服务黄金指标，编辑受目录约束的比较符与阈值；点击一次“确认并执行 N 项检查”后，所有无依赖检查作为同一批次完成，报告展示当前值、阈值线和关键指标折线，并把编辑后的规则原样带入历史、复制摘要和导出 HTML。

### Not building

- 不开放任意 PromQL/SQL/脚本编辑器，也不允许浏览器新增未注册指标。
- 不接真实数据源、不新增生产 adapter、不把 mock 当 F257 的生产 fallback。
- 不支持有依赖关系的 DAG 编排、定时任务、审批流或自动处置。
- 不让 AI 修改判定结果；AI 仍只解释已经锁定的证据。

## Acceptance Criteria

- **AC-G1 — 黄金指标下钻：** 每张检查卡列出具体指标中文名、metric ID、单位、比较符和阈值；业务结果至少拆到订单提交成功率与支付确认成功率，服务检查至少拆到错误率与 p95 延迟。
- **AC-G2 — 规则可编辑：** SRE 可在白名单允许范围内编辑比较符和阈值；metric ID、单位、执行能力、来源与采集语义只读。非法、空值、NaN、Infinity 或目录未允许的比较符不得进入状态。
- **AC-G3 — 单一规则真相：** 编辑先进入 session override；确认后只物化为 immutable `InspectionPlan.checks[].metricRules`。Run 判定、报告门禁、保存定义、历史、复制和导出均读取该物化规则，不保留平行文本规则。
- **AC-G4 — 一次并行执行：** 首访计划、方案复用和保存任务直跑均通过一次确认完成全部独立检查；不再出现编号步骤、排队、等待下一项或“运行下一项”。
- **AC-G5 — 确定性重判：** 修改阈值后，检查状态、总 Evidence Verdict 与 Action 由同一 evaluator 重算；严格阈值可以把原通过结果变为违例，AI 文案不能沿用与新状态冲突的旧叙述。
- **AC-G6 — 趋势证据：** 关键 numeric measurement 保存至少两个带时间标签的数据点；报告展示响应式折线、阈值线、当前值和状态。定性证据不伪造折线。
- **AC-G7 — 快照一致与兼容：** 当前报告、历史、复制和导出使用同一 Run 报告快照；旧版 scalar `metric/rule` 保存定义可迁移读取，损坏定义仍隔离，不静默丢失整个 library。
- **AC-G8 — 离线与响应式：** 390px 无横溢；内联 SVG 有可访问名称；构建后的单文件保持 0 HTTP(S) 请求、0 browser error。

## Terminal Schema

```js
MetricCatalogEntry {
  metricId, label, category, capability, unit,
  allowedOperators, defaultOperator, defaultThreshold,
  sourceRef
}

MetricRule {
  id, metricId, label, category,
  operator, threshold, unit,
  editable,
  sourceRef
}

CheckContract {
  id, purpose, entity, capability,
  metricRules: MetricRule[],
  window, baseline, criticality,
  failureAction, rationale, sourceRefs
}

NumericMeasurement {
  id, metricId, label, entity, kind: 'numeric',
  value, unit, displayValue,
  series: { label, value }[],
  gate: { operator, value, unit, displayValue }
}
```

`metric` 与 `rule` scalar 只允许出现在 legacy migration 输入；新的 workspace、locked plan、saved definition 和 Run 快照不得再写这两个字段。单位由指标目录决定，避免把 `ms` 改成 `%` 却不换算的伪规则。

## Stateful Object Census

| Object | Lifecycle owner | Mutation window | Persisted truth |
|---|---|---|---|
| Metric catalog | compiler fixture / catalog module | build time only | no, deterministic fixture |
| `checkRuleOverrides` | session reducer | `phase === 'plan'` only | no, transient |
| `InspectionPlan.checks` | session reducer at confirmation | materialize once | yes, in TaskInstance / Saved Definition |
| Raw measurements | workspace fixture/compiler | build time only | copied into Run |
| Run/Report | session reducer | append once | yes, TTL=0 local library |

### State transitions

| State | Event | Guard | Result |
|---|---|---|---|
| plan | `CHECK_RULE_UPDATED` | check/rule exists; operator allowed; finite threshold | replace one override only |
| plan | `PLAN_CONFIRMED` | readiness ready; all overrides valid | materialize rules, evaluate all checks as one batch, append Run, go report |
| context/playbook | `PLAYBOOK_EXECUTION_STARTED` | exact/minor match accepted | lock matched plan, evaluate one batch, append Run, go report |
| saved refresh | `SAVED_INSPECTION_RUN_CONFIRMED` | drift review accepted | lock saved plan, evaluate one batch, append Run, go report |
| report/history | `CHECK_RULE_UPDATED` | always forbidden | state identity unchanged |
| any | legacy `EXECUTION_ADVANCED` | deprecated | state identity unchanged |

## Invariants and Adversarial Matrix

| Invariant | Test proof |
|---|---|
| INV-1 metric/capability/source cannot be client-edited | reducer adversarial event |
| INV-2 unit and allowed operators come from catalog | domain + reducer tests |
| INV-3 one override changes exactly one rule | bidirectional multi-rule test |
| INV-4 confirmed plan is immutable | post-confirm edit identity test |
| INV-5 all run results refer to locked plan check/rule IDs | run contract test |
| INV-6 report gates and statuses use edited rules | strict-threshold pass→violation test |
| INV-7 no sequential progress state remains | journey + HTML contract tests |
| INV-8 trend series belongs to immutable measurement snapshot | domain freeze + history test |
| INV-9 legacy definitions migrate without rewriting unrelated records | storage mixed-library test |
| INV-10 export trend and gate values equal current report | share/export test |

## Implementation Tasks

### Task 1: Structured metric catalog and Check Contract

**Files:**
- Create: `designs/ai-inspection-copilot-offline-demo/lib/metric-catalog.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/domain.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/scenarios.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/compiler.mjs`
- Test: `designs/ai-inspection-copilot-offline-demo/tests/domain.test.mjs`
- Test: `designs/ai-inspection-copilot-offline-demo/tests/compiler.test.mjs`

1. 写 Red：具体黄金指标、结构化规则、目录约束、legacy normalization 与 measurement `metricId/series` 契约。
2. 运行定向测试，确认因缺少 catalog / `metricRules` / `series` 正确失败。
3. 实现 catalog、contract assertions 与 fixture/compiler 终态 schema；不在运行时写 scalar `metric/rule`。
4. 运行定向测试至 Green，检查深冻结与损坏输入隔离。

### Task 2: Editable plan rules and immutable materialization

**Files:**
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/reducer.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/selectors.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/saved-inspections.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/render-plan.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/app.mjs`
- Test: `designs/ai-inspection-copilot-offline-demo/tests/journeys.test.mjs`
- Test: `designs/ai-inspection-copilot-offline-demo/tests/ui-contract.test.mjs`
- Test: `designs/ai-inspection-copilot-offline-demo/tests/saved-inspections.test.mjs`

1. 写 Red：编辑 operator/threshold、非法输入拒绝、指标字段只读、确认后不可改、保存定义带最终规则。
2. 运行测试确认失败原因指向缺少事件与投影。
3. 添加 reducer-owned overrides、纯 selector materialization 和计划卡内联编辑器。
4. 运行测试至 Green；candidate 被加查后的规则使用同一编辑路径。

### Task 3: One-shot parallel evaluator

**Files:**
- Create: `designs/ai-inspection-copilot-offline-demo/lib/evaluator.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/reducer.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/selectors.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/render.mjs`
- Test: `designs/ai-inspection-copilot-offline-demo/tests/journeys.test.mjs`
- Test: `designs/ai-inspection-copilot-offline-demo/tests/ui-contract.test.mjs`

1. 写 Red：首访/复用/保存任务均一击到 report，Run 恰好追加一次；严格阈值重算为 Violated/Pause；无“下一项/排队/编号步骤”。
2. 运行测试确认旧 sequential reducer 正确失败。
3. 实现一个共享 `completeInspectionRun` 与 deterministic evaluator；删除 `executionStep` 的业务意义和 `EXECUTION_ADVANCED` 路径。
4. 运行定向 journey 与 storage tests 至 Green，验证重复事件幂等。

### Task 4: Trend charts from immutable report snapshots

**Files:**
- Create: `designs/ai-inspection-copilot-offline-demo/src/report-trend.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/report-model.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/render-report.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/report-share.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/components.css`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/responsive.css`
- Test: `designs/ai-inspection-copilot-offline-demo/tests/report-share.test.mjs`
- Test: `designs/ai-inspection-copilot-offline-demo/tests/ui-contract.test.mjs`

1. 写 Red：关键 numeric 证据有 SVG 折线、阈值线、accessible label；定性证据没有伪图；导出使用同一 series/gate。
2. 运行测试确认缺少 trend projection/rendering 而失败。
3. 实现共享、无状态的 SVG geometry/renderer；当前页与导出只传不可变 measurement。
4. 运行测试至 Green，覆盖零门禁、平线、单值 legacy fallback 和 escape。

### Task 5: Legacy migration, offline browser, docs and delivery

**Files:**
- Modify: `designs/ai-inspection-copilot-offline-demo/src/storage.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/tests/storage.test.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/tests/offline.browser.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/ARCHITECTURE.md`
- Modify: `designs/ai-inspection-copilot-offline-demo/README.md`
- Modify: `docs/features/F257-ai-inspection-real-system.md`

1. 写 Red：旧 definition 混入新 library 可恢复；规则编辑→一次执行→折线报告→历史→导出的真实 Chrome 路径；390px 无横溢。
2. 运行浏览器测试确认旧页面因 sequential UI 和无趋势图失败。
3. 实现 migration 与响应式样式，同步文档和 F257 UX truth，不改真实 provider 边界。
4. 运行 Demo `pnpm check`、整仓 `pnpm gate`、`git diff --check`。
5. 打开隔离预览，记录计划编辑、异常趋势、历史与 390px 证据；完成 quality-gate、fresh-context、跨个体 review、merge-gate。
6. 合入后在 detached acceptance sandbox 复验，并用合入产物覆盖桌面 `AI巡检Copilot.html`。

## Open Questions

无 operator 决策阻塞。单位保持目录只读是数据语义约束；若未来需要单位切换，必须由 catalog 提供带换算的允许单位，而不是自由文本。
