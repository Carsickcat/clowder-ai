---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO, AI_INSPECTION_PLAYBOOK_REUSE]
topics: [aiops, inspection, architecture, check-contract, evidence]
doc_kind: architecture
created: 2026-08-06
updated: 2026-09-02
---

# 架构设计：用户驱动的巡检工作区编译与验证

## 1. 架构目标

首期不建设新的巡检执行平台，也不把 LLM 放在安全闭环中心。Demo 证明的是一条最小、可审阅、可追溯的产品闭环：

```text
变更单 / 发布单引用
  + 可选风险关注点
        ↓
Inspection Request Compiler
        ↓
声明变更 ↔ 运行时事实对账
        ↓
声明内阻断范围 + 声明外 coverage gaps + 候选风险假设
        ↓
可执行 Check Contract + SRE 处置
        ↓
确定性 mock 执行与证据账本
        ↓
Evidence Verdict × Action Decision
        ↓
Scoped Report / RC Agent
```

它遵守四个边界：产品不预设用户场景；关掉 AI 仍能安全运行；候选风险假设没有天然门禁权；缺失证据不能被总结成“正常”。

## 2. 分层

| 层 | 职责 | Demo 实现 | 生产映射 |
|---|---|---|---|
| Input Compiler | 将变更引用与可选关注点编译为 CandidateSet 视图 | `lib/compiler.mjs`；任意服务动态传播 | 电子流、发布平台、Copilot 对话 |
| Change Reconciliation | 对账声明对象与实际版本、配置 hash、实例批次 | `Declared-Observed` 场景契约 | CI/CD 事件、运行时 diff、配置平台 |
| Scope Resolver | 分离默认阻断范围与声明外覆盖缺口 | 纯派生 selector | 业务图谱、Trace、服务目录 |
| Plan Compiler | 模板 Check + AI 候选；校验完整性和来源 | `Check Contract` + readiness selector | 巡检模板目录、LLM 语义编译器 |
| Verification Runner | 执行基线、指标、Trace 和中间件检查 | 确定性 mock steps | 现有巡检引擎、CH/DWS/Hive/Prometheus |
| Evidence Ledger | 保存每条结论的状态、来源、时间窗与边界 | immutable fixture | 可审计证据存储 |
| Decision Policy | 将证据映射为行动建议，允许具名风险例外 | 二维 Evidence/Action | 发布策略、权限审批 |
| Diagnosis Link | 违例后延续到根因诊断和恢复验证 | mock RC Agent 链 | 现有 RC Agent |

## 3. 全局薄腰契约

### 3.1 实体与变更身份

一次验证不能只相信变更单文本。`declaredChange` 与 `observedChange` 分别携带摘要和指纹，`reconciliation.status` 明确表达：

- `Exact`：声明与运行时事实一致；
- `Observed-Superset`：实际变化大于声明；新增实体先进入 `coverageGaps`，不得静默扩大阻断范围；
- `Conflict` / `Unverifiable`：生产形态下不得宣称 Pass。

### 3.2 Check Contract

正式 Check 必须同时具备：

```text
purpose              检查目的
targetEntity         目标实体
capability           可执行能力（只读）
metricRules[]        已注册黄金指标及结构化判定规则
  metricId           指标目录中的稳定 ID（只读）
  operator           目录允许范围内的比较符（SRE 可编辑）
  threshold          有限数值阈值（SRE 可编辑）
  unit + sourceRef   单位与事实来源（只读）
window + baseline    时间窗与对照基线
criticality          对放行的重要度
failureAction        失败后动作
rationale            生成理由
sourceIds            可追溯事实来源
```

缺少任一决策字段或引用不存在的来源，领域校验直接拒绝；AI 候选只有被 SRE 或规则提升后才进入正式 Check 集合。

### 3.3 证据与行动二维模型

证据状态只描述“系统知道了什么”：

```text
Verified / Violated / Inconclusive / NotEvaluated
```

行动状态只描述“SRE 或策略决定做什么”：

```text
Proceed / Proceed-with-conditions / Pause / Rollback
```

二者不可互相洗白。例如 `Inconclusive + Proceed-with-conditions` 是具名风险例外，不是 Pass。界面首屏只突出一个行动建议，再用证据徽章和下钻保持信息密度可控。

## 4. 状态与数据流

产品一级对象是用户请求与编译后的工作区：

```text
InspectionRequest { contextReference, prompt?, targetService? }
        ↓ compileInspectionRequest
CandidateSetView { blockingScope, coverageGaps, candidates, checks, evidence sources }
```

两个 mock fixture 藏在编译器后面，用来提供可复现的执行证据和异常结果；它们不是 session mode，也不出现在一级导航。任意未知服务会走通用 mock catalog，动态生成服务自身指标、直接下游和中间件检查。

会话状态只保存最小事实：当前 workspace（未提交时为 null）、`intake → plan → report` 阶段、候选选择、规则 override 与 RC 展开状态。指标目录、能力、单位和来源不可由浏览器改写；SRE 在计划页修改的比较符与阈值先作为瞬态 override，`PLAN_CONFIRMED` 后一次性物化进 immutable `InspectionPlan.checks[].metricRules`。

所有已选检查在 v0.4 中都声明为无依赖，因此没有逐项推进或排队状态。一次确认会对同一批检查做确定性求值、追加一条 immutable Run，并直接进入报告。当前报告、历史、复制摘要和导出 HTML 都读取该 Run 中同一份规则、判定与趋势序列；不存在第二份文本规则或可变的报告证据。

```text
createDemoSession (blank)
  → demoReducer(INTENT_SUBMITTED)
  → compileInspectionRequest(request) → CandidateSet plan
  → demoReducer(PLAN_CONFIRMED)
  → locked Revision / Run / Report
  → selectViewModel(state)
  → renderApp(viewModel)
```

所有 fixture、workspace 和 reducer 输出均深冻结；`RESET` 返回空白产品入口，新请求不会继承上一轮候选处置、执行或 RC 状态。

## 5. 离线交付架构

源码保留 ES Module 边界用于测试和维护。`scripts/build.mjs` 按固定拓扑顺序内联领域、fixture、request compiler、selector、reducer、渲染和事件适配，再内联全部 CSS，生成字节确定的单 HTML：

```text
lib/*.mjs + src/*.mjs + src/*.css + src/index.html
                         ↓
index.html
```

产物没有外链脚本、样式、字体、图片和 API；运行时只依赖浏览器的本地文件能力。

## 6. 安全边界

- 所有数据深冻结且为 mock；没有生产数据连接。
- 页面不存在 `fetch`、WebSocket、表单提交或动态外链。
- Demo 只输出发布建议，不执行发布、回滚或修复。
- LLM 候选不能自由生成 SQL/PromQL，也不能直接获得阻断权。
- 浏览器验收对 HTTP(S) 请求和运行时异常实行零容忍。

## 7. 从 Demo 到生产的直线路径

保持 `InspectionRequest / CandidateSet / locked Revision / Evidence × Action` 薄腰契约与 UI 决策路径不变，依次替换适配器：mock request compiler → 真实变更与语义解析；mock fixture → 电子流与运行时 diff；mock Check → 已有巡检能力目录；mock evidence → 多引擎查询结果；mock RC → 现有 RC Agent。首期无需重建全局知识图谱，也无需重写现有巡检执行引擎。

## 8. Playbook reuse architecture delta

```text
InspectionRequest → current InspectionWorkspace
                         ↓
               pure Playbook Matcher
                         ↓
             immutable Match Snapshot
                         ↓
      exact / minor-drift / major-drift decision
                         ↓
                 new Task Instance
                         ↓
              newly collected Evidence
                         ↓
          optional pending Playbook Proposal
```

四个状态对象只有一个写入 owner：只读 catalog 拥有 `PlaybookDefinition`；`INTENT_SUBMITTED` 一次性生成 `PlaybookMatchSnapshot`；session reducer 独占 `TaskInstance` 生命周期；report reducer 只追加一个幂等 `PlaybookProposal`。UI 与 selector 不持久化派生状态。

目录中的 `checkIds` 是审批结构的来源与顺序；matcher 必须将它们显式映射到当前 `InspectionWorkspace.committedChecks`，把当前实体、规则和事实来源写入不可变 match snapshot。任一 ID 无当前绑定时只能进入 major drift。exact/minor 被采纳后，reducer 将该结构冻结为新 Task Instance 的 `inspectionPlan`；因此目录升级会影响下一次新任务，但不会回写已锁定任务，也不会携带历史 evidence。

`TaskInstance.sourcePlaybookRef` 只绑定本次实际采用的 exact Playbook；minor/major drift 不能通过旧的专属确认路径进入执行。最终的 `PLAN_CONFIRMED` 把当前 CandidateSet 锁定，此后方案沉淀不得改变任务、证据或审计轨迹。Demo catalog 与 proposal 都是内存 mock；生产化时可替换为既有 Job/Revision 的版本化查询投影和审批适配器，不引入第二个可变 PlaybookStore。
