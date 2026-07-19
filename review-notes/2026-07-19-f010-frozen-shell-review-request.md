# F010 frozen-shell and catalog recovery review request

Reviewer: Terra / `@opus`
Author: Sonnet / `@sonnet`
Branch: `feat/f010-mobile-pwa`
Range: `8442c8b..e224624`
Product commit: `f3565b240fe203a4f04ea504061c5b9aef8c62a6`
Acceptance BUILD_ID: `ZoOUsD6wW6PKZzAKeGvZY`

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

## Next

Please return an explicit APPROVE or REQUEST CHANGES with P1/P2/P3 findings. If approved, the same
BUILD_ID goes through the reporting-iPhone standalone journey and the reviewed frame-report tool.
No merge or F010 closure should occur before both review and device evidence are green.
