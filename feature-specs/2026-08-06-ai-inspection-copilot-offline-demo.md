---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [nova, inspection, copilot, offline-demo, observability]
doc_kind: plan
created: 2026-08-06
updated: 2026-08-09
tips_exempt:
  reason: This is an isolated mock acceptance product under designs/ and adds no runtime capability.
---

# AI Inspection Copilot Offline Product Spec

**Feature:** AI 巡检任务生成与解读 Copilot — user-driven offline product slice
**Goal:** 交付一个无需端口、无需网络、双击即可运行的完整产品投影。用户先描述自己的巡检目标，再按需附加电子流或发布上下文；系统动态编译巡检工作区。两个 mock 用例仅用于快速填充和回归验收，不定义产品形态。

## Product correction

Operator correction (2026-08-09):

> “这是一个完成的产品……产品构建用户决定怎么使用，而不是你直接限制住两个场景给用户用。”

因此产品一级对象是 `InspectionRequest → InspectionWorkspace`，不是 `Scenario`。`ExampleFixture` 只提供可编辑的初始输入；删除所有固定场景导航后，产品能力仍然成立。

## Finish line

SRE 双击 `index.html` 后看到空白的“新建巡检工作区”，可以：

1. 自由输入任意服务、版本与验证目标；
2. 可选填写目标服务，避免实体歧义；
3. 可选附加电子流、发布单或批次作为事实来源；
4. 查看系统编译的实体、变更范围、四维影响面、风险假设和 Check Contract；
5. 处置 AI 候选项、执行 mock 检查并阅读有边界的行动报告；
6. 新建下一次巡检，不受预置用例限制。

离线验收至少覆盖两类结果，但它们是输入样本而非产品模式：

- 用户自定义 `inventory-api` 请求 → `Verified + Proceed`；
- 用户将支付配置示例填入表单并附加 `CHG-84217` → `Violated + Pause + RC Agent`。

## Product / design gates

- **入口：** 单一“创建任意巡检工作区”入口；不得出现固定场景一级导航。
- **上下文：** 自然语言为主输入，电子流/发布单为可选事实来源，两者可组合。
- **示例：** 只能填充表单；用户可编辑，点击示例本身不得创建或切换工作区。
- **决策路径：** 输入理解 → 范围对账 → 任务草案 → 执行取证 → 行动报告。
- **视觉：** action-first、证据与行动二维分离、Unknown 永不渲染为绿色。
- **状态：** blank / compiled / context / plan-blocked / plan-ready / executing / report / mobile。

## Acceptance criteria

- **AC-01 — Offline:** 单一 `index.html` 通过 `file://` 运行；network 0，不需要端口。
- **AC-02 — User-defined product:** 首屏为空白工作区；无 `data-scenario-id` 或“验收场景”导航；任意 `inventory-api` 请求可编译并走完全流程。
- **AC-03 — Composable context:** 目标服务与电子流/发布单均为可选补全；附加上下文进入 provenance，但不成为产品模式。
- **AC-04 — Explainable generation:** 每个正式 Check 包含目的、实体、能力、窗口/基线、规则、严重级别、失败动作、理由和来源。
- **AC-05 — Change reconciliation:** 显式区分声明变化与运行时事实；Observed-Superset 扩大 scope，不能静默 Pass。
- **AC-06 — Plan readiness:** AI 候选在接受/拒绝前不进入 Check；未处置高关键度候选时不得确认计划。
- **AC-07 — Evidence and action:** 证据使用 `Verified / Violated / Inconclusive / NotEvaluated`，行动使用 `Proceed / Proceed-with-conditions / Pause / Rollback`；报告优先展示行动、关键证据、边界与下一步。
- **AC-08 — Responsive and testable:** 1440px 与 390px 无横向溢出；console 0；至少两条用户驱动路径、领域、编译器与单文件构建均有自动化测试。

## Architecture

```text
InspectionRequest
  prompt + optional targetService + optional contextReference
        ↓
Request Compiler
  entity/version extraction + mock capability catalog + context composition
        ↓
InspectionWorkspace
  reconciliation + impact dimensions + risk hypotheses + Check Contracts
        ↓
SRE review → deterministic mock execution → evidence/action report
```

Fixtures live behind the compiler. The runtime session never stores a selected scenario ID.

```js
InspectionRequest = {
  prompt,
  targetService?,
  contextReference?
}

InspectionWorkspace = {
  id, request, title, entryKind,
  declaredChange, observedChange, reconciliation,
  impactDimensions, contextSources, hypotheses,
  candidateChecks, committedChecks, execution, report
}

CheckContract = {
  id, priority, purpose, entity, capability, metric,
  window, baseline, rule, severity, failureAction,
  rationale, sourceRefs
}

DemoSession = {
  workspace: InspectionWorkspace | null,
  phase: "intake" | "context" | "plan" | "execution" | "report",
  candidateDisposition,
  executionStep,
  rcExpanded
}
```

## State transitions

| Current | Event | Guard | Next |
|---|---|---|---|
| blank intake | `INTENT_SUBMITTED` | prompt non-empty | compiled intake |
| compiled intake | `INPUT_CONFIRMED` | workspace exists | context |
| context | `SCOPE_ACCEPTED` | reconciliation verifiable | plan |
| plan | `CANDIDATE_DISPOSED` | known candidate | update disposition |
| plan | `PLAN_CONFIRMED` | readiness ready | execution |
| execution | `EXECUTION_ADVANCED` | steps remain | next step / report |
| report | `RC_TOGGLED` | RC evidence exists | toggle explanation |
| any | `RESET` | none | blank intake |

## Invariants

- **INV-01:** 示例只填充输入，不创建产品模式或持久 session。
- **INV-02:** Session 不保存 `scenarioId`；workspace 来自当前用户请求。
- **INV-03:** 自定义实体必须传播到范围、指标、依赖、Check 与报告。
- **INV-04:** 正式 Check 的来源引用必须可解析。
- **INV-05:** 候选项被接受前不能执行；未处置高风险候选阻断计划。
- **INV-06:** Observed-Superset 的声明外实体必须进入 resolved scope。
- **INV-07:** 证据状态与行动状态正交，缺失证据不能被写成正常。
- **INV-08:** 构建产物无外部资源引用，也不发起 HTTP(S) 请求。

## Safety boundary

- 所有数据均为不可变 mock，不连接生产电子流、指标、Trace、知识图谱或 RC Agent。
- 不生成或执行 SQL、PromQL、脚本、发布、回滚或修复动作。
- 不创建服务端、数据库、登录、持久配置或后台轮询。
- 不用总健康分覆盖关键失败或未知证据。

## Verification evidence

- 编译器测试：任意服务请求与已知高风险上下文。
- UI 契约：空白产品入口、无场景导航、示例只填充。
- 浏览器验收：用户自定义 Proceed 与可编辑示例 Pause + RC。
- 单文件确定性构建、network 0、console 0、390px 无溢出。
