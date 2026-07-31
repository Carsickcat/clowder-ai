# NOVA Connected Inspection Control Plane Implementation Plan

**Feature:** NOVA Change Inspection Journey — connected sandbox continuation  
**Goal:** Deliver a persistent, reusable, read-only inspection control plane whose results come from an explicit server-side observability source, while preserving the reviewed offline demo unchanged.  
**Acceptance Criteria:** AC-C1 through AC-C10 below  
**Architecture cell:** `packages/api/domains/observability` + `packages/web/observability`  
**Map delta:** none  
**Map delta why:** This is a bounded domain inside the existing API/Web ownership cells and adds no new cross-process owner.  
**Architecture:** Fastify owns versioned inspection jobs, cases, runs, decisions, evidence provenance and reports in SQLite. A deterministic evaluator consumes a server-registered read-only source; the web UI sends commands and projects authoritative snapshots. The standalone composition remains fixture-only.  
**Tech Stack:** TypeScript, Fastify, Zod, better-sqlite3, React 18/Next.js, Prometheus-compatible HTTP API  
**前端验证:** Yes — Vitest component contracts plus connected browser acceptance; standalone `file://` regression remains mandatory

---

## Finish Line

At `/observability/inspections`, a user can create and save a reusable inspection job, start two
independent cases from the same immutable revision, execute read-only metric checks, and reopen
their durable results after reload. Each report traces back to the job revision, case, run, source,
query digest, observation timestamp and decision records. Missing or failed data is never passed.

The existing `NOVA-Ops-Intelligence-Standalone.html` still opens offline with network 0 and is
explicitly labelled demo data.

### What We Are Not Building

- No production deployment, rollout, rollback, traffic or Kubernetes mutation.
- No scheduler, cron, queue worker, lease or notification loop.
- No arbitrary connector URL/header/token supplied by a browser.
- No production telemetry access during development or acceptance.
- No LLM-owned execution result, automatic approval or natural-language-to-PromQL generation.
- No DELETE. Archive/disable is the only v1 retirement action.
- No claim of production readiness; identity headers provide current local user scoping, not final AuthN.

## Acceptance Criteria

- **AC-C1:** Created jobs and immutable revisions survive store close/reopen; all user-visible objects have no TTL.
- **AC-C2:** Revising a job creates revision N+1; existing cases remain bound to their original revision snapshot.
- **AC-C3:** Reusing one job twice produces distinct Case/Run/Evidence/Report IDs with no historical evidence copied.
- **AC-C4:** A Run accepts only `caseId`, `purpose` and `Idempotency-Key`; browser payload cannot supply source URL, observations, freshness or verdict.
- **AC-C5:** A server-registered source drives check results. Changed replay/Prometheus observations change the verdict explainably.
- **AC-C6:** Missing, stale, partial, timed-out, unauthorized or malformed source data persists `unknown|failed` and never `passed`.
- **AC-C7:** Reports are immutable snapshots and trace to revision, source, query digest, observedAt, window and check results.
- **AC-C8:** All reads/writes are scoped by trusted header identity; cross-user resources return 404 and mutations without identity return 401.
- **AC-C9:** Connected UI has loading/empty/ready/running/degraded/misconfigured/completed states and never imports or displays fixture jobs/results.
- **AC-C10:** Standalone demo remains byte-reproducible, network 0 and console 0; connected code is absent from its runtime composition.

## Terminal Schema

```ts
type InspectionVerdict = 'passed' | 'risk' | 'unknown';
type InspectionRunStatus = 'running' | 'completed' | 'failed';

interface InspectionJob {
  id: string;
  userId: string;
  name: string;
  service: string;
  environment: string;
  connectorRef: string;
  currentRevision: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InspectionJobRevision {
  id: string;
  jobId: string;
  revision: number;
  checks: readonly InspectionCheckDefinition[];
  createdBy: string;
  createdAt: string;
}

interface InspectionCase {
  id: string;
  userId: string;
  jobId: string;
  jobRevisionId: string;
  changeId: string;
  version: string;
  status: 'ready' | 'running' | 'blocked' | 'completed';
  createdAt: string;
  updatedAt: string;
}

interface InspectionRun {
  id: string;
  caseId: string;
  purpose: 'admission' | 'canary' | 'verification' | 'post_change';
  status: InspectionRunStatus;
  verdict: InspectionVerdict;
  sourceSnapshot: InspectionSourceSnapshot;
  checkResults: readonly InspectionCheckResult[];
  errorSummary: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface InspectionDecisionRecord {
  id: string;
  caseId: string;
  runId: string | null;
  kind: 'approve' | 'pause' | 'resume' | 'accept';
  actorId: string;
  note: string;
  createdAt: string;
}

interface InspectionReportSnapshot {
  id: string;
  caseId: string;
  jobRevisionId: string;
  runIds: readonly string[];
  decisionIds: readonly string[];
  verdict: InspectionVerdict;
  generatedAt: string;
}
```

## Stateful Object Gate

### Object Census

| Object | Lifecycle owner | Storage | Retention |
| --- | --- | --- | --- |
| `InspectionJob` | `SqliteInspectionStore` | `inspection_jobs` | TTL=0; archive only |
| `InspectionJobRevision` | `SqliteInspectionStore` | `inspection_job_revisions` | immutable, TTL=0 |
| `InspectionCase` | `InspectionService` | `inspection_cases` | TTL=0 |
| `InspectionRun` | `InspectionService` | `inspection_runs` | append-only after terminal |
| `InspectionCheckResult` | `InspectionService` | `inspection_check_results` | append-only |
| `InspectionDecisionRecord` | `InspectionService` | `inspection_decisions` | append-only |
| `InspectionReportSnapshot` | `InspectionService` | `inspection_reports` | immutable |
| `RunIdempotencyRecord` | `SqliteInspectionStore` | unique run key | same key → same run |
| `ObservabilitySource` | server composition root | runtime registry | no secret persistence |
| `ConnectedWorkspaceRequest` | web hook | React memory | derived request state only |

### State × Event Transitions

| Object/state | Event | Result |
| --- | --- | --- |
| no Job | `CREATE_JOB` | Job + revision 1 in one transaction |
| active Job rev N | `REVISE_JOB(expected=N)` | append revision N+1; update current pointer |
| active Job rev N | concurrent stale revision | 409; no revision appended |
| no Case | `START_CASE(jobId)` | Case bound to exact current revision snapshot |
| ready Case | `START_RUN(purpose,key)` | create one running Run; same key returns it |
| running Run | source success | append results; terminal completed; derive verdict/report |
| running Run | source failure/timeout/malformed | terminal failed + unknown; no passed report |
| stale running Run | server recovery | terminal failed/interrupted; retry needs a new key |
| terminal Run | any update | reject; append-only |
| any Case | `RECORD_DECISION` | append actor/time/note; no external action |
| connected booting | API success | ready/empty projection |
| connected booting/ready | API/source failure | degraded/misconfigured; no fixture fallback |

### Invariants

- **INV-C1:** Browser commands cannot author observations, timestamps, source URL, freshness or verdict.
- **INV-C2:** Job revision rows and terminal Run/Evidence/Decision/Report rows are never updated or deleted.
- **INV-C3:** A Case permanently binds one `jobRevisionId`; job revision changes do not mutate it.
- **INV-C4:** `(userId, caseId, idempotencyKey)` is unique.
- **INV-C5:** Every query is executed only by a server-registered `connectorRef`.
- **INV-C6:** Non-finite, missing, stale, partial or errored observations can only produce unknown/failed.
- **INV-C7:** Cross-user lookup returns not found; actor and time come from server context.
- **INV-C8:** A report contains only IDs from its Case and exact revision.
- **INV-C9:** Connected runtime has no import or runtime fallback path to demo fixtures.
- **INV-C10:** Standalone has no import or runtime path to connected API code.

### Adversarial Test Matrix

| Scenario | Proof |
| --- | --- |
| Same create/revise request races | OCC produces one next revision; loser gets 409 |
| Same run key sent concurrently/retried | one Run ID and one evidence set |
| Worker crashes after running insert | reopen marks stale Run interrupted/unknown |
| User submits endpoint/token/verdict/value | schema rejects unknown fields |
| Source redirects or returns oversized/malformed JSON | failed/unknown; secret absent from error |
| Source returns stale or no sample | completed/unknown or failed; never passed |
| User B guesses user A IDs | 404 without metadata leakage |
| Job archived while an old Case exists | new Case blocked; old Case/report remain readable |
| Connected API becomes unavailable | degraded state; fixture cards/results absent |
| Standalone rebuild | byte equality, network 0, console 0 |

## Implementation Tasks

### Task 1: RED — Shared Contract and SQLite State

**Files:**

- Create: `packages/shared/src/types/inspection.ts`
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/api/src/domains/memory/schema.ts`
- Create: `packages/api/src/domains/observability/SqliteInspectionStore.ts`
- Test: `packages/api/test/observability/inspection-store.test.js`

1. Add failing tests for AC-C1 through AC-C4, AC-C7, AC-C8 and INV-C2 through INV-C4.
2. Run `pnpm --filter @cat-cafe/api test -- inspection-store` and confirm missing store/schema failure.
3. Add schema V10, transactions, OCC, immutable terminal rows and idempotency.
4. Re-run focused tests; commit store vertical slice.

### Task 2: RED/GREEN — Deterministic Evaluator and Read-only Sources

**Files:**

- Create: `packages/api/src/domains/observability/ports/ObservabilitySource.ts`
- Create: `packages/api/src/domains/observability/InspectionEvaluator.ts`
- Create: `packages/api/src/domains/observability/adapters/ReplayObservabilitySource.ts`
- Create: `packages/api/src/domains/observability/adapters/PrometheusObservabilitySource.ts`
- Test: `packages/api/test/observability/inspection-evaluator.test.js`
- Test: `packages/api/test/observability/prometheus-source.test.js`

1. Add RED tests for threshold boundaries, stale/missing/NaN/partial data, timeout, non-2xx,
   redirect, malformed payload, response budget and secret redaction.
2. Implement an injected source port and pure evaluator. Prometheus uses server-fixed base URL,
   POST `/api/v1/query`, redirect error, bounded timeout and bounded response.
3. Replay source reads only its configured acceptance bundle; requests cannot select a path.
4. Run focused tests; commit source/evaluator slice.

### Task 3: RED/GREEN — Server-owned Service and API

**Files:**

- Create: `packages/api/src/domains/observability/InspectionService.ts`
- Create: `packages/api/src/routes/inspections.ts`
- Modify: `packages/api/src/routes/index.ts`
- Modify: `packages/api/src/index.ts`
- Test: `packages/api/test/observability/inspection-service.test.js`
- Test: `packages/api/test/observability/inspection-routes.test.js`

1. Add RED route tests for missing identity 401, cross-user 404, strict bodies, unknown connector
   503, idempotent Run, failed source persistence and server-authored actor/time/verdict.
2. Implement Job/revision/Case/Run/Decision routes with injected service/store/registry.
3. Register only environment-defined sources; never expose credentials.
4. Build and run focused API tests; commit API slice.

### Task 4: RED/GREEN — Connected Web Composition

**Files:**

- Create: `packages/web/src/app/observability/inspections/page.tsx`
- Create: `packages/web/src/components/observability/InspectionOperationsPage.tsx`
- Create: `packages/web/src/components/observability/InspectionOperationsPage.module.css`
- Create: `packages/web/src/utils/inspection-api.ts`
- Test: `packages/web/src/components/__tests__/inspection-operations-page.test.tsx`
- Test: `packages/web/src/utils/__tests__/inspection-api.test.ts`

1. Add RED contracts for loading/empty/ready/running/degraded/misconfigured/completed.
2. Prove API failures show no fixture jobs and disable Run.
3. Implement create/revise/start Case/start Run/record Decision/history flows via `apiFetch`.
4. Render source, observedAt, freshness, query digest and immutable report provenance.
5. Run focused web tests; commit connected UI.

### Task 5: Composition Boundary and Acceptance

**Files:**

- Modify only if required: `designs/nova-ops-observability-platform-v3/tests/experience-contract.test.mjs`
- Modify only if required: `designs/nova-ops-observability-platform-v3/tests/standalone.browser.mjs`
- Create: `packages/api/test/fixtures/observability/replay-passed.json`
- Create: `packages/api/test/fixtures/observability/replay-risk.json`
- Create: `review-notes/2026-07-31-nova-connected-inspection-quality-gate-sonnet.md`

1. Assert standalone composition has no connected imports and remains network 0.
2. Use temporary SQLite plus replay/fake source for a connected API/browser journey.
3. Create Job → reload → start two Cases → change replay observation → get different verdicts →
   reopen immutable reports.
4. Run:
   - `pnpm --filter @cat-cafe/shared build`
   - `pnpm --filter @cat-cafe/api test`
   - `pnpm --filter @cat-cafe/web test`
   - prototype `npm run check`
   - repository `pnpm check`
5. Commit only owned docs/source/tests; exclude existing reviewer-owned dirty evidence.
6. Run `quality-gate`, then request cross-family review of the final SHA.

