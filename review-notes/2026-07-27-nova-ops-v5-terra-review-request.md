# NOVA Ops V5｜Terra Code Review Request

**Review-Target-ID:** `aiops-observability-platform-hifi-v3`

**Branch:** `feat/aiops-observability-platform-hifi-v3`

**HEAD:** `755762d`

**Worktree:** `E:\ClowderAI\cat-cafe-aiops-hifi-v3`

## Original Requirements

来源：co-creator thread message `0001785082347340-000167-582eb39d`，并冻结在 `review-notes/2026-07-26-nova-ops-v5-high-fidelity-design-contract-siamese.md`。

> 产品就是 SRE 领域，不需要区分角色。烁烁负责高保真产品形态，丢丢完成编码，山本进行代码审视。

请 reviewer 对照这条原始体验判断：用户进入系统后应直接处理当前运行对象，不再先确认身份，也不应退化成模块官网。

## What

- `JourneyHome` 替换为 `SreHome`：全局态势 + Incident / Change / Mission / Inspection 待处置队列。
- `JourneyWorkspace` 替换为 `ObjectWorkspace`：左对象流程、中专业证据、右 Agent Assist / 人工结论。
- 新增 `activeObject`、`INCIDENT_ESCALATED`、`ACTION_PROPOSAL_WRITTEN_BACK`。
- 删除 role/journey 运行坐标；Reports / Governance 保持投影视图。
- 重写产品方案、README、站内说明与 `USER-GUIDE.md`，替换 V3 证据为 V5 桌面/手机/录屏。

## Why

V4 虽然已具备真实页面和双 Agent 闭环，但首页仍要求 SRE 先选择“角色 + 场景”，这与 SRE 横跨发布、故障、保障和巡检的实际工作不符。V5 改为“当前有哪些对象需要处置”，让对象 Scope、证据、人工决策与回写关系成为产品坐标。

## Tradeoff

- 保留既有高保真 Screen、Charts 与 Verification Gate，避免重造专业工作面。
- 对象工作台统一骨架，但对象目录分别定义步骤、证据 tabs、状态与终态。
- Incident 只负责 Investigation / ActionProposal；它可以把动作建议回写源 Finding，但不能改变源对象健康。恢复仍由源对象 Verification 判定。
- 对象 accent 采用低饱和身份色；状态颜色仍独立表达 pass/warning/fail/unknown。

## Architecture Ownership

- **Architecture cell:** `AI Ops SRE object workspace`
- **Map delta:** `update required`
- **Why:** 删除角色 Journey 坐标，新增 SRE Object Workspace 与跨对象引用；没有新增并行 Store、第二套 Agent 或第二个 Verification owner。

请核对实际 diff 是否与该 Map delta 一致。

## Open Questions

### 技术 OQ

1. `ObjectWorkspace` 是否真正守住四类对象边界，而不是把旧 Journey 换名。
2. `INCIDENT_ESCALATED → ACTION_PROPOSAL_WRITTEN_BACK` 是否保留完整来源且无绕过。
3. `ACTION_PROPOSAL_WRITTEN_BACK` 是否只推进 Finding，未提前关闭源对象或写 passed。
4. object accent / status semantics 是否在 CSS 和运行态保持隔离。

### 价值 OQ

无。co-creator 已明确选择 SRE 单一领域与对象中心形态。

## Self-check Evidence

- Quality Gate：`review-notes/2026-07-27-nova-ops-v5-quality-gate-sonnet.md`
- `npm run check`：Prettier clean，Node tests `21/21`，Vite/Sites build exit 0。
- `BASE_URL=http://localhost:5290/ npm run test:browser`：SRE queue、Mission、Change Verification、Inspection、Incident writeback、mobile 全通过，console 0。
- `npm audit --audit-level=high`：0 vulnerabilities。
- `git diff --check`：clean。
- 根目录媒体闸门：工作树与 diff 均 0；证据已归档到正式 `evidence/` 目录。
- 设计证据：3 张截图 + 1 段约 15 秒录屏。

## Review Stance Requested

请给明确 `APPROVE` 或 `REQUEST-CHANGES`；每项 Finding 标注 P1 / P2 / P3，并以 `755762d` 为审阅基线。
