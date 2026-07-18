# F010 mobile chat composer product recovery

Date: 2026-07-18

Reporter: co-creator, reporting iPhone installed PWA. Earlier screenshots: `1784357537844-455e30ef.png` and `1784357537845-e8f055b9.jpg`. Fourth-round device truth: `1784367014821-3bd66f12.png` and `1784367014823-aff1e7f2.png`. Fifth-round continuous journey truth: `C:\Users\myh_1\Desktop\c3a3f0c9826983f20a00cf6d855b4ef0.mp4` (25.57s, HEVC, 592×1280). Sixth-round continuous journey truth: `C:\Users\myh_1\Desktop\07a4d1f3c1d2cdf4acc422ab2fe0512e.mp4` (12.40s, HEVC, 592×1280) and `1784388882630-270baf4d.png`.

## Bug diagnosis capsule

| Field | Current evidence |
|---|---|
| **1. Symptom** | In the sixth video, focusing the composer makes the complete Clowder shell disappear into a blank beige surface for about 1.5 seconds. Manual scrolling restores it. Once restored, the application composer plus a duplicated 3.5rem reserve and the native iOS Form Assistant consume too much of the keyboard-constrained viewport, and the 16px composer looks larger than the 14px message body. |
| **2. Evidence** | Frames around 3.5–5.0s show header, transcript, and composer disappearing together while the concierge overlay and iOS keyboard remain; no status-sheet text is mounted, proving the fifth repair worked but was not the root coordinate fix. The annotated screenshot identifies the duplicated blank band, system assistant, and typography mismatch. Runtime preflight shows the video was captured after BUILD_ID `4gYnE-fXBHLBkq2vLVKkE`, not against an old bundle. |
| **3. Confirmed causes** | The whole fixed `.app-viewport` consumed `visualViewport.offsetTop` as its own CSS `top`. iOS already pans the visual viewport to the focused textarea, so feeding that pan back into the fixed root double-translated the complete shell. Separately, `--mobile-browser-input-assistant-reserve: 3.5rem` reproduced the height of Safari's already visible native assistant. The typography mismatch came from a required 16px textarea beside a 14px mobile message body. |
| **4. Diagnostic strategy** | Treat the video as a single focus journey: assert that arbitrary late `offsetTop` changes never move the AppShell origin; keep only VisualViewport dimensions; remove the duplicated assistant reserve; make tool mode and IME mode mutually exclusive; align message and composer text at 16px on mobile. |
| **5. Timeout strategy** | If root-origin invariance does not remove the blank jump on the reporting iPhone, capture `offsetTop`, `height`, document/body/transcript scrollTop, AppShell rect, composer rect, and activeElement for the same 12-second path. Do not add another offset, timer, or scroll retry. |
| **6. Warning strategy** | Reject `scrollIntoView`, UA/device magic values, another RAF/timeout, a contenteditable migration, hiding closed panels offscreen, shrinking editable text below 16px, or reserving another guessed system-control height. |
| **7. User-visible correction** | The root shell stays at `top: 0`; VisualViewport contributes dimensions only. Keyboard mode owns zero App bottom reserve, so the 48px composer directly meets the system assistant instead of duplicating it. Opening mobile tools blurs the textarea, and refocusing the textarea closes tools. Mobile message copy and composer copy now share a 16px optical scale. |
| **8. Acceptance** | RED→GREEN requires root `top/left=0` through late installed-PWA pans, keyboard reserve `0`, no assistant-height workaround, a 48px composer, IME/tools mutual exclusion, and preserved draft/mention/composition behavior. Chrome projection and automated tests are necessary but the reporting iPhone replay remains the release gate. |

## Repeated-friction classification

This is a harness defect, not four unrelated style bugs: four real-device correction rounds in one thread passed through component-level automation and cross-individual review before the reporting iPhone exposed the next chrome/lifecycle failure. The repair must add journey-level layout guards and must not ask the operator to enumerate more pages.

## Product decision and implementation

- Safari's white Previous / Next / Done row (rendered as arrows and a checkmark on the reporting iPhone) is system-owned form-assistant UI, not a second Clowder confirmation control. Clowder neither suppresses it nor duplicates its height with application padding.
- Status and composing are mutually exclusive task surfaces. Opening status blurs every editable owned by that chat surface, makes the underlying chat inert, and resets the sheet to its header. The sheet and backdrop close together through React state; keyboard CSS no longer hides only half of the modal.
- Closing status now unmounts both sheet and backdrop. Keeping a closed sheet below the visual viewport for an exit animation is explicitly rejected because it leaves Safari-scrollable fixed geometry outside the visible frame.
- The single chat-bottom reserve is the Dock owner while browsing and becomes exactly `0` while composing. The native assistant remains outside Clowder's layout budget; no second composer owner or fixed-device-height path is present.
- Keyboard projection persists across the blur-to-close transition until the same-width viewport restores. VisualViewport dimensions are sampled immediately and on a settling animation frame, while its pan offsets are never reapplied to the fixed AppShell origin.
- Mobile Agent-hook health is a 44px one-row summary with a compact sync action. Detailed error text, five status pills, and repair preview remain available on desktop/governance surfaces and leave the composing layout entirely.
- The mobile composer is one 48px row: 44px attachment target, 44px block textarea, and 44px mic/send target. Internal refocus calls use `focus({ preventScroll: true })` and the IME receives `enterKeyHint="send"`. Opening tools dismisses the IME; focusing the editor closes tools.
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
- Independent review: Terra approved `ca065b8` with **P1=0, P2=0, P3=0** after independently reproducing the focused **60/60**, CSS architecture **54/54**, Web TypeScript, diff check, and clean worktree. Only the reporting-iPhone installed-PWA replay remains open.
