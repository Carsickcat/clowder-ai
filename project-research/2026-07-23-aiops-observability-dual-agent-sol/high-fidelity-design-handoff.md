# NOVA Ops 高保真设计交接合同

本文件给视觉与前端落地使用。它不是低保真“页面建议”，而是可验收的画面、数据、状态和点击旅程契约。

## 1. 设计目标与反目标

### 用户看到首屏后 10 秒内应理解

1. 这是生产系统，当前有业务、变更、巡检和诊断正在运行。
2. 最危险的不是最高“分数”，而是一个具体关键旅程、风险门禁或待决策事项。
3. 两个 Agent 正在做不同的工作，而且有运行、受阻、等待人工和修订状态。
4. 任一结论都能进入证据、查询、专业 Lens 和 Owner，而不是停在 AI 文案。

### 禁止再次出现

- 首屏用大标题解释“什么是 AI 运维”。
- 原子能力、用户场景、价值主张占据生产首页。
- 五个模块复用相同卡片，只换标题和数字。
- 巨大的健康分/环图成为视觉中心。
- 每页右侧固定一个万能聊天框。
- 用霓虹渐变、玻璃大卡和大量空白掩盖信息不足。
- 点击后只 toast，不改变领域状态。

## 2. 视觉系统

### 画布

- 桌面主稿：1440 × 1024；内容最小高度 900，可纵向滚动。
- 手机决策稿：390 × 844；只承载态势、认领、审批、复验状态，不塞复杂查询编辑器。
- 左侧导航 224 px；顶部上下文栏 56 px；主内容 24 px gutter；右侧决策抽屉 360 px，仅按需打开。

### 色彩

- 页面底：`#0B0F14`；工作面：`#111821`；抬升层：`#16212D`；边框：`#253343`。
- 主文字：`#EDF3F8`；次文字：`#9FB0C0`；弱文字：`#6F8192`。
- 健康：`#38C793`；关注：`#F3B84B`；危险：`#F06464`；未知/门禁：`#A58AF5`；运行中：`#4CA7FF`。
- AI 不使用独立“魔法紫”铺满页面；紫色只标注 `AI proposed / unknown / needs review`。

### 数据视觉

- 数值使用 tabular-nums；关键数值与时间戳优先右对齐。
- 趋势图必须有当前、基线/对照、阈值、变更标记和缺数据段；不得画无坐标装饰曲线。
- 状态必须同时用颜色、图标和文字；不依赖颜色单一表达。
- `unknown` 使用紫色斜纹或断点，不用灰色弱化。

### 信息密度

- 采用可观测控制台密度：每屏 5–8 个主要信息区域，每区有明确工作动作。
- 卡片只用于可独立操作的对象；指标组、表格、时间线优先共享容器，避免“卡片墙”。
- Agent 状态以 compact runtime row 呈现：任务、当前步骤、耗时、工具/数据源、阻塞原因、下一状态。

## 3. 全局 Shell

### 左侧导航

```
NOVA Ops
● 运行态势        3
  保障任务        2 active
  变更验证        1 blocker
  巡检工程        4 drafts
  故障调查        2 running
  ───────────
  监控 / 告警 / 日志 / 巡检 / 拨测
  ───────────
  治理与审计      7 gaps
```

传统模块是专业 Lens，视觉上次于 Agent 工作面，但始终可达。

### 顶部上下文栏

`Production ▾  |  全球购核心链路 ▾  |  cn-east + cn-south  |  19:45–20:30  |  🔒 上下文已锁定  |  数据更新 8s`

- Mission/Change/Investigation 存在时，在上下文栏追加其 ID。
- 任意 Lens 跳转必须保留这些值；用户可清除，但要明确提示将离开当前调查/保障上下文。

### 全局右上区

- Agent runtime health：`Inspection 12 running / Diagnosis 2 running`。
- HIL inbox：`3 decisions`。
- 通知、个人与全局搜索。

## 4. Frame 01 — 运行态势 Live Ops

### Mock 场景

- 当前时间：2026-06-18 20:18:42。
- Active Mission：`MIS-61801 全球购峰值保障`，阶段 `峰值 20:00–21:00`。
- Active Change：`CHG-23841 payments-router v3.18.0`，canary 10%，暂停扩流。
- 关键旅程：登录、搜索、加购、结算、支付、订单查询。
- 最重要风险：库存同步延迟、支付 p95 回归、华南拨测不稳定。

### 页面结构

```
┌ 今日生产运行  20:18:42 ───────────────────── [进入保障指挥]
│ 6 关键旅程：3 healthy / 2 degraded / 1 unknown
│ 决策时钟：支付灰度需在 08:12 内决定继续/回滚
├──────────────────────────┬───────────────────────────┐
│ 关键旅程实时矩阵           │ 待决策队列                 │
│ Journey  Health  SLO ... │ P1 暂停扩流  CHG-23841    │
│ 支付     degraded 99.72% │ P2 库存扩容  due 20:24    │
│ 结算     unknown  data...│ P2 华南拨测 认领          │
├──────────────────────────┼───────────────────────────┤
│ 保障流量与容量             │ Agent 运行现场              │
│ Actual 181k RPS           │ Inspection Run #1842 62%  │
│ Plan 98–112k / cap 220k   │ ↳ querying synthetics      │
│ Band + stage markers       │ Diagnosis INV-7719        │
│                            │ ↳ testing DB pool H1       │
├──────────────────────────┴───────────────────────────┤
│ 风险与事件时间线  19:45────────20:18────────21:00    │
│ traffic stage / change / finding / action / unknown  │
└──────────────────────────────────────────────────────┘
```

### 关键组件

1. **关键旅程实时矩阵**：每行显示健康、成功率、p95、SLO burn、拨测地域、最近 Run、新鲜度；点击进入旅程详情，不弹营销说明。
2. **待决策队列**：按截止时间与业务影响排序；每项有 Owner、建议、证据数量、倒计时和明确动作。
3. **流量/容量图**：实际、预测带、容量线、活动阶段、变更标记；预测未就绪时显示 `not_ready: only 1.4 seasons`。
4. **Agent 运行现场**：显示正在执行的 Run/Investigation、当前公开步骤、耗时、阻塞和“查看运行”；不显示隐式推理。
5. **事件时间线**：保障阶段、告警、Finding、变更、人工决策、Action、Verification 统一排布。

### 点击

- 点 `CHG-23841` → Frame 03，ScopeContext 不变。
- 点 `支付 degraded` → 右侧打开旅程详情，可启动/进入 Investigation。
- 点 Agent run → 打开运行抽屉，展示 check/query/tool/result 的审计序列。
- 点 unknown → 进入 Gate detail，显示数据断点、Owner、预计恢复时间。

## 5. Frame 02 — 保障任务 Mission Command

### 页面首问

“全球购峰值保障当前能否继续承载增长？进入下一阶段前必须处理什么？”

### 页面结构

- 顶部 Mission 条：`峰值阶段 · 43m remaining · commander 陈工 · 38 services · Plan v12`。
- 阶段轨道：预热 ✓ → 爬坡 ✓ → **峰值 running** → 回落 → 复盘。
- 中央左：业务交易漏斗与关键旅程（曝光→搜索→加购→结算→支付），同时显示实时、计划、昨同比与 SLO。
- 中央中：流量/容量与预测、错误预算 burn、资源 headroom。
- 中央右：风险战情板（P1/P2 Finding、Owner、ETA、处置状态）。
- 下半部：Inspection Run heatmap，行是检查域（业务/SLO/容量/日志/拨测/依赖），列是最近 30 次高频运行；未知与执行错误显式分色。
- 底部：Agent/HIL 时间线与交班记录。

### 独有动作

`提升检查频率`、`进入下一阶段`、`冻结扩流`、`启动降级预案`、`新建战情 Finding`、`生成阶段快照`。

### 必须避免

Mission 页面不能复制 Live Ops；它要有阶段模型、交易漏斗、Run heatmap、战情 Owner 和指挥动作。

## 6. Frame 03 — 变更验证 Change Guard

### Mock 数据

- `CHG-23841 payments-router v3.18.0`
- 10% canary / control 90%；开始 20:03；观察窗 20m；决策剩余 08:12。
- Objectives：支付成功率、p95、5xx、DB pool、队列 lag、华东/华南拨测、日志新模式。
- 当前：2 fail、1 warning、9 pass、1 unknown、1 info。

### 页面结构

- 顶部决策条：`建议：暂停扩流`，旁边显示“规则 blocker 2 / AI evidence summary / 未知 1”，三个来源不可混为一个分数。
- 左侧 `canary vs control` 小倍图：成功率、p95、错误率、资源；变更时刻垂直线。
- 中央 Objective table：状态、当前、baseline/control、阈值、数据新鲜度、Evidence、Owner。
- 右侧 Decision rail：继续至 25%、延长 10m、暂停、回滚；危险动作需确认并显示审批策略。
- 下方 Finding：`FND-8821 p95 +38%`、`FND-8824 checkout logs new pattern`、`FND-8828 华南拨测 freshness unknown`。
- 底部 Verification timeline：baseline captured → canary started → blocker → investigation → action → verification。

### 交互终局

- 点“回滚”不是 toast：生成 `ActionProposal` → 审批 sheet → `ActionRun running` → Guard 进入 `verifying`。
- 若华南拨测仍 stale，即使指标恢复，Verification 为 `blocked`，顶部显示 `业务恢复但验证未完成`，绝不能 `passed`。

## 7. Frame 04 — NL2Inspection Studio

### 页面结构

三栏工作台，不是聊天页：

```
┌ 意图与澄清 28% ┬ 结构化 Plan 44% ┬ 发布门禁 28% ┐
│ 原始 Prompt      │ 12 Checks       │ 10 Ready       │
│ 缺失信息 3       │ scope/schedule  │ 1 Permission   │
│ 对话澄清          │ query/threshold │ 1 Baseline     │
│ 业务词典映射       │ evidence/owner  │ Cost ¥42/day   │
│                  │ [Run sample]    │ Replay 7 days  │
└─────────────────┴─────────────────┴───────────────┘
```

### 中栏 Check 编辑器

选中“支付成功率”后展示：

- Target：`journey:checkout/payment`
- Source：`metrics: payment_success_total / payment_attempt_total`
- Window：5m，Compare：同星期同时间 + 变更前 30m
- Rule：`< 99.85% for 2/3 runs`
- Evidence：timeseries + top error codes + linked synthetics
- Owner：payments-oncall
- Query：真实可展开的 SPL/DQL 等价表达

### 右栏 Gate

- `Schema resolved` ✓
- `Sample query` ✓ 132 ms / 18.4 MB
- `Data freshness` ✓ 9s
- `Permission` ✕ no read to cn-south synthetic detail
- `Baseline` ◐ learning 3/5 comparable runs
- `Projected cost` ✓ ¥42/day / budget ¥80
- `Replay`：过去 7 天预计触发 6 次，2 次命中历史事件，4 次待人工标注。

发布按钮必须 disabled，并写清 blocker；权限恢复、基线达到门槛后才允许进入 Approval。

### 版本交互

- 所有修改形成 Draft v2，不影响 Published v1。
- 发布后显示 diff：新增 2 checks、阈值调整 1、频率 10m→5m、预计成本 +31%。
- AI 建议以可接受/拒绝的 patch 呈现，不直接重写整个 Plan。

## 8. Frame 05 — 故障调查 Investigation

### Mock 数据

- `INV-7719 支付 p95 回归`，来源 `FND-8821`。
- Scope：payments-router / prod / cn-east+cn-south / 20:03–20:21 / CHG-23841。
- Impact：支付成功率 -0.18pp，p95 +38%，约 18.2k 用户受影响。

### 页面结构

- 顶部 issue bar：影响、状态 `testing hypotheses`、Revision 3、coverage 82%、数据缺口 1。
- 中央主骨架是证据时间线：deploy、metric deviation、log pattern、trace bottleneck、synthetic step failure、人工动作。
- 左下 Observation 列表：事实句 + 来源 icon + 时间窗 + “打开原始数据”。
- 右侧 Hypothesis board：
  - H1 `DB connection pool saturation` — likely 0.81；3 supporting / 1 refuting；Next test “compare pool wait canary vs control”。
  - H2 `promo-pricing downstream latency` — possible 0.42；2 supporting / 2 refuting。
  - H3 `regional network degradation` — unlikely 0.16。
- 下方专业 Lens：Metrics / Logs / Traces / Synthetics / Changes；切换后是各自专业数据，不复制 Observation 卡。
- 最右窄栏只放“下一步”：运行可复核查询、请求权限、询问 Owner、提出 Action；聊天按需展开。

### 明确不展示

不展示“Agent 想了 17 步”的思维链。公开执行序列只包含：查询/工具名、范围、输入参数摘要、结果、耗时、错误和是否被用于某条 Observation。

### 结论

SRE 可将 H1 标为 confirmed，并创建 `ActionProposal: rollback v3.18.0`。若证据不足，可选择 `conclude inconclusive`，系统不得强迫唯一根因。

## 9. Frame 06 — Governance

### Mock 数据

- 128 Tier-1/2 services；健康可判定覆盖 84%。
- 7 stale sources、3 baseline drift、4 missing synthetic regions、2 Agent tools degraded。
- 36 Published Plans、18 Draft、4 Paused；过去 7 天 18,420 Runs，1.8% execution error。
- Forecast：12 active、4 not_ready、3 calibration degraded。

### 页面结构

- 第一行不是“总体健康分”，而是四个治理队列：Coverage gaps / Stale data / Baseline drift / Agent execution health。
- 服务×证据类型 coverage matrix，支持按 Tier、Owner、环境过滤。
- Plan 生命周期与版本 diff 队列。
- Agent 成本/频率/成功率/限流表。
- Forecast readiness 与 calibration 图；显示 not_ready 和失准，不只显示命中案例。
- Audit stream：谁用 NL 修改了计划、谁审批、Agent 调了什么公开工具、谁执行动作。

### 独有动作

分派覆盖缺口、暂停 Plan、批准版本、调整预算/频率、禁用某工具、查看审计。

## 10. Frame 07 — 手机 HIL 决策

### 画面

- 顶部：`P1 · 决策剩余 08:12`。
- 标题：`payments-router 灰度是否回滚？`
- 影响摘要：成功率 -0.18pp、p95 +38%、18.2k users；显示数据更新时间。
- 3 条可核验证据，可点开简图/原始链接。
- 未知项：华南拨测 stale 6m；明确说明“无法确认地域恢复”。
- 建议：暂停扩流；选项 `回滚` / `保持 10% 并观察 10m` / `转交发布负责人`。
- 每个动作写清执行者、Runbook、审批级别和可逆性。
- 底部显示当前 Owner 与 IM/电话入口。

手机不显示完整假设树或日志查询编辑器。

## 11. 可点击 Golden Paths

### GP1：变更异常 → 回滚 → unknown 阻断通过

Live Ops → CHG-23841 → 查看 FND-8821 → 进入 INV-7719 → 确认 H1 → 提议回滚 → 审批 → Action running → Verification → 因华南拨测 stale 显示 blocked → 数据恢复 → rerun → passed。

验收：上下文始终不丢；blocked 期间任何页面都不能显示“验证通过”。

### GP2：自然语言 → 计划 → 验证 → 回放 → 发布

Inspection Studio → 输入意图 → 回答澄清 → 查看 12 Checks → 打开真实 Query → Run sample → 修复 permission → 等/重建 baseline → Replay 7d → 审批 diff → Published v1 → 首次 Run。

验收：至少两个 Gate 真实改变发布按钮状态；Plan 发布后旧版本可查。

### GP3：保障风险 → Owner 处置

Live Ops → MIS-61801 → 点库存同步 elevated → 查看预测窗口和置信区间 → 认领 Finding → 调高检查频率（显示成本变化）→ 扩容 ActionProposal → 复验 → 关闭。

验收：Mission 阶段、交易漏斗和 Run heatmap 都随动作变化。

### GP4：多假设调查 → inconclusive

Alerts/Logs 任一入口 → 创建 Investigation → 自动继承上下文 → 查看 3 个假设 → 从 Logs 钉入反证 → H1 降权 → 请求缺失权限 → 仍不足 → conclude inconclusive → 创建后续观察 Check。

验收：系统允许 inconclusive；不会生成虚假根因，后续 Check 回到 Inspection Studio 草案。

## 12. 高保真交付验收

1. 至少交付 7 个桌面/手机 frame；其中 Live Ops、Mission、Change、Studio、Investigation 必须完全不同构。
2. 每页至少有一个只属于该业务决策的真实组件和一个可改变领域状态的动作。
3. Mock 数据跨页一致：Mission、Change、Finding、Investigation、Owner、时间窗和数值可追踪。
4. 两个 Agent 的运行、受阻、HIL、失败和 revision 在画面中可见。
5. 任何健康/复验正向状态都遵守强制 Gate；`unknown` 不被过滤或折算。
6. 所有 AI 输出标注为 fact / inference / suggestion，并能追到 Evidence 或 Query。
7. 不出现模型隐式 Trace；只展示公开工具/查询审计。
8. 关键 Golden Path 必须真实可点击，按钮不得只 toast。
9. 专业 Lens 的数据结构各自不同，且继承同一 ScopeContext。
10. 视觉评审时先以 10 秒可理解性和业务决策可达性验收，再评风格精细度。
