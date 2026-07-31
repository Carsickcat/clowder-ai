# NOVA Ops V5 SRE Object Workbench Implementation Plan

**Feature:** NOVA Ops V5 SRE 领域对象工作台

**Goal:** 把 V4 的角色/场景入口改造成以待处置运维对象为中心的 SRE 运行工作台，并保持双 Agent、证据、人工决策和复验边界。

**Acceptance Criteria:**

- 首页不再出现角色选择，以按紧急度和截止时间排序的待处置对象队列为主。
- Incident / Change / Mission / Inspection 四类对象可从队列和全局导航进入。
- 四类对象共享左侧对象上下文、中间专业证据、右侧 Agent Assist 的三栏骨架。
- Change / Mission / Inspection 可追溯升级为 Incident；ActionProposal 只能回写原对象 Finding，最终恢复仍由原对象 Verification 决定。
- 对象 accent 只表达对象类型，健康/严重度状态色继续独立表达 pass/warning/fail/unknown。
- 桌面 1440 与手机 390 均完成真实浏览器旅程验证。

**Not building:** 真实后端、生产数据连接、权限系统、跨页面持久化、自动执行生产动作。

**Architecture cell:** `AI Ops SRE object workspace`

**Map delta:** update required

**Map delta why:** 页面坐标由角色旅程切换为统一运维对象；领域对象和双 Agent owner 不变。

**Architecture:** `SreHome` 负责对象队列和二级入口；`ObjectWorkspace` 用对象目录投影统一三栏。领域 reducer 新增对象打开、升级 Incident、ActionProposal 回写事件，已有 Change Verification 继续作为唯一恢复 owner。

**Tech Stack:** React 19、Vite、CSS variables、Node test runner、Playwright/Chrome。

**前端验证:** Yes — reviewer 必须实际打开桌面和手机页面。

---

## 终态 schema

```js
state.activeObject = {
  type: "incident" | "change" | "mission" | "inspection",
  id: string,
};

state.investigation = {
  id: "INV-7719",
  objectId: "INC-7719",
  sourceObject: { type, id } | null,
  sourceAlertCluster: "ALERT-CLUSTER-204",
  actionProposal,
  writeback: { status, targetFindingId, targetObject } | null,
};
```

`Reports` 与 `Governance` 是投影视图，不进入 `activeObject` 的四类业务对象。

## Stateful Object Gate

### 对象 census

1. `activeObject`：当前 UI 对象引用，由 `OBJECT_OPEN/OBJECT_CLOSE` 唯一维护。
2. `investigation`：Incident 生命周期 owner，由 Diagnosis Agent 维护。
3. `sourceObject/Finding`：Incident 的来源引用与回写目标。
4. `Verification`：原 Change/Mission/Inspection 的恢复判定 owner，由 Inspection Agent 维护。

### 状态 / 事件转移

| 当前状态                | 事件                           | 下一状态                      | Owner            | 禁止旁路                             |
| ----------------------- | ------------------------------ | ----------------------------- | ---------------- | ------------------------------------ |
| Home                    | `OBJECT_OPEN`                  | 对象工作台                    | UI reducer       | 不允许只改 DOM                       |
| 原对象调查不足          | `INCIDENT_ESCALATED`           | Incident investigating        | Diagnosis Agent  | Incident 不得直接改原对象健康        |
| Incident concluded      | `ACTION_PROPOSAL_WRITTEN_BACK` | 原 Finding pending action     | SRE + reducer    | 无 ActionProposal 时拒绝             |
| 原对象 action completed | `VERIFICATION_START`           | Verification running          | Inspection Agent | Incident 不得启动或通过 Verification |
| Verification gates pass | `VERIFICATION_EVALUATE`        | Finding closed/report updated | Inspection Agent | unknown/stale/drifted 不得通过       |

### 不变量

- **INV-1:** 首页没有角色身份选择；队列对象是唯一主入口。
- **INV-2:** `activeObject.type` 只允许四类业务对象。
- **INV-3:** Incident 必须保留 source object/alert provenance。
- **INV-4:** Incident 只能生成 ActionProposal 和回写 Finding，不能宣布原对象恢复。
- **INV-5:** 只有原对象 Verification 全部 Gate pass 才能关闭 Finding/更新报告。
- **INV-6:** 对象 accent token 不得复用 status token；unknown/stale 始终使用状态语义。
- **INV-7:** Reports/Governance 不伪装成业务对象或实时健康真相。

### 对抗场景

- 直接调用回写事件但尚无 ActionProposal：reducer 拒绝并写审计。
- Incident 生成 ActionProposal 后未完成原对象 Action：Verification 仍拒绝启动。
- 华南拨测 stale：即使 Incident concluded，原 Change 仍 blocked/unknown。
- 从 Mission/Inspection 升级 Incident：source object 必须保持，返回链接不得落到 Change。
- 刷新/重渲染：固定 Mock 队列顺序和对象状态不随机变化。

## Task 1：合同测试（RED）

**Files**

- Modify: `designs/nova-ops-observability-platform-v3/tests/experience-contract.test.mjs`
- Modify: `designs/nova-ops-observability-platform-v3/tests/domain.test.mjs`

1. 将“角色入口”测试改为 SRE 对象队列合同。
2. 新增 ObjectWorkspace、对象导航、Agent Assist 和色彩隔离静态合同。
3. 新增 Incident 升级、无 ActionProposal 回写拒绝、回写不关闭原对象的 reducer 测试。
4. 运行 `npm test`，确认因缺少 `SreHome/ObjectWorkspace/OBJECT_OPEN` 等预期失败。

## Task 2：领域对象与跨对象链路（GREEN）

**Files**

- Modify: `designs/nova-ops-observability-platform-v3/lib/domain.mjs`

1. 新增 `activeObject`、Incident provenance 与 writeback 投影。
2. 实现 `OBJECT_OPEN/OBJECT_CLOSE`。
3. 实现 `INCIDENT_ESCALATED/ACTION_PROPOSAL_WRITTEN_BACK` 并写 audit。
4. 保持已有 Verification gate，不新增第二套恢复状态。
5. 运行 focused domain tests，再运行全量 Node tests。

## Task 3：SRE 首页与对象目录

**Files**

- Create: `designs/nova-ops-observability-platform-v3/components/screens/SreHome.js`
- Create: `designs/nova-ops-observability-platform-v3/components/objectModel.js`
- Delete after replacement: `designs/nova-ops-observability-platform-v3/components/screens/JourneyHome.js`
- Delete after replacement: `designs/nova-ops-observability-platform-v3/components/journeyModel.js`

1. 用固定 Mock 数据定义四类对象、步骤、专业 tabs、决策摘要和待处置队列。
2. 首页展示全局态势、待处置对象、二级对象入口，不展示角色。
3. 队列动作 dispatch `OBJECT_OPEN`，直接打开对应对象和步骤。
4. 运行合同测试。

## Task 4：ObjectWorkspace 与全局导航

**Files**

- Create: `designs/nova-ops-observability-platform-v3/components/ObjectWorkspace.js`
- Modify: `designs/nova-ops-observability-platform-v3/components/AppHeader.js`
- Modify: `designs/nova-ops-observability-platform-v3/components/AppShell.js`
- Delete after replacement: `designs/nova-ops-observability-platform-v3/components/JourneyWorkspace.js`

1. 左栏改为对象元数据、来源引用、处置步骤、可见终态。
2. 中栏使用对象专属专业 tabs 并承载现有 Screen。
3. 右栏保持事实/假设/缺口/建议/人工结论。
4. 顶部与左侧全局导航提供工作台、Incidents、Changes、Missions、Inspections、Reports、Governance。
5. 从原对象升级 Incident，并提供 ActionProposal 回写入口。

## Task 5：设计 token、响应式与说明书

**Files**

- Modify: `designs/nova-ops-observability-platform-v3/app/globals.css`
- Modify: `designs/nova-ops-observability-platform-v3/USER-GUIDE.md`
- Modify: `designs/nova-ops-observability-platform-v3/components/UserGuide.js`
- Modify: `designs/nova-ops-observability-platform-v3/README.md`

1. 增加对象 accent tier，只用于 icon/border/hover。
2. 状态色继续由现有 status token 控制。
3. 手机端改为顶部步骤条、主内容、底部决策面板；专业 tabs 横向滚动。
4. 使用说明从角色旅程改为四类对象与跨对象回写剧本。

## Task 6：浏览器验收

**Files**

- Modify: `designs/nova-ops-observability-platform-v3/tests/golden-path.browser.mjs`

1. 桌面：从待处置队列进入 Incident，生成 ActionProposal 并回写原 Change。
2. 桌面：从 Change 完成回滚、unknown 阻断、恢复数据、Verification passed。
3. 桌面：进入 Mission 调频；进入 Inspection 解除 gates、Replay、审批并发布。
4. 手机：打开工作台、进入对象、确认步骤条和底部决策面板可达。
5. 保存桌面/手机截图并要求 console 0。

## Task 7：质量门禁与交接

1. `npm run check`
2. `npm audit --audit-level=high`
3. `git diff --check`
4. 浏览器预览桌面 1440 与手机 390。
5. 提交、推送，向山本发跨个体代码审视请求，重点检查对象边界、升级/回写、状态色隔离与双 Agent owner。

## Open Questions

- 技术 OQ：Mission/Inspection 的 Verification 当前仅做高保真投影，本轮不新增完整后端状态机；UI 必须明确原型边界。
- 价值 OQ：无。co-creator 已确定 SRE 单一领域与对象中心方向。

## 收敛检查

1. 否决理由 → ADR：项目级决策写入本计划与 V5 设计合同，不新增全局 ADR。
2. 踩坑教训 → lessons：本轮没有新的跨项目教训；此前“能力官网/角色坐标”偏差已在项目材料中记录。
3. 操作规则 → 指引：对象 accent 不得替代状态色，已写入 INV-6 与设计合同。
