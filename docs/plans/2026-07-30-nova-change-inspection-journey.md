# NOVA Change Inspection Journey Implementation Plan

> 丢丢执行。遵循 TDD、Console Product/Design/Implementation/Verification Gate。

**Goal:** 在现有原型中用一个可走通的变更巡检工作区替代七菜单大盘。  
**Architecture:** 独立 `change-inspection` 领域模块提供纯状态机；React 工作区只投影状态并派发同一组动作。旧 V6 组件暂留源码但不再作为 `/` 入口，便于单提交回滚。  
**Tech Stack:** React 19、Vinext/Vite、CSS、Node test runner、Playwright Core。

## Task 1：RED — 领域旅程

**Files**

- Create: `designs/nova-ops-observability-platform-v3/tests/change-inspection.test.mjs`
- Create: `designs/nova-ops-observability-platform-v3/lib/change-inspection.mjs`

测试先描述 draft → pre-change → canary risk → verification → post-change → completed；另测 stale/不可比证据不能推进。确认 RED 后实现最小纯 reducer。

## Task 2：RED — 体验合同

**Files**

- Modify: `designs/nova-ops-observability-platform-v3/tests/experience-contract.test.mjs`

把旧“七菜单各有布局”合同替换为：

- 单一中文工作区与三阶段旅程；
- Claw 与页面同域动作；
- 每个阶段唯一主动作；
- `不可判定` 明确阻断；
- 禁止旧缩写导航和中英混杂动作。

## Task 3：GREEN — 单一工作区

**Files**

- Modify: `designs/nova-ops-observability-platform-v3/components/OpsApp.js`
- Create: `designs/nova-ops-observability-platform-v3/components/change-inspection/ChangeInspectionApp.js`
- Create: `designs/nova-ops-observability-platform-v3/components/change-inspection/JourneyHeader.js`
- Create: `designs/nova-ops-observability-platform-v3/components/change-inspection/DecisionSurface.js`
- Create: `designs/nova-ops-observability-platform-v3/components/change-inspection/ClawPanel.js`
- Create: `designs/nova-ops-observability-platform-v3/components/change-inspection/RunTimeline.js`
- Create: `designs/nova-ops-observability-platform-v3/app/change-inspection.css`
- Modify: `designs/nova-ops-observability-platform-v3/app/globals.css`

实现固定演示 Case 和完整交互。每个组件低于 350 行；复用现有 CSS token，不引入新依赖。

## Task 4：Browser proof

**Files**

- Modify: `designs/nova-ops-observability-platform-v3/tests/golden-path.browser.mjs`
- Update: `designs/nova-ops-observability-platform-v3/evidence/`

在 1440 desktop 和 390 mobile 上走完请求、确认、变更前准入、灰度风险、重新验证、变更后验收；记录截图，断言 console error 为 0。

## Task 5：质量与跨个体评审

1. 运行 focused tests、全量 `npm test`、`npm run build`。
2. 检查文件体积、未使用旧入口、语言合同与非 happy path。
3. 交给非作者 reviewer 审产品旅程、视觉理解性和代码边界。
4. 修复后仅提交本轮文件，不纳入旧评审截图/评审信。
