# NOVA Ops 2026 双 Agent 可观测平台产品方案

## 1. 产品定义

NOVA Ops 是现有监控、告警、日志、巡检、拨测之上的 **业务健康运行与调查层**。它不替代专业可观测模块，而是把这些模块的信号组织成可持续运行、可人工决策、可审计复验的两个闭环：

1. **Inspection Loop**：目标 → 检查计划 → 高频运行 → 健康评估 → 风险/Finding → 报告。
2. **Diagnosis Loop**：问题 → 观察/证据 → 候选假设 → 结论修订 → 受控动作 → 复验。

一期北极星不是“AI 生成了多少摘要”，而是：

- 变更/保障期间，从风险首次可观测到人做出正确业务决策的时间缩短。
- 人工跨监控、日志、拨测拼证的步骤减少。
- `unknown`、覆盖缺口和证据过期被及时处置，而不是形成静默绿色。

## 2. 用户与必须完成的决策

| 角色 | 进入系统的时刻 | 必须完成的决策 | 产品交付的价值 |
|---|---|---|---|
| 保障负责人 | 大促/重大活动开始前及进行中 | 当前阶段能否继续扩流；哪个风险由谁处置 | 持续业务健康、容量趋势、关键旅程与处置队列在一处闭环 |
| 发布负责人 | 灰度、扩容、配置变更窗口 | 继续、暂停、回滚或延长观察 | 同一验证计划对比变更前后，降低漏检与口头放行 |
| 值班 SRE | 告警、巡检 Finding、业务旅程异常出现时 | 是否升级事件；最可能根因；下一步验证/动作 | Agent 自动收集跨源证据，人围绕假设做判断 |
| 服务 Owner | 日巡、周治理、报告复盘 | 补哪些检查、修哪些长期风险、谁负责复验 | 把报告转成有 Owner、期限和复验的治理队列 |
| 平台工程师 | 新业务接入、NL 巡检草案发布前 | 数据/权限/成本/基线是否允许发布 | 让自然语言生成从 Demo 变成受治理的检查工程流程 |

## 3. 基本原子能力

### 3.1 共享上下文层

| 对象 | 最小字段 | 说明 |
|---|---|---|
| `HealthUnit` | id、type、businessTier、owner、SLO、dependencies | 可评估健康的业务服务、关键旅程或资源组 |
| `ScopeContext` | healthUnits、env、region、timeRange、changeId、missionId | 所有页面切换时必须继承并可锁定 |
| `SignalRef` | signalType、source、query、timeRange、freshness | 指向指标、日志、告警、Trace、拨测或变更的原始引用 |
| `Evidence` | signalRef、snapshot、capturedAt、quality、provenance | 固化到某次 Run/Investigation 的可复核证据 |
| `Gate` | type、status、reason、owner、recoverBy | coverage / freshness / baseline / permission / cost / execution |

### 3.2 巡检域

| 对象 | 最小字段 | 说明 |
|---|---|---|
| `InspectionIntent` | naturalLanguage、clarifications、creator | 用户原始运维语义，不直接执行 |
| `CheckDefinition` | target、query/test、window、comparator、threshold、evidenceType、owner | 可测试、可版本化的检查定义 |
| `PlanVersion` | checks、schedule、scope、notifications、approval、version | NL 或模板生成后的结构化执行计划 |
| `Mission` | scenario、goal、stageModel、planVersion、status | 日巡、保障、变更的长期或窗口化目标 |
| `InspectionRun` | trigger、startedAt、status、checkResults、cost | 每次真实运行实例 |
| `Assessment` | healthState、gates、confidence、reasonCodes | 规则/基线根据 Run 结果做出的健康判断 |
| `RiskSignal` | targetMetric、forecastWindow、confidenceBand、threshold、readiness | 有适用门禁的趋势/容量/错误预算风险，不是黑盒总分 |
| `Finding` | severity、evidence、owner、dueAt、status | 可认领、整改、复验的异常或治理结论 |
| `InspectionReport` | runRefs、findings、unknowns、decisions、actions | 运行事实的只读投影，不是状态真相源 |

### 3.3 诊断域

| 对象 | 最小字段 | 说明 |
|---|---|---|
| `Investigation` | issue、scope、startTime、status、revision | 独立且持久的调查容器 |
| `Observation` | statement、evidenceRefs、factStatus | 只描述可观察事实，必须链接证据 |
| `Hypothesis` | claim、supporting/refutingEvidence、assessment、nextTest | 支持/反驳/未知均可演进的候选根因 |
| `ConclusionRevision` | conclusion、confidence、limitations、createdBy | 新修订不覆盖旧结论 |
| `ActionProposal` | actionType、riskLevel、runbook、approvalPolicy | Agent 只提出建议；动作由策略和人授权 |
| `ActionRun` | approver、executor、audit、result、rollbackRef | 受控执行记录 |
| `Verification` | planRef、status、evidence、blockedBy | 修复后复用原检查复验；门禁未恢复则 blocked |

## 4. 两个 Agent 的职责与协作协议

### 智能巡检 Agent

可以：

- 将意图转成 Check/Plan 草案并解释来源。
- 调用只读数据工具执行计划，生成 Evidence、候选 Finding 和报告。
- 发现 coverage/freshness/baseline/permission/cost 缺口。
- 在满足数据门禁时生成带置信边界的 Risk Signal。
- 达到明确升级规则时创建 Diagnosis handoff 包。

不可以：

- 绕过 Plan approval 发布检查。
- 将未知或执行错误判为健康。
- 自行把“异常相关”改写为“唯一根因”。
- 从自由文本直接执行生产写操作。

### 故障诊断 Agent

可以：

- 从告警、Finding、日志、拨测失败或人工描述创建 Investigation。
- 继承 ScopeContext，生成 Observation、Hypothesis 和 next test。
- 对查询、证据、假设评估和结论做 revision。
- 提出带风险等级、Runbook 和审批策略的 ActionProposal。

不可以：

- 修改巡检结果或把自身置信度写成确定性健康状态。
- 默认执行生产变更。
- 展示或要求用户审阅模型隐式思维链。
- 省略无法访问的数据源和覆盖限制。

### 协作边界

`Finding severity≥P1`、关键旅程持续失败、变更 blocker 或人工点击“启动调查”时，巡检 Agent 创建 handoff：

`issue + scope + time window + triggering checks + evidence snapshot + open gates + change context`

Diagnosis Agent 新建 `Investigation`，只引用这些对象，不夺取 Finding 所有权。调查结论产生 Action 后，复验仍由原 Mission/Plan 执行，避免两个 Agent 分别宣布“已恢复”。

## 5. 统一状态语义

### 健康状态

- `healthy`：关键检查通过且所有强制门禁通过。
- `degraded`：仍可服务，但存在 warning 或错误预算/容量风险。
- `unhealthy`：关键目标失败或确认发生业务影响。
- `unknown`：覆盖、新鲜度、基线可比性或执行失败导致不可判定。

### Run 状态

`queued → running → needs_decision → succeeded / failed / cancelled`

### Investigation 状态

`collecting → testing_hypotheses → needs_input → concluded / inconclusive → verifying → closed`

### Verification 状态

`pending / running / blocked / passed / failed`

硬门禁：只要 coverage、freshness、baseline 或 execution 任一强制 Gate 未通过，健康不得为 `healthy`，Verification 不得为 `passed`。

## 6. 四条核心用户旅程

### Journey A：变更 Guard

1. 变更平台将 `CHG-23841 / payments-router v3.18.0 / prod / 10% canary` 送入 NOVA。
2. 巡检 Agent 根据服务等级、依赖和变更差异推荐 14 个检查；负责人确认 Plan v6。
3. 系统建立变更前基线，验证 coverage/freshness/comparability。
4. 灰度开始后每分钟运行：支付成功率、p95、错误预算、下游超时、日志新模式、关键地区拨测。
5. `checkout p95 +38%` 形成 blocker Finding；系统给出“暂停扩流”，并启动 Investigation。
6. 诊断 Agent 收集数据库连接池、版本差异、Trace 和日志模式，保留支持/反驳假设。
7. 人选择回滚；受控 Runbook 执行后原 Plan 复验。
8. 只有所有强制门禁恢复且关键检查通过，Guard 才允许 `passed`；报告记录暂停、回滚和 revision。

业务决策：继续 / 暂停 / 回滚 / 延长观察。

### Journey B：大促保障 Mission

1. 保障负责人打开“全球购峰值保障”，当前处于预热→爬坡→峰值→回落的阶段模型。
2. Live Ops 展示关键交易旅程、流量与容量预测、地域拨测、未决 Finding、Agent Run 状态。
3. 流量达到预测 1.8x 时，支付成功率仍达标但库存同步延迟进入 elevated；Risk Signal 明示置信区间与数据窗口。
4. 巡检 Agent提高相关检查频率，但受查询预算上限约束并记录变更。
5. 达到升级门槛后生成 Finding，分派库存 Owner；需要根因时再创建 Investigation。
6. 指挥者在决策队列中选择扩容、观察或降级；手机可审批但深度证据留在桌面。
7. 保障结束生成包含阶段、关键风险、动作、复验、unknown 和覆盖缺口的报告。

业务决策：扩流 / 限流 / 扩容 / 降级 / 继续观察。

### Journey C：NL2Inspection

1. Owner 输入：“每 5 分钟巡检支付域，关注成功率、p95、队列堆积和华东/华南结算拨测；异常时通知值班群。”
2. Agent 追问业务时段、阈值策略、对照基线和成本预算。
3. 生成 Plan 草案：12 个 Check、目标/查询/窗口/阈值/证据/Owner 均可编辑。
4. Validation 显示：10 Ready、1 Missing permission、1 Baseline not ready；提供可运行的样本查询和预计日成本。
5. 用户回放过去 7 天，查看触发次数、误报样本和覆盖范围。
6. 两项 blocker 清除后，审批人发布 Plan v1；后续任何 NL 编辑生成 v2，不能静默改动在线版本。

业务决策：继续澄清 / 编辑 / 回放 / 申请权限 / 发布 / 暂停。

### Journey D：值班故障调查

1. 告警或 Finding 预填服务、环境、时间窗、变更和触发证据，创建 Investigation。
2. 时间线先显示事实：何时出现、哪些关键旅程受影响、哪些依赖同时变化。
3. Agent 生成多个 Hypothesis，每个显示支持证据、反证、覆盖缺口和下一条可复核查询。
4. SRE 可在日志、监控、Trace、拨测专业 Lens 深挖，钉入 Evidence 后回到同一时间线。
5. 结论可能为 confirmed / likely / inconclusive；每次重跑保留 revision。
6. ActionProposal 进入审批；动作执行后回原 Plan 复验并关闭 Finding/Investigation。

业务决策：升级 / 否定假设 / 追加证据 / 执行动作 / 转人工专家 / 关闭。

## 7. 信息架构

### 一级导航

1. **运行态势 Live Ops**：此刻的业务健康、保障/变更、Agent 运行和决策队列。
2. **保障任务 Missions**：大促/活动/日巡 Mission 列表、阶段与运行历史。
3. **变更验证 Change Guards**：变更计划、基线、实时验证、放行决策。
4. **巡检工程 Inspection Studio**：NL2Inspection、模板、Check/Plan、回放和发布。
5. **故障调查 Investigations**：问题队列、证据时间线、假设和 Action。
6. **治理 Governance**：覆盖、新鲜度、基线、成本、权限、Agent/工具健康和审计。

### 专业 Lens（保留既有能力，不做六个重复页签）

- Monitoring：SLO、指标、容量、基线、Forecast。
- Alerts：告警归并、路由、升级和状态历史。
- Logs：查询、Facet、模式聚类、原始样本、证据钉入。
- Inspection：Check、Plan、Run、Finding、Verification。
- Synthetics：业务旅程、地域/运营商、步骤瀑布、重试和 CI blocker。
- Traces/Topology：调用链、关键路径、依赖传播和版本差异。

任何 Lens 跳转都继承可见且可锁定的 `service / env / region / time / change / mission / investigation`。

## 8. 页面契约

| 页面 | 首要角色 | 首屏必须回答 | 核心数据 | 主要动作 |
|---|---|---|---|---|
| Live Ops | 保障负责人/SRE | 现在什么最危险、哪些决策快到期、Agent 是否可信运行 | 关键旅程、Mission/Guard、Findings、运行/门禁、决策队列 | 进入任务、认领风险、审批、启动调查 |
| Mission Detail | 保障负责人 | 当前阶段是否能继续、下一阶段前缺什么 | 阶段、流量/容量、关键旅程、Run heatmap、风险、Owner | 调频、暂停、扩流/限流、分派 |
| Change Guard | 发布负责人 | 本次变更是否可继续 | baseline vs current、canary/control、objectives、blockers、decisions | 继续/暂停/回滚/延长观察 |
| NL2Inspection Studio | 服务 Owner/平台工程师 | 这段运维意图最终会运行什么，是否安全可发布 | Prompt、结构化 Checks、Validation、Replay、Cost、Approval | 澄清、编辑、验证、回放、发布 |
| Investigation | 值班 SRE | 影响是什么、哪种假设最可信、下一条验证是什么 | 时间线、Observations、Hypotheses、Evidence、Coverage、Actions | 钉证据、否定/确认、追加查询、提动作 |
| Governance | 平台负责人 | 哪些服务看似绿色但其实不可判定 | coverage、stale、drift、权限/成本、Agent success、审计 | 分派补齐、暂停计划、调整预算、复核版本 |

## 9. 一期范围

### 必须交付

- Live Ops、Change Guard、Mission Detail、NL2Inspection Studio、Investigation 五个真实工作面。
- 共享 ScopeContext 与专业 Lens 深链。
- Check/Plan versioning、Run、Assessment、Finding、Investigation、ActionProposal、Verification。
- coverage/freshness/baseline/execution 四类健康硬门禁。
- 只读跨源查询；生产动作走受控 Runbook + 审批 + 审计。
- 风险信号仅覆盖容量、错误预算、关键指标 Forecast 与异常持续性，并显示置信边界。

### 明确不做

- 单一全局健康分替代业务目标。
- 自由 Prompt 直接生成并执行生产变更。
- 展示模型隐式推理链。
- 无适用性门禁的跨业务风险预测。
- 为 AI 重建日志/指标/告警/拨测专业分析产品。

## 10. 产品指标

1. 变更验证从开始到放行/回滚决策的 P50/P90 时长。
2. 保障风险从首次可观测到 Owner 认领的时长。
3. 每次 Investigation 的人工跨工具跳转次数与首个可用假设时间。
4. `unknown` 平均暴露时长、被误显示为 healthy 的次数（目标为 0）。
5. NL 草案到发布的成功率、回放发现问题率、发布后 7 天撤回率。
6. Finding 整改/复验闭环率与逾期率。
7. Forecast calibration、误报/漏报和 `not_ready` 比例；不使用泛化厂商 ROI 作为验收。
