# NOVA Ops AI 可观测平台｜SRE 使用说明书

> 版本：2026 规划高保真原型 V5
>
> 数据：固定 Mock 数据，不连接生产系统
>
> 目标：验证“故障诊断 Agent + 智能巡检 Agent”如何协助 SRE 处置 Incident、Change、Mission 与 Inspection。

## 快速开始

1. 打开首页后先看“待处置对象”，无需选择身份或功能模块。队列按 blocker、业务影响和截止时间排列。
2. 点击一条 `Incident / Change / Mission / Inspection`，进入该对象的三栏工作台：左侧是对象上下文和五步处置流程，中间是专业证据，右侧是 Agent Assist 与人工结论。
3. 顶部 Scope 会说明对象来源，例如 `由 CHG-23841 自动继承` 或 `由 ALERT-CLUSTER-204 创建`。范围不会在跨页时静默变化。
4. 优先处理 `blocked / unknown / stale / drifted`；它们不能被折算为健康。
5. `Reports / Governance` 是运行对象的投影与治理视图，不是健康真相源，也不能单独宣布恢复。

## SRE 运行工作台

首页回答一个问题：**我现在最需要处理哪个对象？**

- 全局态势只统计 Active Incident、Open Finding、Blocked Change、Running Mission 和 Open Inspection，不生成总健康分。
- 待处置队列同时展示对象类型、对象 ID、当前阶段、截止时间与下一步动作。
- 点击“下一步动作”直接进入对象当前步骤；全局导航也可打开四类对象及报告、治理视图。
- 对象颜色只表示类型，状态仍由 passed、warning、failed、unknown 等语义表达。

## Incident 工作台

示例对象：`INC-7719`，来源 `ALERT-CLUSTER-204`。

1. 在 Alerts 工作面查看 `17 raw → 2 correlated clusters → 1 primary event`，确认事件簇成员、受影响拓扑和 Scope。
2. 切换 Metrics、Logs、Traces、Synthetics，钉入可复核 Observation。
3. 运行 Hypothesis 的 next test；证据不足时标为 `inconclusive`，保留修订并生成后续检查草案。
4. 诊断 Agent 只生成 `ActionProposal`。如果 Incident 从 Change、Mission 或 Inspection 升级而来，点击“回写源 Finding”。
5. 回写后源 Finding 进入 `pending_action`；Incident 仍不能关闭源对象，也不能宣布恢复。

终态：`Investigation + ActionProposal + 原 Finding 回写`。

## Change 工作台

示例对象：`CHG-23841 · payments-router v3.18.0`。

1. 比较 Canary / Control 曲线、变更时刻、SLO 阈值和 Objective 明细。
2. 查看华南拨测 stale 等证据缺口；任何 unknown 都会阻断继续放量。
3. 需要跨源诊断时点击“升级为 Incident 调查”。新 Incident 固定保留来源对象和 Finding ID。
4. 人工选择观察或回滚，形成 Decision Record，记录决策人、业务影响、可逆性与关联 Run。
5. 整改完成后由 Change 的 Verification Run 评估 coverage、freshness、baseline、execution 与 objectives。全部通过后才能关闭 Finding 并更新报告。

终态：`Decision Record + ActionRun + Verification`。

## Mission 工作台

示例对象：`MIS-61801 · 全球购 618 峰值保障`。

1. 查看保障阶段、业务交易漏斗、关键旅程矩阵和高频 Run。
2. 在 Forecast 中同时核对实际 RPS、预测中位数、90% 置信带、容量阈值、风险窗口和模型就绪度。
3. 对具体 Risk Signal 创建或认领 Finding；需要深查时升级为 Incident。
4. 调整巡检频次或冻结扩流时，系统同步展示成本影响并写入审计。
5. 阶段结束后生成版本化保障快照；报告必须保留源 Run、门禁和未决 Finding。

终态：`阶段决策 + Finding + 保障快照`。

## Inspection 工作台

示例对象：`PLAN-312 · 全球购结算链路峰值巡检 · Draft v2`。

1. 从自然语言意图开始，Agent 澄清目标旅程、场景、频次与允许动作。
2. 检查结构化 Plan：每个 Check 都有数据源、窗口、判定规则、Owner 和等价 Query。
3. 逐项解除权限、基线、新鲜度和成本门禁，再回放过去 7 天。
4. 只有 Schema、Sample、Freshness、Permission、Baseline、Cost、Replay、Approval 全部通过时才能发布。
5. 发布后生成首次 Run；异常进入 Finding，复杂异常可升级为 Incident，最终仍回到 Inspection 的 Verification 与报告。

终态：`Published Plan + First Run + 治理报告`。

## 跨对象升级与回写

唯一受支持的闭环是：

`Change / Mission / Inspection → Incident → Investigation → ActionProposal → 源 Finding → 源对象 Verification → Report`

- 升级时必须保存 `sourceObject.type / sourceObject.id / sourceFindingId`。
- Incident 左栏固定展示来源对象并提供返回链接。
- ActionProposal 未形成前，回写动作不可用；形成后只能改变源 Finding 的处置状态。
- Incident 不拥有源对象的健康状态，不能自行关闭 Change、Mission 或 Inspection。
- 只有源对象 Verification 的所有 Gate 通过后，系统才能给出 `passed` 并更新报告。
- 所有跨对象动作进入 Audit，形成可追溯关系。

## 状态语义

- `healthy / passed`：覆盖率、数据新鲜度、基线可比性和检查结果均通过。
- `unhealthy / failed`：存在可复核的失败证据，需要 Finding 和 Owner。
- `unknown`：证据不足、检查未覆盖或数据不可用；不得计入健康、不得默认过滤。
- `stale`：数据超过新鲜度门限，相关判断进入 unknown。
- `drifted`：检查、拓扑、模型或基线变化，历史趋势暂不可比。
- `blocked`：Run 已执行但风险门禁未通过；只能恢复门禁并重新复验。
- `inconclusive`：当前调查证据不足以确认假设；保留 Revision，并创建下一项验证计划。

对象 accent 只用于图标、边框和 hover：Incident 橙、Change 蓝、Mission 紫、Inspection 绿。它不表达健康、严重度或处置优先级。

## 双 Agent 职责边界

智能巡检 Agent 拥有 `Mission → Plan → Check → Run → Assessment → Finding → Verification → Report`，负责主动发现、健康评估、检查生成、覆盖缺口和最终复验。

故障诊断 Agent 拥有 `Investigation → Observation → Hypothesis → Revision → ActionProposal`，由告警或 Finding 触发，负责跨源取证、验证假设和提出动作建议。

两个 Agent 共享 ScopeContext、服务拓扑、变更和 Evidence；诊断 Agent 不能宣布业务恢复，只有源对象的 Verification Run 可以给出 `passed`。

## Mock 数据说明

- 原型中的服务、告警、指标、日志、Trace、拨测、Run、Finding 与人员均为固定 Mock 数据。
- 曲线、热力图和覆盖矩阵不会因页面重绘随机变化；只有明确操作会改变状态。
- 风险预测只展示具体 Risk Signal，包括历史窗口、预测区间、阈值、数据新鲜度与适用条件，不提供不可解释的“未来业务总风险分”。
- “打开专业系统”“分享报告”“导出 PDF”等外部集成动作在原型中明确禁用；它们不是假按钮。
