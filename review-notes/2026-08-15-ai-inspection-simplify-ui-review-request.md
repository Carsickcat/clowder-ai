---
feature_ids: [AI_INSPECTION_SIMPLIFY_UI]
topics: [aiops, inspection, ui, copy, review-request]
doc_kind: review-request
created: 2026-08-15
---

# AI Inspection Copilot Simplification — Formal Review Request

Review-Target-ID: `ai-inspection-simplify-ui`

Branch: `feat/ai-inspection-simplify-ui`

Review target: use the exact HEAD supplied in the A2A handoff that references this note.

## Original requirements

Source thread: `thread_msg13xc7dv3dp4fb`

> 这个产品不像一个可用的产品，每次点击下一步都有很多标语式的口号，整体设计简洁一点吧。
>
> 烁烁，你来把关一下整体设计。设计完直接编码就行。

Operator experience to preserve:

1. Each stage should help the operator make one decision, without manifesto-style copy.
2. Functional labels should replace decorative English module names and promotional headings.
3. Repeated safety explanations should become quiet, contextual disclosure rather than persistent speeches.
4. The five-stage workflow, Playbook decisions, audit guards and action hierarchy must remain behaviorally unchanged.
5. The final report action should remain the single visual climax.

Design truth: `designs/ai-inspection-copilot-offline-demo/DESIGN-SIMPLIFY.md`.

## What

- Rewrites stage titles and supporting copy as short functional statements.
- Removes decorative module labels, repeated manifesto text and right-rail guardrail speeches.
- Reduces ordinary section heading scale and visual emphasis while preserving the final action hero.
- Compresses Playbook reuse disclosure into one contextual information affordance.
- Regenerates the standalone artifact, screenshot evidence and 15-second walkthrough.
- Adds UI contracts that reject the removed slogan and module-label patterns.

## Why

The previous implementation correctly encoded verification-first behavior, but repeatedly narrated that philosophy to the operator. A production-like duty tool should express the philosophy through its state machine and gates, leaving the interface quiet and task-focused.

## Tradeoff

This change deliberately keeps the existing dark NOVA visual language and five-stage information architecture. It does not redesign workflows, add a template dashboard, alter Playbook matching, or remove the offline/mock disclosure. The delta is presentation and copy only.

## Architecture ownership

- Architecture cell: existing offline prototype presentation layer.
- Map delta: none.
- Why: no Store, Queue, Router, Adapter, Dispatcher, Binding, domain contract or state transition changed; the diff is renderer/CSS/copy, evidence and test-contract updates.

## Design verdict

Kimi reviewed the implementation screenshots for UI commit `ae8cf461307abef1cfe6f4d3409d89f312032cd6` and returned `DESIGN APPROVE` with no P1/P2/P3. The only later delta is this review-request note.

## Evidence

- `pnpm check`: 46/46 Node tests pass and all four offline Chrome journeys pass.
- Browser: zero HTTP(S) requests and zero browser errors.
- Responsive: 390px journeys have no horizontal overflow; compact notes remain single-line.
- Deterministic artifact: build leaves the worktree clean.
- Visual evidence:
  - `designs/ai-inspection-copilot-offline-demo/evidence/00-user-defined-intake.png`
  - `designs/ai-inspection-copilot-offline-demo/evidence/06-playbook-exact-match.png`
  - `designs/ai-inspection-copilot-offline-demo/evidence/09-playbook-major-desktop.png`
- Walkthrough: `designs/ai-inspection-copilot-offline-demo/evidence/06-user-directed-risk-walkthrough-15s.webm`.
- `git diff --check` and root-artifact guard are clean.

## Open questions

Technical:

- Did any copy simplification accidentally remove an accessible decision cue or an audit-relevant state projection?
- Do the new UI-contract assertions verify semantics without becoming brittle snapshots?
- Does the regenerated standalone artifact faithfully contain the source renderer and CSS changes?
- Please operate the page in a real browser and confirm each stage still has an unambiguous primary action.

Value: none. The operator explicitly selected the simpler, duty-tool direction and the design owner approved the implemented result.

## Next action

Review the complete diff against the merged Playbook baseline in a detached/read-only sandbox at the exact handoff SHA. Run `pnpm --dir designs/ai-inspection-copilot-offline-demo check`, inspect the built page in a real browser, and return `APPROVE` or `REQUEST_CHANGES` with explicit severity and reviewed SHA.
