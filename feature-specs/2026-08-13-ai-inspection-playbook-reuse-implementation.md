---
feature_ids: [AI_INSPECTION_PLAYBOOK_REUSE]
topics: [aiops, inspection, playbook, implementation-plan, tdd]
doc_kind: implementation-plan
created: 2026-08-13
tips_exempt:
  reason: Standalone offline acceptance artifact; it is not a discoverable Cat Café runtime capability or guide.
---

# Inspection Playbook Reuse Implementation Plan

**Feature:** AI_INSPECTION_PLAYBOOK_REUSE — `designs/ai-inspection-copilot-offline-demo/DESIGN-PLAYBOOK.md`  
**Goal:** 在不改变空白发起主权和五阶段巡检闭环的前提下，让相同业务场景复用经审批的巡检判断结构，同时对当次运行事实重新对账并生成新的不可变任务实例。  
**Acceptance Criteria:** AC-P1 零打扰；AC-P2 精准直跑；AC-P3 差异确认；AC-P4 漂移拦截；AC-P5 审计不可变；AC-P6 空白入口主权；AC-P7 390px 横幅/抽屉；AC-P8 重置不串态。  
**Architecture cell:** Inspection Request Compiler / Plan Compiler / Evidence Ledger  
**Map delta:** update required  
**Map delta why:** `ARCHITECTURE.md` 需要增加 Playbook Matcher、Task Instance 和 Playbook Proposal 的生命周期边界；不新增执行引擎或持久化服务。  
**Architecture:** 在编译后的当前 `InspectionWorkspace` 上运行纯匹配器，产出不可变 `PlaybookMatchSnapshot`。Reducer 是当前 Task Instance、匹配决策与 Proposal 的唯一 lifecycle owner；UI 只消费 selector 投影。复用只继承 Check 结构，证据、对账和任务 ID 始终属于本次执行。  
**Tech Stack:** 原生 ES modules、纯 reducer/selectors、HTML/CSS、Node test runner、离线 CDP browser harness。  
**前端验证:** Yes — 必须在 1440px 与 390px 实测 exact / minor drift / major drift / report proposal，且 network、console error 与横向溢出均为 0。

---

## Finish line

用户提交目标后，系统在 context 现场给出零打扰的方案匹配判断；精准匹配可一次确认直达 execution，小幅差异先留痕再进入适配后的 plan，重大漂移只能重新生成。执行完成后可以创建待审批的新方案版本，但历史 Playbook 版本和已锁定任务实例永不改写。

不建设：独立方案 dashboard、服务端持久化、真实审批流、生产查询、旧证据重放、自动发布/回滚。

## Terminal schema

```js
PlaybookDefinition = {
  id, version, title, scenarioKey, matchRules,
  checkIds, approvedAt, lastUsedAt
}

PlaybookMatchSnapshot = {
  playbookRef: { id, version },
  status: "exact" | "minor-drift" | "major-drift",
  score, lastUsedLabel, validations[], differences[]
}

TaskInstance = {
  id,
  status: "draft" | "executing" | "locked",
  sourcePlaybookRef: null | { id, version },
  referencePlaybookRef: null | { id, version },
  auditTrail[]
}

PlaybookProposal = {
  id,
  kind: "create" | "update",
  sourceTaskInstanceId,
  sourcePlaybookRef,
  targetVersion,
  status: "pending-approval"
}
```

`PlaybookDefinition` 与历史任务 fixture 是不可变真相源；`PlaybookMatchSnapshot` 只在 `INTENT_SUBMITTED` 时生成一次；匹配卡展开态属于 UI 行为，不持久化为业务状态。

## Stateful Object Gate

### Census

1. **PlaybookDefinition** — owner：只读 catalog；无 reducer 写路径。
2. **PlaybookMatchSnapshot** — owner：`INTENT_SUBMITTED`；`RESET` 删除，其他事件不得重算或改写。
3. **TaskInstance** — owner：session reducer；draft 允许追加审计事件，execution 只推进状态，locked 后禁止任何写入。
4. **PlaybookProposal** — owner：report 阶段 reducer；每个 locked task 最多一个，重复提交幂等。

### 状态 × 事件

| Object / current | Event | Guard | Next |
|---|---|---|---|
| no match snapshot | `INTENT_SUBMITTED` | workspace compiled | null / exact / minor / major snapshot |
| exact snapshot | `PLAYBOOK_EXECUTION_STARTED` | reconciliation 可验证 | Task draft → executing；source ref 写入；phase → execution |
| minor snapshot | `PLAYBOOK_DIFF_CONFIRMED` | differences 非空 | audit 追加确认；source ref 写入；phase → plan |
| major snapshot | `PLAYBOOK_REGENERATED` | major drift | reference ref 写入；source ref 保持 null；phase → plan |
| any snapshot | `PLAYBOOK_DISMISSED` | context | 保留 snapshot 供审计，decision=dismissed；走普通 scope 流程 |
| Task executing | final `EXECUTION_ADVANCED` | last step | Task → locked；phase → report |
| Task locked | `PLAYBOOK_PROPOSAL_SUBMITTED` | report 且无 proposal | create v1 或 update v(n+1)，pending approval |
| any | `RESET` | none | 清除 workspace/match/decision/task/proposal；保留 next task ordinal |

旁路禁止：UI 不得直接编辑 catalog、task、proposal；selector 不得落存派生状态；locked task 上的候选处置、RC 展开以外业务事件必须 no-op（RC 展开是纯界面状态，不写 task）。

### Invariants

- **INV-P1:** 无匹配时不渲染任何 Playbook DOM（UI contract）。
- **INV-P2:** exact 直跑仍要求 reconciliation 可验证（reducer test）。
- **INV-P3:** minor drift 的 difference acknowledgement 必须进入 task audit（journey test）。
- **INV-P4:** major drift 永远没有 source playbook，只能保留 reference（reducer + UI test）。
- **INV-P5:** 每次新请求生成新 task ID；RESET 后重提不得复用 ID（journey test）。
- **INV-P6:** locked task 不因保存/更新方案而变化（deep equality test）。
- **INV-P7:** proposal 只追加新版本并保持 pending approval；catalog 不变（domain test）。
- **INV-P8:** RESET 清空 match/decision/proposal，不跨场景串态（journey test）。
- **INV-P9:** 复用路径仍产生全新的 execution evidence；不得引用历史 evidence payload（domain test）。
- **INV-P10:** 单文件产物保持 deterministic、network 0、console 0、390px 无横溢（standalone + browser）。

### 对抗场景

- 重复点击 exact / diff / proposal CTA：事件幂等，不生成双 task 或双 proposal。
- major drift 伪造 exact action：reducer no-op。
- report 后触发 context/plan 事件：locked task 不变。
- RESET 后从有方案切到无匹配：Playbook DOM、reference 与 proposal 全清空。
- 移动端 major drift 未查看完整差异：CTA disabled；确认查看后才允许 regenerate。

## Task 1: Domain and matching contract — Red → Green

**Files:**
- Create: `designs/ai-inspection-copilot-offline-demo/lib/playbooks.mjs`
- Create: `designs/ai-inspection-copilot-offline-demo/tests/playbooks.test.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/scripts/build.mjs`

1. 写失败测试：未知服务无匹配；订单升级 exact；payment 配置 minor drift；服务拆分 major drift；catalog/快照深冻结。
2. 运行 `node --test tests/playbooks.test.mjs`，确认因模块/导出不存在而失败。
3. 实现最小只读 catalog + 纯 matcher；snapshot 只带当前结构差异，不带历史证据。
4. 运行测试并保持 Green。

## Task 2: Session lifecycle and immutable audit — Red → Green

**Files:**
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/reducer.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/lib/selectors.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/tests/journeys.test.mjs`

1. 写失败测试覆盖 exact 直跑、minor 确认、major regenerate、新 task ID、locked task、proposal 幂等与 RESET。
2. 运行聚焦测试，确认新事件/字段缺失导致 Red。
3. 增加最小 reducer 状态和纯 selector；不得复制 scope/readiness 等派生值。
4. 运行 journeys + domain tests，保持 Green 后重构命名。

## Task 3: In-context high-fidelity UI — Red → Green

**Files:**
- Create: `designs/ai-inspection-copilot-offline-demo/src/render-playbook.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/render.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/app.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/components.css`
- Modify: `designs/ai-inspection-copilot-offline-demo/src/responsive.css`
- Modify: `designs/ai-inspection-copilot-offline-demo/tests/ui-contract.test.mjs`

1. 写失败 UI contracts：S1 零 DOM；S2 green + 单主 CTA；S3 amber chips；S4 red 无直跑；S5 ghost proposal 与 audit lock 文案。
2. 运行 UI tests 验证 Red。
3. 按 `DESIGN-PLAYBOOK.md` 复用现有 token/primitive 实现卡片、参考面板、report 沉淀区；零新增色值。
4. 运行 UI tests Green，检查每卡仅一个实心 CTA。

## Task 4: Browser journeys and responsive proof — Red → Green

**Files:**
- Modify: `designs/ai-inspection-copilot-offline-demo/tests/offline.browser.mjs`
- Modify: `designs/ai-inspection-copilot-offline-demo/tests/record-walkthrough.mjs`

1. 先写/运行浏览器失败路径：exact 直跑、minor diff、major drift gate、report proposal、390px 无横溢。
2. 补齐移动端横幅/抽屉行为；major CTA 需 `PLAYBOOK_DRIFT_REVIEWED` 才解锁。
3. 运行 `pnpm check`：所有 unit/UI/browser tests、两条原旅程及新 Playbook 旅程通过，network/errors 为 0。

## Task 5: Truth-source and delivery evidence

**Files:**
- Modify: `feature-specs/2026-08-06-ai-inspection-copilot-offline-demo.md`
- Modify: `designs/ai-inspection-copilot-offline-demo/ARCHITECTURE.md`
- Modify: `designs/ai-inspection-copilot-offline-demo/DESIGN.md`
- Modify: `designs/ai-inspection-copilot-offline-demo/QUALITY-GATE.md`
- Modify: `designs/ai-inspection-copilot-offline-demo/README.md`
- Rebuild: `designs/ai-inspection-copilot-offline-demo/index.html`

1. 将 AC-P1~P8、对象边界与视觉决策回填到真相源。
2. 两次构建比较 SHA-256，确认确定性。
3. 浏览器截图核对 1440px exact/minor/major/report 与 390px major/report。
4. 运行 `git diff --check`、产品 `pnpm check` 与根仓适用门禁；记录 exact HEAD 和证据。
5. 按 quality-gate → fresh-context-review（若非 trivial）→ request-review 交给非作者 reviewer。

## Open Questions

- **技术 OQ:** major drift 的“已看完”在离线 DOM 中用显式按钮投影，不模拟复杂 scroll observer；可回滚，按可测试性自决。
- **价值 OQ:** 无。operator 已决定 Playbook 复用进入高保真实现，且烁烁已主导设计边界。

