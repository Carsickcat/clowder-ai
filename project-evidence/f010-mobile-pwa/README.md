# F010 Mobile PWA — code quality gate evidence

Date: 2026-07-17

Source of truth: `docs/design/F010-mobile-pwa-standard.md`

Implementation plan: `feature-specs/2026-07-17-f010-mobile-pwa.md`

Temporary local branch: `feat/f010-mobile-pwa` (`461c5e3..HEAD`; review repairs `e92afd4`, `e74be7c`, `fbe4e6d`, `5429913`)

## Verdict

The A0–A3 code slice is in independent code review. Earlier review findings were repaired in `e92afd4` and `e74be7c`; Terra's mount-before-installing finding is repaired in `fbe4e6d`; Opus 4.5's chat-banner finding is repaired in `5429913`. The reported drawer/install focus risk is covered by a real-component integration test and does not reproduce, so no speculative focus patch was added. F010 is **not feature-complete** yet: operator-owned iPhone/Android journeys, the real Tailscale HTTPS install/recovery loop, and final reviewer verdicts on current HEAD remain open.

## Acceptance status

| Acceptance criterion | Status | Evidence / remaining work |
| --- | --- | --- |
| AC-A0 | Partial | Browser viewport matrix is recorded below. Operator device models, real-device friction, and recordings remain open. |
| AC-A1 | Code-complete | One breakpoint source feeds Tailwind and JS; the canonical drawer and four mobile work surfaces are covered by contract/component tests. |
| AC-A2 | Code-complete, real-device pending | Installability diagnostics, runtime manifest status/content-type validation, iOS/manual and native prompt paths, WebView/secure/SW blockers, 30-day dismissal, and permanent entry are tested. Real Tailscale HTTPS install evidence remains open. |
| AC-A3 | Code-complete | Foreground/online recovery works even without SW; new workers wait for consent; all-thread drafts/attachments and Approval Hub transient work veto activation; controllerchange reloads once; NetworkOnly business artifacts are production-built. |
| AC-A4 | Partial | Light compact, dark medium, and light desktop browser evidence exists. iPhone/Android journeys and complete real-device parity remain open. |
| AC-A5 | Pending review | F010-focused tests, lint, typecheck, production build, and browser dogfood pass. The complete current delta awaits independent confirmation from Terra, Opus 4.5, and Fable 5; repository-wide Windows baseline limitations are listed below. |

## Browser viewport matrix

All runs used an isolated production build on port 4310 with Chrome headless and `/settings`. The API was intentionally absent; the desktop screenshot therefore contains the product's expected recoverable session warning.

| Viewport | Mode/theme | Result |
| --- | --- | --- |
| 390×844 | compact / light | HTTP 200; mobile trigger 44×44; drawer panel 343.19×844; install entry 44px high; no horizontal overflow; no browser error. |
| 430×932 | compact / light | HTTP 200; mobile trigger 44×44; drawer panel 360×932; no horizontal overflow; no browser error. |
| 768×1024 | medium / dark | HTTP 200; mobile trigger 44×44; drawer panel 360×1024; no horizontal overflow; no browser error. |
| 1024×768 | wide / light | HTTP 200; mobile trigger hidden; desktop rail 52×768; no horizontal overflow; no browser error. |

Screenshots (maximum three per plan):

- `mobile-390x844.png`
- `medium-dark-768x1024.png`
- `desktop-1024x768.png`
- `focus-trap-install-sheet.png` (post-review keyboard-focus repair evidence)

Visual inspection confirmed drawer/backdrop hierarchy, thread list, global modules, install entry, active Settings state, dark-theme readability, and the 1024px desktop rail/settings layout.

Post-review Chrome keyboard verification at 390×844 confirmed:

- the drawer's 14 focusable controls wrap last→first with Tab and first→last with Shift+Tab;
- the install dialog's 2 focusable controls wrap in both directions;
- both overlays close on Escape and restore focus to `mobile-global-nav-trigger`;
- the install sheet exposes `role="dialog"` and `aria-modal="true"`.

## Automated and build evidence

- Pre-review broad selection: **19 test files, 359 tests passed** (includes the F190 visual contract and Node-only SSR regression).
- Post-P2 exact F010 affected selection: **18 test files, 83 tests passed**; the three modal/AppShell suites contribute 17 passing focus and ownership tests.
- Post-review transaction selection: **20 test files, 112 tests passed**; this includes all-thread attachment/text/reply guards, storage failure, Approval Hub selection/deciding, waiting-worker activation, no-SW recovery, manifest 404/HTML, and the prior focus suites.
- Post-Terra existing-installing repair (`fbe4e6d`): the regression was **RED at 7/8** in the controller suite, then **GREEN at 8/8**; the final F010 selection is **19 Vitest files, 96 tests passed**, including mount-time observation and duplicate-listener prevention during same-registration recovery checks.
- Post-Opus 4.5 chat-surface repair (`5429913`): the banner regression was **RED** because `hasMobileNav=true` still rendered the fixed banner, then **GREEN** after chat surfaces stopped rendering it. The real `MobileGlobalNavDrawer` → install guide → Escape integration test was green before and after the repair and restores focus to the persistent menu trigger. The current F010 selection is **20 Vitest files, 98 tests passed**.
- Next/PWA configuration: **8/8 passed**; `skipWaiting` is explicitly false and API, Socket, and uploads remain on network truth.
- Custom color rule test: passed.
- Repository lint: exit 0 (existing warnings only); Web TypeScript: exit 0.
- Repository production build: exit 0 before the SSR repair; Web production builds after SSR, modal-focus, and transaction repairs: exit 0, 22 routes generated.
- Generated `sw.js`: activation is gated by the `SKIP_WAITING` message listener (no unconditional activation); `/api`, `/socket.io`, and `/uploads/` register `NetworkOnly` before static-asset caching; custom worker generated successfully.
- Isolated production preview on port 4310 returned `/manifest.json` as HTTP 200 `application/json; charset=UTF-8` with name `Clowder AI`; the Hub Browser Preview opened successfully and the exact preview listener was stopped afterward.
- The `fbe4e6d` production recheck returned `/` and `/manifest.json` as HTTP 200; generated `sw.js` contained exactly one `skipWaiting()` call, gated by the `SKIP_WAITING` message branch. The isolated 4310/4311 preview and API-stub listeners were stopped by verified PID afterward.
- The `5429913` production build completed with all 22 routes and a generated custom worker. An isolated 4310 preview returned `/settings` as HTTP 200 and opened both `/settings` and the current thread route in Hub Browser Preview; the exact `next start -p 4310` listener PID was verified by command line, stopped, and the port was confirmed clear.
- Production SSR dogfood after repair: Chrome `pageErrors=[]`; server stdout contained only `Starting` / `Ready`, with no `window is not defined` error.

## Repository-wide baseline limitations

These failures are outside the F010 diff and are not hidden as green:

- Full Web Vitest: **5005/5071 passed**, 66 failures in 11 pre-existing files. Failure families are Windows-only `grep`, stale repo/brand assertions, and pre-existing mocks missing `ensureSession`; no F010 test failed.
- A fresh full-Web rerun after `fbe4e6d` remained red only in non-F010 suites; the scoped 19-file F010 selection remained 96/96 green. This rerun is recorded as baseline-red, not silently promoted to a full-suite pass.
- Full Biome: F010 files are clean; the only remaining error is pre-existing formatting in `packages/api/src/infrastructure/websocket/SocketManager.ts`.
- `check:biome-review-worktrees`, `check:sop-definitions`, and `check:start-profile-isolation` fail because their tests spawn bare `pnpm`/POSIX commands on Windows (`status=null` / `ENOENT`).
- `check:pre-merge-gate` contains platform-specific bash/Redis harness failures. The remaining ten `pnpm check` subchecks pass, including feature truth, capability tips, skills, env checks, guides, follow-up tails, and script encoding.
- The repository's root API test command is not deterministically runnable under this Windows shell: PowerShell cannot parse POSIX env assignment, Git Bash glob expansion exceeds the native Node argument limit, and the programmatic fallback did not terminate. Its orphaned runner and four children were identified by exact sandbox command line and stopped.

## Change set

- `f9817e0` unified responsive breakpoint truth.
- `8a64ac2` added the canonical mobile global drawer.
- `213ed0c` made mobile approval scope explicit.
- `6dc1beb` hardened viewport, keyboard, overflow, and touch behavior.
- `d13124d` added durable install diagnostics.
- `b73071c` added recoverable PWA updates and business-data cache safety.
- `39b61be` aligned the mobile badge with typography tokens.
- `7e03d82` aligned F010 files with repository formatting/a11y checks.
- `0f198d8` made install-state rendering SSR and hydration safe.
- `e92afd4` contained modal keyboard focus and preserved the real AppShell opener for restoration.
- `e74be7c` made update activation transactional, protected cross-route transient work, verified manifest availability, preserved recovery without SW, and kept the install banner below mobile work surfaces.
- `fbe4e6d` observes an installing worker that predates controller mount, reuses the same observer for initial/recovery/`updatefound` entry points, and prevents duplicate listeners for the same worker.
- `5429913` removes the contextual install banner from chat surfaces while preserving the persistent install entry, and locks the existing drawer-to-guide focus handoff with a real-component integration test.

[宪宪/gpt-5.6-sol🐾]
