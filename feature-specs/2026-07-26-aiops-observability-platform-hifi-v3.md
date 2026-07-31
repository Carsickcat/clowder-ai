# NOVA Ops 2026 AI 运维可观测平台高保真 V3

## 目标

交付一个真实可点击、数据密集、可用于 2026 产品规划评审的高保真系统，覆盖智能巡检 Agent 与故障诊断 Agent。

## Product Gate

- L1 核心入口：运行态势、保障任务、变更验证、巡检工程、故障调查、报告中心、治理审计。
- 监控/告警/日志/Trace/拨测保留为专业 Evidence Lens。
- 首页直接进入生产运行态，不出现能力介绍 hero。

## 领域状态门禁

1. `healthy/passed` 必须满足 coverage、freshness、baseline、execution、objectives。
2. `unknown/info/error/learning` 均不得转绿。
3. Action 完成不等于 Verification passed。
4. 诊断 Agent 只能给 ActionProposal；最终复验归巡检 Run。
5. NL2 Plan 未通过 permission、sample、baseline、cost、replay、approval 不得发布。

## 高保真验收

1. 禁止出现 `chart-placeholder`。
2. Live Ops、Mission、Guard、Studio、Investigation、Reports、Governance 数据结构和主动作不得同构。
3. 三张关键图必须使用固定 mock 数据并包含坐标、图例、阈值/对照、时间标记和缺数据表达。
4. 每个主按钮必须调用领域动作并产生跨页面可见结果；无实现动作必须 disabled。
5. 至少跑通三条 Golden Path：保障风险、变更诊断与复验、NL2 发布。
6. 桌面 1440 和手机 390 均可用；手机只承担决策、认领和复验跟进。
7. 使用说明书必须说明入口、三条旅程、状态语义、Agent 边界和 Mock 数据。

## 非目标

- 不连接生产数据。
- 不执行真实生产动作。
- 不宣称预测是通用业务风险预知。
- 不重建日志、指标、告警、Trace、拨测查询产品。

## Architecture ownership

- Architecture cell: standalone product prototype
- Map delta: none
- Why: 不接入现有运行时、Store、Queue 或生产数据边界。

## Tips

```yaml
tips_exempt:
  reason: "独立规划原型，不注册为 Clowder AI Console 的用户能力或 Guide Catalog 项。"
```
