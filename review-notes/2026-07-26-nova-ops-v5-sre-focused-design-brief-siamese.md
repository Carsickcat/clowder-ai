# NOVA Ops V5｜SRE 领域产品形态设计简报（烁烁 / Siamese）

**背景：** co-creator 明确纠正：产品形态应聚焦 SRE 领域，不再按角色区分入口；由烁烁主导高保真设计，丢丢编码，山本代码审视。

**核心判断：** V4 把首页从“模块导航”改成“角色 + 场景”是一大进步，但 co-creator 的诉求更纯粹——这是一个给 SRE / 值班工程师用的可观测平台，不应让用户先选“我是发布负责人还是服务 Owner”。SRE 的职责本来就是横跨发布、故障、保障、巡检的。因此首页应回归 **SRE 运行工作台**，以“当前有哪些运维对象需要处置”为组织中心。

---

## V5 设计方向

### 1. 首页：SRE 运行工作台

不再是角色卡片，而是 SRE 上班第一眼需要看到的现场：

- **顶部全局态势**：当前活跃事件数、阻断变更数、进行中 Mission、Open Findings、Agent 运行状态。
- **待处置对象队列**：按紧急度和对象类型列出需要 SRE 立即处理的事项。每个对象显示：
  - 对象类型（Incident / Change / Mission / Inspection）
  - 标题与 ID
  - 当前阶段 / 状态
  - 决策截止时间
  - 下一步动作
- **对象类型快速入口**：Incidents / Changes / Missions / Inspections / Reports / Governance，作为二级导航。

### 2. 统一对象模型

SRE 每天处理四类对象，所有页面都围绕它们展开：

| 对象 | 触发源 | SRE 核心问题 | 主要工作面 |
| --- | --- | --- | --- |
| **Incident** | 告警风暴、人工建案、Finding 升级 | 影响是什么？根因假设？下一步动作？ | Alerts / Metrics / Logs / Traces / Synthetics / Investigation |
| **Change** | 发布事件 | 能否继续放量？是否回滚？ | Metrics / Logs / Traces / Synthetics / Decision Record / Verification |
| **Mission** | 大促/保障 | 能否继续承载流量？ | Metrics / Forecast / Inspection / Risk Signal / HIL |
| **Inspection** | 计划/日巡/NL2 | 检查是否覆盖缺口？Plan 能否发布？ | Query / Gates / Replay / Approval / Report |

### 3. 保留三栏工作台，但左栏改为“对象上下文”

- **左栏**：对象元数据 + 处置流程步骤（Incident: 接入 → 影响 → 证据 → 假设 → 动作；Change: 范围 → 对比 → 调查 → 决策 → 复验；等）。
- **中栏**：当前步骤的专业证据工作面（tabs）。
- **右栏**：AI assist + 人工决策检查器（事实 / 假设 / 缺口 / 建议 / verdict）。

### 4. 导航与信息架构

```
Home (SRE 运行工作台)
├─ 待处置队列
├─ 活跃对象列表
└─ 快速入口：Incidents / Changes / Missions / Inspections / Reports / Governance

进入任一对象
├─ 顶部：对象类型 + ID + Scope（service/env/region/time/source）
├─ 左：对象上下文 + 处置步骤
├─ 中：专业证据 tabs
└─ 右：Agent Assist + 人工决策
```

### 5. 视觉策略

- 保持深色运维工作台（历年 V2 方向）。
- 用**对象类型色**替代角色色：
  - Incident：琥珀/红（紧急、故障）
  - Change：蓝（审慎、对照）
  - Mission：紫（保障、阶段）
  - Inspection：绿（例行、健康）
- 继续使用 Cat Café token 三层架构。

---

## 与 V4 的关键差异

| 维度 | V4 | V5 |
| --- | --- | --- |
| 首页 | 三角色 + 四场景 | SRE 运行工作台 + 待处置对象队列 |
| 组织中心 | 角色 | 运维对象（Incident/Change/Mission/Inspection） |
| 左栏 | 角色任务与旅程步骤 | 对象上下文与处置流程 |
| 入口心智 | “我是 XX 角色，进 XX 场景” | “今天有哪些对象需要我处理” |
| 导航 | 角色 → 场景 → 工作面 | 工作台 → 对象 → 工作面 |

---

## 对双 Agent 的影响

无影响。巡检 Agent 与诊断 Agent 的对象边界保持不变：
- 巡检 Agent 拥有 Mission/Change/Inspection 的 Plan/Run/Assessment/Finding/Verification/Report。
- 诊断 Agent 拥有 Incident 的 Investigation/Observation/Hypothesis/Revision/ActionProposal。
- 诊断完成后，动作执行与复验回到原巡检对象。

---

## 交付建议

1. **烁烁先出高保真设计稿**：本简报 + 关键页面线框/截图说明 + 交互流程。
2. **丢丢按设计稿编码**：保留现有组件能力（Charts、domain reducer、workspace 框架），将首页和导航重构为对象中心。
3. **山本代码审视**：重点看 AppShell、JourneyWorkspace → ObjectWorkspace 的拆分、状态机边界是否仍然清晰。

---

## 下一步

等待 co-creator 确认本方向后，烁烁产出详细高保真页面合同（首页、Incident 工作台、Change 工作台、Mission 工作台、Inspection 工作台）。
