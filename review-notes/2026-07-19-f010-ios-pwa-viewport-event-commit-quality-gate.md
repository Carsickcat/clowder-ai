# F010 installed-PWA viewport event-commit quality gate

Date: 2026-07-19

Branch: `feat/f010-mobile-pwa`

Source evidence: `C:\Users\myh_1\Desktop\8c99ee100752d336619be399e65e3090.mp4` (23.966s, 592×1280)

## Verdict before independent review

**Author gate: PASS.** The implementation is code-Green and ready for independent Terra/Kimi review. Reporting-iPhone installed-PWA replay remains the release truth; no desktop projection is called device acceptance.

## Vision and spec compliance

The repair stays within the F010 terminal contract:

- fixed AppShell origin remains `top/left=0`;
- one hook remains the geometry/state owner;
- Dock and secondary chrome leave layout through the existing composing projection;
- the textarea, Chinese IME, drafts, attachments, reply state, and mention insertion remain unchanged;
- no persisted keyboard state, device sniffing, assistant reserve, `scrollIntoView`, or second coordinate owner is introduced.

Task 9's state transitions are implemented directly: state may latch on a focused shrink/pan before geometry commits; one quiet-window timer publishes only the settled width/height; close occurs only at the settled restored frame; `visualViewport.resize` and `visualViewport.scroll` are both subscribed and cleaned up.

## Root-cause proof

The prior `e27ee2d` repair mixed two decisions. It correctly removed root translation by `offsetTop/offsetLeft`, but also removed `visualViewport.scroll` as an event source. The previous keyboard detector then computed baseline shrink as `baseline.height - height - top`; installed-PWA pan could cancel the shrink and leave `data-mobile-keyboard-open` false even when the settled height was correct. Separately, every resize-time height wrote directly into the fixed shell, so an animation frame could collapse the entire UI.

The old implementation produced four focused Red failures:

- scroll-only terminal delivery did not enter composing or commit the terminal read;
- a `112px` animation-time height replaced the last stable `844px` shell height;
- short Chinese/ASCII punctuation-completed mention tokens remained active.

## Green evidence

- Focused viewport + mention files: **26/26 passed**.
- Broader affected selection: **13 files / 137 tests passed**.
- Web TypeScript: pass.
- Targeted Biome on all four code/test files: pass, zero errors.
- Feature truth: pass.
- Capability tips: 11/11 harness tests and hard check pass; only existing branch/anchor warnings remain.
- Candidate-range diff check: the original packet incorrectly inferred a pass from a clean-worktree `git diff --check`. Terra reproduced four committed trailing-space findings with `git diff --check 85e3284..87ffdd5` (exit 2). Doc-only repair `f65aa32` removes all four; `git diff --check 85e3284..f65aa32` passes.
- Production Web build after all fresh-context repairs: pass; BUILD_ID `davuSC0P3wlGS5zAgfHp-`.

The broader selection covers viewport projection, composer density/state, draft persistence, mention parsing, mobile container/status/toolbar, AppShell navigation, PWA install/update projection, and Markdown ownership.

## Full-suite transparency

Full Web Vitest was attempted and stopped by the command timeout after 303.4 seconds. The partial output contained the repository's known unrelated mock/React-act failure families (including the `ensureSession` mock gap), but no terminal summary was produced; therefore this gate claims neither a full-suite pass nor a new total. The bounded affected selection completed cleanly and is the regression verdict for this change.

## Production-artifact and process evidence

- Temporary Web `4312` served HTTP 200 and embedded BUILD_ID `davuSC0P3wlGS5zAgfHp-`.
- Hub Browser Preview opened that exact final candidate build.
- The temporary Node listener was stopped after the check; port `4312` is free.
- Existing Web `4310` still returns HTTP 200 with old BUILD_ID `2JhXmOBICvwybpU-Kig8T`.
- API `4311` PID `7580` was not restarted or modified.

This evidence proves the new production artifact starts. It does not substitute for installed-iPhone keyboard animation truth.

## Failure-mode and ownership audit

`useVisualViewportCssVars` is the only producer of `--app-viewport-*` and `data-mobile-keyboard-open`. Consumers are bounded to `.app-viewport`, `.mobile-visual-viewport`, `.mobile-visual-bottom`, Dock/secondary chrome CSS, and `PwaInstallPrompt`. No consumer writes geometry and no old offset reaches root positioning.

Mention detection remains local to the existing `ChatInput` parser. Unicode letters, numbers, combining marks, `_`, and `-` are valid; whitespace, punctuation, and symbols terminate the token without changing the draft.

## Fresh-context findings

The fresh-context scan produced three P2 findings and no P1/P3:

- FC-1 (correctness): an open-keyboard orientation frame could poison the new-width baseline and clear composing at settle. **Fixed and proven Red → Green** by staging the new width while retaining the closed-height baseline until blur plus restored geometry.
- FC-2 (missing test): pending timer/rAF and viewport listener cleanup had no direct proof. **Fixed** with unmount-while-pending plus post-unmount resize/scroll delivery.
- FC-3 (missing test): symbol termination and valid number/combining-mark/underscore categories were untested. **Fixed** with explicit Unicode category cases.

Fresh-context is a finding generator only; Terra/Kimi remain the formal review authorities.

## Formal review status

- Terra reviewed exact code SHA `87ffdd5` in message `0001784400867254-000014-6e976ffa`: **REQUEST_CHANGES, P1=0, P2=1, P3=0**. He approved the viewport state machine, event ownership, cleanup, orientation baseline, mention boundaries, and the decision not to escalate to `100dvh + transform`; the sole P2 was the committed-range whitespace gate mismatch. `[FC:new]`
- Doc-only repair `f65aa32` closes that P2 without changing runtime code. Terra continuation-approved the repaired evidence head `7086e37` in message `0001784401196987-000017-cd17c0f4` with **P1=0, P2=0, P3=0** after both range checks returned 0.
- Kimi's independent visual/interaction verdict remains pending.

## Remaining gates

1. Kimi returns the independent visual/interaction verdict for code SHA `87ffdd5`; Terra's correctness and continuation gates are approved.
2. After P1/P2 are zero, replace isolated 4310 with the reviewed build while leaving 4311 untouched.
3. Reporting-iPhone replay of the same Chinese-IME/mention journey.

[丢丢/gpt-5.6-sol🐾]
