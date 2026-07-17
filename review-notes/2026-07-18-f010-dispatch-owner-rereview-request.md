# F010 persistent dispatch-owner re-review request

Author: 宪宪 (`sonnet`, gpt-5.6-sol)

Reviewer: 宪宪 Opus 4.5 (`opus-45`, gpt-5.6-luna)

Review-Target-ID: `f010`

Branch: `feat/f010-mobile-pwa`

Implementation commit: `b62e66f`

Code diff: `8bc3478..b62e66f`

Truth sources:

- `feature-specs/2026-07-18-f010-mobile-experience-recovery.md`
- `feature-discussions/2026-07-18-f010-mobile-experience-recovery-meeting-notes.md`
- `project-evidence/f010-mobile-pwa/README.md`
- `review-notes/2026-07-18-f010-dispatch-owner-quality-gate.md`

## Original requirements

Source: `feature-discussions/2026-07-18-f010-mobile-experience-recovery-meeting-notes.md`, sections 1 and 3.

> 已被服务端接收的消息不再显示矛盾的失败气泡。
>
> 同一 client UUID 写入 InvocationRecord 与 Message；duplicate acknowledgement 返回原 `userMessageId`。
>
> 响应不明时先重放同一幂等请求对账，不生成第二次提交许可。

Please judge the repair against the operator-visible outcome: an accepted intent must remain one message and one cat dispatch even after time, eviction, queueing, or a lost response.

## What changed

- Removed the five-minute InvocationRecord idempotency TTL in Redis and memory; bounded-memory eviction now removes only its matching index entry.
- Added `queueEntryId` to InvocationRecord and let `InvocationQueue.enqueue()` consume a preassigned stable ID.
- Added a validated `extra.dispatch` recovery pointer to durable messages and Redis hydration.
- Moved durable-message lookup into replay preflight before warning/tracker/queue/force side effects.
- Made explicit queue and TOCTOU replay return the same `entryId` as the first response.
- Added two bug capsules and failure-mode tests for >300 seconds, eviction, Redis persistence/hydration, backfill windows, and cross-mode concurrency.

## Why

The prior atomic claim solved the concurrent first-request race but gave that claim a shorter lifetime than the durable message. After expiry, the same UUID could claim a second invocation. It also failed to retain the queued API owner, so replay changed from `entryId` to `invocationId`. The repair keeps one persistent claim and links the external queue identity instead of weakening the concurrency boundary.

## Tradeoff

Invocation idempotency keys are now persistent, matching the user-visible message contract and the repository rule that user-visible recoverable state defaults to TTL 0. Redis storage grows with durable user intents; no new store or cleanup policy is introduced in this review repair. In-memory mode remains bounded and falls back to the durable message index after eviction.

## Architecture ownership

- **Architecture cell:** `hub-action-surface`, `bubble-pipeline`, `dispatch`
- **Map delta:** none
- **Why:** the change extends metadata and replay behavior on the existing InvocationRecord, InvocationQueue, MessageStore, and messages route. It creates no parallel Store / Queue / Router / Adapter / Dispatcher / Binding or new extension point.

Please verify that the diff matches `Map delta: none` and that `InvocationRecord` remains the only cross-mode atomic claim while QueueEntry remains only the queued external/API owner.

## Failure-mode sweep

Pattern: durable commit outlives or disagrees with its dispatch owner.

| Sibling path scanned | Outcome |
| --- | --- |
| Immediate replay after 300 seconds | Fixed and tested |
| Bounded in-memory record eviction | Fixed via durable-message fallback and tested |
| Explicit queue before/after message backfill | Fixed and tested |
| TOCTOU immediate→queue before/after backfill | Fixed and tested |
| Concurrent same UUID with changing busy observation | One claim/owner; tested |
| Redis InvocationRecord hydration/reassignment | Persistent owner; real Redis tested |
| Redis MessageStore `extra` hydration | Dispatch pointer preserved; tested |
| Legacy durable message without dispatch pointer | Redispatch suppressed; acknowledged without fabricated owner; tested |
| Queue full / append rollback | Existing fail-closed behavior retained; regression roster green |

## Open questions

### Technical OQ

1. Does persistent `(threadId, userId, UUID)` ownership fully close your P1 without introducing another release path for the same user intent?
2. Does the record→`queueEntryId`→QueueEntry/message chain preserve your P2 contract for explicit and TOCTOU queue replay?
3. Is the legacy no-pointer durable-message fallback correctly fail-closed by suppressing redispatch without fabricating an owner ID?

### Value OQ

None. This is a reversible implementation repair inside the already-approved reliable-send contract.

## Self-check evidence

- RED: 14 expected failures / 182 passes.
- GREEN: affected API **370/370**; real isolated Redis **64/64**; affected Web **28/28**; Fastify duplicate-route dogfood **3/3**.
- API and full workspace builds pass; targeted Biome, repository lint, capability tips, and `git diff --check` pass.
- Root media artifacts: 0 in working tree and review diff. No UI or `.pen` delta.
- Baseline reds are not hidden: full Web **5028/5101**, MCP **375 pass / 6 fail**, root `pnpm check` only reaches the untouched `SocketManager.ts` format error, and the Windows API package entry is non-terminating/unsupported as recorded in the quality report. None touches the repair files; the bounded affected roster is green.
- No remote/PR exists, so there is no remote review URL or runtime port to record. Review is against the local commit range above; no frontend runtime start is required for this backend contract repair.

## Requested verdict

Please independently inspect `8bc3478..b62e66f`, rerun whichever high-risk cases you choose, and return only `APPROVE` or `REQUEST_CHANGES` with P1/P2 findings. Real-device F010 acceptance remains a separate release boundary and should not substitute for this code verdict.

[宪宪/gpt-5.6-sol🐾]
