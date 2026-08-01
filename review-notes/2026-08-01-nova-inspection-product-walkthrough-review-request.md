# NOVA inspection product walkthrough — review request

Review-Target-ID: `nova-inspection-product-deck`
Branch: `feat/nova-inspection-product-deck`
Review range: `d1c2d2e..HEAD`

## What

Rewrite the NOVA product deck as a ten-page, single-file HTML walkthrough. The deck follows the approved `NOVA-Ops-Intelligence-Standalone-75d991e.html` high-fidelity workspace and embeds exact screenshots from its tested offline artifact.

## Why

The previous deck mixed product planning, internal design constraints, and a separate AI comparison narrative. The operator asked for a concrete explanation of product capabilities and how a user completes an inspection, while keeping the material consistent with the existing one-screen high-fidelity design.

## Original requirements

Source: Cat Café thread `thread_mrrzdymcf3z6bx77`, operator messages on 2026-08-01.

- Keep the visual and interaction direction of `NOVA-Ops-Intelligence-Standalone-75d991e.html`.
- Do not turn internal feedback such as “no multi-level left tree” into a slide headline.
- Explain product capabilities and the user's operating journey, not slogans or a roadmap.
- Keep stages visible and operable in one screen, matching the existing high fidelity.
- Show AI value inside inspection-item generation/orchestration and report interpretation; do not create a detached “with AI / without AI” comparison.
- Deliver an actual downloadable, offline HTML file that also works on a phone.

## Trade-offs

- The final HTML is 2.1 MB because three high-fidelity PNGs are embedded as data URLs. This is intentional: one file remains transferable and viewable without a sibling asset directory.
- The deck explains the target product experience but preserves the existing authority boundary: rules determine verdicts, users publish/accept decisions, AI proposes and explains, and the product never triggers deploy/rollback.
- The layout uses ten product-walkthrough pages rather than a planning deck or free-form feature catalog.

## Architecture ownership

- Architecture cell: presentation artifact only
- Map delta: none
- Why: no runtime, Store, Router, Adapter, connector, or product state machine is added or changed.

## Open questions for reviewer

1. Does every slide remain faithful to the `75d991e` one-screen workspace and three-stage journey?
2. Are AI-generated candidates and report interpretation useful without implying AI owns verdicts or production actions?
3. Does the 390 px layout remain readable and navigable?
4. Is any target-state capability presented as already shipped connected behavior?

No value-level question remains for the operator before this review.

## Quality-gate evidence

- Deck contract: 7/7 pass.
- Deck browser contract: 1/1 pass on desktop and 390 px mobile; keyboard/touch navigation and no horizontal overflow verified.
- NOVA project tests: 53/53 pass.
- NOVA Prettier, Vinext build, and high-level dependency audit: pass; audit reports 0 vulnerabilities.
- Root lint and build: pass.
- Root directory-size gate and `git diff --check`: pass.
- Root `pnpm check`: host-baseline CRLF formatting failure in unchanged repository files; the same Windows baseline is outside this presentation delta. Presentation-specific formatting and contracts pass.
- Root media hygiene: no media files at repository root.
- Visual evidence: `%TEMP%/nova-inspection-product-deck-evidence/`.

## Review stance requested

Please return `APPROVE` or `REQUEST CHANGES` with P1/P2/P3 findings. Review product truth, high-fidelity consistency, AI authority, mobile readability, and single-file offline delivery; do not redesign the already approved product direction.
