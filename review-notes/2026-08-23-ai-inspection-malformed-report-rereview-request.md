---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [aiops, inspection, run-history, persistence-boundary, rereview-request]
doc_kind: review_request
created: 2026-08-23
---

# Targeted Re-review: malformed Run report isolation

Review-Target-ID: ai-inspection-run-history
Branch: `feat/ai-inspection-dual-entry`
Baseline reviewed SHA: `b46a1253d9741134c66febfbacb491d816a81c61`
Repair commits: `5af3dc7d84c400f963b3cb0d2aa10ccca422e285`, `3d7f3394671eb82119fcab57cd1873424fc63502`

## What

- Persisted Run validation now requires the renderer-safe report contract instead of accepting any object-valued `report`.
- An otherwise valid Run whose report is malformed is rejected individually; its saved Definition remains visible and directly runnable.
- Both persisted-data entry paths—startup hydration and cross-tab storage-event merge—preserve degraded diagnostics for the UI.
- Journey, storage-adapter, and real offline-Chrome regressions cover the original `report: {}` reproduction and the follow-up storage-event path.

## Why

The reviewed SHA allowed `report: {}` through hydration and then crashed while rendering historical evidence. The first repair closed that trust-boundary mismatch. A fresh-context scan then found the same failure mode at the second ingestion path: cross-tab merge quarantined the bad Run but discarded its diagnostics. Both paths must expose truthful degraded history without blocking the saved task's normal execution.

## Original Requirements

> “主要基于定义的用户旅程，做一下 UI 的改版优化，然后和 sol 一起讨论下，由 sol 进行主要编码，完成这版的方案。记得一定不要脚手架。”
>
> V2 AC-V5 / INV-V6: damaged history degrades safely while the saved Definition remains directly runnable.

- Sources: operator message `0001787460505650-000434-73c4702d`; `designs/ai-inspection-copilot-offline-demo/DESIGN-V2-RUN-HISTORY.md`.
- Please judge the recovery behavior at both trust boundaries, not only the validator in isolation.

## Tradeoff

- The report contract is centralized beside the existing report vocabulary in `lib/domain.mjs`; no renderer fallback or parallel schema was added.
- `executionResults` remains optional at hydration so legitimate legacy Run snapshots stay readable.
- Cross-tab merge now returns `{ library, diagnostics }` instead of only a library. This is an internal adapter contract used by `app.mjs`; it keeps diagnostic state transient and out of persisted user data.
- Invalid Run records are omitted rather than partially rendered. Valid Definitions, valid Runs, and direct execution remain available.

## Architecture Ownership

Architecture cell: AI inspection offline demo / standalone product artifact

Map delta: existing Domain contract and browser Storage Adapter only

Why: the change aligns the existing compiler, persistence validator, historical renderer, and two browser ingestion paths. It adds no Store, Queue, Router, Dispatcher, Binding, production boundary, or second source of truth.

Please verify the application search contains no third persisted-report ingestion path and that diagnostics never enter the serialized library.

## Open Questions

### Technical OQ

1. Does `validReportContract()` exactly cover fields dereferenced by history and sharing while retaining the intended legacy `executionResults` compatibility?
2. Does storage-event merge preserve its sanitized union and degraded diagnostics without losing valid concurrent records?
3. Do both recovery paths keep the Definition runnable and the history surface non-throwing?

### Value OQ

None. This request is limited to Terra's P1 and the fresh-context finding discovered while closing it.

## Next Action

Independently inspect the remote exact HEAD in a detached/read-only sandbox. Re-run the original `report: {}` reproduction and the cross-tab storage-event variant. Return `APPROVE — <exact SHA>` or `REQUEST CHANGES` with reproducible P1/P2 evidence.

## Review Sandbox

- Logical path: `/tmp/cat-cafe-review/ai-inspection-run-history/opus`
- Windows equivalent: `E:\ClowderAI\cat-cafe-review-ai-inspection-run-history-opus`
- Product validation: `pnpm --dir designs/ai-inspection-copilot-offline-demo check`
- Browser mode: standalone `file://` artifact; API port `none`

### Sandbox Bootstrap

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
```

On Windows PowerShell, clear inherited production mode with `$env:NODE_ENV = 'development'`. Git Bash must be on `PATH` for the repository gate.

## Self-check Evidence

### Red → Green

- Original Red: journey suite → 22 passed, 1 expected failure because `report: {}` remained `available` and retained.
- Original Green: journey suite → 23/23 passed after canonical report validation.
- Fresh-context Red: storage suite → 4 passed, 2 expected failures because merge returned no diagnostics.
- Fresh-context Green: storage + journey suites → 29/29 passed after preserving merge diagnostics.

### Exact product and repository gates

```bash
pnpm --dir designs/ai-inspection-copilot-offline-demo check
# 83/83; offline Chrome 0 HTTP(S) requests, 0 browser errors

pnpm gate
# Status: passed; exact code HEAD 3d7f3394671eb82119fcab57cd1873424fc63502

git diff --check
# exit 0
```

The repository gate includes Biome, feature truth, environment checks, lint, build, platform smoke, and startup acceptance. Existing unrelated lint warnings remain non-blocking.

### Fresh-context result

- Scan target: `5af3dc7`.
- Finding: `src/storage.mjs::merge()` used the diagnostics-dropping parser, so `app.mjs` could not render degraded cross-tab history.
- Resolution: fixed in `3d7f339`, with adapter and real `StorageEvent` coverage.

### Related documents

- Design: `designs/ai-inspection-copilot-offline-demo/DESIGN-V2-RUN-HISTORY.md`
- Bug report: `docs/bug-report/ai-inspection-malformed-run-report/bug-report.md`
- Targeted quality gate: `review-notes/2026-08-23-ai-inspection-malformed-report-quality-gate.md`

[丢丢/gpt-5.6-sol🐾]
