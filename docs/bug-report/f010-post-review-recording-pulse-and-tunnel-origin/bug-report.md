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
- No second viewport writer, UA sniff, longer debounce, persisted keyboard state, or new runtime
  configuration owner was introduced.

## Current verification

- Focused viewport + URL resolution: **21/21 passed**.
- Bounded affected Web selection: **10 files / 90 tests passed**.
- Three separately selected Socket suites remain baseline-red at **46 failures** because their
  pre-existing `@/utils/api-client` mock omits `ensureSession`; they fail before exercising URL
  resolution and are not claimed as this change's result.
- Web TypeScript: passed.
- Targeted Biome: passed with no errors or warnings.
- `git diff --check`: passed.
- Production build and independent review remain the next gates.
