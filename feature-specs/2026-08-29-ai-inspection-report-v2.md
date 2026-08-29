---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [aiops, inspection, implementation-plan, report]
doc_kind: plan
created: 2026-08-29
---

# AI Inspection Report V2 Implementation Plan

**Feature:** AI_INSPECTION_COPILOT_OFFLINE_DEMO — `designs/ai-inspection-copilot-offline-demo/DESIGN-REPORT-V2.md`
**Goal:** 把巡检报告从文字摘要升级为可下钻、可验证、可转发的裁决仪表盘，同时保持旧历史可读。
**Acceptance Criteria:** AC-R1 报告元信息及分享一致；AC-R2 结构化证据仪表盘；AC-R3 全量检查结果表；AC-R4 有证据锚点的三段式解读；AC-R5 异常证据置顶与 RC 可达；AC-R6 历史同构只读；AC-R7 390px 无横溢；AC-R8 文案与证据纪律。
**Architecture cell:** standalone offline inspection demo
**Map delta:** none
**Map delta why:** 只扩展现有 compiler → immutable Run → selector/render/share 单元，不改变仓库 ownership。
**Architecture:** `report.checkResults[]` 是每项已执行检查及其 measurements 的唯一结构化事实源；证据卡和检查表都是纯投影。Run 元信息由时间戳与锁定计划派生，AI 解读只引用 measurement id；旧版 `keyEvidence` 报告在读取时进入兼容投影，不升级持久化 schema。
**Tech Stack:** 原生 ESM、Node test runner、静态 HTML/CSS、离线 Chrome CDP
**前端验证:** Yes — 单测 + 离线 Chrome + Hub Browser Preview

---

## Finish line

报告当前态与历史态共享同一个 V2 主体渲染器；复制摘要与导出 HTML 使用同一个元信息格式；所有可断言的 AI 文案都能定位到结构化证据。此次不接真实 LLM/后端、不引入图表库、不改 Definition 持久结构、不制造第二份检查结果状态。

## Terminal schema

```js
report.checkResults = [{
  checkId,
  status, // Verified | Violated | Inconclusive | NotEvaluated
  summary,
  measurements: [{
    id,
    label,
    entity,
    kind, // numeric | qualitative
    value, unit, displayValue,
    gate: { operator, value, unit, displayValue },
  }],
}]

report.interpretation = {
  whatHappened: { text, evidenceIds },
  likelyCause: { text, evidenceIds },
  recommendedAction: { text, evidenceIds },
}
```

- lifecycle owner: compiler 生成候选结果；`createInspectionRun` 只保留锁定计划内的 `checkResults`，重算 counts/keyEvidence，并把缺失锚点降为“证据不足”。
- pure projections: report metadata、evidence sorting、ratio width、check rows、legacy report compatibility。
- invariants:
  - INV-R1：持久 Run 中每个 `checkResult.checkId` 都属于该 Run 的锁定 plan。
  - INV-R2：每个非“证据不足”的 interpretation 段落至少引用一个当前 Run measurement id。
  - INV-R3：证据/检查状态计数从筛选后的 `checkResults` 派生，与页面一致。
  - INV-R4：legacy report 无 V2 字段时仍通过 v1 contract 并安全渲染定性兼容态。
  - INV-R5：当前/历史/导出/复制使用同一元信息 formatter。

## Task 1: Contract and run materialization

**Files:**
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/domain.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/scenarios.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/compiler.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/saved-inspections.mjs`
- Test: `designs/ai-inspection-copilot-offline-demo/tests/domain.test.mjs`
- Test: `designs/ai-inspection-copilot-offline-demo/tests/saved-inspections.test.mjs`

1. 写 Red：V2 contract、锁定计划筛选、counts 重算、无效 interpretation 锚点降级、legacy 兼容。
2. 运行定向测试，确认以缺少 V2 materialization 失败。
3. 实现结构校验与 `materializeReportForPlan()`；给 fixture/generic compiler 写结构化结果。
4. 运行定向测试至 Green，并提交契约切片。

## Task 2: Shared report projections and share/export

**Files:**
- Create: `designs/ai-inspection-copilot-offline-demo/src/report-model.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/report-share.mjs`
- Test: `designs/ai-inspection-copilot-offline-demo/tests/report-share.test.mjs`

1. 写 Red：元信息包含任务、时间、窗口、实例、耗时；数值证据排序与比例封顶；复制/导出复用同一元信息。
2. 运行测试确认失败。
3. 实现无状态 projection/formatter 与 legacy 定性 fallback。
4. 运行测试至 Green，并提交模型切片。

## Task 3: Current and historical V2 rendering

**Files:**
- Modify: `designs/ai-inspection-copilot-offline-demo/src/render-report.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/render-saved-inspections.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/selectors.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/app.mjs`
- Test: `designs/ai-inspection-copilot-offline-demo/tests/ui-contract.test.mjs`

1. 写 Red：报告头、违例置顶证据、全量检查折叠行、三段解读与 anchor target、历史同构且无分享/保存。
2. 运行测试确认失败。
3. 实现共享报告主体；当前态只附加分享/比较/保存，历史态只附加不可修改 banner。
4. 运行测试至 Green，并提交渲染切片。

## Task 4: Styling, interaction, and 390px acceptance

**Files:**
- Modify: `designs/ai-inspection-copilot-offline-demo/src/components.css`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/responsive.css`
- Modify: `designs/ai-inspection-copilot-offline-demo/tests/offline.browser.mjs`

1. 写 Red：证据 anchor 点击后高亮、异常卡置顶、RC 可达、390px 无横溢与进度条 ≥120px。
2. 运行浏览器测试确认缺少 V2 DOM/交互而失败。
3. 实现 CSS 状态、scroll/focus 高亮及移动端单列布局。
4. 运行 `pnpm check`，打开 Hub Browser Preview，记录异常/正常/历史/390px 证据。
5. 对照 AC-R1~R8 做 quality-gate 后提交最终切片并请求跨个体 review。
