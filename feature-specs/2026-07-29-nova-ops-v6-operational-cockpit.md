# NOVA Ops V6 Operational Cockpit Implementation Plan

**Feature:** NOVA Ops V6 — SRE Operational Cockpit
**Goal:** 应用打开即进入正在值班的 SRE 现场，让用户直接判断和处置运行对象，不再经过欢迎、角色或对象类型入口。
**Acceptance Criteria:** AC-1 首屏无欢迎 Hero、角色选择、对象类型入口和重复总览卡；AC-2 首屏直接展示按影响与截止排序的决策对象、持续运行任务和现场证据缺口；AC-3 Incident / Change / Mission / Inspection 分别采用调查、验证、阶段指挥、计划编译四种不同工作区构图；AC-4 Reports / Governance 明确保持投影视图；AC-5 desktop 与 mobile 均能从首屏直接打开对象并完成既有 Golden Path；AC-6 领域 reducer、跨对象回写与 Verification Gate 不变。
**Architecture cell:** Prototype-local frontend projection
**Map delta:** none
**Map delta why:** 只重构既有高保真原型的信息架构和派生 UI，不改变平台 ownership、持久对象或外部契约。
**Architecture:** 保留现有 reducer 和四类运行对象，以单一 SRE shell 投影值班现场。首屏从重复的 Hero/统计/入口三层收敛为一个实时决策面；对象工作区继续共享 Scope 与跨对象合同，但用显式 layout mode 选择四种差异化构图。
**Tech Stack:** React 19, Vinext/Vite, CSS, Node test runner, Playwright Core
**前端验证:** Yes — reviewer 必须用真实桌面与 390px mobile 浏览器实测。

---

## Finish line

打开 `/` 后，用户已经“在值班”，不是在进入产品：

- 左侧全局导航只负责切换运行对象和投影视图。
- 主区首先呈现当前需要人工判断的对象；不存在品牌介绍或第二套对象导航。
- 次级区只呈现仍在后台运行、会改变下一次判断的 Run / Gate / evidence freshness。
- 打开对象后，页面构图由对象的首要判断决定，而不是套同一张三栏模板。

**不做：** 新后端、新登录、新数据源 adapter、新持久状态、Sites 部署、角色系统。

## Terminal schema

```js
objectCatalog = {
  incident: { layout: "forensics", ... },
  change: { layout: "validation", ... },
  mission: { layout: "command", ... },
  inspection: { layout: "compiler", ... },
};
```

`layout` 是现有对象定义的只读 UI 元数据。它不进入 reducer、不持久化、不产生同步状态。

## Product Gate

- 入口层级：现有 L1 SRE shell，打开即为 cockpit。
- 用户：统一 SRE，不再按发布负责人 / 值班 SRE / 服务 Owner 分流。
- 状态矩阵：
  - full：四个对象均可进入；
  - partial：stale / unknown / blocked 显式留在对象行与现场脉冲；
  - mobile：单列决策流，底部对象导航不遮挡内容；
  - error / empty：本固定 Mock 原型不新增伪状态，沿用现有对象状态。

## Design Gate

### 页面构图

| Surface    | 主判断                           | 构图                                            |
| ---------- | -------------------------------- | ----------------------------------------------- |
| Cockpit    | 现在先判断什么？                 | 决策队列 + 现场脉冲 + 正在运行                  |
| Incident   | 哪个假设最可信，下一测试是什么？ | 时间线 / 证据图 / 假设板                        |
| Change     | 继续、观察还是回滚？             | canary-control / objectives / verification rail |
| Mission    | 当前阶段是否还能继续承载？       | phase track / forecast / run heatmap            |
| Inspection | 计划能否安全发布？               | intent / compiled checks / gates & replay       |

### In-context observability

```yaml
in_context_observability:
  primary_surface: "Cockpit 对象行与对象工作区内的 evidence / gate 状态"
  why_not_dashboard_only: "SRE 必须在做当前决定时看见 stale、unknown、blocked，不能等切到治理页后才发现"
  deep_dive_surface: "Governance 仅用于跨服务覆盖、Agent 健康和长期审计"
  noise_dedup_policy: "同一对象只显示一个当前 blocker；重复信号聚合为 evidence count 与 freshness"
```

## Implementation

### Task 1: RED — 体验合同

**Files:**

- Modify: `designs/nova-ops-observability-platform-v3/tests/experience-contract.test.mjs`

1. 写首屏禁止 Hero、重复 posture 卡和对象类型入口的失败测试。
2. 写四对象必须声明不同 layout mode 的失败测试。
3. 运行 `npm test -- --test-name-pattern="operational cockpit|distinct workspace"`。
4. 预期：两个新增合同因旧 SreHome 和缺失 layout metadata 失败。

### Task 2: GREEN — 单一 Cockpit

**Files:**

- Modify: `designs/nova-ops-observability-platform-v3/components/screens/SreHome.js`
- Modify: `designs/nova-ops-observability-platform-v3/app/globals.css`

1. 删除首屏 Hero、五张 posture 卡和对象类型入口。
2. 将运行态压进值班条；主区只保留可排序决策对象。
3. 增加正在运行与现场脉冲，不复制对象导航。
4. 重跑 focused test，预期首屏合同通过。

### Task 3: GREEN — 四种对象构图

**Files:**

- Modify: `designs/nova-ops-observability-platform-v3/components/objectModel.js`
- Modify: `designs/nova-ops-observability-platform-v3/components/ObjectWorkspace.js`
- Modify: `designs/nova-ops-observability-platform-v3/components/screens/Investigation.js`
- Modify: `designs/nova-ops-observability-platform-v3/components/screens/ChangeGuard.js`
- Modify: `designs/nova-ops-observability-platform-v3/components/screens/MissionCommand.js`
- Modify: `designs/nova-ops-observability-platform-v3/components/screens/InspectionStudio.js`
- Modify: `designs/nova-ops-observability-platform-v3/app/globals.css`

1. 给四对象添加唯一 layout 元数据。
2. 把 layout 投影到 workspace DOM，并为四页面添加独有 primary artifact class。
3. CSS 按 layout 重排证据 tabs、流程 rail、主内容和决策 inspector。
4. 重跑 experience contract 与全量 unit test。

### Task 4: Browser proof

**Files:**

- Modify: `designs/nova-ops-observability-platform-v3/tests/golden-path.browser.mjs`
- Update: `designs/nova-ops-observability-platform-v3/evidence/`

1. 浏览器断言首屏没有入口/角色文案，且 Cockpit 决策对象首屏可见。
2. 逐个打开四对象并断言 layout mode 唯一。
3. 走既有跨对象回写和 Verification Gate。
4. 在 1440 desktop 与 390 mobile 截图，console error 必须为 0。

### Task 5: Quality and review

1. 运行 `npm run check` 与 `npm audit`。
2. 由 Siamese reviewer 审产品形态和视觉，不以旧“角色入口”合同为准。
3. 由 Terra reviewer 审代码与领域边界。
4. 通过后再决定是否保存本地交付版本；本轮不部署 Sites。
