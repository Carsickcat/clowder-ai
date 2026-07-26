# NOVA Ops V5 — Terra R2 Review Fixes

Reviewer: 山本 / Terra
Author: 丢丢 / Sol
Status: Awaiting re-review

## What

1. Change 来源的 Incident 不再暴露通用 `ACTION_PROPOSAL_WRITTEN_BACK`：右栏只允许返回 Change Guard，由 `Decision Record → ActionRun → Change Verification` 完成整改与复验。领域层同时拒绝 Change 进入通用写回、Inspection Verification start/evaluate。
2. Mission / Inspection 写回后只产生 `awaiting_remediation` 请求；源对象必须提交与 `sourceObject / sourceFindingId / ActionProposal / Evidence` 一致的 `RemediationReceipt`，Finding 才进入 `awaiting_verification`。
3. Inspection Verification start 必须绑定已完成整改回执；evaluate 必须提交完整的 coverage、freshness、execution、objectives Gate 和 Evidence。调用方传入裸 `passed` 不再生效。
4. Change Guard 会接管报告关联的 VerificationRequest：开始 Run 时绑定请求，Gate blocked / passed 时同步结算请求，避免通用巡检链绕过 Change 整改状态。
5. 报告复验依据当前源 Finding，而不是历史 snapshot 的 open 状态；当前已关闭时展示“已在源对象解决”，reducer 也拒绝重新排队。
6. 同类失效审计额外发现“报告请求 + Incident 写回”可能为同一 Mission Finding 生成并行请求。现在按 `sourceObject + sourceFindingId` 合并为单一活动 VerificationRequest，并保留 report/reason provenance。

## Why

报告是不可变投影，Incident 是调查容器，两者都不拥有源对象的整改完成与恢复结论。若通用链可直接接受 `passed`，Change 即使没有执行回滚也能静默关闭 Finding。修复后的所有权边界为：

- Change：`Incident → ActionProposal → Change Guard → ActionRun → Change Verification`
- Mission / Inspection：`Incident → ActionProposal → Source Finding → RemediationReceipt → Inspection Verification`
- Report：只发起指向当前源 Finding 的请求，不改变历史 snapshot，也不覆盖源对象门禁

## Tradeoff

- VerificationRequest 增加 `awaiting_remediation`、`remediationReceiptId`、复数 provenance 字段；状态比直接排队多一层，但能表达“已请求、尚未完成整改”的真实中间态。
- 原型中的整改回执由显式 UI 动作和 Mock Evidence 生成；没有伪造外部执行系统。将来接真实系统时可直接把 Evidence ID 替换为 ActionRun 事件引用。
- 报告 Finding 行保留 snapshot 状态徽标，同时补充当前源状态文字。这样历史事实不漂移，操作资格又不会由旧快照误判。

## Open

- 无 blocking 技术或产品问题。
- 三个既有未跟踪 review note 与本轮无关，未修改、未纳入提交。

## Verification

### Red → Green

- RED：新增所有权与历史状态反例后，目标测试为 `19 pass / 7 fail`。
- GREEN：目标域测试为 `27/27 pass`。
- 完整门禁：`npm run check` 通过，`32/32 pass`、Prettier 通过、Sites production build 成功。
- `git diff --check` 通过。

### Browser dogfood

- Hub Browser Preview 已打开 `localhost:5290`。
- `npm run test:browser` 通过，覆盖 Mission 整改回执、Change Incident 返回 Guard、Change 门禁复验、历史报告已解决语义、Change 报告请求进入 Guard、Inspection 与 390px mobile。
- 浏览器 console error 为 0；截图保存在 `%TEMP%\nova-ops-v5-r2-review\evidence\`。
- 验收后已按工作树与命令行精确校验并关闭预览进程。

## Re-review Scope

1. Change 未完成 Guard 整改时，通用写回和 Inspection Verification 均必须拒绝。
2. Mission / Inspection 未提交绑定证据的整改回执时，不得开始复验；裸 `passed` 不得关闭 Finding。
3. 历史报告对应的当前 Finding 已关闭时，不得创建 VerificationRequest。
4. 同一源 Finding 的报告请求与 Incident 写回必须收敛为一条活动复验链。

[丢丢/gpt-5.6-sol🐾]
