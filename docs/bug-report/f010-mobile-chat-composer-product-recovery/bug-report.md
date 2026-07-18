# F010 mobile chat composer product recovery

Date: 2026-07-18

Reporter: co-creator, reporting iPhone installed PWA, screenshots `1784357537844-455e30ef.png` and `1784357537845-e8f055b9.jpg`.

## Bug diagnosis capsule

| Field | Current evidence |
|---|---|
| **1. Symptom** | Focusing the composer can land on status-sheet content instead of a stable conversation frame. After manual repositioning, the keyboard-visible screen stacks a full Agent environment failure card, the app composer, and iOS form accessory UI, leaving little usable conversation space. |
| **2. Evidence** | Third reporting-iPhone correction in one thread. Code inspection confirmed that client-side thread navigation preserved `mobileStatusOpen`, status opening did not blur the composer, every internal refocus used default browser scrolling, the sheet retained its old `scrollTop`, and a full `AgentHookHealthNotice` lived inside the mobile transcript. |
| **3. Confirmed causes** | H1 confirmed: transient sheet state was not keyed to `threadId`, so the second-round client-navigation fix exposed a new lifecycle leak. H2 confirmed: full diagnostic/empty-state/task chrome had no composing projection. H3 confirmed: existing tests asserted presence and breakpoints, not focus ownership, sheet reset, or measured chrome height. |
| **4. Diagnostic strategy** | Trace every composer focus call and status-sheet transition; compare the working closed-sheet path; add RED lifecycle and chrome-budget contracts before modifying implementation; validate the complete focus journey at 390px and keep Safari truth separate from Chrome projection. |
| **5. Timeout strategy** | If the first RED contracts cannot isolate the owner in 30 minutes, instrument focusin, activeElement, document scrollTop, sheet open state, and VisualViewport offsets in the isolated runtime; do not add another CSS offset. |
| **6. Warning strategy** | Any fix requiring a new viewport fallback, fixed iPhone height, UA sniff, hiding authorization actions, or a fourth independent bottom reserve is the wrong coordinate system. Three unsuccessful patch rounds require redesign of the chrome state matrix, not another local spacing tweak. |
| **7. User-visible correction** | Keyboard focus keeps the compact chat header and one compact composer row stable; Dock, status sheet, and noncritical diagnostics leave the keyboard frame. Environment failure becomes a one-line on-demand status entry; the native iOS accessory remains system-owned without an app duplicate. |
| **8. Acceptance** | RED→GREEN tests cover sheet blur/close, thread-transition reset, focus without document scroll, one-row composer budget, collapsed diagnostics while composing, and 390px route journeys. Final release proof still requires a newly built process whose start time follows the reviewed commit plus reporting-iPhone Safari/PWA screenshots. |

## Repeated-friction classification

This is a harness defect, not three unrelated style bugs: three real-device correction rounds in one thread passed through component-level automation and cross-individual review before the reporting iPhone exposed the next chrome/lifecycle failure. The repair must add journey-level layout guards and must not ask the operator to enumerate more pages.

## Product decision and implementation

- Safari's white Previous / Next / Done row is system-owned form-assistant UI, not a second Clowder confirmation control. The supported correction is to budget for it; no browser-sniff or unsupported CSS suppression was added.
- Status and composing are mutually exclusive task surfaces. Opening status blurs the composer; a newly selected thread cannot inherit the old sheet; each open begins at `scrollTop = 0`; while keyboard projection is active, the sheet is hidden.
- Mobile Agent-hook health is a 44px one-row summary with a compact sync action. Detailed error text, five status pills, and repair preview remain available on desktop/governance surfaces and leave the composing layout entirely.
- The mobile composer is one 52px row: 44px attachment target, 44px block textarea, and 44px mic/send target. Internal refocus calls use `focus({ preventScroll: true })` and the IME receives `enterKeyHint="send"`.
- Connection, authorization, execution, queue, vote, quest, research, game-return, and empty-state chrome all share the existing `mobile-keyboard-secondary-chrome` projection instead of acquiring new bottom reserves.

## Verification before independent review

- Implementation commit: `20adebde118b08e2b1cfb0b8e92a056846f8739a`.
- RED: six initial failures across five suites, followed by separate red proofs for transient-sheet thread carry-over and the textarea baseline line box.
- GREEN: five affected suites, **44/44**; TypeScript `--noEmit` passes; targeted Biome has zero errors; Next/PWA production build passes.
- Full Web Vitest remains transparently baseline-red at **5050/5117 passed**, 67 failures in 14 files, improving from the prior **5044/5112**, 68 failures in 15 files. The five changed suites are green; the repeatable ChatInput history/upload failures are already recorded baseline debt, and no new failing test file was introduced by this slice.
- Post-commit isolated runtime: Web `4310` PID `26716` started after commit, HTTP 200, BUILD_ID `i1XgGmGXamb0QSLhn2Bgk`; API remains isolated on `4311`.
- No-cache CDP at 390×844: root/body width `390`, root scrollTop `0`, header `57`, composer `52`, textarea `44`, Dock `56` with four items.
- 390×430 composing projection: composer y=`378`, h=`52`, bottom=`430`; Dock `display:none`; visible secondary chrome count `0`; status sheet `visibility:hidden`; root scrollTop `0`.
- Focus/status journey: textarea focused before status click; active element becomes `BODY`; sheet opens with `aria-hidden=false`, `scrollTop=0`, and its title visible.
- Evidence: `project-evidence/f010-mobile-pwa/composer-recovery-final-20260718-bypass-sw-mobile-390x844.png`, `composer-recovery-final-20260718-status-sheet-390x844.png`, and `composer-recovery-final-20260718-composing-surface-390x430.png`.

Primary product evidence and rejected alternatives are recorded in `project-research/2026-07-18-mobile-chat-composer-product-patterns/sonnet-synthesis.md`.
