# NOVA Ops AI 可观测平台｜使用说明书

> 版本：2026 规划高保真原型 V3
>
> 数据：固定 Mock 数据，不连接生产系统
>
> 目标：验证“故障诊断 Agent + 智能巡检 Agent”在大促保障、变更验证与 NL2 巡检中的产品工作流。

## 快速开始

1. 从左侧 `运行态势` 进入生产工作队列。顶部 Scope 固定为 `Production / 交易支付 / payments-router / 华东+华南 / CHG-23841`，所有页面继承同一上下文。
2. 优先处理带 `blocker`、`unknown`、`stale` 的事项。它们不能被健康汇总折算为绿色。
3. 从左侧 `监控 / 告警 / 日志 / Trace / 拨测` 打开 Evidence Lens。抽屉会显示查询、数据新鲜度和当前 Scope；“钉入调查”会把证据写入故障调查时间线。
4. 页面上的主按钮会改变领域状态；灰色按钮表示条件未满足，不是装饰性入口。

## 大促保障旅程

角色：保障负责人、值班 SRE。

1. 打开 `保障任务`，查看保障阶段、实时 Run 热力图、核心旅程漏斗和预测风险窗口。
2. 在预测图中同时核对实际流量、预测中位数、90% 置信带、容量阈值、历史窗口与模型就绪度。
3. 当容量风险进入黄色窗口时，点击 `提升检查频率`：巡检频次从 10 分钟提高到 2 分钟，同时展示预计成本变化并写入审计流。
4. 对具体风险点击 `认领`，明确 Owner；必要时点击 `冻结扩流`，系统记录当前保障阶段的人工决策。
5. 保障结束后进入 `报告中心`，确认每个 Finding、Owner、处置与复验状态，不用一个总健康分替代证据。

价值：把“保障群里人工盯图”变成带频次、证据、责任和终态的持续健康任务。

## 变更诊断与复验旅程

角色：发布负责人、值班 SRE、服务 Owner。

1. 打开 `变更验证`，核对 Canary / Control 曲线、变更时刻、SLO 阈值和 Objective 明细。
2. 选择 `暂停发布` 或 `回滚`，形成显式发布决策；异常 Finding 可升级到 `故障调查`。
3. 在调查页运行下一条假设测试，查看 Observation、Hypothesis、反证和结论修订；证据不足时可标为 `inconclusive`，系统会生成后续巡检草案。
4. 整改完成后点击 `启动复验`。华南拨测仍 stale 时，Verification Run 必须保持 `blocked / unknown`。
5. 点击 `恢复拨测数据` 只会恢复数据门禁，不会提前标绿；再次执行 Gate 评估且 coverage、freshness、baseline 全部通过后，才关闭 Finding 并更新报告。

价值：发布是否继续、由谁处置、何时恢复都由同一条证据链和 Verification Run 决定。

## NL2巡检旅程

角色：平台工程师、SRE 负责人。

1. 打开 `巡检工程`，从自然语言意图开始。Agent 先澄清目标旅程、场景、频次和允许动作。
2. 检查生成的结构化 Plan：每个 Check 都有数据源、窗口、判定规则、Owner 和等价 Query。
3. 逐项解除发布门禁：申请只读权限、补齐可比基线、回放过去 7 天、审核版本 Diff。
4. 只有 Schema、Sample、Freshness、Permission、Baseline、Cost、Replay、Approval 全部通过时，`发布 Plan` 才可用；领域层也会再次校验，不能绕过 UI 发布。
5. 发布后生成首次 Run，结果进入 Finding、整改、复验与报告闭环。

价值：自然语言降低检查定义成本，但生产安全仍由结构化定义、回放、权限和审批保证。

## 状态语义

- `healthy / passed`：覆盖率、数据新鲜度、基线可比性和检查结果均通过。
- `unhealthy / failed`：存在可复核的失败证据，需要 Finding 和 Owner。
- `unknown`：证据不足、检查未覆盖或数据不可用；不得计入健康、不得默认过滤。
- `stale`：数据已超过新鲜度门限，相关判断进入 unknown。
- `drifted`：检查、拓扑、模型或基线发生变化，历史趋势暂不可比。
- `blocked`：Run 已执行但风险门禁未通过；只能恢复门禁并重新复验。
- `inconclusive`：当前调查证据不足以确认假设；保留 Revision，并创建下一项验证计划。

## 双 Agent 职责边界

智能巡检 Agent 拥有 `Mission → Plan → Check → Run → Assessment → Finding → Verification → Report`。它负责主动发现、健康评估、检查生成、覆盖缺口和最终复验。

故障诊断 Agent 拥有 `Investigation → Observation → Hypothesis → Revision → ActionProposal`。它由告警或 Finding 触发，负责跨源取证、验证假设和提出动作建议。

两个 Agent 共享 ScopeContext、服务拓扑、变更和 Evidence；诊断 Agent 不能宣布业务恢复，只有原巡检 Plan 的 Verification Run 可以给出 `passed`。

## Mock 数据说明

- 原型中的服务、告警、指标、日志、Trace、拨测、Run、Finding 与人员均为固定 Mock 数据。
- 曲线、热力图和覆盖矩阵不会因页面重绘随机变化；只有明确操作会改变状态。
- 风险预测只展示具体 Risk Signal，包括历史窗口、预测区间、阈值、数据新鲜度与适用条件，不提供不可解释的“未来业务总风险分”。
- “打开专业系统”“分享报告”“导出 PDF”等外部集成动作在原型中明确禁用；它们不是假按钮。
