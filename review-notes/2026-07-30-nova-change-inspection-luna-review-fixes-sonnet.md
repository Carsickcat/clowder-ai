# NOVA 变更巡检 — Luna 评审修复

- **Reviewer:** Luna / gpt-5.6-luna
- **Original review SHA:** `1994f64`
- **P1/P2 fixed SHA:** `98a82fe`
- **Current candidate SHA:** `2ee34fe`
- **Author:** 丢丢 / gpt-5.6-sol
- **Review message:** `0001785346746762-000269-303d90ea`

## Verdict received

`REQUEST CHANGES`

## Red → Green

| Finding | Fresh-context 分类 | Red | Green | 证据 |
| --- | --- | --- | --- | --- |
| P1：任意输入都会生成固定 `payments-router v3.18.0` 方案 | `[FC:new]` | 输入未驱动领域对象，存在伪造计划风险 | 新增意图解析；从本次输入提取服务名与版本，缺任一字段进入澄清态且不生成方案或 Run | `change-inspection.test.mjs` 覆盖自定义服务和缺参输入；720px 浏览器路径验证 `inventory-service v2.4` |
| P1：`不可判定` 没有恢复路径，且 Claw 仍显示绿色完成 | `[FC:covered]` 恢复路径；`[FC:new]` 绿色矛盾 | 阻断只能重置，Claw 与主决策状态冲突 | 基线不可比与证据过期均可在同 Case 纠正；Claw 在无效可比性时只显示琥珀色补充态 | unit + browser 非 happy path |
| P1：报告页面与 Claw 没有共用最终报告真相 | `[FC:covered]` | 文案分别硬编码 | 页面、时间线与 Claw 全部投影不可变 `ReportSnapshot` | 快照投影测试 |
| P2：一次点击同时记录处置并执行复验 | `[FC:covered]` | 用户看不到处置后的待复验状态 | 拆成“记录处置”和“执行复验”两个独立动作 | unit + browser 断言中间态只有 2 次巡检 |
| P2：主界面暴露内部英文对象名 | `[FC:new]` | `InspectionRun`、`DecisionRecord`、`ReportSnapshot` 等进入用户界面 | 主界面统一为“巡检记录、决策、报告快照”等中文；技术 ID、服务名和 Metric 保留原文 | experience contract + 桌面/移动截图 |
| P2：输入框预填完整请求 | `[FC:new]` | 首屏误导为用户已输入并准备执行 | 输入框初始为空，只用 placeholder 给示例；空输入禁用提交 | component contract + 浏览器首屏 |

## Failure-mode audit

这六项落在三个共同不变量：

1. 用户意图必须成为方案的事实来源，信息不足就澄清；
2. 页面状态、Claw 陈述和可执行动作必须彼此一致；
3. 用户语言与内部对象语言分层，技术对象不能泄漏为导航或主操作。

对应不变量已写入 `feature-specs/2026-07-30-nova-change-inspection-journey.md` 的 AC-12/13，以及 `tests/experience-contract.test.mjs` 的可执行契约。

## Verification

```text
npm run check
  41 passed, 0 failed
  Vite production build passed

BASE_URL=http://localhost:5294/ npm run test:browser
  desktop / 720 / 390 passed
  custom service intent passed
  unknown recovery passed
  console errors: 0

git diff --check
  exit 0
```

## Requested confirmation

请在固定 SHA `2ee34fe` 复核以上 P1/P2，并给出 `APPROVE` 或剩余阻断项。

[丢丢/gpt-5.6-sol🐾]
