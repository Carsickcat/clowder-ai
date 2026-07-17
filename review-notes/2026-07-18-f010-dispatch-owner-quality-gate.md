# F010 dispatch-owner repair — quality gate

Date: 2026-07-18

Implementation commit: `b62e66f`

Review baseline: `8bc3478..b62e66f`

Verdict: **PASS for the P1/P2 repair slice; independent reviewer verdict remains required.** This is not an F010 feature-close report. The reporting iPhone's Chinese-IME keyboard journey and installed standalone-PWA/Tailscale HTTPS journey remain open release acceptance.

## Vision and spec alignment

- One accepted client UUID still maps to one durable user intent. Replays cannot create a second message, InvocationRecord, QueueEntry, tracker reservation, force cancellation, or cat execution.
- `InvocationRecord` is the universal persistent atomic claim/lifecycle record. `QueueEntry` remains the external/API response owner only when the request queues. A record links the stable `queueEntryId`; the durable message stores the same recovery owner.
- The change extends the existing message/record/queue model. It adds no parallel Store, Queue, Router, Adapter, Dispatcher, Binding, or UI surface.
- Architecture cells remain `hub-action-surface`, `bubble-pipeline`, and `dispatch`; map delta remains none.

## Acceptance matrix

| Finding | Repair | Evidence | Result |
| --- | --- | --- | --- |
| P1 — dispatch ownership expired after 300 seconds | Removed Redis/in-memory claim TTL; durable message preflight now recovers the original invocation/queue owner before any dispatch side effect. | In-memory clock advance, bounded eviction, dependency-free Redis Lua inspection, real isolated Redis store, route side-effect assertions. | PASS |
| P2 — queued replay changed identity to InvocationRecord | Preassign one `queueEntryId`, persist it on the claim and message, and return `queued/confirming` with that same ID for explicit queue and TOCTOU queue. | Queue unit test, explicit queue replay/backfill windows, TOCTOU replay/backfill windows, cross-mode concurrency test. | PASS |

## TDD evidence

- RED: the new/updated affected API selection produced **14 expected failures / 182 passes**. The failures were exactly the missing preassigned queue ID, missing `queueEntryId` persistence, expired claim, wrong queued replay identity, missing durable-message fallback, and missing Redis message-owner hydration.
- GREEN focused: **196/196**.
- Final affected API roster: **370/370** across messages, atomic records, queue gate, QueueProcessor batching, stores/parsers, concurrent fault drill, startup recovery, scheduler/briefing siblings, and acceptance roster.
- Final affected Web contract: **28/28** across composer draft/session recovery and send outcome hooks.

## Verification

| Gate | Result |
| --- | --- |
| API build | PASS |
| Workspace builds (`pnpm -r --workspace-concurrency=1 --if-present run build`) | PASS; all packages and 22 Web routes built. Existing Web lint warnings only. |
| Targeted Biome, 12 changed code/test files | PASS |
| Repository lint | PASS before final evidence-only edits; existing warnings only. |
| Capability tips | PASS, checker tests **11/11**; `tips_exempt` documents that this is an existing reliability repair with no new user action. Existing missing-anchor warnings remain. |
| `git diff --check` | PASS |
| Real isolated Redis | PASS **64/64** on dynamic port 1511 / DB 15. Ports 6398, 6399, and 6401 were not touched; the exact temporary process and directory were stopped/removed. |
| Fastify route dogfood | PASS **3/3**: duplicate POSTs for explicit queue, durable-message fallback, and TOCTOU queue preserved the same owner and did not append/enqueue/dispatch twice. |
| Full Web Vitest | Baseline red: **5028/5101 pass**, 73 failures in 17 untouched Skills/artifact/socket/F252 files. The three affected files pass 28/28 independently. |
| Full MCP tests | Baseline red: **375 pass / 6 fail** in untouched file/shell tools; failures include the absent `/bin/sh` Windows environment. No MCP code changed. |
| Root `pnpm check` | Baseline red only at untouched `packages/api/src/infrastructure/websocket/SocketManager.ts` formatting. The command stops there; no later subcheck is represented as run by that invocation. |
| Full API package entry | Not green: the repository script uses POSIX env assignment and `bash`, unavailable in this Windows shell. An equivalent explicit-glob runner did not terminate after ten minutes (held by untouched preview/F230 tests); its exact runner and two child PIDs were stopped. The 370-test high-risk roster and 64 real-Redis tests provide the deterministic repair verdict. |

## Manual audits

- Architecture ownership command: `check:architecture-ownership` is absent from this repository. Manual map-delta audit found no new owner or parallel execution surface.
- Hotfix/fallback scripts: `scripts/check-hotfix-pattern.mjs` and `scripts/check-fallback-layers.mjs` are absent; no synthetic green is claimed. The affected route adds one durable recovery branch, not three fallback layers in one file.
- Design: no UI code or `.pen` file changed; the existing `docs/design/f190-console-layout.pen` is unrelated, so visual comparison is not applicable.
- Artifact hygiene: no root media artifact was added. A test-generated `.claude/skills` tree containing only reparse links was verified and removed without following link targets.
- Security/data boundary: tests used temporary HOME directories and a dynamically allocated isolated Redis instance. No persistent runtime data was flushed or modified.

## Close boundary

The two code-review findings are closed by `b62e66f`, with no code follow-up tail. F010 itself remains open until independent code review and operator-owned real-device acceptance complete.

[宪宪/gpt-5.6-sol🐾]
