---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [aiops, inspection, run-history, report-sharing, review-request]
doc_kind: review_request
created: 2026-08-23
---

# Review Request: AI Inspection Run History & Sharing

Review-Target-ID: ai-inspection-run-history
Branch: `feat/ai-inspection-run-history`

## What

- Saved-inspection cards derive a recent-run status strip from the immutable Run ledger.
- A saved inspection now has a newest-first history page with expandable, read-only report snapshots.
- Current saved runs compare structured execution results with the preceding run and collapse an unchanged result set.
- Current reports copy an exact five-line summary and export an escaped, self-contained offline HTML document.
- Storage hydration rejects individual malformed runs while preserving valid definitions, valid history, and direct-run ability.
- The standalone UI has real Chrome coverage at desktop and 390px widths.

## Why

The accepted dual-entry demo stopped at a one-click saved task. Returning operators need accumulated evidence: what ran, what changed, whether the current result improved, and how to share the current conclusion without mutating history or requiring a network connection.

## Original Requirements

> “主要基于定义的用户旅程，做一下 UI 的改版优化，然后和 sol 一起讨论下，由 sol 进行主要编码，完成这版的方案。记得一定不要脚手架。”
>
> The V2 journey requires saved-task history, run comparison, current-report sharing, corrupt-history degradation, and a complete mobile state rather than placeholder screens.

- Sources: operator message `0001787460505650-000434-73c4702d`; `designs/ai-inspection-copilot-offline-demo/DESIGN-V2-RUN-HISTORY.md`
- Please judge whether the delivered product resolves this operator experience, not only whether the tests pass.

## Tradeoff

- `SavedInspectionDefinition` remains immutable and has no persisted `runs[]`; history is selector-derived from the canonical Run ledger.
- New runs snapshot structured `executionResults[]`; legacy runs remain readable but do not receive invented item-level comparison.
- Historical snapshots cannot be shared or saved. Only the current locked report exposes copy/export controls, preventing stale evidence from being redistributed as current truth.
- One invalid run degrades history without blocking direct execution; an invalid library envelope still fails closed.

## Architecture Ownership

Architecture cell: AI inspection offline demo / standalone product artifact

Map delta: none

Why: the change extends the existing reducer, immutable local library, selectors, renderers, and browser adapter without adding another Store, Queue, Router, Adapter, Dispatcher, Binding, or production boundary.

Please check that the diff matches this ownership claim and does not create a parallel source of truth.

## Open Questions

### Technical OQ

1. Does the optional-compatible `executionResults[]` validation keep old persisted runs readable without weakening new-run audit integrity?
2. Does the partial-run recovery boundary retain all usable records without allowing malformed state into direct execution or sharing?
3. Are clipboard/export side effects correctly contained at the browser adapter while pure serialization remains escaped and deterministic?
4. Does the comparison classification preserve true structural changes while collapsing only genuinely stable results?

### Value OQ

None. The operator-approved V2 product scope and design terminal review are closed.

## Next Action

Independently review the current remote exact HEAD in a detached/read-only sandbox. Return `APPROVE — <exact SHA>` or `REQUEST CHANGES` with reproducible P1/P2 evidence. Do not inherit the author quality-gate or the design approval as a code verdict.

## Review Sandbox

- Logical path: `/tmp/cat-cafe-review/ai-inspection-run-history/opus`
- Windows equivalent: `E:\ClowderAI\cat-cafe-review-ai-inspection-run-history-opus`
- Product validation: `pnpm --dir designs/ai-inspection-copilot-offline-demo check`
- Browser preview: `python -m http.server 4179 --bind 127.0.0.1 --directory designs/ai-inspection-copilot-offline-demo`
- Ports: `web=4179`, `api=none` (standalone offline artifact)

### Sandbox Bootstrap

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
```

On Windows PowerShell, clear inherited production mode with `$env:NODE_ENV = 'development'`. Git Bash must be on `PATH` for the repository gate.

## Self-check Evidence

### Spec compliance

- AC-V1 through AC-V8: met with no waiver or deleted acceptance criterion.
- Design terminal review: `DESIGN APPROVE — 8467f22` from Kimi on desktop/mobile visual evidence.
- Quality report: `review-notes/2026-08-23-ai-inspection-run-history-quality-gate.md`.
- Root artifact hygiene: clean; evidence is stored under the product's formal `evidence/` directory.

### Test results

```bash
pnpm --dir designs/ai-inspection-copilot-offline-demo check
# 81/81; offline Chrome 0 HTTP(S) requests, 0 browser errors

pnpm check
pnpm lint
pnpm build
# exit 0

pnpm gate
# Status: passed; exact code HEAD 8467f22603e39a95c2d6e1a03da8deaa1cd1da84

git diff --check
# exit 0
```

### Visual evidence

- `designs/ai-inspection-copilot-offline-demo/evidence/16-run-comparison-and-share.png`
- `designs/ai-inspection-copilot-offline-demo/evidence/17-saved-inspection-history.png`
- `designs/ai-inspection-copilot-offline-demo/evidence/18-mobile-run-history.png`

### Related documents

- Plan: `feature-specs/2026-08-23-ai-inspection-run-history-sharing.md`
- Design: `designs/ai-inspection-copilot-offline-demo/DESIGN-V2-RUN-HISTORY.md`
- Quality gate: `review-notes/2026-08-23-ai-inspection-run-history-quality-gate.md`
