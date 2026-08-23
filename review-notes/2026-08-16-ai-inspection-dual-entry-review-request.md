---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [aiops, inspection, dual-entry, saved-inspection, review-request]
doc_kind: review_request
created: 2026-08-16
---

# Review Request: AI Inspection Dual-Entry Journey

Review-Target-ID: `feat-ai-inspection-dual-entry`
Branch: `feat/ai-inspection-dual-entry`
Target commit: exact HEAD supplied in the A2A handoff (review-request document is the only delta after the recorded gate SHA).
Base: `origin/main@3421f0325aa1d27c24662ec6ff444e4fb68b01e9`

## What

- The home stage now shows personal saved inspections while the right rail remains the natural-language entry.
- A first-use request compiles current changes, related services and signals into selectable context cards before task generation.
- The generated plan and report preserve only the selected context; a locked report can be renamed and saved immediately.
- Saved inspections persist in a versioned local browser library and can run directly without invoking the intent compiler or draft-confirmation path.
- Direct runs always refresh current facts, create a fresh immutable task/run and enforce exact/minor/major drift gates.
- The 390px home uses a full-width saved card and a compact bottom composer; browser geometry tests prevent the prior full-screen overlay/collapsed-grid failure.

## Why

The operator asked for two explicit journeys in one usable product: a conversational first-use flow that lets the user supplement detected business context, and a revisit flow where a saved inspection is visible immediately and can run without regenerating a task. The user also required Kimi to own high-fidelity UI decisions, Sonnet to implement, and Terra to inspect the result.

## Original Requirements

Source: current co-creator discussion in this thread, captured by `DESIGN-JOURNEY.md` and `feature-specs/2026-08-16-ai-inspection-dual-entry-journey.md`.

1. First visit begins in the right-side model conversation with a natural-language inspection request.
2. Semantic parsing exposes recent electronic-flow changes, related services and business context for a second user selection.
3. Confirmation generates a reviewable inspection task; user confirmation starts automatic execution.
4. The report includes the selected inspection information results and model-summarized risks.
5. A precise task can be renamed and saved.
6. On revisit, saved inspection tasks are visible on the page and can be executed directly.
7. Direct execution bypasses natural-language task generation while still refreshing current facts and preserving audit immutability.
8. The UX should be concise and product-like; Kimi owns UI quality, Sonnet code, Terra independent inspection.

Reviewer instruction: judge whether the implementation delivers both journeys as operator experiences, not merely whether AC-J1 through AC-J8 have tests.

## Architecture Ownership

- Architecture cell: AI inspection offline demo / standalone product artifact.
- Map delta: none.
- Why: the change extends the existing pure reducer/selector core with a saved-inspection domain and a browser-only persistence adapter. It does not add a production store, queue, router, service boundary or shared approval system.

## Tradeoff

- Persistence is localStorage mock persistence, clearly labeled; there is no backend, cross-device sync or real approval.
- Personal saved inspections are immediate entry points; team-approved Playbooks remain a separate versioned governance layer.
- Direct run bypasses NLP and task-draft confirmation, but never bypasses current-fact refresh or drift protection.
- Definitions persist structure only; evidence and historical reports remain immutable per run.

## Open Questions

### Technical OQ

1. Verify that definitions never capture evidence/report payloads and that locked runs are not mutated by save, reload or rerun.
2. Verify that exact direct run does not call the intent compiler or render task-draft confirmation.
3. Verify storage hydration/merge cannot collide task/run/definition identifiers.
4. Verify the 390px fixed composer leaves the saved-inspection stage readable and primary actions reachable.

### Value OQ

None. The operator explicitly selected the two-entry product model and the local high-fidelity acceptance boundary.

## Self-Check Evidence

- Package `pnpm check`: 67/67 Node tests; offline Chrome first-use/save/reload/direct-run and Playbook exact/minor/major journeys pass.
- Browser hygiene: zero HTTP(S) requests, zero browser errors, no horizontal overflow.
- Repository `pnpm gate`: passed on `512c0ae` after canonical Biome formatting; Feature Truth, lint, build, Windows smoke and startup acceptance all green.
- Syntax: `node --check` passed for 28 ESM files.
- Artifact: standalone `index.html`, SHA-256 `FCF055498AD72F84F65CC9E2F644195122AA5EFC086C6DA587398F621B58F9E9`.
- Preview: `http://127.0.0.1:4392/index.html`; served bytes match the artifact hash.
- Visual evidence: `evidence/11-dual-entry-context-selection.png`, `12-saved-inspection-home.png`, `13-saved-direct-run.png`, `14-mobile-saved-home.png`.
- Walkthrough: `evidence/15-dual-entry-inspection-journey-15s.webm` (16.171 seconds).
- Root artifact hygiene: clean; feature media lives only under the formal `evidence/` directory.

## Next Action

- Kimi: terminal visual review against `DESIGN-JOURNEY.md`, desktop and 390px evidence.
- Terra: independent detached-sandbox code/behavior review of the exact target commit, with explicit `APPROVE` or `REQUEST_CHANGES`.
- Author: resolve findings with red-green evidence; enter merge-gate only when reviews cover the current exact SHA.

[丢丢/gpt-5.6-sol🐾]
