# F010 mobile chat composer product recovery

Date: 2026-07-18

Reporter: co-creator, reporting iPhone installed PWA. Earlier screenshots: `1784357537844-455e30ef.png` and `1784357537845-e8f055b9.jpg`. Fourth-round device truth: `1784367014821-3bd66f12.png` and `1784367014823-aff1e7f2.png`. Fifth-round continuous journey truth: `C:\Users\myh_1\Desktop\c3a3f0c9826983f20a00cf6d855b4ef0.mp4` (25.57s, HEVC, 592×1280).

## Bug diagnosis capsule

| Field | Current evidence |
|---|---|
| **1. Symptom** | Focusing the composer can land on status-sheet content instead of a stable conversation frame. After manual repositioning, the native iOS form assistant sits over the application composer and intercepts the area the user is trying to tap. |
| **2. Evidence** | The fifth-round video records the uninterrupted journey the screenshots could not: composer focus at about 7.75s immediately scrolls to the body of a *closed* status sheet at 8.00s; manual upward swipes recover chat; the same drop recurs at about 20.75s after typing. A document-level scroll indicator moves while status details pass beneath the composer. |
| **3. Confirmed causes** | H1–H4 from the fourth round were necessary but incomplete. H5 is the direct video root cause: when `open=false`, `MobileStatusSheet` stayed mounted at `top = visualViewport.top + visualViewport.height` with `translate-y-0`. `inert` blocked interaction but did not remove the offscreen fixed descendant from Safari's focus/scroll geometry, so WebKit scrolled that closed content into view. |
| **4. Diagnostic strategy** | Trace every composer focus call and status-sheet transition; compare the working closed-sheet path; add RED lifecycle and chrome-budget contracts before modifying implementation; validate the complete focus journey at 390px and keep Safari truth separate from Chrome projection. |
| **5. Timeout strategy** | If the first RED contracts cannot isolate the owner in 30 minutes, instrument focusin, activeElement, document scrollTop, sheet open state, and VisualViewport offsets in the isolated runtime; do not add another CSS offset. |
| **6. Warning strategy** | Any fix requiring a new viewport fallback, fixed iPhone height, UA sniff, hiding authorization actions, or a fourth independent bottom reserve is the wrong coordinate system. Three unsuccessful patch rounds require redesign of the chrome state matrix, not another local spacing tweak. |
| **7. User-visible correction** | A closed status journey is no longer hidden offscreen: the sheet and backdrop are absent from the DOM and scroll geometry. They mount together only after the user explicitly opens status and unmount together on close. The iOS assistant reserve remains the single keyboard-adjacent reserve. |
| **8. Acceptance** | RED→GREEN tests now require a closed sheet to have no DOM, text, backdrop, or offscreen visual-bottom node, while preserving the existing open-modal, authorization, iOS assistant, and viewport contracts. Final release proof still requires this new build on the reporting iPhone; the prior fourth-round approval is superseded for this journey. |

## Repeated-friction classification

This is a harness defect, not four unrelated style bugs: four real-device correction rounds in one thread passed through component-level automation and cross-individual review before the reporting iPhone exposed the next chrome/lifecycle failure. The repair must add journey-level layout guards and must not ask the operator to enumerate more pages.

## Product decision and implementation

- Safari's white Previous / Next / Done row (rendered as arrows and a checkmark on the reporting iPhone) is system-owned form-assistant UI, not a second Clowder confirmation control. The supported correction is to budget for it; no unsupported CSS suppression was added.
- Status and composing are mutually exclusive task surfaces. Opening status blurs every editable owned by that chat surface, makes the underlying chat inert, and resets the sheet to its header. The sheet and backdrop close together through React state; keyboard CSS no longer hides only half of the modal.
- Closing status now unmounts both sheet and backdrop. Keeping a closed sheet below the visual viewport for an exit animation is explicitly rejected because it leaves Safari-scrollable fixed geometry outside the visible frame.
- The existing single chat-bottom reserve now budgets 3.5rem for the iOS touch form assistant while composing. Android and desktop retain zero assistant reserve; no second composer owner or fixed-device-height path was introduced.
- Keyboard projection persists across the blur-to-close transition until the same-width viewport restores. VisualViewport changes are sampled immediately and on a settling animation frame to absorb WebKit's documented late installed-PWA offset without adding a timer or UA-specific geometry source.
- Mobile Agent-hook health is a 44px one-row summary with a compact sync action. Detailed error text, five status pills, and repair preview remain available on desktop/governance surfaces and leave the composing layout entirely.
- The mobile composer is one 52px row: 44px attachment target, 44px block textarea, and 44px mic/send target. Internal refocus calls use `focus({ preventScroll: true })` and the IME receives `enterKeyHint="send"`.
- Noncritical connection, execution, queue, vote, quest, research, game-return, and empty-state chrome share the existing `mobile-keyboard-secondary-chrome` projection instead of acquiring new bottom reserves.
- Authorization is deliberately not treated as secondary chrome: mobile shows a pending-count badge on the existing status action, opening it dismisses the keyboard, and the authorization controls live at the top of the status sheet. Desktop retains the inline authorization cards.
- The expandable input toolbar and every authorization action use 44px-minimum touch targets; compact actions wrap rather than compress below the target size.
- A waiting PWA update remains actionable while browsing but shares the existing secondary-chrome projection while composing; it no longer covers 88px of the keyboard-constrained transcript.

## Verification before independent review

- Implementation commits: product recovery `20adebde118b08e2b1cfb0b8e92a056846f8739a`; reviewer P2 repair `066762d`; browser failure-mode repair `49a4853`.
- RED: six initial failures across five suites, separate red proofs for transient-sheet thread carry-over and the textarea baseline line box, reviewer P2 proofs for authorization/44px actions, and a waiting-worker prompt regression found in browser dogfood.
- GREEN: final affected selection **10 files / 79 tests**; TypeScript `--noEmit` passes; targeted Biome has zero errors; Next/PWA production build passes.
- Full Web Vitest remains transparently baseline-red. The latest managed JSON was **5055/5123**, 68 failures in the same 14-file roster; the only added failure was the reviewer repair's raw-pixel typography guard. That token was replaced by `text-micro`, the targeted F190 guard is green, and the subsequent PWA controller suite is 8/8. No full-suite green is claimed.
- Final isolated runtime: Web `4310` PID `39524`, HTTP 200, BUILD_ID `jcnYuX0LWcqvp7oKHGqSM`; API remains isolated on `4311`.
- No-cache CDP at 390×844: root scrollTop `0`; status target `44`; each expanded toolbar action `44`; composer `52`; Dock `56`.
- 390×430 composing projection with a real waiting worker: composer y=`378`, h=`52`, bottom=`430`; Dock height `0`; update-prompt height `0`/`display:none`; root scrollTop `0`.
- Focus/status journey: textarea focused before status click; active element becomes `BODY`; sheet opens with `aria-hidden=false`, `scrollTop=0`, and its title visible.
- Evidence: `project-evidence/f010-mobile-pwa/mobile-auth-toolbar-final-20260718-390x844.png`, `mobile-status-sheet-final-20260718-390x844.png`, and `mobile-composer-final-20260718-390x430.png`.

Primary product evidence and rejected alternatives are recorded in `project-research/2026-07-18-mobile-chat-composer-product-patterns/sonnet-synthesis.md`.

Primary platform evidence:

- Apple documents the Safari form assistant as browser-owned UI above the keyboard: <https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/DesigningForms/DesigningForms.html>.
- WebKit records late/incorrect VisualViewport updates in Safari and installed web apps: <https://bugs.webkit.org/show_bug.cgi?id=265578> and <https://bugs.webkit.org/show_bug.cgi?id=237851>.
- WebKit continues to track keyboard-created blank/scrollable regions on iOS 26: <https://bugs.webkit.org/show_bug.cgi?id=292603>.

## Fourth reporting-iPhone correction verification

- Product repair: `3667199` (single modal owner, inert chat surface, composer-focus close, iOS assistant reserve, blur hysteresis, settling VisualViewport read).
- CSS architecture repair: `3956aa5` (registered `mobile-shell.css`; `globals.css` returned from 359 to 315 lines and the new sheet is 44 lines).
- RED: 10 failures across the five affected suites before implementation. GREEN: the affected selection is **51/51**; adding the global-CSS architecture suite yields **53/53**.
- Web package TypeScript, targeted Biome, `git diff --check`, and the 22-route production build pass.
- The managed full-Web JSON before the CSS extraction was **5062/5130**, 68 failures. Compared directly with `f010-mobile-auth-final-vitest.json`, all seven new tests passed; the only added failure was the 350-line global-CSS guard, while the former raw-pixel typography failure disappeared. `3956aa5` then makes the exact architecture guard green; the targeted F190 run confirms its raw-pixel guard remains green and only the unchanged modal-scrim baseline fails. A second full-suite green is not claimed.
- Final isolated runtime: Web `4310` PID `22696`, BUILD_ID `dekHachDoovqQ-6QxRcBT`; local and Tailscale HTTPS roots return HTTP 200 and embed that ID. `/vendor/app/mobile-shell.css` returns HTTP 200. API `4311` was untouched.
- Final 4310 browser journey at 390px: open status makes the chat surface `inert`/`aria-hidden`, leaves the sheet and backdrop jointly interactive, and blocks composer focus; close makes the sheet inert, removes the backdrop hit target, and restores composer focus. Root scroll stays `0` throughout.
- Keyboard geometry projection at 390×500: composer `52px` high with bottom `444`; the single `3.5rem` assistant reserve owns the remaining 56px; Dock and secondary chrome occupy `0`.

## Fifth reporting-iPhone video correction

The 25.57-second HEVC screen recording supersedes the prior screenshot-only interpretation. At about 7.75→8.00s, focusing the composer exposes the closed status-sheet body without any explicit status action. Manual swipes traverse that body and recover the chat. At about 20.75s, the same drop recurs after the mention journey. This directly identifies an offscreen geometry defect rather than a stale open modal.

- RED: the closed-sheet test found `.mobile-status-sheet`, `.mobile-visual-viewport`, and all status text in the DOM.
- GREEN: `open=false` returns no sheet journey; `open=true` mounts backdrop and dialog together; close/reopen creates a fresh sheet at `scrollTop=0`.
- Harness: the mobile overflow contract rejects a closed `translate-y-0` status sheet or `aria-hidden={!open}` substitute. `inert` is not accepted as a geometry removal mechanism.
- Same-family sweep: the status sheet was the only closed overlay using the visual-bottom coordinate. The always-visible mobile Dock also uses that coordinate by design and is removed with `display:none` during composing; no second closed status overlay remains.
- Focused verification: six affected files pass **60/60**; Web TypeScript, targeted Biome, `git diff --check`, and the 22-route production build pass.
- Full Web JSON: **5064/5131**, 67 failures in the same 14 historical files. Relative to the prior **5062/5130** baseline, the new guard is green and one historical failure disappeared; no new failure or file family was introduced.
- Isolated runtime: Web `4310` PID `39224`, BUILD_ID `4gYnE-fXBHLBkq2vLVKkE`, HTTP 200; API `4311` remains PID `7580` and was untouched.
- 390px no-cache browser journey: closed status has no sheet, backdrop, or status text; composer focus keeps root scroll at `0`; explicit status open mounts dialog+backdrop; close unmounts both; second composer focus keeps them absent and root scroll at `0`.
