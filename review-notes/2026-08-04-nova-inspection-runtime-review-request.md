# NOVA Inspection Runtime — Review Request

Review-Target-ID: `nova-inspection-runtime`  
Branch: `feat/nova-inspection-runtime`  
Behavior SHA: `ecc82b76876e9e834bd1ad4274bed85b65e7606d`
Base: `26231439a5a98461ca7c1d301b200e07724f1756`

## Original Requirements

Please judge the implementation against the operator experience, not only against the TypeScript diff:

1. Build the next phase as a real-machine version, not another standalone mock.
2. Develop it on an isolated branch.
3. Have Kimi refine the high-fidelity details and complete user journey.
4. Have Terra validate the architecture before implementation.
5. Deliver a runnable version by morning and resolve reversible intermediate choices autonomously.
6. Preserve the earlier requirement that generated inspection jobs are reusable and that the system is genuinely connected and durable.

Primary source: thread message `0001785774553420-000133-33be0abf`.  
Earlier product source: `0001785430019722-000330-2bd1a2f9`.  
Implementation truth: `feature-specs/2026-08-04-nova-inspection-runtime.md`.

## What

- Move NOVA inspection audit state from the shared memory/scheduler database into a dedicated TTL-0 SQLite file.
- Add source scope and SHA-256 snapshot provenance to server-owned run evidence.
- Seal deterministic five-dimensional report intelligence, deductions, basis, risks, and citations inside the immutable report snapshot.
- Project the accepted task/detail/CLAW/execution IA from the connected API, including honest local-fixture, blocked, disconnected, and completed states.
- Add a mobile-readable runbook plus deterministic connected Chrome, restart-recovery, and 15-second video evidence scripts.

## Why / Tradeoffs

- The straight path is to extend the existing `InspectionService` / routes / store / types / page rather than create a second reducer or client store.
- The dedicated DB imports the existing inspection migration constants from `domains/memory/schema.ts` to avoid two schema definitions, but opens a separate file and version table. Please assess whether this dependency direction remains acceptable.
- Replay values remain fixed test fixtures. The server now preserves their original fixture capture time separately from the current replay execution time, includes both in the source snapshot hash, and caps replay freshness at 90. This keeps local journeys executable without presenting fixed values as live telemetry.
- Freshness is measured against each Run's completion window, not final report generation time; otherwise a valid early admission baseline would decay merely because a canary took time.
- There is no production action route, live LLM, enterprise graph, or production telemetry fallback.

## Architecture Ownership

- Architecture cell: existing observability bounded slice exposed through the existing Hub action surface.
- Map delta: none.
- Why: the diff reuses the existing service, strict routes, shared types, source port, store, and connected page. The new database is an internal persistence correction, not a new product plane.

Architecture gate: Terra message `0001785774803181-000136-dcc162d1`.  
Design gate: Kimi message `0001785774802914-000134-537e97d5`.

## Fresh-Context Findings

Fable completed an independent scan in message `0001785780124653-000147-c56e423f` and found two P2 issues against the preceding behavior commit:

1. **FC-1 — replay provenance:** `ReplayObservabilitySource` rewrote capture time on each collection, allowing fixed fixture values to appear fully fresh. Fixed by separating `fixtureCapturedAt` from replay `collectedAt`, persisting both, showing both in the UI, and capping fixed-fixture freshness.
2. **FC-2 — acceptance error scope:** the connected degradation journey globally muted console/request failures while the API was intentionally stopped. Fixed by exempting only observability API aborts and their exact Chrome resource errors, requiring a non-zero exercised failure count, and requiring one-to-one counts.

Both were reproduced by failing API/web/script contracts before implementation and are green at the behavior SHA. A sibling failure-mode audit scanned source ports, replay and Prometheus adapters, snapshot persistence, report scoring, UI projection, and all acceptance console/request collectors. No other conflated timestamp semantics or global failure mutes remain; the script-level static guard prevents recurrence. Fable closure and formal review remain independent required gates.

## Self-Check Evidence

- Quality report: `review-notes/2026-08-04-nova-inspection-runtime-quality-gate.md` — PASS.
- NOVA API: 73/73.
- Entire web suite: 267 files / 1867 tests; no-hardcoded-colors contract passed.
- Root `pnpm lint`, `pnpm check`, and production recursive build: exit 0.
- Standalone: 61/61 plus both real `file://` Chrome suites, console/network `0/0`.
- Connected Chrome: empty, partial, completed, intentional API error; 1440/720/390; no overflow; unexpected console/network `0/0`; three expected observability API aborts matched exactly three scoped resource errors.
- Restart recovery: exact report restored for `nova-final-fc-fix-20260804-02` after stopping and restarting API/web processes.
- Video: 30 real page frames encoded by Chrome to a 15-second WebM.
- `git diff --check`: pass.
- Root media in worktree/commit: none.
- Author worktree: clean after the review-packet commit; the request message supplies the exact review tip and the behavior SHA above.

Baseline caveat: root `pnpm test` is not Windows-portable because the API package embeds POSIX inline environment assignment. Executing the API body directly exposes unchanged workspace tests with POSIX path and `/tmp` symlink assumptions; the diff has no workspace-domain or workspace-test changes. The changed API domain and the entire web application pass independently.

## Reviewer Focus / Technical Questions

1. Can any browser payload still author evidence, source identity, verdict, timestamps, or report score?
2. Can a future/high/stale/malformed observation or invalid A/B basis reach an acceptable report?
3. Are V10→V13 migrations correct for both the legacy shared DB and a fresh/reopened dedicated inspection DB?
4. Is report intelligence fully reconstructible from the exact persisted runs, decisions, candidate origin, source hashes, and A/B projection sealed in the transaction?
5. Does the split fixture-capture/replay-execution model preserve provenance without falsely claiming live data?
6. Do connected failures stay fail-closed without silently loading the standalone fixture state?
7. Can the acceptance/video scripts hide console/network failures, state divergence, or restart loss?

Value questions requiring operator decision: none.

## Requested Verdict

Create a detached/read-only review sandbox for the exact request tip, including behavior SHA `ecc82b76876e9e834bd1ad4274bed85b65e7606d`. Return one explicit `APPROVE` or `REQUEST CHANGES` verdict with P1/P2/P3 counts, independent test/browser evidence, and explicitly mark FC-1/FC-2 as covered, still open, or regressed.
