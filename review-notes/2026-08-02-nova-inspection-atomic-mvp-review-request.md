# Review Request: NOVA Change Inspection Atomic MVP

Review-Target-ID: `nova-inspection-atomic-mvp`

Branch: `feat/nova-inspection-atomic-mvp`

Behavioral SHA: `e69efb0e1726f6062824caed3ac3c960b89a728d`

Behavioral range: `fbaa6089b264e8b8467e539e979871ee4657d2fa..e69efb0e1726f6062824caed3ac3c960b89a728d`

## What

This slice extends the connected inspection control plane into the atomic product journey approved by the co-creator:

- natural-language and confirmed change context generate an immutable, explainable CandidateSet;
- required/recommended candidates, topology provenance and `COVERAGE_OMISSION` are visible and reviewable;
- candidate selections materialize a durable Job and immutable Revision, with required-item waivers persisted in origin;
- one Case executes server-owned admission/canary/verification/post-change Runs and deterministic StageReports;
- admission and latest post-change evidence project a fail-closed Final A/B report;
- grounded assessment separates machine verdict, coverage, A/B comparability and human decision readiness;
- the existing connected page is recomposed into one pre/during/post-change journey without controlling rollout.

## Why

The previous connected slice proved durable Jobs, Cases, evidence and reports, but still started after an SRE had manually invented the checks. The co-creator asked us to reason from both product atoms and the complete change-inspection journey: generate checks from change intent, topology/change context and reusable history; let SREs adjust them; run before/during/after the change; compare pre/post evidence; and use AI-shaped interpretation to explain risk instead of merely listing metrics.

This implementation provides the smallest connected evidence contract that can demonstrate that loop without pretending a deterministic interpreter is a deployed model or widening into production automation.

## Original Requirements

> 1. Start the deck with a user sequence for pre-change, during-change and post-change inspection.
> 2. Derive inspection candidates from natural-language intent, service knowledge/topology, change context and reusable historical tasks.
> 3. Let an SRE review and adjust candidates, then organize the selected checks into an inspection workflow/task.
> 4. Generate stage reports from inspection evidence and compare the post-change result with the pre-change baseline.
> 5. Make report scoring/interpretation the main AI value: explain abnormalities, root-cause hypotheses and risk without reducing everything to a misleading green score.
> 6. For every atomic capability, state its inputs, outputs, value and failure handling.
> 7. After the PPT, build a minimal runnable system without waiting for further operator confirmation.

Source: co-creator messages in `thread_mrrzdymcf3z6bx77` on 2026-08-01; the converged product source is the companion deck's `NOVA-Inspection-Product-Next-lofi.md`.

**Please judge the diff against this operator experience, not only against its internal type/API consistency.**

## Tradeoffs and boundaries

- The runnable generator uses a deterministic server-side catalog and one acceptance topology example; it does not claim live knowledge-graph, electronic change-flow or LLM integration.
- CandidateSets are immutable snapshots. Manual adjustment happens by selecting candidates and recording required waivers when materializing a Revision.
- StageReport, A/B and Assessment are projections of immutable Runs rather than additional mutable stores.
- A/B compares the first admission Run with the latest post-change Run in the same Case. Missing Runs are explicit; query/source drift, unusable evidence or a baseline that did not finish before the current Run began fails comparability closed.
- A post-change Run completes its Case only when it passed and persisted evidence projects a valid A/B report. Otherwise the Case is blocked but remains recoverable.
- Replay is explicit acceptance data. No production telemetry or production action plane is connected.
- Human accept/hold/waive remains distinct from machine pass/risk/unknown and is not inferred by the interpreter.

## Architecture Ownership

Architecture cell: `observability / inspection control plane` across shared contracts, API observability domain, SQLite inspection store and Web observability surface

Map delta: `update required when this isolated prototype is promoted into the product capability catalog`

Why: this slice adds `InspectionCandidateSet` upstream of the existing Job/Revision/Case/Run chain and adds deterministic StageReport/A/B/Assessment projections without creating a parallel evidence Store, Queue, Router, Adapter or Dispatcher.

Please verify that:

- `SqliteInspectionStore` remains the only mutable inspection truth source;
- `InspectionCandidateGenerator` cannot invent executable evidence or bypass server-owned connector scope;
- `InspectionAssessment` cannot rewrite verdicts or manufacture A/B comparability;
- schema V12 migration/immutability and Revision origin stay compatible with existing V10/V11 databases;
- Web commands never accept observations, source identities or verdicts from the browser;
- the declared map delta matches the actual ownership change.

## Open Questions

### Technical OQ for reviewer

1. Is A/B comparability sufficiently fail-closed for missing Runs/results, query-digest drift, source mismatch, invalid run ordering, failed Runs and partial evidence?
2. Can crafted waiver/candidate selections bypass required coverage or cause an untrusted check definition to reach execution?
3. Does V12 migration remain safe for fresh databases and all supported V10/V11 upgrade paths, including candidate immutability and nullable origin for legacy/manual Revisions?
4. Does assessment preserve the semantic separation among machine verdict, `COVERAGE_OMISSION`, A/B comparability and human decision readiness in every terminal state?
5. Does the large existing page need journey extraction before this prototype is promoted, or is its current component complexity non-blocking for this review?

### Value OQ for operator

None. The co-creator already authorized the product sequence and autonomous minimal implementation. No technical A/B is being returned as a product decision.

## Fresh-Context Findings

An independent no-context finding-generator scanned `fbaa608..7177858` and reported **0 P1 / 4 P2**. None were dismissed:

| Finding | Disposition in `e69efb0` |
|---|---|
| FC-1: post-change acceptance could bypass blocked Assessment in both UI and direct store calls | fixed with fail-closed UI readiness and an authoritative SQLite transaction guard; direct bypass regression added |
| FC-2: required candidates omitted under waiver still projected complete coverage | fixed by projecting Revision-origin waivers as coverage omissions, `review_required` and `REQUIRED_CANDIDATE_WAIVED` unknowns |
| FC-3: missing admission/current Runs hid A/B as null | fixed with explicit unavailable reports, nullable Run IDs and bounded reason codes |
| FC-4: UI omitted grounded hypotheses | fixed by rendering hypotheses with the other assessment layers |

Browser recovery testing then found and closed two adjacent integrity gaps: baseline time ordering is now enforced, and an invalid post-change result leaves the Case blocked/recoverable rather than prematurely completed.

## Self-check evidence

- Quality report: `review-notes/2026-08-02-nova-inspection-atomic-mvp-quality-gate-sonnet.md`
- Plan/state census: `feature-specs/2026-08-02-nova-inspection-atomic-mvp.md`
- observability API tests: **64 passed, 0 failed, 10 suites**
- focused Web tests: **23 passed, 0 failed, 2 files**
- complete Web package test: PASS
- root lint: exit 0
- shared/API/MCP/Web production build: PASS
- feature/env/profile isolation checks: PASS (profile check with installed Git Bash on PATH)
- scoped Biome for all changed implementation/test files: no errors; two pre-existing connected-page complexity warnings remain
- directory-size check: PASS; observability domain has 5 files
- browser: direct post-change -> explicit missing-baseline A/B + blocked Case + disabled accept; admission -> new post-change -> Final A/B `valid` -> immutable report; console errors 0
- root media/design artifact gate: empty

Repository-wide baseline limitations (`pnpm test` Windows script syntax, preview-gateway handle, CRLF-wide Biome check and missing dependency-cruiser config) are fully enumerated in the quality report and are not represented as green.

## Review sandbox

- Suggested path: `E:/ClowderAI/review-sandboxes/nova-inspection-atomic-mvp/opus`
- Suggested isolated ports: `web=3213`, `api=3214`, `redis=6368`
- Start command: `pnpm review:start` or the Windows-equivalent isolated profile entry; record actual allocated ports in the verdict

## Next action

Please perform a formal cross-individual review of the final request HEAD and give an explicit `APPROVE` or `REQUEST CHANGES`. Every finding must carry P1/P2/P3 severity. Re-run the highest-risk API tests independently rather than relying only on author evidence.

---

[丢丢/gpt-5.6-sol🐾]
