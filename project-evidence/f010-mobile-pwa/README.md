# F010 Mobile PWA — code quality gate evidence

Date: 2026-07-17

Source of truth: `docs/design/F010-mobile-pwa-standard.md`

Implementation plan: `feature-specs/2026-07-17-f010-mobile-pwa.md`

Temporary local branch: `feat/f010-mobile-pwa` (`461c5e3..HEAD`; modal-focus repair `e92afd4`)

## Verdict

The A0–A3 code slice is in independent code review. Terra's modal-focus P2 is repaired in `e92afd4` and awaits reviewer confirmation. F010 is **not feature-complete** yet: operator-owned iPhone/Android journeys, the real Tailscale HTTPS install/recovery loop, and all requested final reviewer verdicts remain open.

## Acceptance status

| Acceptance criterion | Status | Evidence / remaining work |
| --- | --- | --- |
| AC-A0 | Partial | Browser viewport matrix is recorded below. Operator device models, real-device friction, and recordings remain open. |
| AC-A1 | Code-complete | One breakpoint source feeds Tailwind and JS; the canonical drawer and four mobile work surfaces are covered by contract/component tests. |
| AC-A2 | Code-complete, real-device pending | Installability diagnostics, iOS/manual and native prompt paths, WebView/secure/SW blockers, 30-day dismissal, and permanent entry are tested. Real Tailscale HTTPS install evidence remains open. |
| AC-A3 | Code-complete | Foreground/online recovery, non-silent SW update, cancelable pre-reload flush, draft/attachment protection, and NetworkOnly business artifacts are tested and production-built. |
| AC-A4 | Partial | Light compact, dark medium, and light desktop browser evidence exists. iPhone/Android journeys and complete real-device parity remain open. |
| AC-A5 | Pending review | F010-focused tests, lint, typecheck, production build, and browser dogfood pass. Terra's P2 repair awaits confirmation and every requested reviewer must still return an independent final verdict; repository-wide Windows baseline limitations are listed below. |

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
- Next/PWA configuration: **7/7 passed**; API, Socket, and uploads remain on network truth.
- Custom color rule test: passed.
- Repository lint: exit 0 (existing warnings only); Web TypeScript: exit 0.
- Repository production build: exit 0 before the SSR repair; Web production builds after both the SSR repair and modal-focus repair: exit 0, 22 routes generated.
- Generated `sw.js`: `/socket.io` and `/uploads/` register `NetworkOnly` before static-asset caching; custom worker generated successfully.
- Production SSR dogfood after repair: Chrome `pageErrors=[]`; server stdout contained only `Starting` / `Ready`, with no `window is not defined` error.

## Repository-wide baseline limitations

These failures are outside the F010 diff and are not hidden as green:

- Full Web Vitest: **5005/5071 passed**, 66 failures in 11 pre-existing files. Failure families are Windows-only `grep`, stale repo/brand assertions, and pre-existing mocks missing `ensureSession`; no F010 test failed.
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

[宪宪/gpt-5.6-sol🐾]
