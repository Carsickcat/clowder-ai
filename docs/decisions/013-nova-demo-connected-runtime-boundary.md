# ADR-013: NOVA Demo 与 Connected Runtime 硬隔离

**Status:** Accepted  
**Date:** 2026-07-31  
**Context:** `thread_mrrzdymcf3z6bx77`

## Decision

NOVA 变更巡检保留两个显式 composition：

- `demo`: standalone `file://` artifact，fixture runner，network 0；
- `connected`: Clowder API + SQLite durable state + server-owned read-only observability connector。

两者共享领域语言和展示组件，但不共享 runner。Connected 的连接失败、数据缺失、过期、
超时或解析失败必须落为 `unknown/degraded/failed`；禁止静默切换到 demo fixture。

Connected v1 只读观测并生成证据、判定和报告。人工“批准/继续”只追加
`DecisionRecord`，不触发 deploy、rollout、rollback 或流量操作。

连接器只能由服务端注册并以 `connectorRef` 引用。浏览器不得提交 endpoint、token、
任意 URL、指标值、freshness 或 verdict。Prometheus-compatible adapter 仅使用
operator 配置的固定 dev/staging endpoint，并通过官方 `/api/v1/query` 读取：
<https://prometheus.io/docs/prometheus/latest/querying/api/>。

## Why

当前 standalone 的可信承诺恰好是“离线演示、无后端、无生产动作”。在同一 reducer
里添加 fetch fallback 会让 connected 失败时继续生成 passed fixture，制造最危险的假绿。

服务端持久化和只读 connector boundary 让“任务可复用”和“结果来自观测”成为可测试事实；
同时避免在缺少生产授权、强认证和动作审批时复制发布平台状态机。

## Rejected Alternatives

### localStorage / reducer 作为 connected 真相源

否决：无服务端所有权、版本化、并发控制、重启一致性和 append-only audit。

### 只做 SQLite 持久化，继续用 mock executor

否决：能证明持久化，但不能证明巡检结果来自真实输入。Replay source 可用于验收，
但 connected runtime 必须提供真实只读 connector port。

### Connected 失败时回退 demo

否决：会把数据源故障伪装为健康结论。失败必须 fail-closed。

### 首版接发布/回滚 API

否决：超出只读巡检边界，需要独立权限、双人审批、目标绑定、有效期、一次性 receipt
和事故补偿设计。

### 首版做 scheduler

否决：它会引入 lease、恢复、重试、DLQ 和责任归属，不能增加当前两项核心价值。

## Consequences

- Standalone artifact 和既有 53 项门禁保持不变。
- Connected 页面有独立的 loading/empty/ready/running/degraded/misconfigured 状态。
- Job、revision、case、run、decision、report 默认永久保存，v1 无 DELETE。
- 首版是 connected sandbox，不宣称 production-ready；强 AuthN/AuthZ、scheduler、
  production connectors 和 write actions 后续独立设计。

