# NOVA Ops 2026 双 Agent 产品方案

## 一句话定位

NOVA Ops 是既有可观测平台之上的“主动健康评估与证据驱动调查层”：让保障负责人知道能否继续承载流量，让发布负责人知道能否继续灰度，让 SRE 用证据完成诊断，让服务 Owner 用自然语言安全创建可运行巡检。

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

## 页面合同

| 工作面               | 首屏决策                                     | 独有组件                                                                   | 必须改变状态的主动作                           |
| -------------------- | -------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| Live Ops             | 现在最危险的业务旅程和待决策是什么？         | 旅程矩阵、决策倒计时、Agent runtime、事件时间线                            | 认领风险、进入 Guard/Investigation             |
| Mission Command      | 当前保障阶段能否继续承载增长？               | 阶段轨道、交易漏斗、流量预测、Run heatmap、战情 Owner                      | 调频、冻结扩流、ActionProposal、阶段快照       |
| Change Guard         | 本次灰度继续、观察还是回滚？                 | canary/control 曲线、Objective table、Decision rail、Verification timeline | 暂停、延长、回滚、复验                         |
| NL2Inspection Studio | 这段意图最终会运行什么，是否可安全发布？     | Prompt/澄清、Check 编辑器、Query、Gate、Replay、版本 diff                  | 修复门禁、审批、发布                           |
| Investigation        | 影响是什么，哪个假设最可信，下一测试是什么？ | 证据时间线、Observation、Hypothesis board、专业 Lens                       | 钉证据、运行测试、confirm/inconclusive、提动作 |
| Reports              | 本次运行检查了什么、发现什么、是否闭环？     | 报告版本、覆盖/新鲜度、Finding/Action/Verification、分享投影               | 追踪整改、触发复验、生成分享快照               |
| Governance           | 哪些服务看似绿色但其实不可判定？             | coverage matrix、stale/drift、Agent 执行健康、forecast readiness、审计     | 分派缺口、暂停 Plan、复核版本                  |

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
