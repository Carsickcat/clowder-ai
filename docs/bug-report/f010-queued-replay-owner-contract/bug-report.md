# F010 queued replay owner contract

Reporter: Opus 4.5 (`REQUEST_CHANGES` on `7d2bca8..85d0cb1`)

## Reproduction

1. Send a UUID-bearing request that enters explicit queue mode or degrades to queue at the tracker TOCTOU gate.
2. Observe the first response: `202 queued` with an `entryId`.
3. Replay the same UUID.
4. Current code answers as an immediate InvocationRecord owner (`200 acknowledged` or `202 confirming` with `invocationId`) instead of preserving the QueueEntry API owner.

## Diagnosis capsule

| Field | Content |
|---|---|
| **1. Symptom** | Expected: queued and TOCTOU-degraded replays always return the same `entryId`. Actual: the first response is queue-owned, while replay switches identity and status semantics to InvocationRecord. |
| **2. Evidence** | The F010 spec requires `202 queued/confirming` with `entryId`; `replyForExistingInvocation` only knows `invocationId`. Existing tests at the queue and TOCTOU replay boundaries encode the divergent `200 acknowledged` behavior. |
| **3. Root cause** | `7d2bca8` correctly introduced a universal atomic InvocationRecord claim to close cross-mode races, but the claim record was not linked to the QueueEntry response owner. Replay therefore cannot reconstruct the original API ownership model. |
| **4. Diagnostic strategy** | Separate concurrency ownership from API response ownership. Trace a stable preassigned QueueEntry ID through record claim, enqueue, durable message metadata, Redis hydration, and replay. Add explicit queue, TOCTOU, and append/backfill-window tests. |
| **5. Timeout strategy** | If a literal queue-only claim reopens cross-mode races, retain the universal atomic record and document the linked owner chain rather than weakening the concurrency boundary. |
| **6. Warning signals** | Removing the pre-side-effect atomic claim, generating a second QueueEntry ID in `enqueue`, or returning `invocationId` for a record that has `queueEntryId` means the fix is incomplete. |
| **7. User-visible correction** | The first queued response and every replay expose one stable `entryId`; `confirming` never creates another bubble or UUID. |
| **8. Acceptance** | RED tests cover stable preassigned queue IDs, explicit queue replay, TOCTOU replay, both confirming windows, and concurrent cross-mode claim behavior. Focused and broad API suites must pass. |

## Root-cause model

InvocationRecord is the persistent atomic claim and lifecycle record for every UUID-bearing dispatch. QueueEntry is the external response owner whenever the request queues. The record stores `queueEntryId`, the queue accepts that preassigned ID, and the durable message stores the same owner pointer. This linked chain preserves the `7d2bca8` concurrency fix while satisfying the queued API contract.

## Failure-mode audit

- Explicit queue replay before and after message backfill.
- Immediate request that loses the tracker TOCTOU race and becomes queued.
- Two concurrent same-UUID requests observing different busy states.
- Queue capacity rejection and append rollback.
- Queue entry removed after processing while replay still needs stable identity.
- Redis restart/hydration of the claim and message owner pointers.

[宪宪/gpt-5.6-sol🐾]
