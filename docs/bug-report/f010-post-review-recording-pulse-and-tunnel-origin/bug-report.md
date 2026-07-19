# F010 post-review recording: pulsed viewport collapse and explicit-HTTPS origin drift

Date: 2026-07-19
Reporter: co-creator, via the reporting iPhone installed PWA
Recording: `C:\Users\myh_1\Desktop\录屏.mp4`
SHA-256: `81376E69119A1685D89BD83F150B62F427B08050D7206029AD0711D2FDA71D2A`

## Diagnostic capsule

| Field | Content |
|---|---|
| **1. Symptoms** | Expected: focusing the composer keeps the chat shell visible and `@` lists the routable cats. Actual: the post-`87ffdd5` recording shows the complete shell disappearing for roughly one second during keyboard opening; later the mention picker contains only `@thread` and `@all`. |
| **2. Evidence** | The HEVC recording was created at `2026-07-18T19:24:43Z`, after Web PID `17084` started at `19:05:53Z` from the reviewed build. Frame review shows a complete shell before focus, a native keyboard/accessory row with no web shell during the opening pulse, and an empty cat section in the picker. Runtime preflight: Web `4310/PID 17084`; API `4311/PID 7580`; worktree HEAD `59a9eb9`; reviewed runtime commit `87ffdd5`. Tailscale currently exposes same-origin `/api` and `/socket.io` on HTTPS `8443`; Kimi restored compatibility port `8444` after the recording. |
| **3. Hypotheses to verify** | Viewport: a near-zero intermediate `visualViewport.height` can remain event-quiet longer than the fixed 120 ms settle timer, so `commitSettledFrame` publishes it to the whole `.app-viewport`. The existing regression only keeps the bad frame alive for one animation frame. Networking: `resolveApiUrl` treats every explicit browser port as direct Web+1 API access, so HTTPS reverse-proxy origin `:8443` becomes `:8444`; losing that optional mapping empties client-fetched cats and disconnects Socket.IO despite valid same-origin proxy routes. |
| **4. Diagnostic strategy** | Reverse-trace recording → viewport event sequence → the hook's only CSS-variable writer → `.app-viewport`; reproduce a bad height that outlives the quiet window before a scroll-only terminal frame. Separately freeze explicit HTTPS `:8443` resolution as a same-origin contract while retaining HTTP direct-port `+1` behavior. |
| **5. Timeout strategy** | If either focused RED does not fail for the stated reason, stop before implementation and return to source/runtime tracing. Do not tune another debounce delay. |
| **6. Warning strategy** | A third geometry owner, UA sniff, device-specific ratio, or another longer timer means the coordinate model is wrong. A networking fix that still requires a second HTTPS port has not removed the configuration drift. |
| **7. User-visible correction** | Keyboard opening may hide secondary chrome and move to its terminal height, but the whole shell can never collapse through an unusable intermediate frame. HTTPS reverse-proxy access uses its own origin for session, cats, messages, and sockets, so the picker does not depend on a separate `:8444` mapping. |
| **8. Acceptance** | RED→GREEN tests cover an unusable viewport pulse that survives the settle timer and then a valid scroll-only terminal frame; API URL tests cover explicit HTTPS same-origin and preserve explicit HTTP direct-port derivation. Focused suites, affected Web tests, TypeScript, format/diff checks, and production build must pass before deployment. |

## Runtime preflight

```text
PORT=4310
PID=17084
START_TIME=2026-07-18T19:05:53.3855958Z
HEAD=59a9eb952163d9c44f135855ca01f673309338a0
TARGET_COMMIT=87ffdd5aa52a819b5ca8025c1800f9969b459136
PROCESS_AFTER_TARGET=yes
LOG_EVIDENCE=0 (the Web process does not write the API log)

PORT=4311
PID=7580
START_TIME=2026-07-18T01:31:24.8746420Z
HEAD=59a9eb952163d9c44f135855ca01f673309338a0
TARGET_COMMIT=87ffdd5aa52a819b5ca8025c1800f9969b459136
PROCESS_AFTER_TARGET=no (the viewport change is Web-only; API identity is recorded separately)
LOG_EVIDENCE=0 in the worktree-local `api.log`
```

## Claim grounding

- Recording freshness: **verified (T0)** by file hash/media creation time and the Web listener start time.
- `8444` restoration: **verified (T0)** by `tailscale serve status` plus HTTPS `8444/api/health = 200` and `8444/api/cats = 200`.
- Proposed code causes: still hypotheses until the focused tests fail for the expected reason.

## Root cause confirmation

Both focused tests failed before implementation for the predicted values:

- the pulse test received `--app-viewport-height: 112px` instead of retaining `844px`;
- the explicit HTTPS test resolved `https://desktop.example.ts.net:8444` instead of the page origin
  `https://desktop.example.ts.net:8443`.

The viewport failure is therefore not an insufficiently long test wait or an unverified device guess:
the fixed quiet timer admits an event-silent near-zero frame into the only whole-shell geometry
writer. The mention failure is not parser or roster data: the client constructed a dead second TLS
origin before `/api/cats` and Socket.IO could use the valid same-origin proxy.

## Repair

- `useVisualViewportCssVars` now keeps the last usable whole-shell geometry when a composing frame is
  below the bounded minimum height; keyboard state still latches and the next valid resize/scroll
  frame commits normally.
- `resolveApiUrl` now keeps explicit HTTPS access on the page origin. HTTP direct access retains the
  existing Web+1 convention.
- The usable-shell floor is bounded at 144px rather than 240px, so an already-landscape PWA can
  still commit a legitimate compact keyboard frame while rejecting the recorded 112px collapse.
- Animation-time frames can latch composing state but cannot stage a geometry baseline; a rejected
  width-changing pulse rolls baseline staging back until a usable terminal frame arrives.
- The Tailscale guard parses only the explicit `:8443` listener block, so routes from `:8444` or any
  other listener cannot satisfy the same-origin contract accidentally.
- No second viewport writer, UA sniff, longer debounce, persisted keyboard state, or new runtime
  configuration owner was introduced.

## Current verification

- Focused viewport + URL resolution: **23/23 passed**.
- Bounded affected Web selection: **10 files / 91 tests passed**.
- Tailscale multi-listener status parser: **2/2 passed**; live guard reports all 8443 routes present.
- Three separately selected Socket suites remain baseline-red at **46 failures** because their
  pre-existing `@/utils/api-client` mock omits `ensureSession`; they fail before exercising URL
  resolution and are not claimed as this change's result.
- Web TypeScript: passed.
- Targeted Biome: passed with no errors or warnings.
- `git diff --check`: passed.
- Exact candidate `466436f` production build: passed; isolated BUILD_ID
  `NLgMJFRRSV9bzl_iQLbc5` served HTTP 200 on temporary port 4312 from PID `35176` and opened in Hub
  Browser Preview. The temporary listener was terminated after verification.
- Independent review remains the next gate; reporting-iPhone replay remains the device acceptance.

## 2026-07-19 follow-up: `录屏2.mp4` invalidates threshold-based shell projection

`录屏2.mp4` (SHA-256
`E6826F1A47CC0ECA51A14981B88A9C6E6656FF7C852673FB84236A64E83BFC8E`) was recorded after the
`KpKOypWIwv_tNKdAuPlWs` candidate was deployed. It contains two distinct failures: the composer is
outside the visible region for multiple intervals, and the AppShell/header/transcript disappear
together for post-launch runs of 2.0 s and 1.0 s. The reviewed frame-report harness (`8442c8b`,
schema 1.1.0) reports both post-launch shell verdicts as false.

The direct root-collapse path remained in `fbb2850`: the hook projected
`Math.min(baseline.height, window.innerHeight)` to `--app-viewport-height`. The alleged stable shell
therefore still consumed an unconfirmed keyboard-animation value. Existing tests fixed
`innerHeight` at a safe value and did not exercise the reporting-iPhone path.

### Superseding RED evidence

Before the final implementation, the focused suite failed with the exact unsafe projections:

- a settled `innerHeight=112px` / VV pulse projected a 112px root instead of retaining 844px;
- a non-zero intermediate `innerHeight=420px` projected a 420px root instead of retaining 844px;
- an opening `innerHeight=500px` projected a 500px root instead of retaining 844px;
- the installed-PWA `/` start URL exposed no trace, so build/controller identity could not accompany
  a standalone replay without a query-bearing webclip.

These failures supersede the earlier 144px floor. The final contract is not another lower bound:
from composer focus through confirmed close, no `innerHeight`, VisualViewport height/top, or
orientation frame may replace the last confirmed unobscured shell width/height.

### Final repair under review

- Root width and height always project the confirmed baseline while focus/keyboard state is active.
- Width-changing orientation frames are staged only as a candidate; two matching unobscured reads
  are required before close adopts a new baseline and returns the Dock.
- Keyboard overlap remains a composer-only projection; root top/left remain `0px`.
- An acceptance-build flag can expose the already reviewed, bounded viewport trace on standalone
  `/`; normal builds remain query-gated and no Service Worker/update policy is changed.
- Catalog presentation now distinguishes loading, retryable fetch failure, confirmed empty, and
  ready. A failed cold fetch shows an explicit retry instead of the false irreversible “no members”
  first-run state.

### Verification before exact-commit deployment

- Focused/affected mobile selection: **9 files / 100 tests passed**.
- Viewport state machine: **25/25 passed**; catalog presentation: **4/4 passed**; catalog retry:
  **3/3 passed**.
- Web TypeScript and repository lint: passed. Target Biome (four new/rewritten core files) and
  `git diff --check`: passed.
- Acceptance-flag production Web build: passed.
- Full Web Vitest has one unrelated baseline failure: `MobileStatusSheet.tsx` lacks the F190 modal
  scrim pattern; that file is unchanged by F010. The package test wrapper also cannot spawn `pnpm`
  on this Windows host (`spawn pnpm ENOENT`).
- Repository `pnpm test` is blocked before API assertions by POSIX inline-env syntax on Windows;
  repository `pnpm check` is blocked by three pre-existing formatting errors
  (`SocketManager.ts`, `mobile-shell.css`, and historical CRLF in `ChatContainer.tsx`). The bounded
  changed-file gates above are green and no unrelated baseline file is reformatted in this fix.

The remaining release gates are an exact-commit acceptance build, independent cross-cat review, and
one reporting-iPhone standalone replay whose HUD/trace and frame report prove both shell and composer
behavior. This section does not claim device acceptance before those artifacts exist.

### Exact acceptance artifact

The reviewed implementation commit is `f3565b240fe203a4f04ea504061c5b9aef8c62a6`. A production
acceptance build was created from that exact commit with the process-only
`NEXT_PUBLIC_VIEWPORT_TRACE=1` flag and has BUILD_ID `ZoOUsD6wW6PKZzAKeGvZY`.

```text
PORT=4310
PID=4456
START_TIME=2026-07-19T15:20:02.0998763+08:00
TARGET_COMMIT=f3565b240fe203a4f04ea504061c5b9aef8c62a6
BUILD_ID=ZoOUsD6wW6PKZzAKeGvZY

PORT=4311
PID=7580 (unchanged)
```

Both `http://localhost:4310` and
`https://desktop-9o1va3o.tail58c13e.ts.net:8443` returned HTTP 200 for the page, exact build
manifest, and `/api/health`; `/api/cats` returned four cats through both origins. Hub Browser
Preview opened the exact local root. The final reporting-iPhone replay must show the same BUILD_ID
in its HUD before the keyboard journey begins; any other ID is not evidence about this candidate.
