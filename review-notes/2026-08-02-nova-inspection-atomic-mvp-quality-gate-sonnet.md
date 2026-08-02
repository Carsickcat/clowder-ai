# NOVA Change Inspection Atomic MVP — Quality Gate

**Date:** 2026-08-02

**Author:** 丢丢 / gpt-5.6-sol

**Branch:** `feat/nova-inspection-atomic-mvp`

**Base:** `fbaa6089b264e8b8467e539e979871ee4657d2fa` (`origin/feat/aiops-observability-platform-hifi-v3`)

**Truth sources:**

- `feature-specs/2026-08-02-nova-inspection-atomic-mvp.md`
- `NOVA-Inspection-Product-Next-lofi.md` in the companion product-deck worktree
- co-creator direction: organize the product by pre/during/post-change journey and atomic capability inputs, outputs and value

## Verdict

**Scoped atomic slice: PASS, ready for cross-individual review.**

The runnable system now demonstrates one connected, persisted path:

`ChangeContext -> CandidateSet -> Playbook Revision -> Case -> admission/post-change Runs -> StageReports -> Final A/B -> Assessment`

This is a read-only acceptance system. It cannot deploy, roll out, change traffic, roll back, approve a release, write telemetry or access production data. Machine verdict, evidence coverage, A/B comparability and human decision readiness remain separate.

## Product requirement mapping

| Requested capability | Implemented input | Implemented output | Value / invariant | Result |
|---|---|---|---|---|
| inspection-item generation | confirmed natural-language intent, service, change ID, version, server connector scope, deterministic topology/rule catalog | immutable `InspectionCandidateSet` with required/recommended priorities, reasons, EvidenceRefs and coverage omissions | unknown services do not receive invented dependencies; missing signal mapping is `COVERAGE_OMISSION`, not a green or `UNKNOWN` check | PASS |
| inspection orchestration | selected candidate IDs plus required-item waivers | durable Job and immutable Revision with candidate origin | browser cannot alter check queries, priorities, verdicts or evidence; deleting a required candidate needs a non-empty waiver | PASS |
| stage execution/report | Case, server-owned purpose and idempotency key | immutable Run evidence and deterministic StageReport | NOVA observes stages only; missing/stale/source-failed evidence fails closed | PASS |
| pre/post comparison | first admission Run and latest post-change Run in the same Case | `InspectionABReport` with per-check values, deltas, EvidenceRefs and `valid/partial/unavailable` | source/query drift, missing results or unusable evidence block comparability without rewriting either Run verdict | PASS |
| report interpretation | latest immutable Run, candidate coverage and A/B report | facts, hypotheses, unknowns, recommendation and decision readiness | rules own verdict; coverage omission remains an unclosed risk; invalid A/B blocks post-change readiness | PASS |
| user journey | one connected screen | intent composer, candidate review, Revision/Case creation, stage Run controls, A/B and assessment | pre/during/post stages are visible without turning NOVA into a rollout controller | PASS |

## State and security closure

- schema V12 adds immutable, user-scoped candidate sets with no TTL or delete path;
- every materialized Revision records its candidate-set origin, selected candidates and required waivers;
- connector identity and environment scope are resolved and revalidated server-side;
- generation and materialization routes use strict bounded schemas and reject browser-authored evidence/verdict fields;
- A/B is a deterministic projection of persisted Runs, not a mutable second evidence store;
- missing baseline/current Runs now produce an explicit `unavailable` A/B report instead of a hidden null state;
- A/B query-digest/source mismatch, unusable evidence or a baseline that did not finish before the post-change Run began yields `unavailable`, and post-change decision readiness becomes `blocked`;
- the SQLite accept transaction independently rejects a post-change pass unless persisted Runs project a `valid` A/B report; browser state cannot bypass it;
- a post-change Run completes its Case only when the Run passed and A/B is valid; otherwise the Case becomes `blocked` and remains recoverable;
- required-item waivers project as explicit coverage omissions and `REQUIRED_CANDIDATE_WAIVED` unknowns, never complete coverage;
- `COVERAGE_OMISSION` never changes the in-scope machine verdict and never counts as healthy coverage;
- candidate sets, Jobs, Revisions, Cases, Runs, evidence and reports remain owner-scoped and durable;
- no production connector, external change system, free-form DAG or generative-model dependency was added.

## Verification evidence

### Fresh-context closure

An independent fresh-context scan of behavioral SHA `7177858` reported 0 P1 and 4 P2 findings. All four were accepted and closed before formal review:

| Finding | Closure |
|---|---|
| FC-1: UI and store could accept a post-change pass while Assessment was blocked by missing A/B | fail-closed UI guard plus authoritative SQLite transaction guard; direct-store bypass regression added |
| FC-2: a waived required candidate did not affect coverage projection | Revision origin waivers now produce `coverageStatus=omission`, `review_required` and an evidence-linked unknown |
| FC-3: missing admission/current Runs hid A/B as null | explicit unavailable A/B snapshot with nullable Run IDs and a bounded missing-run reason |
| FC-4: grounded hypotheses were projected but omitted by the UI | hypotheses are rendered alongside facts, unknowns and recommendations |

Browser recovery testing then exposed two adjacent decision-integrity gaps, also closed: baseline time ordering is now enforced, and an invalid post-change comparison leaves the Case blocked/recoverable instead of prematurely completed.

### Automated gates

- red test evidence: `inspection-ab-report.test.js` initially failed because `projectInspectionABReport` did not exist; green implementation then passed both valid comparison and query-digest mismatch cases.
- `pnpm --filter @cat-cafe/api build` — PASS.
- `node --test packages/api/test/observability/*.test.js` (run from `packages/api`) — **64/64 pass**, 10 suites.
- focused Web Vitest (`inspection-api` + `inspection-operations-page`) — **23/23 pass**, 2 files.
- `pnpm --filter @cat-cafe/web test` — PASS for the complete Web suite and hardcoded-color rule test.
- `pnpm lint` — exit 0 across shared/API/MCP/Web; repository baseline warnings remain outside this slice.
- `pnpm -r --if-present run build` — PASS across shared/API/MCP/Web.
- production route table includes `/observability/inspections` at **8.71 kB**, first load **98.3 kB**.
- scoped Biome over the changed implementation and test files — exit 0; only the pre-existing large-page complexity warnings remain.
- `pnpm check:features` — PASS (`features=151`, `roadmap_active=41`).
- `pnpm check:env-ports` — 20 tests, 0 failures.
- `pnpm check:env-registry` — 3/3 pass.
- `pnpm check:env-example` — 4/4 pass.
- `pnpm check:start-profile-isolation` with installed Git Bash on PATH — 3/3 pass.
- `check-dir-size.sh` via installed Git Bash — exit 0; observability domain is 5 files.
- `git diff --check` — PASS.

### Browser dogfood

Isolated runtime:

- Web: `http://localhost:5172/observability/inspections`
- API: `http://localhost:3172`
- Redis: `127.0.0.1:6328`
- connector: `replay-acceptance`, scope `acceptance`

Headless system Chrome executed the actual UI flow:

1. generate candidates;
2. inspect `COVERAGE_OMISSION`;
3. materialize Revision and create Case;
4. execute post-change without a baseline and verify explicit unavailable A/B, blocked Case and disabled acceptance;
5. execute admission, then a new post-change Run;
6. verify Final A/B becomes valid, record human acceptance and reopen the immutable report.

Observed result:

```json
{
  "title": "变更巡检决策工作台",
  "missingBaseline": {
    "abComparability": "unavailable",
    "reason": "missing_baseline_run",
    "caseStatus": "blocked",
    "acceptDisabled": true
  },
  "abComparability": "valid",
  "abChecks": [
    "availability 0.999 -> 0.999, delta 0",
    "latency 184 -> 184, delta 0",
    "error-rate 0.002 -> 0.002, delta 0"
  ],
  "machineVerdict": "passed",
  "coverageStatus": "omission",
  "decisionReadiness": "review_required",
  "consoleErrors": []
}
```

All generation/materialization/Case/Run commands returned their expected 201 responses and workspace reads returned 200. CORS preflights returned expected 204 responses. The visual evidence remains ignored outside Git at:

- `C:/Users/myh_1/AppData/Local/Temp/nova-inspection-ab-unavailable.png`
- `C:/Users/myh_1/AppData/Local/Temp/nova-inspection-ab-valid.png`
- `C:/Users/myh_1/AppData/Local/Temp/nova-inspection-ab-desktop.png`
- earlier desktop/mobile evidence under the same temporary directory

Hub Browser Preview was opened on the isolated route after browser acceptance.

## PPT companion deliverable

The companion product deck is committed independently on `feat/nova-inspection-product-deck` at `7b8e0a9823db80ac475d92ea862f6087a7eeb238`:

- `NOVA-Change-Inspection-Product-vNext.pptx` — 8 slides, SHA256 `DA391EE979EF5327FB3C5ECBC83313A6BE687EBB6049B53ED4FE3DA3F8179B8E`
- `NOVA-Change-Inspection-Product-vNext.pdf` — SHA256 `E57BD694487787C5F61B7BA45638CDC06FD3E5F66CA2302C2EC774FD57532C7B`
- low-fidelity source and reproducible build script live beside the exports

PowerPoint COM reopened the deck successfully and verified one full-slide visual per each of 8 slides.

## Architecture and artifact review

Ownership stays in the existing inspection control-plane cell:

- shared: durable contracts;
- API observability domain: generation, projections and service invariants;
- SQLite inspection store/schema: immutable persistence;
- Web inspection route: connected projection and bounded commands.

The architecture map needs an update only if this isolated prototype is promoted into the product capability catalog. No NOVA `.pen` source exists. No screenshots, SQLite files, generated browser profiles, media or build outputs are staged. No changed file exceeds 5 MB.

## Known repository blockers and non-blocking warnings

These prevent claiming that every root script is green, but they do not originate from this slice:

- root `pnpm test` invokes the API script with POSIX `VAR=1 command` syntax, which Windows `cmd.exe` rejects before tests start; direct Windows-equivalent observability tests pass 64/64;
- a direct full API test run advances to the existing `domains/preview/preview-gateway.test.js` child and leaves a process handle open beyond its declared 60-second timeout; the exact test process was stopped after isolation evidence, while the changed observability suite completed independently;
- root `pnpm check` reports 1,800+ formatter errors because committed CRLF files across the repository conflict with the current Biome formatter expectation; scoped changed files are clean;
- `pnpm check:deps` references a missing root `.dependency-cruiser.cjs`, so dependency-cruiser cannot start;
- `pnpm check:dir-size` and profile isolation require Git Bash to be placed on PATH on Windows; both pass when invoked with the installed Git Bash;
- Biome retains complexity warnings in the pre-existing migration aggregator and large connected inspection page. The assessment/A/B projection remains below the warning threshold after helper extraction. Reviewer focus is requested on whether the journey view should be extracted before promotion beyond this prototype.

The exclusions in the plan are terminal safety/product boundaries authorized by the request for a minimal runnable system, not deferred completion claims.

---

[丢丢/gpt-5.6-sol🐾]
