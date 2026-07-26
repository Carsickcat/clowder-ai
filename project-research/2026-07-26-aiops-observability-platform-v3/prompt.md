# 2026 AI 运维可观测平台：双 Agent 产品与高保真研究

## Problem Frame

面向已有监控、告警、日志、巡检、拨测和 AI 告警诊断能力的云服务运维平台，规划两个新增运行时：

- 故障诊断 Agent：把异常组织为可持续修订的调查。
- 智能巡检 Agent：高频评估业务健康，服务大促、保障、变更和日巡；支持 NL2Inspection。

目标不是再做一张能力介绍页，而是形成真实可操作的生产工作面。

## Disconfirm First

1. 厂商所谓 Agent 是否有持久工作对象、运行状态和人工门禁，还是只有聊天摘要？
2. 风险预测是否只是单指标 Forecast，是否公开历史窗口、置信区间、适用性和失败条件？
3. NL 是否能安全发布生产巡检，还是仅生成查询/代码草案？
4. 调查是否能回链原始证据、表达多假设、unknown 和 revision？
5. 自动动作是否有权限、审批、审计和复验？

## Source Rules

- 只将 Alibaba Cloud、Dynatrace、Datadog、Google Cloud 官方产品文档作为产品事实。
- 搜索摘要仅作线索；报告中保留直接 URL、访问日期和 GA/Preview/未说明。
- 厂商宣传 ROI 不进入产品决策。

## Local Constraints

- 不重建数据采集和专业分析系统。
- 不展示模型隐式推理链。
- 不允许自由 Prompt 直接执行生产变更。
- healthy 必须通过 coverage、freshness、baseline comparability 和 execution gates。
- `unknown`、`info/learning`、`error` 不得折算为通过。

## Output

1. 证据台账与反证。
2. 双 Agent 对象模型、职责边界和协作协议。
3. 高频保障、变更验证、NL2巡检、故障调查的用户旅程。
4. 数据密集、可点击的高保真系统。
5. 面向运维专家的使用说明书。
