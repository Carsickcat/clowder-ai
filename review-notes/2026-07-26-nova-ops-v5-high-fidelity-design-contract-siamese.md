# NOVA Ops V5｜SRE 领域高保真设计合同（烁烁 / Siamese）

**状态：** 待 Sol 编码、Terra 代码审视

**前置约束：**
- 产品用户统一为 SRE / 值班工程师，不区分角色。
- 首页从“角色 + 场景”改为“SRE 运行工作台 + 待处置对象队列”。
- 组织中心：Incident / Change / Mission / Inspection 四类对象。
- 跨对象链路：`Change/Mission/Inspection → Incident → ActionProposal → 原对象 Verification`。
- Incident 不能自行关闭原对象；对象 accent 色不能替代健康/严重度状态色。

---

## 1. SRE 运行工作台（Home）

### 首屏决策问题
> “我现在最需要处理哪个对象？”

### 页面结构

```
┌─────────────────────────────────────────────────────────────────┐
│  NOVA Ops · SRE 运行工作台      [全局 Scope]  [运行态] [使用说明]  │
├─────────────────────────────────────────────────────────────────┤
│  全局态势卡片                                                    │
│  Active Incidents  Open Findings  Blocked Changes  Running Missions  Open Inspections │
│       2                4               1                1              7         │
├─────────────────────────────────────────────────────────────────┤
│  待处置对象队列（按紧急度 + 截止时间排序）                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┬──────────────┬──────────┬──────────┬─────────────┐ │
│  │ 类型      │ 对象          │ 当前阶段  │ 截止时间  │ 下一步动作    │ │
│  ├──────────┼──────────────┼──────────┼──────────┼─────────────┤ │
│  │ Incident │ ALERT-204    │ 影响确认  │ 12m      │ 确认影响拓扑  │ │
│  │ Change   │ CHG-23841    │ 决策阻塞  │ 08:12    │ 决定回滚/观察 │ │
│  │ Mission  │ MIS-61801    │ 峰值保障  │ 20:24    │ 冻结扩流      │ │
│  │ Inspection│ PLAN-312    │ 等待审批  │ 21:30    │ 审批 Draft v2 │ │
│  └──────────┴──────────────┴──────────┴──────────┴─────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  对象类型快速入口                                                │
│  [Incidents] [Changes] [Missions] [Inspections] [Reports] [Governance] │
└─────────────────────────────────────────────────────────────────┘
```

### 关键规则

- 对象类型用图标 + 文字标签区分，不用颜色表达状态。
- “下一步动作”是可点击的，点击后直接进入该对象的对应步骤。
- 顶部 Scope 始终锁定 `Production / payments-router / cn-east+cn-south / 19:45–20:30`。
- 没有“总健康分”，只有对象级 blocker/unknown 计数。

---

## 2. Incident 工作台

### 对象状态
- ID: `INC-7719`
- 来源: `ALERT-CLUSTER-204`
- 影响: `成功率 -0.18pp · p95 +38% · 18.2k 用户`
- 状态: `investigating`

### 左栏：对象上下文 + 处置步骤

```
当前对象
INC-7719 · 支付 p95 回归
来源：ALERT-CLUSTER-204
影响：18.2k 用户

处置步骤
1. 接入告警/人工建案  [active]
2. 确认影响与责任人
3. 组织 Observation
4. 验证假设与反证
5. 提议动作并回写

可见终态
Investigation + ActionProposal + 原 Finding 回写
```

### 中栏：专业证据 tabs（默认 Alerts）

Tabs: `Alerts · Metrics · Logs · Traces · Synthetics`

**Alerts tab 默认内容：**
- 事件簇：`17 raw → 2 correlated clusters → 1 primary event`
- 受影响拓扑：`payments-router → checkout → order-query`
- 合并/拆分事件按钮
- Scope 分支入口：允许在调查中显式扩展或收窄范围

**Metrics tab:**
- Canary/Control 对照图（可钉证据）
- SLO 阈值与当前值

**Logs tab:**
- 异常模式列表
- 可复核 Query
- 钉入证据按钮

**Traces tab:**
- 关键路径瀑布图
- DB acquire 占比

**Synthetics tab:**
- 拨测状态（含 stale 区域）

### 右栏：Agent Assist — 证据与决策

```
事实
17 条告警归并为 2 个事件簇；支付旅程受影响

假设
H1 · DB pool saturation（当前支持证据最多）

证据缺口
华南拨测 stale，地域影响范围仍不完整

建议
运行 canary/control pool-wait 下一测试，再形成 ActionProposal

人工结论
[ running ] 调查中；不得宣布恢复
决策人：payments-oncall   截止：12m
```

### 跨页入口
- 从 Change/Mission/Inspection 升级而来的 Incident，左栏显示“来源对象：CHG-23841”和返回链接。
- ActionProposal 生成后，右栏显示“回写 CHG-23841 Finding → 启动 Verification”。

---

## 3. Change 工作台

### 对象状态
- ID: `CHG-23841`
- 标题: `payments-router v3.18.0`
- 状态: `blocked`
- 决策: 待发布负责人 / SRE 决定

### 左栏：对象上下文 + 处置步骤

```
当前对象
CHG-23841 · payments-router v3.18.0
范围：10% canary / 90% control

处置步骤
1. 锁定变更范围
2. 比较 Canary / Control  [active]
3. 升级证据调查
4. 记录人工决策
5. 复验并回写报告

可见终态
Decision Record + ActionRun + Verification
```

### 中栏：专业证据 tabs（默认 Metrics）

Tabs: `Metrics · Alerts · Logs · Traces · Synthetics`

**Metrics tab 默认内容：**
- Canary vs Control p95 曲线
- 变更时刻 marker
- SLO 阈值 120ms
- 异常点可点击钉入 Investigation

**其他 tabs:** 同 Incident 对应 tabs，但上下文绑定 Change。

### 右栏：Agent Assist — 证据与决策

```
事实
p95 142ms，相对 control +38%；DB pool wait 78%

假设
连接池等待上升解释 Canary 的支付延迟回归

证据缺口
华南拨测 stale 6m；地域恢复仍不可判定

建议
暂停扩流，执行回滚并复验

人工结论
[ unknown ] 等待 SRE/发布负责人选择观察或回滚
决策人：发布负责人   截止：08:12
```

### Decision Record 区域

在右栏下方或中栏底部展示：
- 选项 A：保持 10% 观察 10m（可逆，无需审批，预计多采 5 次 Run）
- 选项 B：回滚 v3.18.0（Runbook，L2 + oncall，预计 3m）
- 选项 C：继续至 25%（blocked：2 fail + 1 unknown）

选中后记录：决策人、时间、业务影响、可逆性、关联 Run ID。

---

## 4. Mission 工作台

### 对象状态
- ID: `MIS-61801`
- 标题: `全球购 618 峰值保障`
- 阶段: `峰值`
- 状态: `running`

### 左栏：对象上下文 + 处置步骤

```
当前对象
MIS-61801 · 全球购 618 峰值保障
阶段：峰值 · 43m remaining

处置步骤
1. 确认保障阶段
2. 观察业务与容量  [active]
3. 归并 Risk Signal
4. 人工调频或冻结
5. 复验与阶段快照

可见终态
阶段决策 + Finding + 保障快照
```

### 中栏：专业证据 tabs（默认 Metrics）

Tabs: `Metrics · Forecast · Inspection · Logs`

**Metrics tab:**
- 业务交易漏斗
- 关键旅程矩阵

**Forecast tab:**
- 实际 RPS / 预测中位数 / 90% 置信带
- 容量阈值 220k
- 风险窗口 20:24–20:38

**Inspection tab:**
- Run heatmap
- 最近 Run 列表

**Logs tab:**
- 风险相关日志模式

### 右栏：Agent Assist — 证据与决策

```
事实
181k RPS，容量 220k，17.7% headroom

假设
预测上界将在风险窗口越过当前容量阈值

证据缺口
inventory-sync 风险 Owner 尚未完成扩容确认

建议
维持 2m 高频巡检并冻结扩流

人工结论
[ warning ] 扩流已冻结，等待容量动作复验
决策人：陈工   截止：20:24
```

---

## 5. Inspection 工作台

### 对象状态
- ID: `PLAN-312`
- 标题: `全球购结算链路峰值巡检`
- 版本: `Draft v2`
- 状态: `draft`

### 左栏：对象上下文 + 处置步骤

```
当前对象
PLAN-312 · 全球购结算链路峰值巡检
服务：payments-router

处置步骤
1. 识别覆盖缺口
2. 描述运维意图  [active]
3. 检查结构化 Plan
4. 回放并人工审批
5. 首个 Run 与报告

可见终态
Published Plan + First Run + 治理报告
```

### 中栏：专业证据 tabs（默认 Plan）

Tabs: `Plan · Query · Coverage · Replay · Report`

**Plan tab:**
- 意图与澄清
- 结构化 Check 列表
- 等价 Query 预览

**Query tab:**
- Sample query 执行结果
- 延迟 / 数据量

**Coverage tab:**
- 数据源覆盖矩阵
- 权限、基线、新鲜度门禁

**Replay tab:**
- 7 天回放结果
- triggers / matched incidents / noise

**Report tab:**
- 首个 Run 结果预览
- Finding / Verification 状态

### 右栏：Agent Assist — 证据与决策

```
事实
84% 服务具备可判定健康覆盖

假设
补齐拨测权限与可比基线后，候选 Plan 可进入回放

证据缺口
7 stale sources · 3 drifted baselines

建议
先修复门禁，再审阅 Draft v2 diff 与 7 天 Replay

人工结论
[ unknown ] 等待服务 Owner / SRE 负责人审批
决策人：payments-owner   截止：Today 21:30
```

---

## 6. 跨对象旅程

### 核心链路

```
Change/Mission/Inspection 发现异常
           ↓
    升级创建 Incident
           ↓
   Investigation / Observation / Hypothesis
           ↓
      ActionProposal
           ↓
   回写原对象 Finding
           ↓
   原对象 Verification Run
           ↓
      报告更新
```

### 交互规则

1. **升级入口**：在 Change/Mission/Inspection 的右栏“Agent Assist”中，当证据缺口或假设需要深入调查时，显示“升级为 Incident 调查”按钮。
2. **Incident 左栏显示来源**：创建后的 Incident 左栏固定展示“来源对象：CHG-23841 / MIS-61801 / PLAN-312”和返回链接。
3. **ActionProposal 回写**：Incident 生成 ActionProposal 后，右栏显示“将 ActionProposal 回写至 CHG-23841”按钮；点击后原对象的 Finding 更新，并触发 Verification Run。
4. **Verification 终态**：只有原对象的 Verification Run 全部 Gate pass 后，才能关闭 Finding 并更新报告；Incident 不能自行宣布恢复。
5. **Traceability**：所有跨对象操作写入 audit，保留 `Incident → ActionProposal → Finding → Verification → Report` 的可追溯链。

---

## 视觉与交互通则

### 导航
- 顶部固定：Logo + 全局 Scope + 当前对象类型 + 运行态 + 使用说明。
- 左侧全局导航：工作台 / Incidents / Changes / Missions / Inspections / Reports / Governance。
- 对象工作台内：左栏显示对象上下文和步骤，中栏显示专业 tabs，右栏显示 Agent Assist。

### 色彩
- **对象 accent**（低饱和，用于边框、图标、hover）：
  - Incident: 琥珀/橙
  - Change: 蓝
  - Mission: 紫
  - Inspection: 绿
- **状态色**（严格保留给健康/严重度）：
  - healthy / passed: 绿
  - warning / degraded: 琥珀
  - unhealthy / failed / P1: 红
  - unknown / stale: 紫
  - running: 蓝

### 状态语义
- 不允许把 unknown/stale/drifted 折算为 healthy。
- 不允许用对象 accent 色暗示对象健康状态。

### 移动端
- 三栏在手机上折叠为：顶部步骤条（可横向滑动）+ 主内容区 + 底部决策面板。
- 专业 tabs 横向滚动，不挤出主内容。

---

## 验收标准

- [ ] 首页不再出现角色选择。
- [ ] 待处置对象队列能直接点击进入对象对应步骤。
- [ ] 四类对象工作台均使用统一三栏骨架。
- [ ] 中栏专业 tabs 包含监控/告警/日志/Trace/拨测/巡检，不再是全局抽屉。
- [ ] 右栏 Agent Assist 始终展示事实/假设/缺口/建议/人工结论。
- [ ] 跨对象升级与回写链路可追溯。
- [ ] 对象 accent 色与健康/严重度状态色隔离。
- [ ] 桌面 1440 与手机 390 均完成真实浏览器旅程验证。
