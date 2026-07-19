# F010 frozen-shell and catalog recovery review request

Reviewer: Terra / `@opus`
Author: Sonnet / `@sonnet`
Branch: `feat/f010-mobile-pwa`
Review-Target-ID: `f010`
Range: `8442c8b..7d235e3`
Product commits: `f3565b240fe203a4f04ea504061c5b9aef8c62a6`, `7d235e3f89c275b5a47d755d38cbf7fbdb9f25b4`
Acceptance BUILD_ID: `fI2pHXO01zency2O6yYcz`

## Original requirements

Source: `feature-specs/2026-07-19-f010-ios-keyboard-geometry-incident.md`, Goal, Finish line,
Geometry state x event table, and INV-G1 through INV-G5. Device evidence is preserved in
`docs/bug-report/f010-post-review-recording-pulse-and-tunnel-origin/bug-report.md`.

The reporting iPhone must keep AppShell, header, transcript, and composer visible and stable through
two consecutive focus/Chinese-IME/mention/blur journeys. From focus through confirmed close, no
keyboard-time `innerHeight` or VisualViewport frame may replace root width/height. A changed
orientation can become the baseline only after close evidence confirms an unobscured stable frame;
the device replay itself must expose build/API/geometry provenance.

Architecture cell: `hub-action-surface`
Map delta: `none`
Why: this change only corrects the existing transient geometry owner's transition handling; it
does not add a Store, Queue, Router, Adapter, Dispatcher, Binding, API, or persistence boundary.

## What

- Freeze `--app-viewport-{width,height}` to the last confirmed unobscured baseline from composer
  focus through two matching unobscured close reads.
- Stage width-changing orientation frames without rebasing the live AppShell.
- Keep keyboard overlap scoped to the existing composer/transcript consumers.
- Let an acceptance build expose the already reviewed viewport trace at standalone `/`; normal
  builds remain query-gated.
- Split catalog presentation into loading, retryable failure, confirmed empty, and ready states.

## Why

`录屏2.mp4` was captured after the prior stable-shell candidate and still contains composer-hidden
intervals plus two full-shell blank episodes. The previous implementation continued to project
`Math.min(baseline.height, window.innerHeight)`, so an iOS keyboard-animation `innerHeight` pulse
could still collapse the root. The cold catalog path also rendered a fetch failure as the
irreversible first-run “no members” state.

RED evidence reproduced 112px, 420px, and 500px root projections where 844px had to remain frozen.
The final coordinate contract removes all keyboard-time runtime geometry from root width/height
rather than adding another threshold or debounce.

## Tradeoff

- During a focused orientation change, the old shell baseline remains visible until close is
  confirmed; this favors a stable, non-blank shell over mid-keyboard reflow.
- The acceptance flag is compile-time/process-only. It intentionally produces a diagnostic
  acceptance artifact and is not a new persisted setting or Service Worker policy.
- The implementation does not yet claim the composer’s device behavior is accepted; the same
  exact-build iPhone replay remains mandatory.

## Open questions for review

1. Can any focus/keyboard/native-pan path still write an unconfirmed frame to root width or height?
2. Can `pendingWidthBaseline` plus the two-read close candidate latch the keyboard forever or adopt
   a false orientation baseline?
3. Does the acceptance-build trace gate remain absent from normal builds and avoid changing SW
   update semantics?
4. Does catalog failure remain retryable without remounting the composer or erasing drafts/IME?
5. Are there any P1/P2 regressions in the changed range that focused tests do not cover?

## Verification

- Affected mobile suite: 9 files / 100 tests passed.
- Viewport: 25/25; catalog presentation: 4/4; catalog retry: 3/3.
- TypeScript: passed; repository lint: passed; target Biome and `git diff --check`: passed.
- Exact product-commit production build: passed.
- Local 4310 and HTTPS 8443 page/build manifest/health: HTTP 200; both `/api/cats`: four cats.
- Web PID 4456; API PID 7580 unchanged.
- Full Web Vitest’s only failure is an unchanged `MobileStatusSheet.tsx` F190 scrim baseline; the
  package wrapper separately has a Windows `spawn pnpm ENOENT` defect.
- Repository `test/check` baseline blockers are documented in the bug report and are outside the
  changed files.

## Review round 2 correction and superseding verification

Terra's P1 showed that a width change beginning after `blur` was absent from the orientation
candidate state. The exact RED journey was
`390x844 -> focus -> 390x500 -> blur -> 844x300 -> 844x390`. The old portrait baseline classified
the final landscape height as a keyboard shrink forever.

The correction does not adopt the runtime frame or add a threshold: while the keyboard is latched,
a new width is staged only as `pendingWidthBaseline`; the existing unobscured close evidence then
adopts the settled landscape baseline. The former `ZoOUsD6wW6PKZzAKeGvZY` acceptance artifact is
superseded and must not be used for replay.

- P1 RED: the new regression failed with `data-mobile-keyboard-open="true"` after the settled
  `844x390` frame.
- P1 GREEN: viewport 26/26; affected mobile suite 9 files / 101 tests passed.
- TypeScript, target Biome, `git diff --check`, and exact production build passed.
- Exact commit: `7d235e3f89c275b5a47d755d38cbf7fbdb9f25b4`.
- BUILD_ID: `fI2pHXO01zency2O6yYcz`.
- Web PID 11112, started `2026-07-19T16:07:30.8416346+08:00`; API PID 7580 unchanged.
- Local 4310 and HTTPS 8443 page/build manifest/health returned 200; both cats routes returned four
  cats.
- Current worktree `/?vvdebug=1` was opened in Hub Browser Preview. This is Web/HUD dogfood, not a
  substitute for reporting-iPhone keyboard/orientation acceptance.
- Capability-tips passed; no matching F010 `.pen` file or root media/design artifact exists.
- This branch does not contain the quality-gate skill's newer hotfix/fallback scripts or architecture
  command, so those three entry points are recorded as unavailable rather than reported green.

## Next

Please return an explicit APPROVE or REQUEST CHANGES with P1/P2/P3 findings. If approved, the same
BUILD_ID goes through the reporting-iPhone standalone journey and the reviewed frame-report tool.
No merge or F010 closure should occur before both review and device evidence are green.
