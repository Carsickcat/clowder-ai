# Sol 独立综合：从竞品工作流到 2026 产品判断

## 结论先行

NOVA 不应再做一个“AI 运维能力门户”，也不应把监控、告警、日志、巡检、拨测换皮成五个 AI 页签。正确产品坐标是：

> **一个面向保障与变更的实时业务健康运行系统，内含两种职责清晰的 Agent runtime。**

- 智能巡检 Agent 持续回答：现在业务是否可判定为健康、风险在哪里、覆盖是否可信、这次保障/变更下一步需要谁决策。
- 故障诊断 Agent 在异常达到升级条件后回答：影响如何传播、哪些证据支持或反驳候选根因、应采取什么受控动作、修复是否有效。
- 两者共享业务服务、关键旅程、拓扑、变更、遥测和证据，但不能共享同一个自由状态机，更不能互相覆盖结论。

## 四家产品真正值得借鉴的部分

### Alibaba Cloud：长期目标与可干预执行

STAROps 的价值不在“数字员工”称谓，而在把自然语言目标变成 `Mission → Blueprint → Task Run → Report`，并且有 Draft/Active/Paused、运行历史和 HIL。它证明 NL2Inspection 的产品终态应是**可审阅、可版本化、可调度、可暂停的执行计划**。

不照搬的部分：执行页展示完整“推理过程”。NOVA 只展示可复核的查询、工具、输入、结果、结论修订和人工决策，不展示隐式思维链。

### Dynatrace：验证对象与因果问题对象分离

Site Reliability Guardian 把服务目标、指标、阈值和每次 Validation 做成结构化对象；Problems 则承载异常归并、影响和根因。这给出清晰的双 Agent 分界：

- 巡检 Agent 运行 `Guard / Inspection Run`，结果允许 pass、warning、fail、info/error。
- 诊断 Agent 运行 `Investigation`，结果允许多假设、证据不足与结论修订。

不照搬的部分：Guardian 的整体结果采用最严重目标聚合，适合质量门但不足以表达业务保障的多层影响。NOVA 需要同时保留 blocker、受影响关键旅程和证据门禁，不能只给一个红黄绿。

### Datadog：从现场进入 Agent，而不是从 Agent 找现场

Datadog 的强项是把 Watchdog/Bits 嵌入 Monitor、Service、APM 图表、On-call 和 Case。用户从一个延迟尖峰或 Monitor 直接启动调查，既继承上下文，又能回到日志、Trace、拨测等专业面。自动调查还有频率限制和审计记录。

不照搬的部分：服务健康的 Ok/Critical 聚合依赖既有 Monitor/Incident/Insight，容易让“未建监控”不可见。NOVA 必须让 coverage / freshness / baseline drift 成为同等醒目的风险门禁。

### Google Cloud：证据、假设与修订比唯一答案更可信

Cloud Assist Investigation 用持久资源保存 Issue、Observations、Hypotheses 和 Revisions，Observation 链到源数据；调查默认只读且受调用者 IAM 限制。这比一段“AI 根因”更接近企业运维需要的可审计调查。

不照搬的部分：该能力仍是 Preview 且访问受限，不能把它的宣传能力当作行业普遍成熟度。NOVA 一期应把多假设、引用和修订做成产品契约，而不是许诺全自动 RCA 命中率。

## 竞品横向判断

| 决策维度 | 行业成熟做法 | 仍然薄弱的部分 | NOVA 取舍 |
|---|---|---|---|
| 运行对象 | Mission、Guardian、Validation、Problem、Investigation | 保障、大促的业务目标与技术检查往往分散 | 建立 `Assurance Mission`，统一目标、检查计划、运行实例与决策时间线 |
| NL 创建 | NL→Query、NL→Blueprint，通常带确认 | 从运维语义直接生成可治理检查仍不普遍 | 做 `NL2Inspection Studio`，强制结构化预览、回放和发布门禁 |
| 高频巡检 | 调度检查、异常检测、SLO/阈值验证 | 容易变成高频告警制造器 | 先做高频 Assessment 与 Findings 去重，频率、成本和噪声可观察 |
| 风险预测 | 单指标 forecast、异常趋势、SLO burn | 缺少无条件的跨业务“风险分”证据 | 一期称为“风险信号/趋势预警”；满足数据门禁后才显示 forecast 与置信区间 |
| 故障诊断 | 多源关联、拓扑影响、假设与查询 | 跨产品覆盖和唯一根因仍有限 | 显示覆盖前提、候选假设、反证、inconclusive 与 revision |
| 自动动作 | Workflow、HIL、授权、审计 | 默认自治会扩大误操作半径 | 诊断默认只读；建议→审批→受控 Runbook→复验，生产写操作不由自由文本直达 |
| 移动端 | On-call 摘要与调查入口 | 手机不适合复杂深挖 | 手机只承载态势、HIL 决策、认领和复验确认；深度调查回桌面 |

## 对用户原始设想的校准

### 1. 高频次巡检：必须做，但产品目标不是“更多次运行”

高频的业务价值是缩短状态变化到可行动 Finding 的时间，并在保障/变更窗口内连续复验。需要四个内生约束：

- 同一风险的去重与演化，不把每个 Run 都变成新告警。
- 频率与服务负载、查询成本联动显示。
- 每次正向结论都经过 coverage、freshness、baseline、执行错误门禁。
- 保障结束后保留决策、异常、动作和复验形成报告，而非临时大屏截图。

### 2. 业务风险预测：保留愿景，降低一期承诺

一期可交付的是：

- 容量耗尽、错误预算燃烧、延迟/流量趋势、异常模式持续性的 `Risk Signal`。
- 明示目标指标、历史窗口、预测窗口、置信区间、阈值、适用性和最近校准。
- 不满足数据门禁时返回 `not_ready / unknown`，而非低风险。

一期不承诺的是：跨任意业务和场景给出一个可直接驱动放行的“未来风险总分”。

### 3. NL2Inspection：把“生成”设计成工程流程

推荐状态机：

`Intent draft → Clarifying → Structured plan → Validating → Replay ready → Awaiting approval → Published → Running → Version review`

验证至少包含：数据源存在、字段/指标解析、时间窗、权限、样本查询、预计成本、运行频率、基线可比性、通知与 Owner。任何一项未通过，AI 只能保存草案，不能发布。

## 一期场景优先级

### P0：变更 Guard + 保障实时巡检（同一引擎，两种时间结构）

推荐先打穿这一条，因为它同时满足：目标明确、时间窗明确、业务决策明确、现有数据可复用、价值可测量。

- 变更前：生成/选择验证计划并建立可比基线。
- 变更中：高频运行关键旅程、SLO、容量、日志模式和拨测检查。
- 发现异常：形成 Finding；达到升级门槛时创建 Diagnosis Investigation。
- 人工决策：继续、暂停、回滚、继续观察。
- 动作后：复验同一计划；最终报告保留所有 revision 和 unknown。

### P1：大促/重大活动保障 Mission

复用同一 Run/Assessment/Finding/Investigation 体系，但增加流量阶段、容量水位、关键交易漏斗、地域/渠道和指挥角色。它不应只是把变更页换个标题。

### P1：NL2Inspection Studio

一期可以与 P0 同步小范围上线，但只面向只读检查生成和人工发布；避免为了“任何话都能巡检”扩大数据权限和查询成本。

### P2：跨业务预测与半自动修复

待形成预测回测、误报/漏报和动作审计数据后再扩展，不进入一期核心价值承诺。

## 核心产品判断

首页不应是能力图谱，也不应是纯事件队列。它应该是 **Live Operations / 运行态势**：回答此刻哪些业务旅程正在保障、哪些变更处于验证窗口、哪些巡检 Run 在运行或受阻、哪些风险需要人做决策、哪些诊断正在收集证据。

基本原子能力、场景和 Agent 都应通过正在变化的业务状态被用户看见。只有这样，高保真才是在设计一套系统，而不是画一张“AI 运维产品介绍官网”。
