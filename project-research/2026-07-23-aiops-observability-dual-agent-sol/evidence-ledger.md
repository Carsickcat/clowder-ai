# 一手证据台账：2026 AI 运维双 Agent

访问日期：2026-07-23

说明：只把厂商官方文档中的产品对象、工作流、状态和限制记录为事实；“对 NOVA 的启示”均为本研究的产品推断，不代表厂商声明。

## Alibaba Cloud

| # | 一手事实 | 运行对象 / 交互 | 成熟度标注 | 对 NOVA 的启示（推断） | 来源 |
|---|---|---|---|---|---|
| A1 | STAROps 把 `Mission` 定义为长期 O&M 目标；Agent 在 `Workspace` 限定的数据和权限范围内执行。 | Digital Employee → Workspace → Mission | 官方文档未明示 GA/Preview，不作推断 | 巡检不是一次聊天结果，应有长期目标、作用域与执行身份。 | [Core concepts](https://www.alibabacloud.com/help/en/starops/product-overview/core-concept) |
| A2 | 创建 Mission 时先用自然语言对齐意图，Agent 追问缺失信息并给出结构化理解；随后生成包含 Task、触发、执行策略和输出的 Blueprint，用户确认后运行。 | Intent alignment → Blueprint → Confirm → Run | 未明示 | NL2Inspection 必须生成可审阅的结构化计划，不能直接从 Prompt 跳到生产执行。 | [Create and plan Missions](https://www.alibabacloud.com/help/en/starops/user-guide/creating-and-planning-long-term-mission), [Mission quick start](https://www.alibabacloud.com/help/en/starops/getting-started/quick-start-for-long-term-tasks) |
| A3 | Mission 有 Draft / Active / Paused / Deleted；Task 有 Running / Success / Cancelled / Failed；执行记录包含计划时间、实际开始、耗时、报告与会话链接。 | Mission lifecycle、Task lifecycle、Execution records | 未明示 | 用户必须看见 Agent 正在运行、暂停、失败和历史实例，而不只是最终报告。 | [Mission management and progress tracking](https://www.alibabacloud.com/help/en/starops/user-guide/task-management-and-progress-tracking) |
| A4 | 高风险操作、信息不足、多方案和异常确认会触发 HIL，任务暂停等待用户；超过 3 小时无人响应则失败。 | HIL request → Review → Approve/Reject → Resume/Fail | 未明示 | `needs_decision` 应是一等状态，保障场景必须显示等待谁、截止时间和不处理后果。 | [Mission execution and human intervention](https://www.alibabacloud.com/help/en/starops/user-guide/task-execution-and-human-intervention) |
| A5 | Task Report 会记录巡检范围、严重度、异常当前值/阈值/受影响资源、修复建议、所有检查明细；检查状态包括 passed、anomalous、not applicable、requires attention。 | Task Report、Finding、Check result | 未明示 | 报告是 Run 的投影，不应成为唯一真相源；“需关注/不适用”不能被吞进绿色总分。 | [Artifacts and report management](https://www.alibabacloud.com/help/en/starops/user-guide/product-and-report-management) |
| A6 | SLS 智能巡检按调度周期对日志/指标流聚合，写入巡检事件并触发告警；其价值是自适应异常识别，而非通用业务风险预测。 | Scheduled inspection → Model → Event → Alert | 文档 2024，未明示 | 高频巡检底座应是确定的调度、输入、结果事件和通知；AI 解释置于其上。 | [Introduction to intelligent inspection](https://www.alibabacloud.com/help/en/sls/introduction-to-intelligent-inspection) |
| A7 | CloudMonitor 智能助手可将自然语言生成 SPL 查询并返回可观测分析。 | NL → SPL → Result | 未明示 | NL 首先要落成可读、可测试、可保存的 Query/Check 定义。 | [Intelligent O&M Assistant](https://www.alibabacloud.com/help/doc-detail/2982257.html) |

## Dynatrace

| # | 一手事实 | 运行对象 / 交互 | 成熟度标注 | 对 NOVA 的启示（推断） | 来源 |
|---|---|---|---|---|---|
| D1 | Site Reliability Guardian 是 change impact validation 应用；Guardian 绑定服务/应用和多个 Objective，可手动或由事件/API Workflow 触发验证。 | Guardian → Objective → Indicator → Validation | 最新版正式文档，未标 Preview | 变更保障应以 `Guard` 与每次 `Validation Run` 为核心，而不是临时 Dashboard。 | [Site Reliability Guardian](https://docs.dynatrace.com/docs/deliver/site-reliability-guardian) |
| D2 | Objective 由 DQL/SLO 指标与静态或自适应阈值判定；结果有 error / fail / warning / pass / info；自适应阈值至少需要 5 次验证，学习期返回 info。 | Objective result、overall worst-state aggregation | 未标 Preview | 学习期、查询错误和不可判定必须显式存在；不能在模型未就绪时给出 pass。 | [Site Reliability Guardian](https://docs.dynatrace.com/docs/deliver/site-reliability-guardian) |
| D3 | Lifecycle Guardian 用于发布质量门、压测后验证和持续服务健康；Business Guardian 用业务事件衡量应用行为。 | Lifecycle / Business Guardian | 未标 Preview | 同一验证引擎可服务变更与保障，但触发、上下文和指标体系必须区分。 | [Site Reliability Guardian](https://docs.dynatrace.com/docs/deliver/site-reliability-guardian) |
| D4 | Problems 将相关 Davis events 组织为一个 Problem，基于拓扑、事务和代码上下文做因果关联；Problems app 提供问题队列、影响实体、日志/Trace 深链。 | Problem → Impacted entities / root cause / drill-down | 未标 Preview | 诊断 Agent 应挂在持久 Problem/Investigation 上，保留专业分析工具的深链。 | [Root cause analysis concepts](https://docs.dynatrace.com/docs/dynatrace-intelligence/root-cause-analysis/concepts), [Problems app](https://docs.dynatrace.com/docs/dynatrace-intelligence/problems-app) |
| D5 | Predictive AI 对任意数值时间序列做预测，但至少需要 14 个数据点；预测由 Notebook 分析器触发。 | Time series → Forecast analysis | 未标 Preview | 预测应是某个指标、窗口与模型的可审计结果，不是服务级黑盒“未来风险分”。 | [Predictive AI analysis](https://docs.dynatrace.com/docs/dynatrace-intelligence/reference/ai-models/forecast-analysis) |
| D6 | NL2DQL 用于 Dashboards/Notebooks 快速分析；官方明确生成式输出可能不准确、不完整或不可靠，建议人工评估。 | Prompt → DQL → Quick analysis | 未标 Preview；Agentic action 另有 Preview | NL 生成必须展示查询、样本结果和验证状态，禁止把生成成功等同于检查可发布。 | [Agentic and generative AI overview](https://docs.dynatrace.com/docs/dynatrace-intelligence/agentic-and-generative-ai/dynatrace-generative-ai-overview), [DQL generation model](https://docs.dynatrace.com/docs/dynatrace-intelligence/reference/ai-models/dynatrace-dql-generation-model) |

## Datadog

| # | 一手事实 | 运行对象 / 交互 | 成熟度标注 | 对 NOVA 的启示（推断） | 来源 |
|---|---|---|---|---|---|
| DD1 | Bits Investigation 会迭代形成 hypotheses、收集 telemetry 并给出 root-cause conclusion；聊天可访问 exploratory queries、hypothesis assessments 与结论。 | Investigation → Query → Hypothesis assessment → Conclusion | 文档未明示；不同站点可用性不同 | 诊断页面应展示“查询—证据—假设状态—结论”，而不是一段不可复核的 RCA 摘要。 | [Bits Investigation](https://docs.datadoghq.com/bits_ai/bits_investigation/), [Chat with Bits Investigation](https://docs.datadoghq.com/bits_ai/bits_investigation/chat_bits_investigation/) |
| DD2 | 自动调查可由 Monitor 触发；每个 Monitor 默认 24 小时最多一次自动调查，可配置组织级限额；手工调查、工具调用和开关会进入 Audit Trail。 | Monitor → Auto investigation；Rate limit；Audit event | 站点可用性不同 | Agent 运行成本、频率与审计必须产品化，不能隐形无限执行。 | [Configure Bits Investigation](https://docs.datadoghq.com/bits_ai/bits_investigation/configure/), [Audit Trail events](https://docs.datadoghq.com/account_management/audit_trail/events/) |
| DD3 | Watchdog RCA 在发现 APM 异常后自动尝试 RCA；依赖 APM 与 unified tagging，支持的根因类型是明确受限的集合。 | APM anomaly → RCA → root cause / critical failure / impact | 未标 Preview | 诊断覆盖率必须显示数据前提和“未覆盖根因类型”，否则会制造虚假确定性。 | [Watchdog RCA](https://docs.datadoghq.com/watchdog/rca/) |
| DD4 | 服务页整合 monitors、incidents、Watchdog insights；可从延迟尖峰直接启动 Bits 调查，并保留到日志、Trace 等专业面的入口。 | Service health → Signal → Investigate with Bits | 未标 Preview | 首页可按业务服务聚合态势，但调查必须从具体信号和时间窗进入。 | [Service Page](https://docs.datadoghq.com/tracing/services/service_page/) |
| DD5 | Forecast Monitor 适用于强趋势或重复模式，显示历史与预测、置信边界，支持线性/季节算法；季节算法至少需要两个周期历史。 | Metric → Forecast + confidence bounds → Threshold alert | 未标 Preview | 风险预测必须携带适用性、历史窗口、模型、置信区间和触发阈值。 | [Forecasts Monitor](https://docs.datadoghq.com/monitors/types/forecasts/) |
| DD6 | Synthetic Results Explorer 保存每次测试运行、重试、失败细节和 CI blocking 状态。 | Synthetic test → Test run → Retry / blocking result | 未标 Preview | 拨测旅程应以步骤和运行实例参与变更放行，不应只贡献一个聚合分数。 | [Synthetic Results Explorer](https://docs.datadoghq.com/synthetics/explore/results_explorer/) |

## Google Cloud

| # | 一手事实 | 运行对象 / 交互 | 成熟度标注 | 对 NOVA 的启示（推断） | 来源 |
|---|---|---|---|---|---|
| G1 | Cloud Assist Investigation 是持久资源，包含 Issue、Observations、Hypotheses 和 Revisions；Observation 带源数据链接，多次运行可查看历史修订。 | Investigation → Observation → Hypothesis → Revision | Preview；2026-04-10 起需 Premium Support 或申请访问 | 诊断结论必须可修订，证据链接和历史版本比“展示思维链”更有价值。 | [Investigations overview](https://docs.cloud.google.com/cloud-assist/investigations), [Create an investigation](https://cloud.google.com/gemini/docs/cloud-assist/create-investigation) |
| G2 | Investigation 可从日志 Warning、Monitoring alert、chat、Cloud Hub 和具体产品页启动；输入会预填错误、时间和资源。 | Contextual entry → Prefilled issue → Run | Preview | Agent 应嵌入现有工作面并继承 service/env/time/change，而不是要求用户重新描述现场。 | [Investigations overview](https://docs.cloud.google.com/cloud-assist/investigations) |
| G3 | 调查使用调用者权限，OAuth token 不用于变更数据；项目级调查限定在单项目，应用级限定在 App Hub application。 | IAM-scoped read-only investigation | Preview | 诊断 Agent 默认只读；执行动作必须进入独立受控 Action/Approval 流。 | [Investigations overview](https://docs.cloud.google.com/cloud-assist/investigations) |
| G4 | 调查运行具有概率性，重复运行可能略有差异；时间戳准确性影响效果，官方要求核对资源是否出现在 Observations。 | Dynamic run + user fact check | Preview | 必须展示 run revision、输入快照、时间窗和证据覆盖，而不是覆盖旧结论。 | [Investigations overview](https://docs.cloud.google.com/cloud-assist/investigations) |
| G5 | Cloud Assist 的自然语言资源查询会返回等价查询供用户验证。 | Prompt → Answer + equivalent query | 按 Cloud Assist 套餐/权限 | NL2Inspection 编辑器应将“自然语言理解”与“可执行定义”并排展示。 | [Use Cloud Assist panel](https://docs.cloud.google.com/cloud-assist/chat-panel) |
| G6 | Synthetic Monitor 周期执行 Cloud Run 测试函数，保存成功/失败、耗时、日志/Trace；频率要平衡发现速度、服务负载和成本；Gemini 生成测试代码处于 Public Preview。 | Test definition → Scheduled run → Result / Alert | Synthetic Monitor 未在该页标 Preview；AI code generation 为 Public Preview | AI 可生成检查草案，但运行频率和成本必须在发布前模拟；拨测结果是可追溯运行数据。 | [Create a synthetic monitor](https://docs.cloud.google.com/monitoring/synthetic-monitors/create) |
| G7 | SLO monitoring 由 SLI、SLO、compliance period 和 error budget 构成；错误预算变化可作为故障早期信号。 | Service → SLI/SLO → Error budget → Alert | 未标 Preview | 业务健康应以 SLO/关键旅程为上层目标，避免从资源指标平均出“健康分”。 | [SLO monitoring concepts](https://docs.cloud.google.com/stackdriver/docs/solutions/slo-monitoring) |

## 证据合成：已验证与未验证

### 已被多家一手资料共同支持

1. **持久对象优于对话输出。** Mission、Guardian/Validation、Problem/Investigation 都保存范围、运行、结果和历史。
2. **诊断从现场入口继承上下文。** 日志、告警、服务页、异常图表都可直接发起调查，不要求重新拼接时间窗与资源。
3. **生成式能力与判定能力分离。** NL 适合生成查询/计划和解释；阈值、SLO、验证状态、权限与审批仍是显式结构。
4. **运行时可观察性是产品核心。** 执行中、失败、限流、等待人工、修订、审计和报告都是一等状态。
5. **预测有明确适用边界。** 时间序列历史、模式、置信边界与阈值是必要输入；没有证据支持无条件的业务风险总分。

### 尚未被证据支持，不应写入一期承诺

1. Agent 能跨任意监控体系稳定预测大促业务风险。
2. 一段自然语言可以在无需验证、权限或成本检查的情况下安全生成并发布任意巡检。
3. AI 能稳定给出唯一根因；Google 明确允许多假设与修订，Datadog Watchdog 也有覆盖前提和有限根因类型。
4. 自动修复应成为一期默认闭环；一手资料共同显示授权、HIL、策略护栏或只读边界。
