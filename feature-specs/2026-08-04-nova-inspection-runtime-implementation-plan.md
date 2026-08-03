# NOVA Inspection Runtime Implementation Plan

> Scope anchor: `feature-specs/2026-08-04-nova-inspection-runtime.md`

**Goal:** project the existing connected inspection domain through the accepted NOVA four-region workbench, while isolating durable inspection data and sealing explainable report intelligence.

**Architecture:** keep `InspectionService` and `SqliteInspectionStore` as the only domain write path. Open a dedicated SQLite database using the existing inspection schemas, compute report intelligence from frozen server-owned evidence, and render one `InspectionWorkspace` into task rail, decision surface, CLAW, and execution board. Do not introduce a second reducer or client domain store.

**Stack:** TypeScript, Fastify, better-sqlite3, React/Next.js, CSS Modules, Node test runner, Vitest/Testing Library, Playwright.

---

## Task 1: Isolate the inspection database

**Files:**
- Create: `packages/api/src/domains/observability/InspectionDatabase.ts`
- Create: `packages/api/test/observability/inspection-database.test.js`
- Modify: `packages/api/src/index.ts`

1. Write a failing test that opens a temporary dedicated inspection database and proves only inspection schema/state is present, TTL is absent, persistence survives reopen, and a memory/scheduler database is not required.
2. Run the focused test and record the expected missing-module failure.
3. Implement `openInspectionDatabase(dataRoot)` using `better-sqlite3`, the repository SQLite pragmas, and inspection-only schema installation.
4. Wire API startup to `<CAT_CAFE_DATA_DIR>/nova-inspection/inspection.sqlite`; close only this owned handle during shutdown.
5. Run focused API tests and verify the scheduler continues to use its existing database independently.

## Task 2: Seal five-dimensional report intelligence

**Files:**
- Modify: `packages/shared/src/types/inspection.ts`
- Modify: `packages/api/src/domains/memory/schema.ts`
- Create: `packages/api/src/domains/observability/InspectionReportIntelligence.ts`
- Modify: `packages/api/src/domains/observability/SqliteInspectionStore.ts`
- Modify: `packages/api/src/domains/observability/InspectionService.ts`
- Create or modify tests under: `packages/api/test/observability/`

1. Write failing tests for deterministic dimensions, exact weighted deductions, evidence references, versioned model metadata, immutable persistence, and restart reconstruction.
2. Add shared immutable report-intelligence types.
3. Add schema V13 `intelligence_json`, preserving the report immutability triggers and migration compatibility.
4. Compute intelligence from the accepted run, the full case run/decision lineage, candidate coverage, A/B report, and frozen assessment basis; never accept a browser score.
5. Insert report and intelligence atomically and deserialize it on every read.
6. Run focused store, service, schema, and route tests.

## Task 3: Refactor the connected workspace into one projection

**Files:**
- Modify: `packages/web/src/components/observability/InspectionOperationsPage.tsx`
- Create: `packages/web/src/components/observability/inspection-runtime/inspectionWorkspaceProjection.ts`
- Create: `packages/web/src/components/observability/inspection-runtime/useInspectionRuntimeWorkspace.ts`
- Create focused presentational components under: `packages/web/src/components/observability/inspection-runtime/`
- Modify: `packages/web/src/components/observability/InspectionOperationsPage.module.css`
- Modify: `packages/web/src/components/observability/inspection-operations-page.test.tsx`

1. Extend tests first for the accepted DOM regions, connected-only loading/error copy, server provenance, blocked/running/completed projections, report intelligence, and absence of fixture fallback.
2. Extract one runtime hook around the existing inspection API client. The hook owns transport/form state only and always reloads the authoritative workspace after a successful command.
3. Extract a pure projection from `InspectionWorkspace` to visual state. Task history, stage, next action, report, and CLAW share that projection.
4. Render the existing product route as:
   - `RuntimeHeader`
   - `InspectionTaskRail`
   - `InspectionDecisionSurface`
   - `InspectionClawPanel`
   - `InspectionExecutionBoard`
5. Preserve candidate generation, materialization, revision/case creation, run, decision, acceptance, and recovery flows.
6. Keep every production action absent; label replay execution as local development evidence collection.
7. Run focused web tests after each extraction.

## Task 4: Apply Kimi’s high-fidelity state and responsive gate

**Files:**
- Modify: `packages/web/src/components/observability/InspectionOperationsPage.module.css`
- Modify connected browser tests under: `packages/web/` or `designs/nova-ops-observability-platform-v3/tests/`

1. Add the top banner `DEV LOCAL · fixture-backed sources` and explicit source capture/scope/hash detail.
2. Implement loading, empty, partial, blocked, running, completed, and error states with the frozen Chinese copy.
3. At 1440px retain task/detail/CLAW columns plus the bottom execution board.
4. At 720px adapt without hiding current conclusion or next action.
5. At 390px order task → detail → CLAW → execution, keep the local primary action reachable, use ≥44px targets, and prevent horizontal overflow.
6. Verify keyboard focus, semantic status roles, reduced motion, and contrast.

## Task 5: Runtime and regression verification

**Files:**
- Modify test fixtures/scripts only where a reusable connected journey is required.
- Update: `feature-specs/2026-08-04-nova-inspection-runtime.md`

1. Install frozen dependencies with `NODE_ENV=test` in the isolated worktree.
2. Run focused shared/API/web suites, type checks, lint, and dependency checks.
3. Re-run the standalone `npm run check` to preserve its 61 contracts and offline `file://` journeys.
4. Start the worktree with a safe negative `WORKTREE_PORT_OFFSET` and isolated `CAT_CAFE_DATA_DIR`; never use the live Cat Café ports or production stores.
5. Exercise the connected golden path in a real browser, refresh, restart, and re-open the accepted report.
6. Capture 1440, 720, and 390 evidence plus loading/error/blocked/completed states; require zero console errors and no unexpected network requests.
7. Mark every AC with its exact test or browser evidence.

## Task 6: Independent review, merge, and merged-commit acceptance

1. Run the repository quality gate and create an exact-head review packet.
2. Request cross-individual code/security review; resolve every P1/P2 with red-to-green evidence.
3. Run PR/CI/remote review truth checks, then merge only after all gates pass.
4. In a new detached acceptance environment, run the same connected journey against the merged commit and verify persistent state remains isolated.
5. Deliver the run command, URL, mobile-readable artifact/evidence, exact commit, and explicit production-boundary statement to the operator.
