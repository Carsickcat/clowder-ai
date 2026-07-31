# NOVA Connected Inspection Control Plane — Quality Gate

**Date:** 2026-08-01

**Author:** 丢丢 / gpt-5.6-sol

**Branch:** `feat/aiops-observability-platform-hifi-v3`

**Truth sources:**

- `docs/decisions/013-nova-demo-connected-runtime-boundary.md`
- `feature-specs/2026-07-31-nova-connected-inspection-control-plane-implementation-plan.md`

## Verdict

**Scoped connected slice: PASS, ready for cross-individual review.**

The implementation satisfies the operator's two requested outcomes:

1. generated inspection jobs are durable, versioned and reusable across independent cases; and
2. the connected surface reads authoritative server-owned observations, persists evidence and reports in SQLite, and never falls back to demo fixtures.

This is deliberately a **connected sandbox**, not a production automation system. It performs read-only evaluation only. It does not deploy, roll out, roll back, change traffic, write telemetry or connect to production data.

The repository-wide gate is not green because of pre-existing/shared baseline failures listed under “Known repository blockers”. Those failures are separated from the passing connected slice and were not rewritten as part of this change.

## Vision and boundary review

The three-cat convergence selected one runtime split:

- standalone `file://` remains fixture-only, network 0 and presentation-safe;
- connected Web/API uses SQLite as the authoritative store;
- observation sources are registered server-side and expose only bounded metadata to the browser;
- the default acceptance source is deterministic replay data, while an optional Prometheus adapter is configured only through server environment variables;
- source failure, stale/missing data or malformed responses fail closed as `unknown|failed`;
- no connected failure path imports or displays demo fixture results.

The runtime boundary is recorded in ADR-013. No new operator decision is required.

## Acceptance matrix

| AC | Evidence | Result |
|---|---|---|
| AC-C1 durable jobs/revisions, TTL=0 | schema V10 plus V11 integrity migration and store close/reopen acceptance in `inspection-store.test.js` and `inspection-connected-acceptance.test.js` | PASS |
| AC-C2 immutable revision binding | optimistic revision and original-case snapshot assertions in `inspection-store.test.js` | PASS |
| AC-C3 reusable job, disjoint case/run/evidence/report IDs | restart acceptance creates two cases from one job and reopens independent evidence | PASS |
| AC-C4 browser cannot author observations/verdict/source URL | strict route schemas and adversarial route tests; Run accepts only case, purpose and `Idempotency-Key` | PASS |
| AC-C5 server source drives deterministic results | replay evaluator boundary plus real Prometheus HTTP adapter tests | PASS |
| AC-C6 failures never become passed | missing/stale/partial/non-finite/future data, timeout, redirect, byte-budget and malformed payload tests | PASS |
| AC-C7 immutable traceable reports | SQLite immutability triggers and report provenance assertions | PASS |
| AC-C8 scoped reads/writes | required identity header and cross-user 404 tests | PASS |
| AC-C9 complete connected UI, no fixture fallback | component tests for API failure, empty source, source scope, persistence projection and fail-closed acceptance | PASS |
| AC-C10 standalone isolation | direct `file://` browser acceptance: network 0, console 0; static composition has no connected import | PASS with shared standalone drift noted below |

## Security and integrity closure

The final implementation includes the following review-driven protections:

- a report-sealed Case rejects any new Run at the store/service boundary;
- `accept` requires the Case's **latest**, terminal, `passed` Run, preventing an old green Run from bypassing newer risk evidence;
- latest-pass validation, accept Decision, report snapshot and Case sealing execute in one `BEGIN IMMEDIATE` transaction, so a failed report cannot leave a stray accept Decision;
- risk and unknown Runs cannot generate an accepted report, and the UI disables the action before the request;
- a Case permits only one active Run while preserving same-key idempotent replay; first-writer conflicts are resolved under an immediate transaction;
- startup reconciliation seals crash-left `running` Runs as `failed/unknown`, blocks their Cases and requires a new idempotency key;
- Job environment must equal the selected server-owned source `scope`; the browser displays it read-only, so an acceptance source cannot be mislabeled as production;
- source scope is revalidated again at revise/run time, closing server configuration drift after restart;
- source URLs and authorization remain server-only; safe metadata exposes only ID, kind, label and scope;
- Prometheus redirects are disabled, response bytes are bounded, one total deadline covers the whole multi-check Run, malformed scalar types fail closed, and upstream bodies/secrets are not reflected;
- replay observations bind check ID to the configured query; reusing an ID with a different query produces `error/unknown`, not a synthetic pass;
- relative checks are rejected unless the registered source explicitly declares baseline capability;
- terminal Runs reject both evidence mutation and new evidence insertion; parent-chain triggers bind Case↔revision, Decision↔Run/Case/owner and Report↔Case/revision;
- no DELETE route or TTL exists for user-visible inspection state.

Thanks to 山本 for identifying and closing the report-sealing, latest-pass and source-scope integrity paths before the fixed review commit.

## Verification evidence

### Focused automated gates

- `node --test packages/api/test/observability/*.test.js` — **51/51 pass**, 6 suites.
- focused Web Vitest (`inspection-api` + `inspection-operations-page`) — **17/17 pass**, 2 files.
- `pnpm --filter @cat-cafe/shared lint` — PASS.
- `pnpm --filter @cat-cafe/api lint` — PASS.
- `pnpm --filter @cat-cafe/web exec tsc --noEmit` — PASS.
- `pnpm --filter @cat-cafe/api build` — PASS.
- `pnpm --filter @cat-cafe/web build` with `NEXT_PUBLIC_API_URL=http://127.0.0.1:3114` — PASS; `/observability/inspections` is present in the production route table.
- scoped Biome over 25 owned files — exit 0, no errors and no fixes required; warnings are recorded below.
- `pnpm check:env-registry` — 3/3 PASS.
- `pnpm check:env-example` — 4/4 PASS.
- `pnpm check:env-ports` — 20 tests, 0 failures (plus tool-declared skips).
- `pnpm check:features` — PASS (`features=151`, `roadmap_active=41`).

### Connected production-browser dogfood

Isolated acceptance runtime:

- Web: `http://127.0.0.1:3113/observability/inspections`
- API: `http://127.0.0.1:3114`
- SQLite: `data/nova-preview/evidence.sqlite` (ignored local acceptance data)
- server source: `replay-acceptance`, scope `acceptance`

Recorded flow: create/reuse Job → create Case → execute server-owned Run → accept latest passed Run → reopen immutable report.

Latest production-browser result:

```json
{
  "connectedLabel": true,
  "fixtureLabelAbsent": true,
  "noRealObservationClaim": true,
  "reportVisible": true,
  "replayTransparent": true,
  "revisionTwoVisible": true,
  "runSealed": true,
  "scrollWidth": 960,
  "viewportWidth": 960,
  "errors": []
}
```

Ignored local evidence (not staged):

- `data/nova-preview/nova-connected-desktop.png`
- `data/nova-preview/nova-connected-mobile.png`
- `data/nova-preview/nova-connected-15s.gif`

Hub Browser Preview was reopened on the production page after the latest integrity changes.

Reviewer P2 browser retry acceptance injected a valid CORS-enabled `409 Inspection state conflict` for the first revision POST, then allowed the second request through to the real API:

```json
{
  "firstResponseStatus": 409,
  "afterConflict": {
    "connectionState": "ready",
    "alerts": ["Inspection state conflict"],
    "retryEnabled": true
  },
  "afterRetry": {
    "connectionState": "ready",
    "conflictCleared": true,
    "revisionTwoVisible": true,
    "retryEnabled": true
  },
  "unexpectedErrors": []
}
```

The browser emits its expected resource-load console entry for the deliberately injected 409; no unexpected console or page errors occurred. The conflict screenshot remains ignored at `data/nova-preview/nova-command-conflict-recoverable.png`.

### Standalone regression

Direct `node tests/standalone.browser.mjs` passed against the `file://` artifact with interaction exercised, network 0 and console 0. Connected source code is not imported by the standalone runtime.

## Dogfood findings fixed during this slice

- route validation initially accepted an HTML-pattern-incompatible service expression; the form and API contract were aligned;
- report acceptance initially left the Case rail stale until reload; the authoritative Case projection now refreshes immediately;
- new server environment variables were initially absent from registry/example governance; all three Prometheus settings are registered, server-only and non-runtime-editable, with authorization marked sensitive;
- report sealing, latest-pass enforcement and environment/source scope binding were added after adversarial review;
- a fresh-context scan found two false-green paths: coercible malformed Prometheus scalars and replay query-ID spoofing; both now fail closed with regression tests;
- the same scan found non-atomic accept, terminal evidence append, concurrent Runs, restart-left Runs and durable parent-chain gaps; schema V11 and the atomic store lifecycle close the whole failure mode family;
- persisted Jobs now expose owner-scoped current revision detail, so a Job with no Case can still create revision N+1 after a reload;
- the page identifies replay as “验收回放 / 服务端回放数据” with kind/scope and removes the ambiguous “真实观测” claim;
- the page now fails closed before Run/Accept rather than relying on hidden buttons or post-click errors.
- reviewer P2 found that recoverable command conflicts reused the boot-time connection error state and disabled every command; connection failures and command failures are now separate, and a browser-injected 409 can be retried successfully without reload.

## Architecture review

Ownership remains inside the existing cells:

- `packages/api`: observability domain, SQLite store, source ports/adapters, route composition;
- `packages/shared`: durable inspection contracts;
- `packages/web`: connected inspection projection and commands.

No architecture-map delta is required. Reviewer focus is requested on the new Store/Adapter seam and the composition additions in the shared API entrypoint.

No current NOVA `.pen` source exists; the only repository match is unrelated F070 setup-card design work. The parent NOVA feature also declares `tips_exempt` because this is an independent prototype/control-plane surface rather than a Console Guide Catalog capability.

Root artifact hygiene scan found no new media/design artifacts. Browser evidence remains under ignored `data/`.

## Known repository blockers and non-blocking debt

These prevent a truthful claim that the entire repository is green, but do not originate from the connected slice:

- repository-wide `pnpm check` is currently dominated by the existing CRLF/Biome baseline (previous run: 2,434 diagnostics across 1,943 files);
- `pnpm check:start-profile-isolation` has three existing Windows assertions that expect exit code `0` but receive `null`;
- the concurrently edited standalone area has two existing functional/build-identity drifts (a file-length limit and checked-in HTML not matching the local rebuild), while its direct browser contract still passes network 0 / console 0;
- the branch does not provide `check-hotfix-pattern.mjs`, `check-fallback-layers.mjs`, `check:architecture-ownership` or `check:capability-tips`; they were not fabricated as substitute evidence;
- `gh` is unavailable in this environment, so PR/cloud status was not claimed.

Scoped Biome emits no error but retains warnings in pre-existing API aggregation/migration functions. It also reports cognitive complexity in the new single-page connected UI. The latter is accepted as P3 refactor debt for a follow-up extraction after behavior/security review; it does not weaken the server-side invariants or test coverage.

The current recovery rule assumes one process-level `SqliteInspectionStore` owner. If multiple long-lived API instances later share the same SQLite file, restart reconciliation must move to a lease/heartbeat model so a new instance cannot classify another live owner's Run as interrupted.

`X-Cat-Cafe-User` remains a trusted local gateway identity header, not end-user authentication. The API is loopback-only in this connected sandbox; strong AuthN/AuthZ remains an explicit production-readiness prerequisite rather than an unclaimed property of this slice.

## Commit hygiene

The target worktree contains concurrent standalone design/evidence changes and historical review notes owned by other cats. This change will stage only the connected API/shared/Web/env files plus this quality report. No standalone source, screenshots, temporary SQLite data or unrelated review notes are included.

---

[丢丢/gpt-5.6-sol🐾]
