# NOVA Connected Inspection Control Plane 讨论纪要

**Thread ID:** `thread_mrrzdymcf3z6bx77`  
**日期:** 2026-07-31  
**参与者:** co-creator、丢丢、山本、烁烁、Fable

## 背景

已验收的 standalone job platform 是一个诚实的离线演示：作业来自 fixture，Case/Run
存在浏览器 reducer 中，network 0。co-creator 要求继续完成两件事：

1. 用户生成的巡检任务可持久复用；
2. 建立真实可用、而非换皮 mock 的系统代码。

原计划
[`2026-07-30-nova-standalone-job-platform-implementation-plan.md`](../feature-specs/2026-07-30-nova-standalone-job-platform-implementation-plan.md)
明确排除了 backend、persistent store、connector 和 runtime ownership boundary，因此它保留为
demo 阶段真相源；connected 阶段另立计划。

## 各方观点

- **山本：** 服务端持久化 Job/JobVersion/Case/Run/Evidence/Decision/Report；只接
  allow-list 的测试指标连接器；浏览器不能提交指标、结论、连接器 URL 或目标环境。
- **烁烁：** 首先让作业、Case 和报告跨刷新/重启保留；standalone 与 connected
  显式分层；不以 localStorage 冒充持久系统。
- **Fable：** 建议本地单机控制面和 replay 数据源；Job revision、Execution、
  CheckResult、Decision、Report、EvidenceRef 都是持久对象；无数据必须 unknown。
- **丢丢：** 把 replay 和真实只读连接器放在同一个 port 后面：replay 负责确定性验收，
  Prometheus-compatible adapter 负责 dev/staging 真实遥测；两者都不能触发发布动作。

## 共识

1. Standalone 保留 `demo` composition，继续 fixture + network 0。
2. Connected 是独立 composition；API/connector 失败时显示 `unknown/degraded`，绝不回退 fixture。
3. 服务端是 Job、Revision、Case、Run、Evidence、Decision、Report 的唯一真相源。
4. Job 更新产生不可变 revision；每次复用创建新 Case，历史证据不复制。
5. 第一阶段仅做 read-only inspection。批准/继续只写 DecisionRecord，不调用 deploy、
   rollout、rollback 或流量 API。
6. 连接器只能引用服务端注册的 `connectorRef`；endpoint/token 不接受浏览器输入、不入库。
7. 用户可见对象默认永久持久化；v1 不提供 DELETE，只允许 archive/disable。
8. 运行结果必须有 source、observedAt、window、query digest 等 provenance；缺失、过期、
   超时、权限不足和 malformed response 均为 `unknown/failed`，不能成为 passed。

## 分歧与收敛

### SQLite 持久化后继续 mock 是否足够

否决。它证明了持久化真实，但没有证明巡检读取了真实观测。最终方案保留
`ReplayObservabilitySource` 作为可复现输入，同时实现服务端配置的
`PrometheusObservabilitySource`。交付名称是“connected sandbox”，不是“生产巡检”。

### 是否今晚接生产可观测性和发布平台

否决。当前没有生产数据授权、连接器治理、强认证、查询预算和生产动作审批边界。
首版只允许 operator 在服务端配置 dev/staging 或本地 acceptance source，并且绝不提供生产写 API。

### 是否现在做 scheduler/worker queue

否决。手动 Run 足以证明 Job 可复用和真实数据可判定。首版用 idempotency key 防重，
持久化 `running → completed|failed`；stale running 在重启恢复时 fail-closed 为 interrupted。
调度器、lease、DLQ 属后续独立 phase。

## 行动项

1. 新增 connected-system 实施计划和 ADR。
2. TDD 建立共享 schema、SQLite 持久化、deterministic evaluator 和只读 connector port。
3. TDD 暴露 Fastify Job/Case/Run/Decision API，所有资源按 header identity 隔离。
4. 新增 `/observability/inspections` connected UI；不改 standalone composition。
5. 用临时 SQLite、fake/replay transport 和浏览器 interception 验证，不访问生产数据。

## 收敛检查

1. 否决理由 → ADR？**有** → `docs/decisions/013-nova-demo-connected-runtime-boundary.md`
2. 踩坑教训 → lessons-learned？**没有新增通用教训**；“demo/live 不得 fallback”进入本 ADR
3. 操作规则 → 指引文件？**没有**；这是 NOVA 域内架构规则，不升级为全仓家规

