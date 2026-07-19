# F010 iOS Keyboard Geometry Incident Implementation Plan

**Feature:** F010 — `docs/features/F010-mobile-cat.md`
**Goal:** 在 reporting iPhone 的 installed PWA 中，连续聚焦中文输入框时 AppShell、header 与 transcript 保持可见且不跳动；composer 只在系统键盘上方稳定停靠；猫猫 roster 在冷启动时不再错误显示为空。
**Acceptance Criteria:** 满足 F010 的移动软键盘、单一滚动 owner、44px 触控与真机关键旅程要求；两次连续 focus/blur 的每一帧 AppShell 均可见；`@` picker 在 catalog 加载完成后显示可调用猫猫；iPhone 录屏同时包含 BUILD_ID、API origin 与几何 trace；实现经跨猫 review 后再部署。
**Architecture cell:** `hub-action-surface` (consumer surface; no ownership-map change)
**Map delta:** none
**Map delta why:** 本切片只纠正既有 AppShell 的 transient geometry projection 与聊天 catalog loading presentation，不创建业务 store、API 或持久化边界。
**Architecture:** `useVisualViewportCssVars` 是唯一的 transient geometry owner。它区分“未遮挡 shell baseline”与“键盘 overlap”：composer focus 到 confirmed close 期间，任何 `window.innerHeight` 或 `VisualViewport` 脉冲均不得写入 shell width/height；它们只可在确认后更新 composer inset。一个 query-gated、内存有界的 trace 记录每个事件、读数、CSS 投影和真实 rect，用同一段 iPhone 录屏裁决原生 pan、root collapse 或 composer feedback。
**Tech Stack:** Next.js/React, TypeScript, CSS custom properties, Vitest/Testing Library, iPhone installed-PWA video acceptance.
**前端验证:** Yes — compact browser contract + reporting iPhone standalone replay are both required; Chrome does not replace the device verdict.

---

## Finish line

连续两次“打开 PWA → 点 composer → 中文 IME → 输入 `@` → 收键盘”期间，应用壳不会变空、header/transcript/composer 不会整体离开可见区域；Dock 只在确认 composing 时退出，composer 的最终底边贴在系统可见底边之上。冷启动尚未得到 catalog 时显示 loading/retry，不得伪装成“没有可用成员”。

**Not building:** 不改变 Service Worker 更新策略、不强制 `skipWaiting`、不删除 operator 的 PWA 图标、不写 UA/机型像素、不开第二条 API 入口、不增加 `scrollTo` 循环或 Form Assistant reserve。

## Stateful-object census

| Object | Owner | Lifetime | Storage | Prohibited side channel |
|---|---|---|---|---|
| `KeyboardGeometrySession` | `useVisualViewportCssVars` | mount → unmount | closure/ref only | AppShell/ChatContainer 不得自行改 CSS geometry token |
| `ViewportTrace` | same hook, only `?vvdebug=1` | mount → unmount, capped ring buffer | closure + debug DOM/console only | 不写 localStorage、API 或业务 store |
| `CatCatalogPresentation` | `useCatData` consumer | mount/retry lifecycle | existing query state | empty roster 不得被解释为 first-run before fetch settles |

### Geometry state × event table

| State | Event | Next | Root shell projection | Composer projection |
|---|---|---|---|---|
| `unobscured-stable` | composer `focusin` | `opening` | freeze last confirmed frame | retain last inset |
| `opening` | resize/scroll/innerHeight pulse | `opening` or `composing` | **unchanged** | only record provisional values |
| `composing` | stable overlap sample | `composing` | **unchanged** | commit one bounded inset |
| `composing` | focusout/restoring frame | `closing` | **unchanged** | retain last inset/Dock hidden |
| `closing` | two consistent unobscured samples | `unobscured-stable` | adopt new baseline once | inset `0`, Dock returns |
| any focused state | orientation event | `orientation-pending` | retain old baseline until close-confirmation | trace only; no keyboard-frame rebase |

### Invariants

- **INV-G1:** From composer focus until confirmed close, `--app-viewport-{width,height}` never consumes `window.innerHeight`, `visualViewport.height`, or `offsetTop` from a keyboard event.
- **INV-G2:** `top/left` for the fixed AppShell remain `0px`; no viewport offset is applied as a second root translation.
- **INV-G3:** Only the geometry hook writes shell/inset variables. The composer is the only keyboard-overlap consumer; transcript padding is derived from its committed inset, never a separate reserve.
- **INV-G4:** Trace records event source, event timestamp, `innerHeight`, VV rect, document/transcript scroll, AppShell/header/composer rect, active element and committed CSS variables; it is absent unless `vvdebug=1`.
- **INV-G5:** A pending/failed catalog fetch never renders the irreversible first-run/“no cats” state; successful retry updates the same picker without remounting the composer or erasing draft/IME composition.

### Adversarial cases

1. Focus composer; `innerHeight` and VV height both become `112px` for more than 120ms. Root keeps its `844px` baseline.
2. Focus composer; a non-zero intermediate `innerHeight=420px` is also rejected as root geometry, not merely near-zero values.
3. VV `scroll` emits pan after resize; it can classify keyboard state but cannot alter root rect.
4. Blur through restoring pulses; Dock cannot flash until two close samples agree.
5. Open keyboard twice in one page session; both traces have no root collapse and composer has a final stable rect.
6. Cold API catalog followed by successful retry: no fake first-run card, `@` picker acquires cats, draft persists.
7. Unmount with rAF/timer pending: no later style/data write.

## Task 1: Record the real geometry before changing it

**Files:**
- Modify: `packages/web/src/hooks/useVisualViewportCssVars.ts`
- Modify: `packages/web/src/components/AppShell.tsx` or a narrowly-owned debug presenter
- Test: `packages/web/src/hooks/__tests__/useVisualViewportCssVars.test.tsx`

1. Add a failing test for `?vvdebug=1` trace enablement, event ordering and bounded cleanup; normal URLs expose no debug output.
2. Implement a capped, read-only trace and a compact diagnostic overlay/copyable payload. Every record is captured both before and after a projection attempt.
3. Run RED then GREEN; verify cleanup removes listeners, timers and debug nodes.

## Task 2: Replace keyboard-time root geometry with a true frozen baseline

**Files:**
- Modify: `packages/web/src/hooks/useVisualViewportCssVars.ts`
- Modify only if required: `packages/web/src/app/console-shell.css`, `packages/web/src/app/mobile-shell.css`, `packages/web/src/components/ChatContainer.tsx`
- Test: `packages/web/src/hooks/__tests__/useVisualViewportCssVars.test.tsx`

1. Write the seven adversarial RED contracts above, especially the actual `innerHeight=112px` and `420px` pulse paths that the current suite omits.
2. Remove the `min(baseline.height, window.innerHeight)` root write during `opening`, `composing` and `closing`; root dimensions derive exclusively from the last confirmed unobscured baseline.
3. Commit composer overlap only from confirmed stable samples. If the trace shows native pan or transform feedback instead of a root collapse, take that single branch and delete the competing compensation rather than layering a second fix.
4. Verify root/AppShell rect remains stable in unit tests and a 390px browser preview; preserve 16px textarea, 44px controls, Chinese IME, attachments, mentions, drafts and desktop behavior.

## Task 3: Make catalog cold start honest and recoverable

**Files:**
- Modify: exact `useCatData` owner and its focused consumer(s) discovered in Task 1
- Modify: `packages/web/src/components/ChatContainer.tsx` only if it owns the false first-run presentation
- Tests: focused `useCatData`/ChatInput/ChatContainer suites

1. RED: pending catalog is not an empty catalog; failed initial fetch exposes retry/loading and does not unmount input or empty the mention picker permanently.
2. GREEN: reuse the existing query owner, retry policy and catalog data; do not create a second cache/store.
3. Verify `@` picker reports four cats in the isolated HTTPS route and Socket remains same-origin.

## Task 4: Prove the device path and review

1. Build the exact candidate in an isolated worktree/port. Record SHA, BUILD_ID, API origin and launch time.
2. Record one trace-enabled reporting-iPhone replay: cold start, focus, Chinese typing, `@`, mention selection, send, blur, refocus. The recording itself must make package identity and geometry values visible.
3. Cross-cat review: Kimi audits frames/density; Sonnet audits lifecycle/cold-start behavior; author cannot approve own code.
4. Only after P1/P2 are zero may the isolated 4310 acceptance build be replaced. The iPhone replay remains the release gate.

