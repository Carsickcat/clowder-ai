# Claim Ledger — AI for Operations / AIOps

> 审计日期：2026-07-14。`use-with-caveat` 的 claim 不得被表述为通用生产事实。

| Claim | 原始来源 | 来源类型 / 年份与对象 | 五问摘要 | Verdict | Provenance |
|---|---|---|---|---|---|
| Google Cloud 的调查会从日志、配置、指标形成可回溯的 Observations；调查 OAuth 权限受发起用户/服务账号限制且不写入被调查资源。 | [Google Cloud Assist investigations](https://docs.cloud.google.com/cloud-assist/investigations?hl=en) | 官方文档，2026，Google Cloud 单项目/App Hub 调查 | 一手；产品利益相关但具体行为、限制可核；当前仍为 Preview/受 Premium Support 或账号团队访问限制；不能外推到其他云或开源 agent。 | use | [一手/官方文档/2026/GCP 调查/高] |
| Azure 的“自主运维”当前只自动做告警关联、建 issue、深度调查；改变环境的决定由人做。 | [Azure Observability Agent](https://learn.microsoft.com/en-us/azure/azure-monitor/aiops/observability-agent-autonomous-operations) | 官方文档，2026，Azure Preview | 一手；厂商利益相关但权限和预览边界清楚；适用于 Azure Preview，不代表行业所有产品。 | use | [一手/官方文档/2026/Azure Preview/高] |
| AWS CloudWatch investigations 将遥测、CloudTrail、部署和资源变更作为调查输入，并给出 Systems Manager runbook 等建议。 | [AWS 发布说明](https://aws.amazon.com/about-aws/whats-new/2024/12/amazon-q-developer-operational-investigation-preview/) | 官方发布，2024，AWS Preview | 一手但发布时间较早且产品命名/可用性可能变化；是功能线索，不是效益或 GA 证明。 | use-with-caveat | [一手/官方发布/2024/AWS Preview/中] |
| HolmesGPT 的内置 toolset 默认只读、尊重既有 RBAC/IAM，并记录每次工具调用。 | [HolmesGPT 文档](https://holmesgpt.dev/0.21.0/why-holmesgpt/) | 项目官方文档，2026，开源 SRE Agent | 一手实现宣称；需在部署时核验配置，且自定义/MCP remediation tool 不自动继承该只读边界；没有独立安全审计证据。 | use-with-caveat | [一手/项目文档/2026/HolmesGPT 默认内置工具/中] |
| K8sGPT 会扫描 Kubernetes 故障并可通过 MCP 暴露集群操作；其 README 警告事件 payload 可能含敏感项目名且尚未完全脱敏。 | [K8sGPT README](https://github.com/k8sgpt-ai/k8sgpt) | 代码仓库，2026，Kubernetes 工具 | 一手代码/README；当前 main/release 状态有变化风险；适用于向外部 LLM 发送 cluster context 的数据泄露风险，不是泛化漏洞证明。 | use | [一手/开源仓库/2026/K8sGPT 使用者/中高] |
| AIOpsLab 将检测、定位、分析、缓解拆成可注入故障、生成负载、收集遥测、保存 action trace 的可评估任务。 | [AIOpsLab 代码与文档](https://github.com/microsoft/AIOpsLab) | 开源框架与 MLSys 2025 论文，微服务/Kubernetes benchmark | 一手代码 + 已发表会议论文；基准不是生产环境，适合验证 agent 流程与回归，不证明生产自愈可靠。 | use | [一手/代码+论文/2025/微服务 K8s benchmark/高] |
| 遥测污染可诱导 AIOps agent 产出危险 remediation；一项控制实验报告平均 89.2% 的攻击成功率。 | [When AIOps Become “AI Oops”](https://pasquini-dario.github.io/me/aioops.pdf) | RSA Conference 论文，2025；AIOpsLab 两应用、GPT-4o/4.1、120 次控制试验 | 有原始实验与明确模型/样本；不是生产流量、只测两类框架，且 LLM-as-judge 参与等价判定；数字只能说明该威胁模型值得防御，不能估计真实入侵概率。 | use-with-caveat | [一手/学术实验/2025/受控 AIOpsLab/中高] |
| IncidentFox 开源版不含其生产安全层（sandbox isolation、credential proxy），该层使用不同许可证。 | [IncidentFox README](https://github.com/incidentfox/incidentfox) | 项目官方仓库，2026，AI SRE 平台 | 一手；不是安全审计；但足以说明 self-hosted 开源版与生产安全版的能力边界不能混淆。 | use | [一手/开源仓库/2026/IncidentFox OSS/高] |
| IncidentFox 宣称其告警关联可降噪 85–95%。 | [IncidentFox README](https://github.com/incidentfox/incidentfox) | 项目营销性 README，2026 | 没有公开数据集、基线、工作负载或独立复现；强利益冲突。 | reject | [一手/营销 claim/2026/未说明对象/低] |
