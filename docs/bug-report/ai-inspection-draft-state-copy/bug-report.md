---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [aiops, draft, review, ux-copy]
doc_kind: bug-report
created: 2026-08-24
---

# 草案状态文案与真实门禁分叉

### Bug 诊断胶囊：可选 AI 建议被表述为必处理

| 栏位 | 内容 |
|------|------|
| **1. 现象** | `medium` 候选不阻断巡检，但草案同时显示“需要你确认”与可点击的“确认并开始巡检”。期望文案准确区分必处理建议与可选建议。 |
| **2. 证据** | Fresh-context scan on `21b5c3c`; `compiler.mjs` 生成 `medium` 候选，而 `selectPlanReadiness()` 只阻断 `high`，`render-plan.mjs` 却统一使用必处理文案。 |
| **3. 问题假设或根因** | 已确认：呈现层使用候选总数推导文案，没有使用 readiness 暴露的 `unresolvedCandidateIds`，导致不同门禁状态被压成同一条文案。 |
| **4. 诊断策略** | 对照 selector、compiler 与真实 generic journey；扫描所有从 `readiness.status` 派生的状态文案。 |
| **5. 超时策略** | 20 分钟内无法用现有 selector 信息表达时，停下并请设计负责人确认是否改变门禁；不改 domain 行为代偿文案问题。 |
| **6. 预警策略** | 若修复要求改变 candidate criticality 或 reducer 门禁，说明越过“行为零变化”边界，立即回退。 |
| **7. 用户可见交互修正** | 高关键度未处理时仍显示“需要你确认”；中关键度未处理时显示“可选建议”，且明确可直接开始。 |
| **8. 验收** | `medium candidate is presented as optional...` 按预期先红后绿；候选双向切换 characterization test 保持绿；产品 86/86，离线 Chrome 0 network / 0 browser errors，exact-head gate 待提交后执行。 |
