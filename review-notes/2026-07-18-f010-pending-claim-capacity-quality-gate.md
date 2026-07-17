# F010 pending-claim capacity quality gate

Implementation commit: `06c84e2`

Review repair range: `fe7fbc4..06c84e2`

Status: **PASS for independent code re-review**. This is not a feature-completion claim; iPhone Chinese-IME and installed standalone-PWA acceptance remain open.

## Vision and spec alignment

Sources:

- `feature-discussions/2026-07-18-f010-mobile-experience-recovery-meeting-notes.md`
- `feature-specs/2026-07-18-f010-mobile-experience-recovery.md`
- Opus 4.5 `REQUEST_CHANGES` message `0001784327391611-000414-53609411`

| Contract | Result | Evidence |
| --- | --- | --- |
| One client UUID owns one dispatch | Pass | An undurable InvocationRecord is never capacity-evicted; replay resolves the existing record before tracker/queue/router side effects. |
| Append/backfill window returns `confirming` | Pass | Real Fastify regression blocks the first append, applies capacity pressure, and receives `202 confirming` with the original `invocationId`. |
| Terminal no-message UUID is not reusable | Pass | Failed/canceled records with no durable message remain reserved and continue to return the original terminal owner. |
| Bounded memory remains bounded when safe | Pass | Records with `userMessageId` remain evictable; a successful backfill immediately repays temporary soft-cap overflow. |
| Architecture ownership | Pass | Architecture cell `dispatch`; Map delta `none`; no new Store, Queue, Router, Adapter, Dispatcher, Binding, or extension point. |

The repair implements Task 5's bounded-record-eviction clause and INV-6. It does not alter message response schemas, QueueEntry ownership, Redis storage, or frontend behavior.

## Delivery completeness

- This review slice is complete and extends the existing dispatch owner model; it does not require a later rewrite.
- F010 itself is intentionally not being closed in this gate. Therefore no CloseGateReport is asserted; operator-owned real-device acceptance remains visibly open in `project-evidence/f010-mobile-pwa/README.md`.
- `tips_exempt` remains valid: this is an existing reliable-send contract repair with no new user action, capability, or guide entry point.

## Red → Green

RED on the prior implementation:

- `InvocationRecordStore` soft-bound contract: `1 !== 2`; the original pending claim had been evicted.
- Real route replay: returned `200` after a second claim instead of `202 confirming`; the log recorded `InvocationRecord message backfill found no owner record`.

GREEN:

- Focused store + route: **67/67**.
- Store usage semantics + store + route after refactor: **73/73**.
- Broad affected API selection: **350/350** across messages, record usage, queue, QueueProcessor, MessageStore, Redis retention/hydration, and acceptance roster.
- Route dogfood: **1/1**.

## Failure-mode sweep

Pattern: destructive capacity eviction before an alternate durable owner exists.

| Sibling | Resolution |
| --- | --- |
| `queued` / `running`, no message | Retained; route race covered. |
| `failed` / `canceled`, no message | Retained; same UUID remains terminal. |
| `succeeded`, no message | Retained; existing invariant-violation response remains authoritative. |
| Any status with durable message | Eligible for eviction; existing message owner recovery remains authoritative. |
| Temporary all-undurable overflow | Allowed fail-closed; backfill triggers immediate safe trimming. |
| Redis store | N/A: no process-local bounded Map eviction. Persistent retention test remains green. |

Full capsule: `docs/bug-report/f010-pending-claim-capacity-eviction/bug-report.md`.

## Fresh validation

| Command | Result |
| --- | --- |
| `pnpm --filter @cat-cafe/api run build` | Exit 0 |
| `node --test packages/api/test/invocation-record-store.test.js packages/api/test/invocation-record-store-usage.test.js packages/api/test/messages-delivery-mode.test.js` | 73/73 |
| Broad 13-file affected API selection | 350/350 |
| `node --test --test-name-pattern "capacity pressure cannot evict" packages/api/test/messages-delivery-mode.test.js` | 1/1 real Fastify route dogfood |
| `pnpm biome check .../InvocationRecordStore.ts` | Clean, no fixes |
| `git diff --check` | Pass |
| `pnpm -r --if-present run build` | Exit 0; Web generated 22 routes |
| `pnpm check` | Baseline red only: untouched `packages/api/src/infrastructure/websocket/SocketManager.ts` formatting |

The broad Redis adapter tests ran; isolation-flagged integration suites reported their normal skip. No production/user Redis was accessed or mutated.

## Dogfood-Your-Slice

Scope verdict: required because duplicate dispatch is user-visible.

End-to-end path: real Fastify `POST /api/messages` → real in-memory InvocationRecord claim → blocked message append → capacity pressure → same-UUID replay.

Observed result: `202 confirming`, original `invocationId`, one append, one tracker acquisition, zero queue/router side effects during the blocked window. No bug remained after the repair.

## Design, artifacts, and tooling

- Matching `designs/**/*.pen`: none; no UI delta.
- Root media/design artifacts in worktree and slice diff: none.
- The quality skill's referenced `check-hotfix-pattern.mjs`, `check-fallback-layers.mjs`, `check-architecture-ownership.mjs`, and `evidence-output-contract.md` are absent from this checkout. Manual diff audit found one existing-store policy change, no fallback stack, and no architecture-map delta; this tooling gap is reported rather than fabricated as green.
- The main workspace path `E:\ClowderAI\clowder-ai` is not a Git worktree. All edits and commits landed only in the established F010 worktree.

[宪宪/gpt-5.6-sol🐾]
