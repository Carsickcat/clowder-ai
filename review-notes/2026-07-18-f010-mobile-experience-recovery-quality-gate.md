# F010 Mobile Experience Recovery — Quality Gate

**Spec:** `feature-specs/2026-07-18-f010-mobile-experience-recovery.md`  
**Discussion:** `feature-discussions/2026-07-18-f010-mobile-experience-recovery-meeting-notes.md`  
**Worktree:** `E:\ClowderAI\clowder-ai-f010-local-sandbox`  
**HEAD:** `85d0cb13844e7547069558a5ffe0771fca1583f1`
**Checked:** 2026-07-18 05:10 +08:00

## Verdict

**PASS for independent re-review.** The two implementation findings reported after the original recovery build are repaired in `85d0cb1`: durable-message acknowledgment no longer depends on recoverable `InvocationRecord` metadata, and a deterministic send rejection returns the exact composition to the user without a ghost bubble. Full F010 release acceptance is not claimed: Opus 4.5 must re-review this SHA, and the reporting iPhone still needs the final Chinese-IME/standalone-PWA touch journey.

## Vision coverage

| Operator need | Implementation / evidence | Verdict |
| --- | --- | --- |
| Stop page zoom, wrong scrolling and keyboard geometry | Full VisualViewport rectangle, one AppShell frame, one transcript scroll owner, one Dock reserve | PASS |
| Make the composer usable, not merely functional | 16px editable, one compact primary action, 44px targets, bounded mention tray, draft/image/reply preservation | PASS |
| Remove permanent update-check obstruction | Background update-check failures are diagnostic-only; update-ready remains actionable | PASS |
| Return vertical space to conversation | Mobile nav hides and reserves 0px during composition; connection state is a one-line projection | PASS |
| Stop contradictory `Load failed` after server acceptance | Same UUID reconciles once; durable message-store truth heals a failed record backfill; definite rejection removes the optimistic bubble and restores text/image/reply | PASS |
| Do not advertise cats that cannot route | Acceptance-only AgentRegistry fail-closed gate; five-cat failure and four-cat passing roster recorded | PASS |

## Invariant coverage

| Invariant | Code | Tests |
| --- | --- | --- |
| One viewport frame / no duplicate offset | `useVisualViewportCssVars.ts`, `globals.css`, `AppShell.tsx` | `useVisualViewportCssVars.test.tsx`, `mobile-overflow-contract.test.ts` |
| One scroll owner / one Dock reserve | `ChatContainer.tsx`, `MobileOpsShell.tsx` | `chat-container-mobile.test.ts`, `MobileOpsShell.test.tsx` |
| Composer and mention UX | `ChatInput.tsx`, `ChatInputActionButton.tsx`, `ChatInputMenus.tsx` | mobile + draft persistence tests |
| Update and connection noise compression | `PwaUpdateController.tsx`, `ConnectionStatusBar.tsx` | controller/status tests |
| Ambiguous/deterministic send recovery | `useSendMessage.ts`, `ChatInput.tsx`, `messages.ts`, message-store adapters | Web hook/real-composer tests + API delivery-mode/store race tests |
| Acceptance roster truth | `acceptance-roster-gate.ts`, API startup | `acceptance-roster-gate.test.js` + isolated startup evidence |

## Dogfood-Your-Slice

Scope verdict: **required and exercised for the original `2852721` recovery build; current `85d0cb1` non-visual failure paths are exercised through the real Fastify route and real React composer.**

End-to-end path:

1. Build production Web with API 4311 rewrite.
2. Start isolated API on Redis 6398 DB15 with the acceptance roster gate enabled.
3. Prove the five-cat catalog fails closed on missing Kimi AgentService.
4. Start a disposable four-cat projection and verify `/api/cats` contains only registered entries.
5. Start production Web 4310 and open `/thread/thread_mrogfco44bos1sgn` in Hub Browser Preview.
6. Verify the same path, Build ID, manifest, worker and API through Tailscale HTTPS.

Observed result:

- HTTP 200: thread, `/manifest.json`, `/sw.js`, `/api/health`.
- HTTPS roster: `opus, sonnet, opus-45, fable-5`.
- HTML contains BUILD_ID `UFvg9ZmNKinCNMPq0huTu`.
- Five-cat gate exits 1 with missing `cat-komzvl9r`.
- No production/runtime ports or Redis 6399 were touched.

Dogfood findings fixed in the same turn:

- Corrected acceptance startup ownership: catalog selection requires `CAT_TEMPLATE_PATH`; `CAT_CAFE_CONFIG_ROOT` alone only selects account/config roots.
- Corrected an over-specific CSS contract assertion so quote serialization does not create a false failure.

The earlier HTTPS environment is retained as historical layout/PWA evidence only. It is not represented as runtime proof for the later `85d0cb1` message-recovery delta. That delta adds no visual styling claim; its end-to-end boundary is the real route/store transaction and mounted composer lifecycle covered below.

## Post-review repair evidence (`85d0cb1`)

| Finding | Red | Green / terminal model |
| --- | --- | --- |
| Durable append followed by `InvocationRecord.userMessageId` backfill failure returned 500 and poisoned replay | 4 API failures across missing lookup, immediate, explicit queue, and TOCTOU queue | Message append is the commit point; scoped idempotency lookup repairs metadata on replay. Focused API build + tests **73/73**; broader affected selection **196/196**. |
| Deterministic HTTP rejection stranded an optimistic bubble and cleared text/image/reply | 2 Web failures | Hook removes the correct active/split-pane bubble and returns `false`; real `ChatInput` restores the exact snapshot. Focused **3 files / 28 tests**; broader affected **10 files / 67 tests**. |

The Redis adapter uses compare-and-delete Lua for stale-index cleanup, preventing a stale reader from deleting a concurrent append's new owner. Its dependency-free adapter test is active; the repository's isolated-Redis integration is present but skips without the isolation flag, and no persistent Redis port/database was reused.

## Fresh verification

| Check | Result |
| --- | --- |
| Web post-review focused Vitest | 3 files / 28 tests PASS |
| Web broader affected Vitest | 10 files / 67 tests PASS |
| API post-review focused Node tests | build + 73/73 PASS |
| API broader affected Node tests | 196/196 PASS |
| Web TypeScript | PASS |
| API build | PASS |
| Repository lint | exit 0; baseline warnings only |
| Targeted Biome | PASS |
| `check:features` | PASS; 254 feature docs scanned |
| `check:capability-tips` | 11/11 PASS; missing `origin/main` and unrelated stale-anchor warnings recorded |
| Next/PWA config | 8/8 PASS |
| Hardcoded-color rule harness | PASS |
| Production Web build | PASS; 22 routes; custom worker generated |
| `git diff --check` | PASS |

Repository-wide limitations are not promoted to green:

- A fresh direct full-Web run exits non-zero in unrelated skills/F232, socket, governance, header/color-token, and adaptive-pass-ball families. The affected hook/composer files do not appear among failures; the runner output was truncated, so no exact total is invented.
- Root `pnpm check` remains red only on untouched `packages/api/src/infrastructure/websocket/SocketManager.ts` formatting.
- `scripts/check-hotfix-pattern.mjs`, `scripts/check-fallback-layers.mjs`, and `check:architecture-ownership` are absent in this worktree, so no synthetic verdict is reported.

## Design and artifact checks

- Matching `designs/**/*.pen`: none; UI changed without a Pencil design, so design comparison is marked unavailable.
- Root media/design artifacts in worktree or commit diff: none.
- Architecture cells: `hub-action-surface`, `bubble-pipeline`, `dispatch`; map delta `none`. The existing message-store port/adapters gain one scoped lookup, but no parallel Store/Queue/Router/Adapter/Dispatcher/Binding ownership boundary was introduced.
- Capability tips: exempted in F010 frontmatter because the slice changes passive layout, reliability and error projection rather than adding a discoverable action.

## Visual evidence boundary

Hub Browser Preview was opened on the exact current thread and current production build. Three current-build screenshots are archived under `project-evidence/f010-mobile-pwa/`:

- `recovery-20260718-mobile-390x844.png`
- `recovery-20260718-mobile-430x932.png`
- `recovery-20260718-desktop-1024x768.png`

The two mobile runs used Chromium device metrics. Their measured `innerWidth`, root `clientWidth`, VisualViewport width, document `scrollWidth`, and Dock width all matched 390px or 430px exactly. The composer textarea and compact primary action remained inside the frame, and visual inspection confirmed all four Dock destinations and header actions were visible. A first set made with the raw browser-window flag was rejected rather than archived because Chromium kept a wider CSS viewport and cropped the bitmap; it is not acceptance evidence.

The available preview tooling does not expose a virtual iOS keyboard. No 15-second real-iPhone recording was fabricated. The original four iPhone screenshots remain pre-fix problem evidence; the final iPhone 13 Pro Safari/PWA Chinese-IME touch journey is the only remaining release-acceptance evidence.

[宪宪/gpt-5.6-sol🐾]
