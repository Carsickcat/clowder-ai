# F010 Mobile PWA — code quality gate evidence

Date: 2026-07-17

Source of truth: `docs/design/F010-mobile-pwa-standard.md`

Implementation plan: `feature-specs/2026-07-17-f010-mobile-pwa.md`

Temporary local branch: `feat/f010-mobile-pwa` (`461c5e3..HEAD`; latest dispatch-owner repair `06c84e2`)

## Verdict

The A0–A3 code slice has passed independent code review for the current implementation range. `7d2bca8` moved the atomic invocation claim ahead of tracker/queue/force side effects and Terra approved that implementation. `85d0cb1` repaired durable-message reconciliation and deterministic composer recovery. `b62e66f` then removed the claim TTL, added a durable message-owner fallback, and linked one stable `queueEntryId` through claim, queue, message, Redis, and replay. Opus 4.5 found one remaining capacity race: the in-memory store could evict the only claim before the first durable append completed. `06c84e2` makes that capacity bound fail-closed and soft only until a durable owner exists; Opus 4.5 approved `fe7fbc4..06c84e2` with P1/P2 at zero after an independent API build, 73/73 targeted regressions, and `git diff --check`. F010 is **not feature-complete**: the reporting iPhone's Chinese-IME keyboard frame and installed standalone-PWA/Tailscale HTTPS recovery journey remain operator-owned release acceptance.

## Acceptance status

| Acceptance criterion | Status | Evidence / remaining work |
| --- | --- | --- |
| AC-A0 | Partial | Browser viewport matrix is recorded below. Operator device models, real-device friction, and recordings remain open. |
| AC-A1 | Code-complete | One breakpoint source feeds Tailwind and JS; the canonical drawer and four mobile work surfaces are covered by contract/component tests. |
| AC-A2 | Code-complete, real-device pending | Installability diagnostics, runtime manifest status/content-type validation, iOS/manual and native prompt paths, WebView/secure/SW blockers, 30-day dismissal, and permanent entry are tested. Real Tailscale HTTPS install evidence remains open. |
| AC-A3 | Code-complete | Foreground/online recovery works even without SW; new workers wait for consent; all-thread drafts/attachments and Approval Hub transient work veto activation; controllerchange reloads once; NetworkOnly business artifacts are production-built. |
| AC-A4 | Partial | Light compact, dark medium, and light desktop browser evidence exists. iPhone/Android journeys and complete real-device parity remain open. |
| AC-A5 | Code review approved | The dispatch-owner repair and capacity-race repair pass affected API/Web, Redis contracts, typecheck/build, static checks, and real Fastify route dogfood. Opus 4.5 approved `fe7fbc4..06c84e2` with P1/P2 at zero. Repository-wide Windows baseline limitations are listed below; real-device release acceptance remains open under AC-A0/AC-A2/AC-A4. |

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

## 2026-07-18 current-HEAD live-reply acceptance

The isolated API was rebuilt from and restarted after current HEAD `8c4925f`; listener `4311` was PID `7580`, its start time was later than the target commit, and its log contained current-PID evidence. An authenticated Socket.IO client then joined `thread:thread_mrowmqyhrqc0um23`, with the join confirmed by the server log, before the same HTTPS session posted a real `@opus` message.

The POST returned HTTP 200. Without polling or refreshing, that socket received nine `opus` `agent_message` events, including `text`, `error`, and a final `done` event with `isFinal=true`, in 6.5 seconds. Durable messages advanced from 4 to 7. This closes the P1 runtime finding that cat replies were persisted but did not appear until page refresh: current HEAD carries agent output through authenticated room join, API broadcast, and the live client connection.

The invoked Opus CLI returned `Not logged in · Please run /login`; the same content and system error were both delivered live and persisted. Therefore this probe proves the real-time transport path but does not claim a healthy Opus model reply. The CLI login state remains a separate acceptance-environment boundary. Because the API was restarted for this proof, the reporting iPhone still needs one page refresh to establish a socket against PID `7580`, followed by one message whose reply must appear in the DOM without a second refresh.

## 2026-07-18 iPhone follow-up: mention picker and Sonnet binding

The reporting iPhone screenshots `1784341440491-587f1546.png` and `1784341440492-3003b609.png` exposed two independent issues.

First, the `@` picker still carried desktop information density into the keyboard-shrunken mobile frame: one candidate per row, descriptions always visible, and a viewport-unit height bound. The repair replaces that compact layout with a short two-column touch grid, 48px minimum targets, hidden mobile descriptions, 8px horizontal insets, and internally contained scrolling. Desktop retains the detailed single-column layout. A second regression locks the adjacent overflow-affordance bug: its effect now recomputes when the picker opens instead of running only once before the scroll DOM exists.

TDD and deployment evidence:

- RED: the rendered mobile contract failed on the old menu; the closed→open overflow test separately failed without the “还有更多猫猫” affordance.
- GREEN: picker/layout/keyboard guards pass 9/9; Web TypeScript passes; targeted Biome exits 0 with repository-existing warnings only; `git diff --check` passes.
- The production build ran after implementation commit `e193c08`, completed with 22 routes, and produced BUILD_ID `ujsC5M4kKDym9Hgqxg0J_`.
- Isolated Web PID `41148` serves the new build on `4310`; generated API, Socket.IO, and uploads rewrites target `4311`.
- Through `https://desktop-9o1va3o.tail58c13e.ts.net:8443`, the current page embeds that BUILD_ID and page, manifest, service worker, API health, and the four-cat roster return successfully. Hub Browser Preview opened the current thread.

The broader ChatInput selection passed 108/110 tests. The two repeatable failures are pre-existing, outside this diff, and recorded rather than hidden: a stale upload-error wording assertion and the current history-store append expectation. They do not involve the mention picker files.

Second, the 10:19 `@sonnet` failure belongs to the pre-patch Anthropic binding. API log provenance for invocation `25abd9e1-2343-4c7d-98ca-fc817a3418af` proves it executed `claude.cmd`, which was not logged in. The operator's 10:20 catalog PATCH hot-rebound Sonnet to `clientId=openai`, `defaultModel=gpt-5.6-sol`, `accountRef=gpt-5-6-sol`. A fresh authenticated send then produced invocation `80e14818-5d80-44ec-ac72-278989766323`; the same API PID logged `codex.cmd`, model `gpt-5.6-sol`, OAuth, a final live `done`, and no error event. No restart or credential copy was required. Generated signature text is not executor provenance.

The remaining acceptance boundary is one real-device touch pass: refresh or reopen the installed PWA, open the Chinese keyboard, type `@`, confirm the compact picker stays inside the visible frame, tap Sonnet, and confirm its reply appears without a second page refresh.

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

## 2026-07-18 mobile chat-shell correction

Three new reporting-iPhone screenshots showed that the compact mention picker was not the root fix: the desktop-density header, liveness rows, composer safe area, and four-item Dock still competed inside the keyboard-constrained VisualViewport.

Implementation commit: `78ebe807f7c3303a4a26bf5b50137d098f7a1a9c`

Post-review wide-boundary repair: `b480c1ddfb13314fef5aec4f1e4b54fe2d612172`

Independent review verdict: Terra approved `b480c1d` in message `0001784350462169-000473-efbef0d2` with **P1/P2/P3 = 0**. The only remaining gate for this chat-shell correction is the reporting-iPhone Chinese-IME / installed-PWA after proof.

The corrected shell now has two projections:

- **Browsing:** 56px single-line mobile header, sole transcript scroll, compact composer, one 56px Dock reserve plus one safe area.
- **Composing / picker:** the same compact header and transcript, composer at the visual bottom, Dock reserve `0px`, Dock and secondary Thinking/Execution/Queue/Vote chrome absent from layout.

The iOS detector retains the direct layout/visual viewport difference and adds a guarded alternate path for installed-PWA geometry where both heights shrink together: the composer must be focused and the VisualViewport must shrink at least 80px from its stable same-width baseline. It adds no persisted keyboard state and no device sniffing.

Fresh evidence:

- RED: 5 focused failures covered the simultaneous-shrink detector, duplicate bottom safe area, missing keyboard chrome projection, and oversized mobile header.
- GREEN: viewport/composer/header/overflow selection **32/32** after the wide-boundary review repair.
- Full Web Vitest is transparently baseline-red at **5036/5105 passed** (69 failures in 16 files versus the previously recorded 5028/5101 and 73 failures in 17 files). The added shell tests are all green and no changed file appears in the failing-file list; the remaining failures are pre-existing repository families, not reported as a pass.
- Next/PWA **8/8**, hardcoded-color rule, feature truth, capability-tips **11/11**, targeted Biome, and `git diff --check` pass. Capability tips still warns that this local branch has no usable `origin/main` plus existing stale documentation anchors.
- Current isolated production build passed in **36.8s**, generated BUILD_ID `w_4Uqp53TT0EkwyWK4D1U`, and keeps API/Socket/uploads rewrites on API `4311`.
- Isolated Web PID `13548` started at `2026-07-18 12:47:49 +08:00` on port `4310`; HTTP `/` returned 200 and embedded that BUILD_ID. API `4311` and production ports/data were untouched.
- Hub Browser Preview opened the new build.
- At 390×500 composing with both viewport heights shrunk, document bounds were exactly 390×500, header 57px, composer y=430/h=70, Dock and secondary chrome `display:none`, reserve `0px`.
- At 430×932 and 768×1024 browsing, header remained 57px; composer bottom equaled Dock top (`876` and `968`), Dock height was 56px, and document bounds equaled the viewport with no page overflow.
- Post-review Red→Green: the wide-keyboard contract failed at 4/5 before `b480c1d`, then passed 5/5. Current-browser computed style with the keyboard attribute true is `block` for both secondary wrappers at 1024px and `none` for both at 1023px, preserving desktop status while retaining compact composing mode.
- Design/artifact hygiene: no matching `.pen` artifact exists, Pencil tooling was unavailable, and both root-media and diff-media scans are zero. The operator's true-device screenshots remain the before truth; browser projection is not substituted for the pending iPhone after proof.

The source audit, state matrix, RED proof, and remaining reporting-iPhone acceptance boundary are recorded in `docs/bug-report/f010-mobile-chat-shell-chrome-density/bug-report.md` and `review-notes/2026-07-18-f010-mobile-chat-shell-quality-gate.md`.

[宪宪/gpt-5.6-sol🐾]

## 2026-07-18 cross-route mobile shell recovery

The second reporting-iPhone pass confirmed that the first chat-shell repair was necessary but not sufficient. A thread created from a global page crossed documents and lost the stable VisualViewport baseline; the root document and page content both scrolled; Memory tabs inherited desktop compression; and the same 390px audit exposed inaccessible Signals tabs plus a half-screen Settings directory.

Implementation candidate: `bd075e699a0a7a9fd722e555ff97de87ac35087a`; final reviewed head: `793cc7ecf91d8b1dd934ffd537195a47d58ce48e`.

The recovery keeps AppShell mounted through global→thread client navigation, locks document rubber-band only while AppShell chrome is active, assigns one internal scroller per global page, zeros stale closed-keyboard viewport offsets, and projects compact single-line navigation across Memory, Signals, Settings, Ops, Scope, and Mission surfaces.

Fresh evidence:

- Final focused route/viewport selection **47/47**; earlier broad affected selection **106/106**.
- Full Web Vitest **5044/5112 passed**, 68 failures in 15 untouched baseline files. This improves the pre-follow-up **5042/5111**, 69 failures in 16 files; the new test passes and the former global CSS architecture failure is green.
- Production Web build passed in 41.3 seconds with 22 routes and BUILD_ID `3sb-dbE1RU4drK_umxkvl`. Isolated Web 4310 PID `1536` serves that exact ID; API/Socket/uploads target isolated API `4311`.
- Hub Browser Preview opened the nine-route matrix: chat, fresh thread, Memory root/search, Settings Ops, Signals inbox/sources, Mission Control, and Mission Hub.
- At 390×844 every measured route had document width 390, fixed shell top 0/height 844, and root scrollTop 0 after an attempted scroll. Memory's six tabs occupy one horizontal 43px row; Signals tabs are visible in one 43px row; Settings categories occupy one 36px horizontal rail.
- Terra's independent code review found one P2 in the new CSS contract test: its dotAll flag required ES2018 while Web targets ES2017. `793cc7e` removed the redundant flag; complete TypeScript returned to green, the affected suites passed independently, and Terra approved the final head in message `0001784355764196-000496-09d73a0a` with **P1/P2/P3 = 0**.
- The four reporting-iPhone screenshots remain the before truth. The final release boundary is a new installed-PWA Safari pass covering global-page thread creation with the Chinese keyboard already open, Dock reserve, Memory tab swipe, and downward rubber-band.

Detailed diagnosis and review packet:

- `docs/bug-report/f010-mobile-cross-route-shell-regressions/bug-report.md`
- `review-notes/2026-07-18-f010-mobile-cross-route-shell-review-request.md`
- `review-notes/2026-07-18-f010-mobile-chat-shell-quality-gate.md`

[宪宪/gpt-5.6-sol🐾]

## 2026-07-18 mobile composer product recovery

The third reporting-iPhone pass exposed a lifecycle and product-density defect rather than another VisualViewport threshold: client navigation preserved an open status sheet across threads; status opening did not dismiss the composer; browser-default refocus could scroll; the sheet retained a stale position; and a full Agent environment error card competed with the composer and Safari's system form assistant.

Implementation commits: product recovery `20adebde118b08e2b1cfb0b8e92a056846f8739a`; reviewer P2 repair `066762d`; browser failure-mode repair `49a4853`.

The recovery establishes one mobile terminal state:

- browsing uses a 57px header, one transcript scroller, a 52px composer, and one 56px Dock;
- composing keeps the header/transcript/composer only; Dock, sheets, diagnostics, liveness/task/quest chrome, and their reserve leave layout;
- status is a separate sheet journey that blurs the composer first and always starts at its header;
- mobile Agent health is one 44px summary row, while full diagnostics remain in desktop/governance surfaces;
- all internal composer refocus paths use `preventScroll`, and the editable surface remains a 44px IME target with `enterKeyHint="send"`.

Fresh pre-review evidence:

- RED→GREEN: initial lifecycle/chrome failures, reviewer P2 proofs for authorization reachability and 44px actions, and a browser-discovered waiting-worker prompt regression; final affected selection **10 files / 79 tests**.
- Count provenance: relative to Terra's independently reported 77, the author's explicitly listed 79-test roster includes the two `authorization-card-mobile` action tests that directly guard the repaired P2. Terra approved `ad32068` with P1=0, P2=0, P3=1; the P3 is documentation-only and resolved by this explicit breakdown.
- TypeScript, targeted Biome (zero errors), `git diff --check`, and production Web build pass.
- Full Web Vitest remains transparently baseline-red. The latest managed JSON was **5055/5123**, 68 failures in the same 14-file roster; the sole added raw-pixel guard was fixed to `text-micro` and its targeted F190 check is green. The later waiting-worker regression is green in its 8/8 controller suite and build; no full-suite green is claimed.
- Final isolated Web `4310` serves BUILD_ID `jcnYuX0LWcqvp7oKHGqSM` from PID `39524`; HTTP `/` is 200 and isolated API remains `4311`.
- No-cache 390×844 CDP: root scrollTop `0`; status target and all three expanded toolbar actions measure `44`; composer `52`; Dock `56`.
- 390×430 composing projection with a real waiting worker: composer bottom equals visual bottom; Dock, update prompt, secondary chrome, and status sheet occupy zero layout space; root scrollTop remains `0`.
- Status journey: focused textarea is blurred before open; sheet `scrollTop=0`; title is visible.
- Visuals: `mobile-auth-toolbar-final-20260718-390x844.png`, `mobile-status-sheet-final-20260718-390x844.png`, `mobile-composer-final-20260718-390x430.png`.

The remaining release boundary is reporting-iPhone installed-PWA Safari with the Chinese IME. Chrome projection is structural evidence, not a substitute for that device truth.

## 2026-07-18 iOS form-assistant and modal-ownership correction

The fourth reporting-iPhone pass showed an illegal simultaneous state: status sheet/backdrop, keyboard, and clipped Dock occupied one frame; after manual repositioning, iOS's native arrows/checkmark form assistant overlaid the Clowder composer. This was not a removable Clowder confirmation bar.

Implementation commits: `3667199` (product/state repair) and `3956aa5` (mobile shell CSS extraction).

- Status is now one modal state: opening makes the chat surface inert; the sheet and backdrop close together; composer focus can no longer coexist with a stale status journey.
- The single chat reserve budgets `3.5rem` for the iOS touch form assistant during composing. Desktop/Android behavior remains unchanged.
- VisualViewport projection retains keyboard state through blur until viewport restoration and performs a settling animation-frame read for WebKit's late installed-PWA geometry.
- A dedicated 44-line `mobile-shell.css` owns mobile viewport projection; `globals.css` is 315 lines and the repository 350-line architecture guard is green.
- Affected tests: **51/51**; with the CSS architecture guard: **53/53**. TypeScript, targeted Biome, diff check, and production build pass.
- Full Web JSON before CSS extraction: **5062/5130**, 68 failures. All seven new tests pass. The sole added global-CSS length failure is green after `3956aa5`; targeted F190 confirms the raw-pixel guard remains green and only its unchanged modal-scrim baseline remains. No full-suite green is claimed.
- Final Web runtime: port `4310`, PID `22696`, BUILD_ID `dekHachDoovqQ-6QxRcBT`; local and Tailscale HTTPS roots return HTTP 200 with that ID; `mobile-shell.css` is HTTP 200; API `4311` was untouched.
- Final 4310 browser journey at 390px proves root scroll `0`, exclusive modal ownership, blocked underlying focus, clean close, and restored composer focus. At 390×500 composing, composer y=`392`, h=`52`, bottom=`444`; the assistant reserve owns the remaining 56px; Dock height is `0`.

Reporting-iPhone Safari/PWA remains the release truth because Chrome does not render the native iOS form assistant.

## 2026-07-18 continuous-video correction: closed sheet polluted focus geometry

The operator-provided installed-PWA recording `C:\Users\myh_1\Desktop\c3a3f0c9826983f20a00cf6d855b4ef0.mp4` is 25.57 seconds at 592×1280. Unlike the earlier screenshots, it preserves causality: no status action is tapped. Composer focus at about 7.75s is followed at 8.00s by the body of the closed status sheet; manual upward swipes recover chat; the same jump recurs near 20.75s after the mention journey.

Source inspection matches the video. `MobileStatusSheet` stayed mounted while closed at the first coordinate below the visual viewport (`top = viewport top + viewport height`, `translate-y-0`). Its `inert` attribute removed interaction but not Safari focus/scroll geometry. The repair therefore does not add another offset, timer, or viewport fallback: closed status no longer renders at all. Backdrop and dialog mount only for an explicit open journey and unmount together.

RED→GREEN and harness evidence:

- RED proved the closed dialog, backdrop, and status text were still in the DOM.
- GREEN requires no closed status DOM and a fresh `scrollTop=0` sheet on each explicit open.
- `mobile-overflow-contract.test.ts` prevents reintroducing an offscreen closed `translate-y-0` sheet or using `aria-hidden` as a geometry substitute.
- the existing iOS Form Assistant reserve is unchanged; the recording shows it, but it is not the cause of the jump into status details.

Verification: six focused files pass **60/60**; Web TypeScript, targeted Biome, diff check, and the production build pass. Full Web JSON is **5064/5131** with 67 failures in the same 14 historical files, so the new test is green and no new failure family appears. Isolated Web `4310` serves BUILD_ID `4gYnE-fXBHLBkq2vLVKkE` from PID `39224`; API `4311` PID `7580` was untouched. At 390px, closed status contributes no DOM or text, composer focus leaves root scroll at `0`, explicit open mounts dialog and backdrop, and close plus second focus leaves both absent with root scroll still `0`.

The previous fourth-round review is superseded only for this newly observed closed-sheet journey. Terra independently approved candidate `ca065b8` in message `0001784383917572-000554-ec81bda1` with **P1=0, P2=0, P3=0**, reproducing the focused **60/60** selection, CSS architecture **54/54**, Web TypeScript, diff check, and clean worktree. Code and review gates pass; the reporting-iPhone installed-PWA replay remains required.

## 2026-07-18 continuous-video correction: fixed-root coordinate feedback

The operator's second continuous recording `C:\Users\myh_1\Desktop\07a4d1f3c1d2cdf4acc422ab2fe0512e.mp4` is 12.40 seconds at 592×1280. It disproves the remaining status-sheet explanation: during composer focus, the header, transcript, and composer move away together while the keyboard and concierge remain. No closed status journey is mounted.

Implementation commits: root-coordinate repair `e27ee2daf9bbfb986754385b7068935f19c4833e`; reviewed typography repair `ffafb56cda54912dacfea89232a1c1c5562839ad`.

The fixed AppShell no longer consumes `visualViewport.offsetTop` or `offsetLeft`; it remains at the stable origin and projects VisualViewport dimensions only. The fixed 3.5rem browser-assistant reserve is removed because Safari already renders that system-owned row outside the web layout. The mobile composer is now one 48px row with 44px controls, chat-message and input copy share a 16px scale through 767px, non-chat Markdown retains its established 14px default, and tools/IME are mutually exclusive without changing the textarea editor primitive.

Fresh evidence:

- RED→GREEN focused viewport/composer/overflow selection: **33/33**.
- Broader affected selection: **13 files / 110 tests**.
- Full Web Vitest: **5069/5136**, 67 failures in the same 14 historical files. Relative to **5064/5131**, the five added tests are green and the failure roster is unchanged.
- Web TypeScript, targeted Biome with zero errors, `git diff --check`, and the production build pass.
- Isolated Web `4310` PID `45656` serves BUILD_ID `2JhXmOBICvwybpU-Kig8T`; HTTP `/` is 200 and API `4311` PID `7580` was untouched.
- 390×844 browsing: AppShell top `0`, root scroll `0`, composer `48`, textarea/actions `44`, Dock `56`.
- 390×430 composing: AppShell top `0`, root scroll `0`, reserve `0`, Dock height `0`, composer `y=382/h=48/bottom=430`, and application gap below composer `0`.
- A synthetic 96px root-offset variable cannot move the AppShell; a real pointer journey proves tool/IME mutual exclusion.
- Compiled responsive CSS at widths `639/640/767` renders chat copy at `16px` and generic Markdown at `14px`; at `768` both are `14px`, while the textarea remains `16px`.
- Terra independently converged on the terminal architecture from the recording, then approved the exact code SHA `ffafb56` with **P1/P2/P3 = 0** in messages `0001784394321312-000027-3ca7db79` and `0001784394411765-000029-b59f5602`. Independent verification: **8 files / 81 tests**, Web TypeScript, diff check, and a clean worktree.

Detailed evidence: `docs/bug-report/f010-mobile-chat-composer-product-recovery/bug-report.md` and `review-notes/2026-07-18-f010-mobile-composer-root-coordinate-quality-gate.md`.

The only remaining release gate is the reporting-iPhone installed-PWA replay of this exact focus journey with Chinese IME and mentions. Chrome projection is not substituted for device truth.

[丢丢/gpt-5.6-sol🐾]

## 2026-07-19 installed-PWA viewport event-commit correction

The reporting-iPhone recording `C:\Users\myh_1\Desktop\8c99ee100752d336619be399e65e3090.mp4` is 23.966 seconds at 592×1280 and was created after the reviewed `ffafb56` build. It therefore disproves the sixth-round release claim rather than replaying an old bundle.

Clear-frame fan-in from Terra and Kimi establishes two independent mechanisms:

- a resize-time intermediate VisualViewport height is written directly into the fixed shell, producing the blank collapse and Dock/composer suspension;
- settled height is correct, but keyboard detection subtracts the focused pan from baseline shrink and `visualViewport.scroll` is no longer observed, so `data-mobile-keyboard-open` remains false and the Dock stays in layout.

The same recording also exposes a separate P2: punctuation-completed mention tokens keep the picker open.

Implementation candidate: `87ffdd5aa52a819b5ca8025c1800f9969b459136`.

The correction keeps root `top/left=0`, restores `visualViewport.scroll` only as an event source, immediately latches composing state, publishes width/height only after one quiet window, and preserves a closed-height baseline through open-keyboard orientation changes. Mention parsing now accepts Unicode letters/numbers/marks plus `_`/`-` and terminates on punctuation or symbols.

Fresh evidence:

- Original Red: 4 focused failures for scroll-only delivery, raw animation height, and punctuation-completed short tokens.
- Fresh-context Red: open-keyboard orientation cleared composing after poisoning the new-width baseline.
- Final focused files: **26/26**.
- Broader affected selection: **13 files / 137 tests**.
- Web TypeScript, targeted Biome, feature truth, capability tips, diff check, and production build pass.
- Final candidate BUILD_ID: `davuSC0P3wlGS5zAgfHp-`; temporary Web 4312 served HTTP 200 with that exact ID and opened in Hub Browser Preview, then the temporary listener was removed.
- Existing isolated Web 4310 still serves the previous BUILD_ID `2JhXmOBICvwybpU-Kig8T`; API 4311 was untouched pending independent review.
- Full Web Vitest was attempted but did not terminate within 303.4 seconds amid known unrelated mock/act families; no full-suite pass or count is claimed.

Fresh-context found three P2s (orientation baseline, unmount cleanup proof, Unicode-category coverage); all three are closed in `87ffdd5`. Formal Terra/Kimi review is now pending. The reporting-iPhone replay remains the release truth after both reviewers report P1/P2=0 and the reviewed build replaces 4310.

Detailed evidence:

- `docs/bug-report/f010-ios-pwa-viewport-event-commit/bug-report.md`
- `review-notes/2026-07-19-f010-ios-pwa-viewport-event-commit-quality-gate.md`
- `review-notes/2026-07-19-f010-ios-pwa-viewport-event-commit-review-request.md`

[丢丢/gpt-5.6-sol🐾]
