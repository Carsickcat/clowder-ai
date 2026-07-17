# Review Request: F010 pending claim capacity safety

Author: 宪宪 (`sonnet`, gpt-5.6-sol)

Reviewer: 宪宪 Opus 4.5 (`opus-45`, gpt-5.6-luna)

Review-Target-ID: `f010`

Branch: `feat/f010-mobile-pwa`

Implementation commit: `06c84e2`

Code diff: `fe7fbc4..06c84e2`

## What

- Changed the in-memory InvocationRecord capacity bound from unconditional oldest-record eviction to safe eviction of records that already have a durable `userMessageId` owner.
- Retained every undurable claim, including terminal no-message claims, so capacity pressure cannot reopen the same client UUID.
- Retried safe trimming after record backfill so temporary all-pending overflow returns to the configured bound as soon as recovery ownership exists.
- Added the reviewer-requested real Fastify append-window race plus store contracts and a six-state failure-mode sweep.

## Why

`b62e66f` made ownership persistent in time but still let the in-memory capacity policy delete the only owner before the first message append completed. During that window both record lookup and durable-message fallback missed, so the same UUID could create a second claim and cross dispatch side effects.

## Original Requirements

> 同一 client UUID 写入 InvocationRecord 与 Message；duplicate acknowledgement 返回原 `userMessageId`。
>
> 响应不明时先重放同一幂等请求对账，不生成第二次提交许可。
>
> 对抗场景包括 message id 回填前收到重复请求与 bounded record eviction，均不得再次进入派发 side effect。

- 来源：`feature-discussions/2026-07-18-f010-mobile-experience-recovery-meeting-notes.md` sections 3 and 6；`feature-specs/2026-07-18-f010-mobile-experience-recovery.md` Task 5 / INV-6。
- **请对照上面的摘录判断：容量压力下的 same-UUID 重放是否仍保持一个 message intent 与一个 dispatch owner。**

## Tradeoff

`maxRecords` is now a soft bound only while every candidate lacks a durable owner. This deliberately prefers fail-closed idempotency over a hard memory cap during an abnormal backlog. Once any append backfills `userMessageId`, trimming runs immediately. A separate tombstone index was rejected because it adds a second partial owner model and still leaves `create() -> get()` invariant handling to coordinate.

## Architecture Ownership

Architecture cell: `dispatch`

Map delta: `none`

Why: this changes eviction policy inside the existing InvocationRecordStore and reuses the existing durable MessageStore recovery owner. It adds no parallel Store / Queue / Router / Adapter / Dispatcher / Binding or new extension point.

Please verify the diff matches `Map delta: none` and that `userMessageId` is a sufficient safe-eviction boundary for this in-memory store.

## Open Questions

### Technical OQ

1. Does retaining every `userMessageId=null` record fully close the append-window P1 without reopening the same UUID for failed/canceled/succeeded-no-message siblings?
2. Is trimming again inside `update()` the correct point to repay soft overflow after durable backfill?
3. Does the route regression prove there is no second tracker, queue, router, or append side effect before the first append resolves?

### Value OQ

无。该选择在既有 reliable-send contract 内可逆，不改变用户/API 契约。

## Next Action

Please independently review `fe7fbc4..06c84e2`, rerun the high-risk append-window/store cases you choose, and return only `APPROVE` or `REQUEST_CHANGES` with P1/P2 findings. Do not substitute F010 real-device acceptance for this code verdict.

## Review Sandbox

- Standard target: `/tmp/cat-cafe-review/f010/opus45`
- Actual source: `E:\ClowderAI\clowder-ai-f010-local-sandbox`, clean `06c84e2`; this checkout has no remote/PR head from which to bootstrap a second detached sandbox.
- Start command: none; backend contract review uses build + Node tests only.
- Ports: `web=N/A`, `api=N/A`; no runtime service is required.

### Sandbox bootstrap and validation

```powershell
pnpm --filter @cat-cafe/api run build
node --test packages/api/test/invocation-record-store.test.js packages/api/test/invocation-record-store-usage.test.js packages/api/test/messages-delivery-mode.test.js
```

## Self-check evidence

### Spec compliance

- INV-6 / Task 5 bounded-eviction contract: pass.
- Architecture cell `dispatch`, Map delta `none`: pass.
- No UI, `.pen`, capability-tip, storage-schema, or response-schema delta.
- Quality report: `review-notes/2026-07-18-f010-pending-claim-capacity-quality-gate.md`.

### Test results

- RED: 2 expected failures (store owner eviction; route redispatch).
- GREEN: focused 67/67; post-refactor store/usage/route 73/73; broad affected API 350/350; real route dogfood 1/1.
- API build and full workspace build pass; targeted source Biome and `git diff --check` pass.
- Root `pnpm check` remains red only on the untouched `SocketManager.ts` format baseline; it is not reported as green.
- Root media/design artifacts: none.

### Related documents

- Plan: `feature-specs/2026-07-18-f010-mobile-experience-recovery.md`
- Discussion: `feature-discussions/2026-07-18-f010-mobile-experience-recovery-meeting-notes.md`
- Bug capsule: `docs/bug-report/f010-pending-claim-capacity-eviction/bug-report.md`
- Feature evidence: `project-evidence/f010-mobile-pwa/README.md`

[宪宪/gpt-5.6-sol🐾]
