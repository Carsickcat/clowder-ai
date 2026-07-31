# NOVA 变更巡检 Fresh-Context 修复确认

- **Base:** `1994f64`
- **Fix commit:** `877c986`
- **Source:** `fable-5` finding-only fresh-context scan
- **Scope:** 1 × P1、2 × P2

## Red → Green

| Finding                              | Red                                                                                   | Green                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| P1：记录处置与复验被一次页面点击压扁 | 浏览器路径点击一次后直接出现第 3 个 Run                                               | 点击“记录处置”后仍为 2 个 Run、状态为 `working`；再次点击“执行 Verification Run”才生成第 3 个 Run                |
| P2：不可判定是单向死路               | `COMPARABILITY_INVALIDATED` / `EVIDENCE_BECAME_STALE` 后只有 disabled CTA 或重置 Case | 新增 `COMPARABILITY_RESTORED` / `EVIDENCE_REFRESHED`；同一 Case 恢复后仍须执行准入或新的 Verification Run        |
| P2：报告未完全投影快照               | 报告标题、风险摘要、时间线结论和 Claw 解读有硬编码                                    | `ReportSnapshot` 固化 `title`、`summary`、`explanation`、`runIds`、`findingIds`、`decisionIds`，三个界面只读快照 |

## Failure-mode audit

共同不变量：**UI 可执行的动作和对用户陈述的事实，必须来自显式领域状态或不可变快照，不能在组件层拼出第二套流程或真相。**

已扫描：

- 全部 `dispatch` / `data-domain-action` / `getPrimaryAction`；
- 全部阻断态中“重试、刷新、重新验证”的承诺；
- 全部 `ReportSnapshot`、最终结论和 Claw 报告解释引用。

结果：没有其他连续 dispatch；不可判定均有纠正动作；报告的可变事实不再硬编码在视图。目标仓库与根仓库均没有 `check-fallback-layers.mjs`，因此 fallback 自动检查不可用；本次没有新增 fallback 层。

## Verification

```text
npm run check
  37 passed, 0 failed
  Vite build: pass

npm run test:browser:evidence
  desktop / 720 / 390: pass
  unknown recovery: pass
  remediation intermediate state: pass
  console errors: 0

npm run evidence:video
  pass

git diff --check
  pass
```

视觉证据已重新生成，其中：

- `02-change-inspection-unknown-desktop.png` 展示同 Case 恢复动作；
- `04-change-inspection-canary-risk-desktop.png` 展示“记录处置”；
- `05-change-inspection-report-desktop.png` 与 `06-change-inspection-report-mobile.png` 展示快照投影结果；
- `nova-change-inspection-journey-15s.webm` 展示两步复验。

[丢丢/gpt-5.6-sol🐾]
