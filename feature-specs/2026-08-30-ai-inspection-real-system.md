---
feature_ids: [F257]
topics: [aiops, inspection, architecture, implementation-plan, production-integration]
doc_kind: plan
created: 2026-08-30
---

# AI Inspection Real System — Implementation Plan

## Goal

把已验收的 Copilot UX 连接到现有 NOVA Inspection 控制面和真实只读数据源。最终系统只有一份运行时状态：`InspectionWorkspace` 及其持久化对象；demo fixtures 只保留为测试输入。

## Existing Truth to Preserve

- `InspectionService` owns CandidateSet → Job/Revision → Case → Run/Decision/Report lifecycle.
- `SqliteInspectionStore` owns TTL=0 persistence, identity isolation, idempotency and immutable records.
- `ObservabilitySource` owns metric collection; `PrometheusObservabilitySource` already implements bounded, no-redirect, timeout-aware reads.
- `/api/observability/inspection-*` and `InspectionOperationsPage` already form a connected API/Web path.
- Production bootstrap currently registers only `replay-acceptance`; candidate/topology generation is static. Those are the integration gaps.

## State and Ownership Census

| Object | Current owner | v1 change |
|--------|---------------|-----------|
| CandidateSet | `SqliteInspectionStore` | add authoritative change/topology provenance and digests |
| Job/Revision | `SqliteInspectionStore` | no new store; retain immutable lineage |
| Case/Run/Decision/Report | `SqliteInspectionStore` | retain; add pre-run drift evidence |
| Metric observation | `ObservabilitySource` snapshot | compose real configured source |
| Change fact | currently request body | resolve through `ChangeSource`, persist normalized snapshot |
| Topology fact | static generator | resolve through `TopologySource`, persist normalized snapshot |
| UI workspace | connected Web projection | replace operations-form surface with validated Copilot journey without local business truth |

## Invariants

1. The browser never supplies authoritative change/topology facts.
2. A saved task never executes against silently drifted change/topology inputs.
3. Source failures never produce Pass and never activate replay implicitly.
4. A completed Run/Report is immutable and remains readable after restart.
5. AI copy may summarize locked evidence but cannot determine verdicts or invent facts.
6. Page, history, copy summary and export project the same report snapshot.

## Phase 0 — Architecture and contracts

### Red tests

- `ChangeSource` rejects malformed/oversized/redirected/unauthorized responses with bounded error codes.
- `TopologySource` returns explicit missing/partial/stale states with provenance.
- startup config does not register a half-configured source and never substitutes replay.
- candidate generation cannot accept client-authored authoritative facts on the real endpoint.

### Implementation

- Add `ports/ChangeSource.ts` and `ports/TopologySource.ts` with normalized snapshots, provenance, freshness and typed errors.
- Add configuration/registry composition separate from adapter logic.
- Keep `ObservabilitySource`; extend source metadata/health only where the real UI needs it.
- Add an inspection ownership cell when the ownership-map infrastructure reaches this branch; until then, keep the boundary explicit in this plan and module paths.

### Checkpoint

- Architecture continuity review before provider-specific adapters or UI migration.

## Phase 1 — Real source composition

### Red tests

- Prometheus is registered only with complete validated config.
- authorization is not logged or persisted.
- timeout, 401/403, redirect, oversize, multi-series and stale samples yield fail-closed outcomes.
- replay is available only under explicit acceptance scope.

### Implementation

- Compose existing `PrometheusObservabilitySource` from validated environment/config.
- Implement provider adapters against operator-supplied non-production contracts.
- Expose source capability/health metadata without exposing secrets.

### Blocker boundary

Internal ports, registry and failure semantics can be completed now. Provider adapter acceptance cannot be claimed until endpoint/auth/sample payloads and a safe test tenant are supplied.

## Phase 2 — Authoritative planning and drift guard

### Red tests

- real candidate generation resolves change/topology server-side and persists their digests.
- required coverage omissions block or require explicit waiver.
- direct-run succeeds with unchanged digests and blocks with a typed drift conflict when facts change.
- identity A cannot resolve, materialize or run identity B's objects.

### Implementation

- Introduce an async planning service around `InspectionCandidateGenerator`; generator remains deterministic over normalized inputs.
- Extend CandidateSet provenance with change/topology snapshots and catalog version.
- Re-resolve lightweight digests before run; return a comparison payload on drift.
- Preserve existing Job/Revision store and materialization contract.

## Phase 3 — Copilot Web projection

### Red tests

- no localStorage value can create or mutate an authoritative job/run/report.
- high-candidate, optional-candidate, conflict, missing, stale, partial and long-name states render correctly.
- saved-task direct run still passes through drift guard.
- current/history/copy/export use the same immutable Report ID and evidence anchors.
- 390px has no horizontal overflow.

### Implementation

- Move the validated dual-entry/five-stage UX into the connected inspections route.
- Reuse existing API functions and add only the planning/drift endpoints required by server truth.
- Treat browser storage as optional presentation preference only.
- Preserve Report V2 evidence discipline and readonly historical snapshots.

## Phase 4 — One-service real acceptance

- Use a non-production service and readonly credentials supplied by operator.
- Run first-visit planning, candidate adjudication, materialization, execution and report.
- Restart API and verify saved task, run history and immutable report recovery.
- Change an allowed test fact and verify drift blocks direct run.
- Revoke/disable a source and verify fail-closed unavailable/inconclusive UI.
- Record exact configuration shape and redacted provenance; never commit credentials or production payloads.

## Verification Matrix

| Layer | Command/evidence |
|------|------------------|
| Ports/adapters | focused API unit tests with adversarial HTTP fixtures |
| Store/lifecycle | existing observability suite + new restart/drift/identity tests |
| Web projection | component tests + real browser flow at desktop and 390px |
| Demo behavior | existing offline Copilot `check` remains green as UX regression oracle |
| Repository | `pnpm gate` with inherited `NODE_ENV` removed |
| Release | isolated merged-main acceptance; optional real-source smoke only with operator authorization |

## Review Sequence

1. Architecture continuity (reuse boundaries, ports, state ownership).
2. TDD implementation in `feat/ai-inspection-real`.
3. Siamese real-data UI continuity.
4. quality-gate → fresh-context-review → formal review → merge-gate.

## Open Inputs Needed

- Change/topology provider base URL and API schema.
- Authentication mechanism and secret delivery path.
- Metric provider URL, tenant/header requirements and approved query scope.
- One non-production service/change identifier and representative success/failure/stale samples.
