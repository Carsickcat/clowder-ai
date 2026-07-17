# F010 durable message / InvocationRecord backfill reconciliation

## Diagnosis capsule

| Field | Evidence |
| --- | --- |
| Symptom | A user message could be durably appended, then `InvocationRecord.userMessageId` backfill could fail. The route converted that metadata failure into HTTP 500 and a terminal failed record. A replay with the same idempotency key then returned `MESSAGE_NOT_DURABLE` even though the message existed. |
| Reproduction | Inject one failure into the first record update carrying `userMessageId`. Before the fix, immediate returned 500 instead of 200, and both explicit queue and TOCTOU queue returned 500 instead of 202. |
| Root cause | Message append and recoverable record metadata backfill shared one rollback/failure boundary. The code therefore treated the secondary index as the commit point and ignored the message store's existing `(userId, threadId, idempotencyKey) -> messageId` durable index. |
| Terminal model | `IMessageStore.append()` is the durable commit point. `InvocationRecord.userMessageId` is recoverable metadata. Backfill is best-effort; a replay resolves the durable message through the same scoped idempotency index, repairs the record, and returns the original message ID. |
| Verification | The new regressions cover immediate, explicit queue, and TOCTOU queue. In-memory and Redis adapters expose the same scoped lookup contract. The affected API selection passes 196/196; the focused reconciliation/store selection passes 73/73. |

## Failure-mode audit

- A message append failure still rolls back queue ownership and terminalizes the invocation claim.
- Queue-entry message-ID backfill remains inside the queue transaction; only `InvocationRecord` metadata failure is recoverable.
- Replays do not append a second message and do not create a second invocation owner.
- Missing records and succeeded-without-message states retain their existing invariant/error responses when no durable message can be resolved.
- Redis stale-index cleanup uses compare-and-delete Lua. It can delete only the exact missing message ID read by that request, so it cannot erase a concurrent append's new owner.
- The Redis adapter contract is covered by a dependency-free unit test and remains present in the isolated Redis integration suite. The repository's Bash-based isolated Redis launcher could not allocate an instance in this Windows executor; no persistent Redis port or database was reused or modified.

## Red → Green evidence

- Red: 4 API failures — missing message-store lookup plus immediate/explicit-queue/TOCTOU backfill failures.
- Green: 73/73 focused API tests after reconciliation and atomic Redis cleanup.
- Broad affected API selection: 196/196, including queue ownership, `QueueProcessor`, `InvocationRecordStore`, message stores, and the acceptance roster gate.

[宪宪/gpt-5.6-sol🐾]
