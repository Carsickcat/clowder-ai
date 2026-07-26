# NOVA Ops V5 — Terra Review Fixes

Reviewer: 山本 / Terra
Author: 丢丢 / Sol
Status: Awaiting re-review

## What

1. ActionProposal 现在绑定不可变的 `investigationId / sourceObject / sourceFindingId`。新来源对象升级 Incident 时会清空旧提案、写回收据和临时调查状态；对象打开、Incident 升级与写回均拒绝未知对象 ID 或 Finding/source 不匹配。
2. 报告“请求复验”不再修改报告结论冒充执行结果，而是为每个版本内的 open Finding 创建 source-linked `VerificationRequest`。只有 `INSPECTION_VERIFICATION_STARTED / EVALUATED` 能实例化 Run 和判定 Finding。
3. 报告正文改读不可变的 `Run / Assessment / PlanVersion / Finding / Journey / InvestigationRevision` snapshot；Finding 点击改为 `OBJECT_OPEN` 恢复源对象上下文。
4. Failure-mode sweep 同步修正了现有 Change verification Run 的 source 绑定，以及 Mission/Inspection ActionProposal 无条件跳 Change Guard 的同类入口。
5. Browser harness 支持临时 evidence 目录，并将默认地址从无法连接的 `127.0.0.1` 对齐到 dev server 的 `localhost:5290`。

## Why

原实现把 ActionProposal、Finding、Verification 和 Report 当作可共享的当前投影，导致不同 SRE 对象之间可能串线：Change 的回滚建议能够写到 Mission Finding，报告复验没有进入源巡检链，报告正文也会随全局状态漂移。V5 合同要求整条链保持：

`Source Object → Incident → ActionProposal → Source Finding → Source Verification → Versioned Report`

## Tradeoff

- 没有让报告按钮直接创建或判定 Run；报告只创建请求，Inspection Agent 链负责 Run 生命周期。多一个显式状态对象，换取所有权边界和可审计性。
- 报告 snapshot 采用生成时复制，而不是渲染时回查全局 store。会产生少量数据冗余，但版本语义不会漂移。
- 原型当前只有每类一个已知对象，因此 ID 校验使用严格 registry；没有为尚不存在的多对象后端提前造动态仓储抽象。

## Open Questions

### Technical

- 无 blocking 技术问题。
- 当前历史原型 worktree 不包含 `check-hotfix-pattern`、`check-fallback-layers`、`check:architecture-ownership`、`check:capability-tips` harness；这些命令已实跑并明确返回“不存在”，未计作通过。Diff 人工审计未新增 fallback 层。

### Value

- 无需 operator 决策；本轮只恢复已冻结的对象来源、Verification 所有权和版本化报告合同。

## Verification

### Red → Green

- RED：新增 5 组合同测试后为 `21 pass / 5 fail`。
- GREEN：最终 `npm run check` 为 `27/27 pass`，Prettier 通过，Sites production build 成功。
- Browser dogfood：`npm run test:browser` 通过；覆盖 Mission/Change Incident 写回、Change Verification、Inspection、Report snapshot 深链与复验排队、390px mobile，console 0。
- 临时截图：`%TEMP%\nova-ops-v5-review\evidence\04-report-versioned-projection.png`。

### Gate Notes

- `.pen` 扫描仅命中无关的 `designs/f070-project-setup-card.pen`，本功能以已冻结 V5 high-fidelity Markdown contract 为设计真相源。
- 工作树与已提交差异均未出现仓库根目录媒体/设计工件。
- `gh` CLI 在当前环境不可用；branch commit truth 以 `git log` 和后续 push SHA 为准。
- 没有延期项或下一阶段尾巴。

## Next Action

请 Terra 在本文所在 commit 上复验：

1. Change proposal 不得跨对象写回；
2. Finding/source 和未知对象 ID 必须拒绝；
3. Report 请求只能生成 source-linked VerificationRequest；
4. Run 只能由 Inspection Agent 链启动/判定；
5. Report UI 只读 snapshot，并以 `OBJECT_OPEN` 回钻源对象。

[丢丢/gpt-5.6-sol🐾]
