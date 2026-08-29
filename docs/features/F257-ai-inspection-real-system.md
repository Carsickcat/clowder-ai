---
feature_ids: [F257]
related_features: []
topics: [aiops, inspection, observability, production-integration, copilot]
doc_kind: spec
status: in-progress
created: 2026-08-30
---

# F257: AI Inspection Real System — AI 巡检真实系统

> **Status**: in-progress | **Owner**: Ragdoll + Siamese | **Priority**: P0
>
> 将已经验证过的 AI 巡检 Copilot 产品旅程接到现有 NOVA Inspection 控制面与真实企业数据源；不再运行独立 demo 状态机，不以 mock 作为任何生产降级路径。

## Why

离线 Copilot 已经用五轮产品迭代验证了用户旅程：对话创建、范围对账、候选裁决、保存直跑、运行历史和可追溯报告。仓库同时已经拥有一套真实的 NOVA Inspection 控制面：持久化的 CandidateSet / Job / Revision / Case / Run / Decision / Report、只读 ObservabilitySource 端口、Prometheus adapter、严格身份隔离、幂等和 immutable audit records。

缺口不是“再写一套巡检系统”，而是两端尚未汇合：

- NOVA 的候选生成仍从前端接收完整变更上下文，拓扑与规则目录仍是静态规则；
- 生产启动只注册 acceptance replay，已实现的 Prometheus adapter 尚未由显式配置接入；
- Copilot 的最终交互仍是离线单文件，没有投影服务端的权威 InspectionWorkspace；
- 真实电子流、拓扑和指标接入点尚无统一来源契约与运行时健康状态。

本 Feature 以现有 NOVA 控制面为唯一真相源，把经过验收的 Copilot UX 变成它的真实产品表面。

## Product Boundary

### v1 includes

- 一个真实服务的完整旅程：输入变更引用 → 真实变更/拓扑对账 → 候选裁决 → 持久化任务 → 直跑/漂移守门 → 真实指标取证 → immutable 报告。
- `ChangeSource` 与 `TopologySource` 新端口；现有 `ObservabilitySource` 继续承担 MetricSource 职责。
- 生产源只在完整配置后注册；断连、超时、权限不足、数据陈旧或响应畸形一律 fail closed。
- 复用 `SqliteInspectionStore` 和 `InspectionService`；不新增第二个 `PlaybookStore`、第二套报告对象或 localStorage 业务真相。
- Copilot 最终 UX 投影现有 API 的 CandidateSet / Job / Revision / Case / Run / Report。
- 只读 RBAC；v1 不触发真实处置。

### v1 excludes

- 定时巡检、通知触达、团队审批流、自动修复、多服务批量。
- 全局指标语义平台；v1 采用单服务、白名单指标与显式规则版本。
- 隐式 mock/replay fallback。Replay 仅可在明确的 acceptance scope 中注册。

## User Journey

1. 用户在 Copilot 输入变更引用和可选的自然语言意图；公开 API 不接受浏览器提交的 service、environment、connector、version 等权威字段。
2. 服务端通过 `ChangeSource` 从变更引用解析权威变更事实，通过 `TopologySource` 补齐依赖和信号覆盖；每个事实携带来源、采集时间和摘要。
3. 确定性规则目录生成正式检查，AI 只能提出候选建议。用户对高风险候选必须表态，对一般候选可选处理。
4. 用户确认后，CandidateSet materialize 为 NOVA Job/Revision；Case 的 change/version 从 revision 锚定的 CandidateSet 派生，不再接受浏览器重复提交。
5. 创建新 Run 前重新解析变更与拓扑摘要；出现漂移则返回 typed 409 和差异摘要，且不创建 Run。相同 idempotency key 已存在时先返回既有 Run，不重复访问来源或创建记录。
6. `InspectionService` 使用注册的真实 `ObservabilitySource` 只读取证，规则引擎计算 Pass / Fail / Inconclusive。
7. 当前报告、历史快照、复制摘要和导出 HTML 都投影同一个 immutable Report，AI 解读只引用锁定证据。
8. 任何来源不可用都显示明确 unavailable/inconclusive，不展示伪造的 demo 数值。

## Architecture Truth

```text
Copilot Web
    │ existing /api/observability/inspection-* API
    ▼
InspectionService ── SqliteInspectionStore (authoritative, TTL=0)
    │
    ├── InspectionPlanningSources (narrow resolver, bootstrap-owned)
    │      ├── ChangeSource   (new: change facts + provenance)
    │      └── TopologySource (new: dependencies + coverage)
    └── ObservabilitySource (existing: Prometheus/replay adapters)
                         │
                         └── deterministic evaluator → immutable Run/Report
```

`PlaybookStore` 是产品概念，不是新的 persistence port：它映射到现有 Job/Revision lineage。MetricSource 同样不另建平行接口，而是扩展并正确组合现有 `ObservabilitySource`。规划来源不并入 metrics registry；bootstrap 只组合一个窄的 `InspectionPlanningSources` resolver。

CandidateSet 扩展为不可变 `planningSnapshot`：包含 change/topology 两源 provenance、capturedAt、内容哈希、catalog version/hash 和总 `planningDigest`。Revision origin 保存同一 `planningDigest` 作为完整性锚点，不新增 PlanningSnapshot 表。

## Requirements Checklist

| Area | Requirement | Verification |
|------|-------------|--------------|
| Identity | 所有读取和写入继续按 `userId` 隔离 | API/store adversarial tests |
| Authority | 公开规划入口只接受 change reference + 非权威 intent；Case 不接受 change/version；浏览器不能直建/改 Job checks | route schema adversarial tests |
| Persistence | Job/Revision/Case/Run/Decision/Report TTL=0，重启后可恢复 | restart persistence test |
| Provenance | 变更、拓扑、指标均记录 source ID、采集时间、摘要/哈希 | contract + API tests |
| Freshness | 超龄事实或指标不得判为通过 | evaluator and journey tests |
| Fail closed | 未配置/超时/401/畸形响应不回退 replay 或 mock | startup and adapter tests |
| Immutability | 已 materialize revision 与已完成 run/report 不可改写 | store conflict tests |
| Drift | 创建新 Run 前 change/topology digest 漂移必须阻断且不留下 Run | store count + end-to-end journey test |
| LLM boundary | LLM 不产生门禁结果，不创造无证据事实 | projection tests |
| UX continuity | 首访、复访、候选裁决、历史、报告 V2 与已验收 UX 同构 | browser acceptance |
| Responsive | 390px 无横溢，真实长名称和缺失态可读 | browser assertions |

## Acceptance Criteria

- [x] AC-1: `ChangeSource` / `TopologySource` 契约与错误分类完成，所有事实含 provenance 和 freshness。
- [ ] AC-2: Prometheus 通过显式生产配置注册；配置缺失时 source 不注册且 API 明确返回 unavailable，不回退 replay。
- [x] AC-3: CandidateSet 公开创建接口只接受 change reference 与可选 intent；service/environment/connector/version/topology 均由服务端来源解析，浏览器提交这些字段会被拒绝；公开直建/修改 Job checks 的旁路被移除。
- [x] AC-4: CandidateSet materialize 后，Job/Revision/Case/Run/Decision/Report 继续使用现有服务端持久化与不可变约束；Case 的 change/version 必须从 revision origin 派生。
- [x] AC-5: 保存任务直跑在创建新 Run 前校验 change/topology digest；漂移时返回 typed 409 + 差异摘要且 Run 数量不变，同 idempotency key 已有 Run 时原样返回。
- [ ] AC-6: 一个配置的真实服务可完成端到端巡检，指标判定来自真实 ObservabilitySource。
- [ ] AC-7: Copilot Web 使用现有 NOVA API，页面、历史、分享与导出引用同一权威报告。
- [ ] AC-8: 数据源 unavailable / timeout / unauthorized / stale / malformed 的路径均 fail closed 且有可操作空态。
- [ ] AC-9: 既有 NOVA runtime tests 与离线 Copilot 93 项回归保护保持全绿；新增真实旅程覆盖 restart、identity、drift 和 390px。
- [ ] AC-10: 合入后在隔离 acceptance 环境验证，不接触生产用户数据；真实环境 smoke test 仅在 operator 提供授权接入点后进行。

## Implementation Progress

- `feat/ai-inspection-real@44bac1e`: 完成规划来源端口、不可变 `planningSnapshot` / `planningDigest`、严格公开 schema、Case lineage 派生、Run 前 drift guard、显式 Prometheus 组合与无 replay fallback；API observability 89/89、NOVA deliverables 6/6 通过。
- `feat/ai-inspection-real@eb6c845`: Connected Web 只提交 `changeRef` 与可选 intent，移除 Job/Revision/Case 权威事实写入口，保留只读 lineage 投影，并把 typed drift 409 呈现为重新规划动作；完整 Web tests 与整仓 `pnpm gate` 通过。
- production build 在隔离端口 API `3192` / Web `5192` 返回 200；Hub 预览已打开，但当前会话无可控内嵌浏览器实例，因此 390px 与真实长数据视觉验收仍未宣称完成。
- provider-specific `ChangeSource` / `TopologySource` adapter、真实指标端到端与 smoke test 继续等待 co-creator 提供非生产 endpoint、鉴权、样例 payload、测试服务及允许查询范围。

## Dependencies

- **Evolved from**: NOVA connected inspection control plane (`feature-specs/2026-08-04-nova-inspection-runtime.md`)
- **UX truth**: `designs/ai-inspection-copilot-offline-demo/` at `main@bcf994a`
- **Implementation plan**: `feature-specs/2026-08-30-ai-inspection-real-system.md`
- **External**: change/topology/metric endpoints, authentication, sample payloads and a non-production test tenant supplied by operator

## Risks

| Risk | Mitigation |
|------|------------|
| 外部 API 契约未知 | 先冻结内部 normalized ports；provider adapter 只有拿到样例和授权后才宣称完成 |
| 新旧系统形成双真相 | Copilot 只投影 InspectionWorkspace；禁止新 PlaybookStore/localStorage 业务状态 |
| 指标同名不同义 | v1 白名单 + 显式 unit/operator/threshold/catalog version |
| 数据源不稳定 | bounded timeout/response size、错误分类、健康状态、fail closed |
| 真实环境误操作 | 所有 adapter 只读；无自动处置；使用隔离测试租户 |
| UX 被真实长数据撑坏 | 真实长名称、missing/stale/partial 状态纳入设计 continuity 和 390px 测试 |

## Open Questions

- co-creator 需提供：电子流/拓扑/指标源的非生产 endpoint、鉴权方式、样例请求响应、测试服务标识和允许的查询范围。
- 若企业变更源与拓扑源是同一 API，可由一个 provider adapter 实现两个端口，但端口语义仍保持分离。

## Key Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | 复用 NOVA 控制面，不建立第二运行时 | 现有持久化、身份、幂等、不可变报告已经是正确底座 | 2026-08-30 |
| 2 | 不新增 `PlaybookStore` | Job/Revision 已经是服务端方案真相；新 store 会产生双写与漂移 | 2026-08-30 |
| 3 | 复用 `ObservabilitySource` 作为 MetricSource | Prometheus adapter 已存在且有安全边界，无需平行抽象 | 2026-08-30 |
| 4 | 生产源不配置则不注册 | unavailable 必须可见；mock fallback 会伪造安全感 | 2026-08-30 |
| 5 | 分配 F257 | 共享项目记忆中 F152-F256 已被并行主线占用，避免未来合流碰撞 | 2026-08-30 |
| 6 | CandidateSet 内嵌 immutable planningSnapshot，不新增表 | 它已是 planning→revision 的自然持久化坐标，revision origin 可用 digest 锚定完整性 | 2026-08-30 |
| 7 | 规划来源使用窄 resolver，不并入 metrics registry | change/topology 解析与指标采集的生命周期、错误语义不同 | 2026-08-30 |
| 8 | legacy operations 表面只读且 role-gated | 保留诊断价值，但彻底关闭绕过规划和 drift guard 的第二写路径 | 2026-08-30 |

## Review Gate

- 架构边界：山本（British Shorthair）
- 真实数据形态 UI continuity：烁烁（Siamese）
- 正式代码 review：跨个体 reviewer
- 真实环境 smoke test：co-creator 提供授权接入点后执行
