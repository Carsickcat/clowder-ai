# F010 Mobile PWA A0–A3 code review request

Author: 宪宪 (`sonnet`, gpt-5.6-sol)

Review-Target-ID: `f010`

Branch: `feat/f010-mobile-pwa`

Diff: `461c5e3..HEAD`

Truth source: `docs/design/F010-mobile-pwa-standard.md`

Quality evidence: `project-evidence/f010-mobile-pwa/README.md`

## What changed

- Unified the `<768 / 768–1023 / >=1024` responsive contract behind one JSON truth source consumed by Tailwind and JS.
- Added one AppShell-owned mobile global drawer with Threads, Memory, Mission, Signals, Settings, and the persistent PWA install entry.
- Added the four compact work surfaces and explicit global/current-thread approval scope.
- Hardened safe-area, visual viewport, keyboard, overflow, and 44px touch behavior.
- Replaced the candidate install prompt with an installability state machine, platform/manual guidance, durable 30-day dismissal, and precise diagnostics.
- Added foreground/online recovery, a non-silent SW update controller, cancelable pre-reload draft protection, and NetworkOnly upload/business-artifact routing.
- Fixed a production-only SSR crash found during browser dogfood by keeping install facts deterministic until hydration completes.
- Repaired Terra's modal-focus P2 with a shared focus boundary, dialog semantics, Tab/Shift+Tab containment, Escape handling, and real AppShell opener restoration (`e92afd4`).
- Repaired the remaining review blockers in `e74be7c`: an AppShell-resident all-thread/Approval Hub transient-work guard, explicit Workbox waiting-worker activation, foreground recovery without SW, runtime manifest verification, and install-banner layering below mobile work surfaces.
- Repaired Terra's mount-before-installing P2 in `fbe4e6d` by observing an already-present installing worker through the same deduplicated path used by recovery and future `updatefound` events.
- Repaired Opus 4.5's chat-composer overlap P2 in `5429913`: chat surfaces no longer render the contextual banner, while the persistent drawer entry keeps installation discoverable. A real-component integration test proves the existing drawer→guide→close focus restoration, so that separate concern required no production patch.
- Repaired Terra's single-use install-prompt P2 in `986049e`: the deferred event is cleared before its first `prompt()` attempt, so dismissal or an exception falls back to manual guidance without offering a stale native action.
- Repaired Opus 4.5's 768–1023 drawer-close P2 in `986049e`: thread create/select paths now consume the shared `RESPONSIVE_BREAKPOINTS.wide` boundary and close throughout the complete mobile work surface.

## Why

F010 must remain one Next.js product and one state/data model. The change re-composes that product for mobile instead of shrinking the desktop three-column shell or creating a second native UI. Installation is treated as one subcapability; navigation, touch, keyboard, recovery, update safety, and data-cache semantics remain first-class acceptance concerns.

## Original Requirements

> operator 首次从手机通过 Tailscale 访问时，现有网页样式不好用；希望判断做 App 还是 PWA，并要求功能和样式与当前产品保持一致。

- 来源：thread `thread_mrogfco44bos1sgn`, message `0001784263666837-000118-0c1774b0`
- 请对照这条原始体验判断交付物是否解决“同一产品在手机上可用”，而不只是“能安装”。

## Tradeoff

本阶段不复制 Swift/Flutter/React Native 客户端；选择同一 Next.js 产品的响应式 PWA，以共享业务状态和数据真相源。原生壳只在未来出现 Web 无法满足的系统能力时进入能力门。

## Architecture Ownership

- Architecture cell: `hub-action-surface`（主）；`thread-navigation`、`approval-index`（相邻消费）
- Map delta: none
- Why: 只重组既有 Hub、ThreadSidebar、ApprovalPanel 与 Service Worker 生命周期观察，不改变 owner、数据边界、扩展点或 canonical store。

请 reviewer 检查 diff 是否与 `Map delta: none` 一致，并确认没有新建并行 Store / Queue / Router / Adapter / Dispatcher / Binding。

## Open Questions

### 技术 OQ

1. `fbe4e6d` 是否完整覆盖 registration 首次取得、同一对象恢复重查与未来 `updatefound` 三个 installing-worker 入口，同时保持单 worker 单监听？
2. `5429913` 以 surface ownership 隐藏聊天页 contextual banner、保留抽屉持久入口，是否比猜测 composer 高度更稳健？
3. 真实 `MobileGlobalNavDrawer` 集成测试是否足以证明抽屉卸载时先归还持久 opener、安装说明关闭时最终回到同一 opener？

### 价值 OQ

无；本轮只是已批准更新协议内的可逆代码修复。

## Review focus

Please inspect the complete diff, with extra attention to:

- `packages/web/src/components/AppShell.tsx`
- `packages/web/src/components/MobileGlobalNavDrawer.tsx`
- `packages/web/src/components/MobileOpsShell.tsx`
- `packages/web/src/components/ChatContainer.tsx`
- `packages/web/src/components/ChatInput.tsx`
- `packages/web/src/components/ApprovalPanel.tsx`
- `packages/web/src/components/PwaInstallPrompt.tsx`
- `packages/web/src/hooks/useModalFocus.ts`
- `packages/web/src/components/pwa/PwaInstallExperienceProvider.tsx`
- `packages/web/src/components/pwa/PwaUpdateController.tsx`
- `packages/web/src/components/pwa/PwaTransientWorkGuard.tsx`
- `packages/web/src/lib/pwa-installability.ts`
- `packages/web/next.config.js`
- all F010-related tests in `packages/web/src/**/__tests__`

Check especially:

1. one owner for mobile drawer state and no duplicate navigation authority;
2. breakpoint boundary behavior at 768 and 1024;
3. install prompt eligibility/dismissal under denied storage, WebView, offline, standalone, and native-prompt failure;
4. update flow cannot lose text/reply/attachment/approval transient state across route/surface unmounts, activate before consent, or reload more than once;
5. API, Socket, uploads, and business artifacts never become stale offline truth;
6. SSR/hydration safety of all browser-only facts;
7. desktop AppShell and global approval semantics remain intact.
8. modal focus cannot leave the drawer/install sheet and always returns to a still-mounted opener;
9. manifest 404/HTML and no-Service-Worker environments remain truthful and recoverable.
10. contextual install UI never obscures chat composer controls, while installation remains discoverable.
11. a consumed `beforeinstallprompt` event can never be offered a second time after dismissal or exception;
12. both thread-create and thread-select close the drawer across the complete `<1024` mobile work surface.

## Review Sandbox

- Path: `E:\ClowderAI\clowder-ai-f010-local-sandbox`（当前项目尚无正式 remote；reviewer 只读该本地 Git sandbox）
- Start Command: `pnpm --filter @cat-cafe/web build`，随后从 `packages/web` 运行 `node node_modules/next/dist/bin/next start -p 4310 -H 127.0.0.1`
- Ports: `web=4310`, `api=4311`（4311 使用隔离 503 stub，不连接 runtime）

## Verification already run

- Pre-review broad suite: 19 files / 359 tests passed; post-P2 suite: 18 files / 83 tests; post-review transaction suite: 20 files / 112 tests passed.
- Next/PWA configuration: 8/8; no-hardcoded-colors rule passed.
- Repository lint: exit 0; Web TypeScript: exit 0.
- Repository production build: exit 0; post-review Web production build: exit 0 with 22 routes.
- Generated `sw.js` exposes the gated `SKIP_WAITING` message protocol, retains `clientsClaim`, and places `/api`, `/socket.io`, and `/uploads/` NetworkOnly routes before static caching.
- Production browser matrix: 390×844, 430×932, 768×1024 dark, 1024×768 desktop; HTTP 200, no overflow, no page errors; server log clean after SSR repair.
- Post-P2 real Chrome keyboard path at 390×844: drawer 14-control and install-sheet 2-control focus boundaries wrap in both directions; Escape closes and restores `mobile-global-nav-trigger`; screenshot `project-evidence/f010-mobile-pwa/focus-trap-install-sheet.png`.
- Full Web baseline: 5005/5071 passed. The 66 failures are isolated to 11 pre-existing files and documented in the evidence report; none are F010 tests.
- Full check baseline limitations (Windows child process resolution and one unrelated API Biome format item) are documented rather than silently waived.
- Post-`986049e` repair: focused Red was 4 failed / 10 passed, focused Green is 14/14, and the fresh F010 selection is 21 files / 103 tests. Next/PWA 8/8, TypeScript, ESLint, targeted Biome, capability tips, hardcoded-color rule, production build, and `git diff --check` pass.
- Isolated `986049e` preview: `/settings` returned HTTP 200 (42,830 bytes) on port 4310 and opened in Hub Browser Preview; the command-line-verified listener was stopped and the port was confirmed clear.

## Re-review delta: `fbe4e6d`

Terra's re-review found one additional P2: if `registration.installing` already existed before `PwaUpdateController` mounted, the controller could miss `updatefound` and never surface the worker when it reached waiting.

- Red→Green: the new mount-before-installing regression failed on the prior implementation (7/8), then passed after the repair (8/8).
- Failure-mode audit: initial registration discovery, same-registration foreground/online recovery, and future `updatefound` now share one installing-worker observer; the same worker is never subscribed twice.
- Fresh verification: 19 F010 Vitest files / 96 tests, Next/PWA 8/8, no-hardcoded-colors, TypeScript, ESLint, targeted Biome, capability-tips, and Web production build all pass.
- Production dogfood: `/` and `/manifest.json` returned HTTP 200 in the isolated 4310/4311 preview; generated `sw.js` has one message-gated `skipWaiting()` call; Hub Browser Preview opened successfully.
- Baseline disclosure: a fresh full-Web run still fails in non-F010 suites, and root `pnpm check` still stops on the unrelated committed `SocketManager.ts` format error. Neither was modified or reported as green.

## Re-review delta: `5429913`

Opus 4.5's re-review of `461c5e3..c882900` reported two P2 items and one P3 in addition to the already-repaired installing-worker issue.

- **P2 chat banner/composer overlap — fixed.** The new regression was red on the prior implementation because `hasMobileNav=true` still rendered `pwa-install-banner`. Chat surfaces now suppress the contextual banner and retain the persistent drawer entry; the focused tests are green.
- **P2 drawer/install focus handoff — verified, no source change.** A new integration test mounts the real `MobileGlobalNavDrawer`, focuses its install entry, opens the shared install guide, closes it with Escape, and verifies `document.activeElement` is the persistent AppShell-style menu trigger. This test passed on the pre-fix production code and remains green, matching the earlier real-Chrome keyboard evidence; adding another focus fallback would duplicate a mechanism that already works.
- **P3 dismissal when storage is unavailable — non-blocking pushback.** The provider's catch path retains dismissal in React state for the current document session. A browser refresh creates a new document session; persisting across refresh without Web Storage would require a second persistence mechanism such as a cookie, which is outside the approved 30-day local-storage contract and would add fallback complexity without a P1/P2 user-safety benefit.
- **Fresh verification:** 20 F010 Vitest files / 98 tests, Next/PWA 8/8, no-hardcoded-colors rule, TypeScript, ESLint, targeted Biome, capability-tips, and Web production build all pass. The build generated 22 routes and the custom PWA worker.
- **Preview evidence:** isolated port 4310 returned `/settings` as HTTP 200; Hub Browser Preview opened both `/settings` and the current chat route. The exact listener process was command-line verified, stopped, and the port confirmed clear.

## Re-review delta: `986049e`

Terra found that `beforeinstallprompt` is a single-use capability, while Opus 4.5 found that `ThreadSidebar` still treated only `<768` as mobile even though F010 defines the mobile work surface as `<1024`.

- **P2 single-use prompt — fixed.** The focused tests failed on the prior implementation because a dismissed or thrown prompt still exposed "立即安装". The provider now consumes the deferred event before calling `prompt()`; both cases fall back to manual guidance without a stale retry. Chrome's first-party lifecycle contract is recorded in the quality evidence.
- **P2 768–1023 drawer close — fixed.** Both creation and selection now share one helper backed by `RESPONSIVE_BREAKPOINTS.wide`; tests cover close at 768 and 1023 and preserve the no-close desktop behavior at 1024.
- **Red→Green:** the two focused suites moved from 4/14 failures to 14/14 passing. The complete fresh F010 selection is 21 files / 103 tests.
- **Failure-mode audit:** no other affected create/select sibling retains a hard-coded `<768` close rule, and no other deferred-prompt consumer can retain the event after an attempt. Architecture ownership remains `Map delta: none`.

## Known boundary and risk

- This is a temporary local Git sandbox because the project does not yet have the operator's formal repository. Do not merge or push; review the local diff/commits.
- AC-A4 real iPhone/Android journeys and Tailscale HTTPS evidence remain operator/device work. A code approval is not a feature-complete declaration.
- The isolated browser preview intentionally had no API; the desktop screenshot's recoverable session warning is expected.
- Highest-risk areas are update/draft coordination, SSR/browser state boundaries, and Workbox route ordering.
- Earlier verdicts were mixed: Fable 5 approved the pre-latest delta, while Terra and Opus 4.5 requested changes that are addressed above. Because `fbe4e6d` and `5429913` changed executable behavior, all three reviewers are asked for a fresh verdict on current HEAD.

## Requested verdict

Return one explicit verdict: `APPROVE` or `REQUEST_CHANGES`. Every finding must include severity (`P1`, `P2`, or `P3`), exact file/line evidence, impact, and a concrete recommended resolution. P1/P2 must be clear blockers; P3 must be explicitly non-blocking.

## Next Action

Terra、Opus 4.5、Fable 5 请各自复核完整 `461c5e3..HEAD`，重点审查 `fbe4e6d` 与 `5429913` 的新增行为，并分别给出当前 HEAD 的明确 verdict。不要沿用旧 SHA 的结论。

[宪宪/gpt-5.6-sol🐾]
