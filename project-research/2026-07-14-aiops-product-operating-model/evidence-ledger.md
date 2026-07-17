# Claim ledger — AI for Operations 产品能力与 SRE 收益

研究日期：2026-07-14。`use` 表示可确认产品能力或研究对象；它不自动表示可复制的 ROI。

| Claim | 一手来源 | 类型 / 时效 / 适用范围 | Verdict | Provenance 与限制 |
|---|---|---|---|---|
| Gemini Cloud Assist 调查会将日志、配置、指标等整理为带源数据链接的 Observations，允许多个假设和修订 | [Google Cloud documentation](https://docs.cloud.google.com/cloud-assist/investigations?hl=en) | 官方文档，2026-07-10；Google Cloud，Preview 且受支持与访问资格限制 | use | 产品事实；不是其“更快解决”营销措辞的独立因果证据 |
| Gemini 调查可从 Logs Explorer、Cloud Monitoring 告警、聊天面板、Cloud Hub 和部分产品页发起；调查 token 不会用于变更数据 | [Google Cloud documentation](https://docs.cloud.google.com/cloud-assist/investigations?hl=en) | 官方文档，2026-07-10；Google Cloud | use | 证明上下文式交互与只读边界；数据驻留限制仍需逐环境核对 |
| CloudWatch investigations 可由控制台、Amazon Q chat 或告警动作发起，并扫描遥测寻找关联数据 | [AWS documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Investigations-CreateInvestigation.html) | 官方文档，2026-07；AWS | use | 证明三种触发模式；不以旧的 2024 发布公告推断当前 GA/定价 |
| Azure Observability Agent 在 Preview 中可后台关联告警、创建 issue、自动深度调查；人工仍控制所有环境变更 | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/aiops/observability-agent-autonomous-operations) | 官方文档，更新 2026-06-23；单一 Application Insights 资源为主，Preview | use | 证明“准备工作自主、处置人工”的产品边界；不能外推到全 Azure 或生产成熟度 |
| Azure 的 on-call 队伍会处理解释过的 issue 而非原始告警洪流 | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-monitor/aiops/observability-agent-autonomous-operations) | 厂商描述，2026 | use-with-caveat | 可作为预期工作流变化，不能视为已验证的降噪比例或 MTTR 结果 |
| Dynatrace Assist 的 agentic 行为通过独立权限和 MCP/tool 权限约束，可调用实时遥测、开放问题、日志与安全发现 | [Dynatrace Docs](https://docs.dynatrace.com/docs/dynatrace-intelligence/agentic-and-generative-ai/chat-with-dynatrace-assist) | 官方文档，2026 | use | 证明权限按能力拆分；具体可用功能取决于租户权限和集成配置 |
| HolmesGPT 的内置调查设计为只读且遵循既有 RBAC；可查询多数据源、做定时健康检查，并可把分析写回外部系统 | [HolmesGPT repository](https://github.com/HolmesGPT/holmesgpt) | 项目源码/README，2026-07 快照 | use-with-caveat | 这是项目自述，仍应测试；其单列的 Kubernetes remediation MCP 能缩放、回滚、改资源，不能与默认只读混为一谈 |
| K8sGPT 是“analyzer 先筛选诊断、LLM 再解释”的模式，且有 MCP server | [K8sGPT repository](https://github.com/k8sgpt-ai/k8sgpt) | 项目源码/README，2026-07 快照 | use | 证明架构和接口；部署方仍负责模型后端、脱敏与 RBAC |
| Robusta Classic 把规则式 Prometheus 告警富化与可选 AI RCA 分开，支持显式 self-healing rules | [Robusta repository](https://github.com/robusta-dev/robusta) | 项目源码/README，2026-07 快照 | use | 证明“确定性规则 / 生成式调查”可分层；不证明任何规则适合其他环境 |
| AIOpsLab 可部署微服务、注入故障、生成负载、导出遥测，并按 Detection/Localization/Analysis/Mitigation 与 action trace 评估 agent | [AIOpsLab repository](https://github.com/microsoft/AIOpsLab) | 研究工具源码，2026-07 快照 | use | 它是评估基础设施，不是生产值班平台 |
| 遥测中的不可信文本可以操纵 AIOps agent 的 remediation 行为 | [When AIOps Become “AI Oops”](https://pasquini-dario.github.io/me/aioops.pdf) | 对抗性研究；受控实验、特定 agent/模型/任务 | use-with-caveat | 威胁模型适用于生产设计；论文中的攻击成功率不可外推为现实入侵概率 |
| “AI 使 MTTR 降低 X%”或“节省 Y 个 FTE” | 部分厂商/项目 README 营销材料 | 缺少统一基线、样本和反事实 | reject | 本报告不采用此类数字；需用本团队前后对照和事件回放来验证 |
