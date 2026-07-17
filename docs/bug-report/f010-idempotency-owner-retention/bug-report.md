# F010 persistent dispatch ownership

Reporter: Opus 4.5 (`REQUEST_CHANGES` on `7d2bca8..85d0cb1`)

## Reproduction

1. Send a message with a client UUID and let the durable user message and cat invocation complete.
2. Wait longer than the InvocationRecord idempotency-index TTL (300 seconds), or lose the bounded in-memory record.
3. Replay the same UUID in the same `(threadId, userId)` scope.
4. The durable message is reused by `MessageStore`, but a new InvocationRecord can be claimed and a second cat dispatch can start.

## Diagnosis capsule

| Field | Content |
|---|---|
| **1. Symptom** | Expected: one client UUID permanently identifies one durable user intent and never dispatches cats twice. Actual: after five minutes the InvocationRecord lookup can miss while the durable message still exists, allowing a new invocation owner and a second dispatch. |
| **2. Evidence** | `RedisInvocationRecordStore` creates the idempotency key with `EX 300`; the in-memory store also expires its index after five minutes. `MessageStore` keeps its scoped idempotency owner persistently, but the route only consults InvocationRecord before dispatch. |
| **3. Root cause** | Two stores assign different lifetimes to the same user-visible idempotency contract, and the route treats the shorter-lived InvocationRecord index as the sole dispatch gate. Durable-message reconciliation only repairs a known record; it cannot stop dispatch when the record index itself is absent. |
| **4. Diagnostic strategy** | Trace the UUID through route preflight, atomic record creation, durable append, Redis hydration, and bounded-memory eviction. Add tests that advance beyond 300 seconds and that simulate a missing record with an existing durable message owner. |
| **5. Timeout strategy** | If route-level replay cannot be made safe without coupling stores, reduce to a persistent owner pointer stored on the durable message and prove the fallback before expanding the model. |
| **6. Warning signals** | Any TTL on user-visible message idempotency, a replay path that reaches tracker/queue/router after finding a durable message, or owner metadata that Redis parsing drops indicates the model is still unsafe. |
| **7. User-visible correction** | Replaying an old UUID returns the original `userMessageId` and its stable invocation/queue owner; it never creates another optimistic message or cat response. |
| **8. Acceptance** | RED tests cover >300-second in-memory replay, persistent Redis ownership, durable-message fallback with no route/queue/tracker side effects, and Redis `extra.dispatch` round-trip. Focused and broad API suites must pass. |

## Root-cause model

The durable user message is the irreversible commit point. Its `extra.dispatch` pointer is the persistent recovery owner. InvocationRecord remains the atomic concurrency claim, but its idempotency mapping must be persistent as well. Route preflight resolves InvocationRecord first, then the durable-message owner as a recovery fallback for legacy TTL records or bounded-memory eviction.

## Failure-mode audit

- Same UUID after five minutes.
- Same UUID after the in-memory InvocationRecord was evicted.
- Redis message hydration dropping owner metadata.
- Legacy durable messages without an owner pointer.
- InvocationRecord message-id backfill failure followed by replay.
- Concurrent replay while the first request is between claim, append, and backfill.

[宪宪/gpt-5.6-sol🐾]
