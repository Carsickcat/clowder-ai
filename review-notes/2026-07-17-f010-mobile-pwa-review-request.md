# F010 Mobile PWA A0–A3 code review request

Author: 宪宪 (`sonnet`, gpt-5.6-sol)

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

## Why

F010 must remain one Next.js product and one state/data model. The change re-composes that product for mobile instead of shrinking the desktop three-column shell or creating a second native UI. Installation is treated as one subcapability; navigation, touch, keyboard, recovery, update safety, and data-cache semantics remain first-class acceptance concerns.

## Review focus

Please inspect the complete diff, with extra attention to:

- `packages/web/src/components/AppShell.tsx`
- `packages/web/src/components/MobileGlobalNavDrawer.tsx`
- `packages/web/src/components/MobileOpsShell.tsx`
- `packages/web/src/components/ChatContainer.tsx`
- `packages/web/src/components/ChatInput.tsx`
- `packages/web/src/components/ApprovalPanel.tsx`
- `packages/web/src/components/PwaInstallPrompt.tsx`
- `packages/web/src/components/pwa/PwaInstallExperienceProvider.tsx`
- `packages/web/src/components/pwa/PwaUpdateController.tsx`
- `packages/web/src/lib/pwa-installability.ts`
- `packages/web/next.config.js`
- all F010-related tests in `packages/web/src/**/__tests__`

Check especially:

1. one owner for mobile drawer state and no duplicate navigation authority;
2. breakpoint boundary behavior at 768 and 1024;
3. install prompt eligibility/dismissal under denied storage, WebView, offline, standalone, and native-prompt failure;
4. update flow cannot lose text/reply/attachment/approval transient state or reload more than once;
5. API, Socket, uploads, and business artifacts never become stale offline truth;
6. SSR/hydration safety of all browser-only facts;
7. desktop AppShell and global approval semantics remain intact.

## Verification already run

- F010 affected suite: 19 files / 359 tests passed.
- Next/PWA configuration: 7/7; no-hardcoded-colors rule passed.
- Repository lint: exit 0; Web TypeScript: exit 0.
- Repository production build: exit 0; post-SSR-fix Web production build: exit 0.
- Production browser matrix: 390×844, 430×932, 768×1024 dark, 1024×768 desktop; HTTP 200, no overflow, no page errors; server log clean after SSR repair.
- Full Web baseline: 5005/5071 passed. The 66 failures are isolated to 11 pre-existing files and documented in the evidence report; none are F010 tests.
- Full check baseline limitations (Windows child process resolution and one unrelated API Biome format item) are documented rather than silently waived.

## Known boundary and risk

- This is a temporary local Git sandbox because the project does not yet have the operator's formal repository. Do not merge or push; review the local diff/commits.
- AC-A4 real iPhone/Android journeys and Tailscale HTTPS evidence remain operator/device work. A code approval is not a feature-complete declaration.
- The isolated browser preview intentionally had no API; the desktop screenshot's recoverable session warning is expected.
- Highest-risk areas are update/draft coordination, SSR/browser state boundaries, and Workbox route ordering.

## Requested verdict

Return one explicit verdict: `APPROVE` or `REQUEST_CHANGES`. Every finding must include severity (`P1`, `P2`, or `P3`), exact file/line evidence, impact, and a concrete recommended resolution. P1/P2 must be clear blockers; P3 must be explicitly non-blocking.

[宪宪/gpt-5.6-sol🐾]
