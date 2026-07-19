# Claim Ledger — AIOps 与 AI 巡检产品研究

审计日期：2026-07-20。`use-with-caveat` 只能用于描述适用场景或产品方向，不得写成跨企业效果承诺；`reject` 不进入产品商业论证。

| Claim | 原始来源 | 来源类型 / 年份与对象 | 五问摘要 | Verdict | Provenance |
|---|---|---|---|---|---|
| GCP Investigation 会基于日志、配置、指标形成带源数据链接的 Observation；不确定时保留多根因假设并支持 revision；调查 token 不写入被调查资源。 | [Google Cloud Assist investigations](https://docs.cloud.google.com/cloud-assist/investigations?hl=en) | 官方文档，2026-07-17，Google Cloud 单项目/App Hub 调查 | 一手；产品方有利益关系，但功能、权限、Preview、存储与范围限制均明确；仅适用于受支持资源，且截至 2026-04 需 Premium Support 或额外准入。 | use | [一手/官方文档/2026/GCP 调查/高] |
| Azure 将后台告警关联、issue 创建和深度调查与“人决定任何环境变更”分开；持久 agent resource 拥有身份、范围、配置和治理边界。 | [Azure Copilot Observability Agent](https://learn.microsoft.com/en-us/azure/azure-monitor/aiops/observability-agent-overview) | 官方文档，2026-06-23，Azure Monitor | 一手；产品方有利益关系，产品明确是 Preview，并有区域、会话与 CMK 等限制；可用来借鉴 controlled autonomy，不能当行业 GA/ROI 证据。 | use-with-caveat | [一手/官方文档/2026/Azure Preview/高] |
| AWS CloudWatch Investigations 可将 metrics、logs、deployment/change events、traces 等整合为 observations / hypotheses；用户可接纳或丢弃建议，配置后可生成含 findings、时间线和建议动作的报告，并以 CloudTrail 留痕。 | [AWS CloudWatch investigations](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Investigations.html) | 官方文档，2026 快照，AWS CloudWatch | 一手；功能与权限边界清楚；AWS 的“小时级搜索可更快”是供应商的定性表述，没有跨组织实验设计，不能换算为 MTTR 指标。 | use | [一手/官方文档/2026/AWS 账户/高] |
| HolmesGPT 把定时巡检建模为可开关的 ScheduledHealthCheck：cron 触发独立执行记录，保存最近结果、时长、活动实例与历史；每次执行都有模型调用成本。 | [HolmesGPT Scheduled Health Checks](https://holmesgpt.dev/dev/operator/scheduled-health-checks/) | 开源项目官方文档，2026-07 快照，Kubernetes Operator | 一手项目文档；页面提示版本会变，且自然语言 query/LLM 评估不是企业级巡检正确性的独立证明；适合作为“声明、运行、历史、预算”分层的交互参考。 | use-with-caveat | [一手/开源文档/2026/Kubernetes 巡检/中] |
| K8sGPT 先由已编码的 Kubernetes analyzer 扫描和筛选资源问题，再在 `--explain` 时用模型解释；它支持 analyzer、namespace/filter、JSON 输出与持续监控 Operator。 | [K8sGPT repository](https://github.com/k8sgpt-ai/k8sgpt) | 开源源码/README，2026-07 快照，Kubernetes | 一手实现说明；仓库随版本演进，README 不是独立准确率证据；但“结构化判定先于语言解释”的架构模式可直接借鉴。 | use | [一手/开源源码/2026/Kubernetes/中高] |
| 腾讯云 CloudQ 将业务架构图作为巡检、容量治理、混沌演练等的载体；支持账号级/架构图级巡检，发现配置、可靠性、安全、容量、成本风险并导出报告。 | [腾讯云智能顾问核心能力](https://cloud.tencent.com/document/product/1264/132438) | 厂商官方文档，2026-06-03，腾讯云 DevOps Agent | 一手产品文档；能确认产品方向而不是效果。对大厂产品最有价值的是“从资源列表上升到业务架构 / 服务健康单元”的建模。 | use-with-caveat | [一手/厂商文档/2026/云上 DevOps/中] |
| 腾讯云 Database AI Service 宣称 MySQL CPU 诊断从 30 分钟压缩到 2 分钟，并给出运维升级率等数字。 | [腾讯云数据库 AI 服务](https://cloud.tencent.com/product/tdai) | 厂商产品页，2026 快照，特定 MySQL/DBA 工作流 | 一手营销页但未公开样本、基线、客户、任务定义或第三方复现；对象是特定数据库技能，不能迁移为通用巡检或 AIOps ROI。 | reject（作为通用 ROI） | [一手/营销 claim/2026/未说明对象/低] |
| AIOpsLab 用 Application、Task、Fault、Workload、Evaluator 五个组成部分评价 Detection / Localization / Analysis / Mitigation，并保存 agent action trace、solution 和 duration。 | [Microsoft AIOpsLab](https://github.com/microsoft/AIOpsLab) · [论文](https://arxiv.org/abs/2501.06706) | 开源框架 + MLSys 2025 论文，微服务/Kubernetes benchmark | 一手代码和论文；基准环境不是大型企业生产系统，不能证明自愈安全性；适合迁移“历史回放 + 轨迹 + evaluator”的验收方法。 | use | [一手/代码+论文/2025/微服务基准/高] |
| Dynatrace Assist 将 agentic query 和 MCP 工具权限分开，并指出 agentic 模式读取环境数据需要显式工具权限；聊天上下文受当前打开应用范围约束。 | [Dynatrace Assist](https://docs.dynatrace.com/docs/dynatrace-intelligence/agentic-and-generative-ai/chat-with-dynatrace-assist) | 厂商官方文档，2026-04-28，Dynatrace 平台 | 一手产品文档；适合借鉴按工具/数据面授权及上下文定界；不构成查询质量、准确率或隐私充分性的独立证明。 | use-with-caveat | [一手/厂商文档/2026/Dynatrace 租户/中] |

## 审计结论

1. **可采纳的事实**：云厂商和开源实践都已把“跨源证据、假设、历史记录、人工选择、报告”产品化；这里没有任何一手证据能推出统一的 MTTR 降幅。
2. **需保留的反例**：预览态产品、版本频繁的开源项目和无方法论的厂商数字，都不应被转写成“业界已经验证”的能力或经营收益。
3. **对本课题的影响**：巡检一期的验收应围绕证据完整性、检查覆盖、发现闭环与人机协作耗时，而非先承诺一个行业通用的 MTTR/人力比例。
