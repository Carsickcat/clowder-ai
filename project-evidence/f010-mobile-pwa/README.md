# F010 Mobile PWA — code quality gate evidence

Date: 2026-07-17

Source of truth: `docs/design/F010-mobile-pwa-standard.md`

Implementation plan: `feature-specs/2026-07-17-f010-mobile-pwa.md`

Temporary local branch: `feat/f010-mobile-pwa` (`461c5e3..HEAD`; latest dispatch-owner repair `06c84e2`)

## Verdict

The A0–A3 code slice remains in independent code review. `7d2bca8` moved the atomic invocation claim ahead of tracker/queue/force side effects and Terra approved that implementation. `85d0cb1` repaired durable-message reconciliation and deterministic composer recovery. `b62e66f` then removed the claim TTL, added a durable message-owner fallback, and linked one stable `queueEntryId` through claim, queue, message, Redis, and replay. Opus 4.5 found one remaining capacity race: the in-memory store could evict the only claim before the first durable append completed. `06c84e2` makes that capacity bound fail-closed and soft only until a durable owner exists; Opus 4.5's final verdict on this repair is pending. F010 is **not feature-complete**: the reporting iPhone's Chinese-IME keyboard frame and installed standalone-PWA/Tailscale HTTPS recovery journey remain operator-owned release acceptance.

## Acceptance status

| Acceptance criterion | Status | Evidence / remaining work |
| --- | --- | --- |
| AC-A0 | Partial | Browser viewport matrix is recorded below. Operator device models, real-device friction, and recordings remain open. |
| AC-A1 | Code-complete | One breakpoint source feeds Tailwind and JS; the canonical drawer and four mobile work surfaces are covered by contract/component tests. |
| AC-A2 | Code-complete, real-device pending | Installability diagnostics, runtime manifest status/content-type validation, iOS/manual and native prompt paths, WebView/secure/SW blockers, 30-day dismissal, and permanent entry are tested. Real Tailscale HTTPS install evidence remains open. |
| AC-A3 | Code-complete | Foreground/online recovery works even without SW; new workers wait for consent; all-thread drafts/attachments and Approval Hub transient work veto activation; controllerchange reloads once; NetworkOnly business artifacts are production-built. |
| AC-A4 | Partial | Light compact, dark medium, and light desktop browser evidence exists. iPhone/Android journeys and complete real-device parity remain open. |
| AC-A5 | Pending review | The dispatch-owner repair and capacity-race repair pass affected API/Web, Redis contracts, typecheck/build, static checks, and real Fastify route dogfood. Opus 4.5's final re-review of `06c84e2` remains open. Repository-wide Windows baseline limitations are listed below. |

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

## 2026-07-17 iPhone keyboard follow-up (superseded)

The co-creator's real iPhone screenshot exposed a Visual Viewport coordinate bug that the earlier Chrome viewport matrix could not reproduce. The first follow-up used `height + offsetTop` as a transitional repair. The 2026-07-18 recovery review rejected that formula because it mixed two coordinate models and could double-count the visual offset.

The current invariant is a complete VisualViewport rectangle in layout-viewport CSS pixels:

```css
top: var(--app-viewport-top);
left: var(--app-viewport-left);
width: var(--app-viewport-width);
height: var(--app-viewport-height);
```

`useVisualViewportCssVars` is the only writer. AppShell consumes the rectangle once; safe area is consumed only at frame/Dock edges; a keyboard inset is not added to an already-shrunken visual viewport.

## 2026-07-18 mobile experience recovery

- Worktree: `E:\ClowderAI\clowder-ai-f010-local-sandbox`
- Commit: `2852721733176828e28f5090d1f53c3bbdb3b2c4`
- Production BUILD_ID: `UFvg9ZmNKinCNMPq0huTu`
- Build time: `2026-07-18T03:13:09+08:00`
- Acceptance Web/API: `4310` / `4311`
- Persistence boundary: Redis `127.0.0.1:6398/15`; no flush/delete was performed. DB size moved from 54 to 62 keys through normal isolated service startup.

The current HTTPS entry at `https://desktop-9o1va3o.tail58c13e.ts.net:8443/thread/thread_mrogfco44bos1sgn` returns HTTP 200 and embeds the BUILD_ID above. `/manifest.json`, `/sw.js`, and `/api/health` return HTTP 200. The generated rewrites point API, Socket.IO, and uploads to `localhost:4311`.

The acceptance-only roster gate was exercised in both directions:

- The five-cat snapshot exited 1 because `cat-komzvl9r` (`kimi/k3`) had no registered AgentService; the failure listed the missing cat and all four passing entries.
- A disposable catalog projection removed only that unverified member. With the gate enabled, `/api/cats` exposes `opus`, `sonnet`, `opus-45`, and `fable-5`, and the API listens on 4311. Product configuration and credentials were not rewritten or copied.

Fresh recovery verification:

- Web: 12 Vitest files / 80 tests passed.
- API: 39/39 Node tests passed, including immediate, queue, TOCTOU and message-id backfill races.
- Web TypeScript, API build, targeted Biome, feature truth, capability tips, next/PWA configuration (8/8), and hardcoded-color rule passed.
- Web lint exited 0 with repository baseline warnings only.
- Production build completed with 22 routes and a custom service worker.
- Hub Browser Preview opened the current thread from port 4310.

Current-build Chrome device-emulation evidence (maximum three recovery screenshots):

- `recovery-20260718-mobile-390x844.png`
- `recovery-20260718-mobile-430x932.png`
- `recovery-20260718-desktop-1024x768.png`

The mobile captures were produced through Chromium device metrics rather than a cropped browser window. At 390×844 and 430×932, `innerWidth`, `documentElement.clientWidth`, and `visualViewport.width` matched exactly; document/body `scrollWidth` also matched the viewport. The mobile Dock measured exactly 390px and 430px wide, and the textarea ended at x=322 and x=362 respectively, leaving the compact primary action inside the frame. Visual inspection confirmed all four Dock destinations, the composer action, and the header actions remain visible without horizontal clipping.

The embedded preview tool does not expose programmatic iOS keyboard control. Therefore the final positive evidence for Chinese IME, the real iPhone keyboard frame, and the installed standalone PWA remains a short operator-owned touch test on the reporting iPhone; it is not represented as automated proof.

## Automated and build evidence

- Pre-review broad selection: **19 test files, 359 tests passed** (includes the F190 visual contract and Node-only SSR regression).
- Post-P2 exact F010 affected selection: **18 test files, 83 tests passed**; the three modal/AppShell suites contribute 17 passing focus and ownership tests.
- Post-review transaction selection: **20 test files, 112 tests passed**; this includes all-thread attachment/text/reply guards, storage failure, Approval Hub selection/deciding, waiting-worker activation, no-SW recovery, manifest 404/HTML, and the prior focus suites.
- Post-Terra existing-installing repair (`fbe4e6d`): the regression was **RED at 7/8** in the controller suite, then **GREEN at 8/8**; the final F010 selection is **19 Vitest files, 96 tests passed**, including mount-time observation and duplicate-listener prevention during same-registration recovery checks.
- Post-Opus 4.5 chat-surface repair (`5429913`): the banner regression was **RED** because `hasMobileNav=true` still rendered the fixed banner, then **GREEN** after chat surfaces stopped rendering it. The real `MobileGlobalNavDrawer` → install guide → Escape integration test was green before and after the repair and restores focus to the persistent menu trigger. The current F010 selection is **20 Vitest files, 98 tests passed**.
- Post-`986049e` re-review repair: the two focused suites were **RED at 4 failed / 10 passed** on the prior implementation, then **GREEN at 14/14** after consuming the deferred prompt before its first attempt and aligning both thread create/select close paths to the shared `wide=1024` boundary. The final F010 selection is **21 Vitest files, 103 tests passed**.
- Post-`85d0cb1` message recovery repair: API was **RED at 4 failures** (missing scoped lookup plus immediate/explicit-queue/TOCTOU backfill failures) and Web was **RED at 2 failures** (ghost optimistic bubble plus lost text/image/reply). The final focused runs are API build + **73/73** and Web **3 files / 28 tests**. Broader affected selections pass API **196/196** and Web **10 files / 67 tests**.
- Post-`b62e66f` dispatch-owner repair: the expanded API selection was **RED at 14 failures / 182 passes**, then **GREEN at 196/196**. The final affected API roster passes **370/370**, real isolated Redis passes **64/64**, the affected Web composer/send files pass **28/28**, and Fastify route dogfood passes **3/3**.
- Post-`06c84e2` pending-claim capacity repair: the new store and real Fastify append-window regressions were **RED at 2 failures / 64 passes**, then **GREEN at 67/67** after protecting undurable claims. The post-refactor selection passes **73/73**, the broad affected API roster passes **350/350**, route dogfood passes **1/1**, and the full workspace build exits 0.
- Next/PWA configuration: **8/8 passed**; `skipWaiting` is explicitly false and API, Socket, and uploads remain on network truth.
- Custom color rule test: passed.
- Repository lint: exit 0 (existing warnings only); Web TypeScript: exit 0.
- Repository production build: exit 0 before the SSR repair; Web production builds after SSR, modal-focus, and transaction repairs: exit 0, 22 routes generated.
- Generated `sw.js`: activation is gated by the `SKIP_WAITING` message listener (no unconditional activation); `/api`, `/socket.io`, and `/uploads/` register `NetworkOnly` before static-asset caching; custom worker generated successfully.
- Isolated production preview on port 4310 returned `/manifest.json` as HTTP 200 `application/json; charset=UTF-8` with name `Clowder AI`; the Hub Browser Preview opened successfully and the exact preview listener was stopped afterward.
- The `fbe4e6d` production recheck returned `/` and `/manifest.json` as HTTP 200; generated `sw.js` contained exactly one `skipWaiting()` call, gated by the `SKIP_WAITING` message branch. The isolated 4310/4311 preview and API-stub listeners were stopped by verified PID afterward.
- The `5429913` production build completed with all 22 routes and a generated custom worker. An isolated 4310 preview returned `/settings` as HTTP 200 and opened both `/settings` and the current thread route in Hub Browser Preview; the exact `next start -p 4310` listener PID was verified by command line, stopped, and the port was confirmed clear.
- The `986049e` production build completed with all 22 routes and a generated custom worker. An isolated 4310 preview returned `/settings` as HTTP 200 (42,830 bytes) and opened in Hub Browser Preview; the exact `next start -p 4310` listener PID was command-line verified, stopped, and the port was confirmed clear.
- Production SSR dogfood after repair: Chrome `pageErrors=[]`; server stdout contained only `Starting` / `Ready`, with no `window is not defined` error.

## Post-review message recovery: `85d0cb1`

- **Durable-message reconciliation:** `IMessageStore` now resolves the existing `(userId, threadId, idempotencyKey)` owner. A failed `InvocationRecord.userMessageId` backfill is recoverable metadata failure, not a rollback of the already durable user message. Replay repairs the record best-effort and acknowledges the original message ID.
- **Redis race safety:** stale idempotency-index cleanup uses compare-and-delete Lua, so an old reader cannot erase a concurrent append's new owner. Dependency-free adapter tests actively exercise the lookup and cleanup; the isolated Redis integration remains present but is skipped when the repository isolation flag is absent.
- **Deterministic rejection recovery:** `useSendMessage` returns `false` only for a definite server rejection and removes the matching active/split-pane optimistic bubble. `ChatInput` restores the exact text, images, and reply snapshot, persists it to the originating thread if unmounted, blocks double-submit while awaiting the decision, and records history only after acceptance.
- **Ambiguous outcome boundary:** a twice-ambiguous transport result keeps the optimistic bubble and cleared composer because the server may have committed the UUID; restoring the draft there would invite a duplicate send.
- **Fresh gate:** focused API **73/73**, focused Web **28/28**, broader affected API **196/196**, broader affected Web **67/67**, API/Web production builds, repository lint, targeted Biome, capability tips, and `git diff --check` pass. Root `pnpm check` remains red only on the untouched `SocketManager.ts` formatting baseline.
- **Dogfood boundary:** the route regressions use the real Fastify route and the Web regression mounts the real composer. The current production build (`THC1vM_Yiu8S0k4b1b1MI`) served the exact thread route on isolated port 4312 as HTTP 200 (47,060 bytes) and opened in Hub Browser Preview; the listener was then command-line verified and stopped. No new screenshot or deterministic-rejection browser claim is fabricated for this non-visual lifecycle—the older `2852721` HTTPS build remains historical layout/PWA evidence only.

## Post-review persistent dispatch ownership: `b62e66f`

- **Persistent claim:** Redis and in-memory InvocationRecord idempotency mappings no longer expire after 300 seconds. In-memory eviction removes its matching index entry so durable-message recovery can take over cleanly.
- **Durable recovery owner:** user messages persist `extra.dispatch = { ownerKind, ownerId }`; the Redis parser validates and preserves it. If a legacy record/index is absent, route preflight returns the original message and owner before tracker, queue, warning, or force side effects.
- **Queued API identity:** explicit queue requests preassign one `queueEntryId`; TOCTOU queue degradation links one generated ID before enqueue. The same ID appears on the record, QueueEntry, durable message, `confirming`, and `queued` replay responses.
- **Failure-mode coverage:** tests cross the former 300-second boundary, bounded-memory eviction, append/backfill failure, explicit queue and TOCTOU confirming windows, Redis hydration, and concurrent same-key requests that observe different busy states.
- **Fresh gate:** API high-risk roster **370/370**, isolated Redis **64/64**, affected Web **28/28**, route dogfood **3/3**, targeted Biome, repository lint, capability tips, `git diff --check`, and full workspace build pass. The complete ledger, including baseline reds, is `review-notes/2026-07-18-f010-dispatch-owner-quality-gate.md`.
- **Architecture boundary:** the universal InvocationRecord remains the atomic concurrency claim; QueueEntry is the queued API response owner. No parallel store/queue/router/adapter/dispatcher/binding or UI surface was introduced.

## Pending-claim capacity safety: `06c84e2`

- **Fail-closed soft bound:** the in-memory InvocationRecordStore only evicts records after `userMessageId` proves a durable recovery owner exists. Pending and terminal-without-message claims remain reserved even when the configured capacity is exceeded.
- **Overflow repayment:** record backfill reruns safe trimming immediately, so abnormal all-undurable pressure can exceed the limit temporarily without becoming an unbounded steady state.
- **Real route proof:** a Fastify regression blocks the first append, creates capacity pressure, and replays the same UUID. Replay returns the original `202 confirming`; tracker/queue/router/append side effects do not duplicate.
- **Failure-mode coverage:** queued/running, failed/canceled, succeeded-without-message, safely recoverable, Redis N/A, and post-backfill states are enumerated in `docs/bug-report/f010-pending-claim-capacity-eviction/bug-report.md`.
- **Fresh gate:** focused **67/67**, post-refactor **73/73**, broad affected API **350/350**, route dogfood **1/1**, API/workspace builds, targeted source Biome, and `git diff --check` pass. Root `pnpm check` remains red only on the untouched `SocketManager.ts` format baseline.

## Re-review repair: `986049e`

- **Single-use install prompt:** `PwaInstallExperienceProvider` snapshots and clears the deferred event before calling `prompt()`. Dismissal and thrown-prompt tests prove the manual guide cannot expose a stale second "立即安装" attempt. This matches Chrome's first-party contract that a deferred `beforeinstallprompt` event may call `prompt()` only once; a later attempt must wait for a new event: <https://developer.chrome.com/blog/a2hs-updates/>.
- **Medium-width drawer close:** thread creation and selection now use the shared JSON-backed `RESPONSIVE_BREAKPOINTS.wide` boundary. Tests cover close at 768 and 1023, and no close at 1024.
- **Failure-mode audit:** the relevant `ThreadSidebar` create/select siblings now share one helper; no `<768` drawer-close branch remains in the affected scope. The deferred install event has one owner and one consumer; no sibling consumer retains it after an attempt. No new fallback layer, architecture owner, store, queue, router, adapter, dispatcher, or binding was introduced.
- **Fresh gate:** 21 F010 Vitest files / 103 tests, Next/PWA 8/8, TypeScript, ESLint, targeted Biome, hardcoded-color rule, capability tips, production build, and `git diff --check` pass.

## Repository-wide baseline limitations

These failures are outside the F010 diff and are not hidden as green:

- Full Web Vitest after `b62e66f`: **5028/5101 passed**, 73 failures in 17 untouched files. Failure families include Skills/artifact fixture drift, pre-existing socket mocks missing `ensureSession`, and F252 pass-ball assertions; the affected F010 Web files pass 28/28 independently.
- A fresh full-Web rerun after `fbe4e6d` remained red only in non-F010 suites; the scoped 19-file F010 selection remained 96/96 green. This rerun is recorded as baseline-red, not silently promoted to a full-suite pass.
- A fresh full-Web rerun after `85d0cb1` also exited non-zero only in unrelated skills/F232, socket, governance, header/color-token, and adaptive-pass-ball families. The affected hook/composer files were absent from the failure list; no exact full-suite count is claimed because the runner output was truncated.
- Full Biome: F010 files are clean; the only remaining error is pre-existing formatting in `packages/api/src/infrastructure/websocket/SocketManager.ts`.
- `check:biome-review-worktrees`, `check:sop-definitions`, and `check:start-profile-isolation` fail because their tests spawn bare `pnpm`/POSIX commands on Windows (`status=null` / `ENOENT`).
- `check:pre-merge-gate` contains platform-specific bash/Redis harness failures. The remaining ten `pnpm check` subchecks pass, including feature truth, capability tips, skills, env checks, guides, follow-up tails, and script encoding.
- The repository's root API test command is not deterministically runnable under this Windows shell: its package script uses POSIX env assignment and `bash`, which is absent. An equivalent `file:///` setup plus exact test globs did not terminate after ten minutes in untouched preview/F230 tests; its exact runner and two child PIDs were identified and stopped. The bounded high-risk roster passes 370/370 and real isolated Redis passes 64/64.
- Full MCP tests remain baseline red at **375 pass / 6 fail** in untouched file/shell-tool tests, including `/bin/sh` assumptions on Windows.

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
- `986049e` consumes each native install prompt exactly once and closes the canonical drawer throughout the 768–1023 mobile work surface using shared breakpoint truth.
- `7d2bca8` atomically claims a message UUID before tracker/queue/force side effects and keeps one invocation owner through queue processing.
- `85d0cb1` reconciles durable messages across record-backfill failure and makes deterministic send rejection restore the exact composer session without leaving a ghost bubble.
- `b62e66f` retains dispatch ownership beyond the legacy five-minute window and preserves one queued response owner through claim, message, Redis, and replay.
- `06c84e2` preserves undurable invocation claims under in-memory capacity pressure and repays soft overflow after durable backfill.

[宪宪/gpt-5.6-sol🐾]
