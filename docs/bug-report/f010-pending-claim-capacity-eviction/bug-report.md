# F010 pending invocation claim capacity eviction

Reporter: Opus 4.5 (`REQUEST_CHANGES` on `8bc3478..b62e66f`)

## Diagnosis capsule

| Field | Evidence |
| --- | --- |
| Symptom | While the first request was blocked before its durable message append completed, creating enough unrelated in-memory InvocationRecords could evict its claim. Replaying the same client UUID then created a second InvocationRecord and crossed tracker/append dispatch side effects. |
| Reproduction | Configure `InvocationRecordStore({ maxRecords: 1 })`; start a real `POST /api/messages` request and pause its first `messageStore.append`; create one unrelated claim; replay the original UUID before releasing the append. |
| Root cause | Capacity trimming deleted the oldest record and its idempotency index without checking whether another persistent dispatch owner existed. A claim with `userMessageId === null` has no durable-message recovery pointer, so eviction reopened the UUID instead of merely shedding cache state. |
| Terminal model | `maxRecords` is a safety-first soft bound. Only records with a non-null `userMessageId` are recoverable through the durable message index and eligible for eviction. Undurable claims remain reserved regardless of lifecycle status; backfill immediately retries safe trimming so temporary overflow is repaid. |
| Diagnostic strategy | Prove the race through the real Fastify route with the real in-memory record store, then isolate store semantics for pending, terminal-without-message, recoverable, and post-backfill states. |
| Timeout strategy | The regression uses explicit promises around the first append and does not depend on elapsed time. The append gate is always released before assertions so failure cannot strand Fastify teardown. |
| Warning signals | Any capacity/TTL cleanup that removes the last UUID owner before a durable message exists, or any same-key replay that increases tracker, queue, router, or append side-effect counts, reopens this defect. |
| Acceptance | The original claim returns `202 confirming` during the append window; no second tracker/queue/router/append side effect occurs; terminal undurable claims remain reserved; safe backfill restores the configured bound. |

## Failure-mode sweep

Pattern: **destructive capacity eviction before an alternate durable owner exists**.

| Sibling state | Verdict | Coverage |
| --- | --- | --- |
| `queued` / `running`, `userMessageId=null` | Fixed: never evict | Real Fastify append-window regression plus store soft-bound test |
| `failed` / `canceled`, `userMessageId=null` | Fixed: never evict; same UUID must keep returning the terminal owner | Terminal-without-message capacity test |
| `succeeded`, `userMessageId=null` | Protected by the same predicate; replay remains the existing invariant violation | Existing succeeded-without-message route regression |
| Any status with `userMessageId` | Safely evictable; durable message lookup is the recovery owner | Bounded-capacity recoverable-record test and durable-owner route regressions |
| Soft overflow after append/backfill | Fixed: `update()` immediately trims the oldest recoverable record | Store backfill repayment assertion |
| Redis InvocationRecordStore | N/A: it has no process-local bounded Map eviction | Persistent Redis idempotency retention regression |

## Red → Green evidence

- RED: store contract failed with `1 !== 2`; route replay returned `200` instead of `202 confirming`, and the log reported that the original InvocationRecord backfill found no owner.
- GREEN: focused store/message route selection passes 67/67; usage-extraction refactor selection passes 73/73.
- Broad affected API selection passes 350/350; real route dogfood passes 1/1; workspace build exits 0.

[宪宪/gpt-5.6-sol🐾]
