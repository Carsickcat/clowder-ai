# NOVA Ops 2026 双 Agent 产品方案

## 一句话定位

NOVA Ops 是既有可观测平台之上的 SRE 运行控制面：把 Incident、Change、Mission、Inspection 组织为可处置、可追溯的运行对象，让 SRE 在同一工作台完成主动健康评估、证据驱动调查、人工决策与复验。

## 双 Agent 职责

| Agent          | 拥有对象                                                             | 触发                                       | 输出                                           | 不得越权                             |
| -------------- | -------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------- | ------------------------------------ |
| 智能巡检 Agent | Mission、Plan、Check、Run、Assessment、Finding、Verification、Report | cron、保障阶段、变更事件、人工、发布后验证 | 业务健康、风险信号、Finding、报告、复验结论    | 不宣布无证据健康；不直接执行生产变更 |
| 故障诊断 Agent | Investigation、Observation、Hypothesis、Revision、ActionProposal     | 告警、Finding 升级、人工调查               | 影响面、多假设、证据缺口、可复核结论、动作建议 | 不替代巡检 Gate；不自行宣布恢复      |

二者共享 `ScopeContext(service/env/region/time/change/mission)`、拓扑、变更和 Evidence。诊断完成后，动作执行与最终复验回到原 Mission/Guard。

## 核心原子能力

1. **Scope & topology**：业务旅程、服务、依赖、Owner、SLO、变更。
2. **Check compiler**：意图澄清、结构化 Check、等价 Query、权限/成本/基线检查。
3. **Run engine**：调度、事件触发、进度、重试、阻塞、成本、公开工具审计。
4. **Assessment gates**：coverage、freshness、baseline comparability、execution、permission。
5. **Evidence graph**：指标、日志、Trace、告警、拨测、巡检结果和变更的可回链证据。
6. **Finding governance**：确认/驳回、Owner、SLA、Action、Verification。
7. **Investigation**：Observation、多假设、支持/反证、下一测试、Revision、inconclusive。
8. **Risk signal**：具体指标 Forecast、错误预算、容量耗尽和异常持续性；带窗口、置信区间、readiness。
9. **Report projection**：Run 与 Finding 的可分享投影，不是独立真相源。

## 四条必须跑通的旅程

### 1. 大促保障

进入 Mission → 看阶段、流量/容量、关键旅程、Run heatmap → 风险信号触发 Finding → Owner 认领 → 提高检查频率并看到成本变化 → 生成扩容 ActionProposal → 审批 → 复验 → 阶段快照。

### 2. 变更验证

变更事件触发 Guard → canary/control 对照 → Objective fail/unknown → 升级 Investigation → 钉入日志和 Trace 证据 → 提议回滚 → ActionRun → Verification；任何 stale/unknown 均阻断 passed。

### 3. NL2Inspection

输入意图 → Agent 澄清范围/频率/输出 → 生成结构化 Plan → 打开真实 Query → Run sample → 权限/成本/新鲜度/基线门禁 → 7 天回放 → 人工审批 diff → Published Plan → 首次 Run → 报告。

### 4. 故障调查

告警/Finding 进入 → 继承 Scope → 时间线和多 Lens → Observation → 三个可证伪假设 → 运行 next test → confirmed 或 inconclusive → ActionProposal/后续观察 Check → 回到 Verification。

## 信息架构与页面骨架

产品用户统一为 SRE。首屏不要求选择身份，也不从监控、告警、日志等功能模块开始，而是回答“现在最需要处理哪个运行对象”：

| 运行对象   | 首要问题                         | 对象 accent（仅身份） | 状态真相源              |
| ---------- | -------------------------------- | --------------------- | ----------------------- |
| Incident   | 当前影响是什么，哪个假设最可信？ | 低饱和橙              | Investigation 状态      |
| Change     | 继续、观察还是回滚？             | 低饱和蓝              | Decision + Verification |
| Mission    | 峰值阶段是否还能继续承载？       | 低饱和紫              | Mission Run + Finding   |
| Inspection | 候选 Plan 是否可安全发布和运行？ | 低饱和绿              | Plan Gate + Run         |

`Reports / Governance` 是运行对象的版本化投影与治理视图，不是第五、第六类健康对象。

进入任一对象后使用同一 SRE 决策骨架：

- **左栏**：对象 ID、来源、影响、五步处置流程与可见终态。
- **中栏**：与该对象 Scope 绑定的专业证据；Metrics、Alerts、Logs、Traces、Synthetics、Inspection 等以标签切换。
- **右栏**：AI 输出分成事实、假设、证据缺口、建议；人工 verdict 独立记录决策人、截止时间与结论。
- **顶栏**：展示 Scope 的继承来源（Mission / Change / Alert Cluster / Service Catalog）；扩展范围必须显式创建分支。
- **全局左导航**：工作台 / Incidents / Changes / Missions / Inspections / Reports / Governance。

对象 accent 不得复用健康或严重度颜色；passed、warning、failed、unknown 继续使用独立状态语义。

## 跨对象合同

唯一受支持的升级与回写链是：

`Change / Mission / Inspection → Incident → ActionProposal → 源 Finding → 源对象 Verification → Report`

- 创建 Incident 时必须保存 `sourceObject` 与 `sourceFindingId`。
- Incident 可以组织 Observation、Hypothesis、反证与动作建议，但不能关闭源对象。
- ActionProposal 只能把源 Finding 推进到待执行；最终恢复必须由源对象 Verification Run 的 Gate 判定。
- 所有升级、回写和复验关系进入 Audit，Report 只投影对应版本的运行结果。

## 页面合同

| 工作面         | 首屏决策                                     | 独有组件                                                                     | 必须改变状态的主动作                                         |
| -------------- | -------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| SRE 运行工作台 | 现在最需要处理哪个对象？                     | 全局态势、按紧急度排序的对象队列、对象类型入口                               | 直接打开对象当前步骤                                         |
| Incident       | 影响是什么，哪个假设最可信，下一测试是什么？ | 事件簇、拓扑、Observation、Hypothesis board、专业 Lens                       | 钉证据、next test、confirm/inconclusive、回写 ActionProposal |
| Change         | 本次灰度继续、观察还是回滚？                 | canary/control 曲线、Objective table、Decision Record、Verification timeline | 暂停、延长、回滚、升级 Incident、复验                        |
| Mission        | 当前保障阶段能否继续承载增长？               | 阶段轨道、交易漏斗、流量预测、Run heatmap、Risk Signal                       | 调频、冻结扩流、升级 Incident、阶段快照                      |
| Inspection     | 这段意图最终会运行什么，是否可安全发布？     | Prompt/澄清、Check 编辑器、Query、Gate、Replay、版本 diff                    | 修复门禁、审批、发布、升级 Incident                          |
| Reports        | 本次运行检查了什么、发现什么、是否闭环？     | 报告版本、源 Run/Assessment、Finding/Action/Verification                     | 追踪整改、请求源对象复验、生成分享快照                       |
| Governance     | 哪些服务看似绿色但其实不可判定？             | coverage matrix、stale/drift、Agent 执行健康、forecast readiness、审计       | 分派缺口、暂停 Plan、复核版本                                |

## 一期承诺

- 高频巡检：正式能力，支持保障、变更和关键服务日巡。
- 风险预测：试点能力，只覆盖容量、错误预算和具备数据条件的关键指标 Forecast。
- NL2Inspection：正式的“候选 Plan 编译与验证”，生产发布必须经门禁与人工审批。
- 故障诊断：与既有 AI 告警诊断衔接，形成持久 Investigation 与 Evidence。

## 反目标

- 不画全局 AI 风险分。
- 不画五个同构模块页签。
- 不用 toast 冒充领域动作。
- 不用装饰曲线冒充可观测图。
- 不展示隐式思维链。
- 不让 Report 脱离 Run/Finding/Verification。
