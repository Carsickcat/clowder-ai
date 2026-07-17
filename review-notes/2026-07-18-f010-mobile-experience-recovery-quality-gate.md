# F010 Mobile Experience Recovery — Quality Gate

**Spec:** `feature-specs/2026-07-18-f010-mobile-experience-recovery.md`  
**Discussion:** `feature-discussions/2026-07-18-f010-mobile-experience-recovery-meeting-notes.md`  
**Worktree:** `E:\ClowderAI\clowder-ai-f010-local-sandbox`  
**HEAD:** `2852721733176828e28f5090d1f53c3bbdb3b2c4`  
**Checked:** 2026-07-18 03:15 +08:00

## Verdict

**PASS for independent code review.** The recovery slice is implemented, production-built, and running in the isolated HTTPS acceptance environment. Full F010 release acceptance is not claimed: the reporting iPhone still needs the final Chinese-IME/standalone-PWA touch journey, and code review verdicts must clear P1/P2.

## Vision coverage

| Operator need | Implementation / evidence | Verdict |
| --- | --- | --- |
| Stop page zoom, wrong scrolling and keyboard geometry | Full VisualViewport rectangle, one AppShell frame, one transcript scroll owner, one Dock reserve | PASS |
| Make the composer usable, not merely functional | 16px editable, one compact primary action, 44px targets, bounded mention tray, draft/image/reply preservation | PASS |
| Remove permanent update-check obstruction | Background update-check failures are diagnostic-only; update-ready remains actionable | PASS |
| Return vertical space to conversation | Mobile nav hides and reserves 0px during composition; connection state is a one-line projection | PASS |
| Stop contradictory `Load failed` after server acceptance | Same UUID reconciles once; duplicate responses distinguish acknowledged/confirming/failed/invariant violation | PASS |
| Do not advertise cats that cannot route | Acceptance-only AgentRegistry fail-closed gate; five-cat failure and four-cat passing roster recorded | PASS |

## Invariant coverage

| Invariant | Code | Tests |
| --- | --- | --- |
| One viewport frame / no duplicate offset | `useVisualViewportCssVars.ts`, `globals.css`, `AppShell.tsx` | `useVisualViewportCssVars.test.tsx`, `mobile-overflow-contract.test.ts` |
| One scroll owner / one Dock reserve | `ChatContainer.tsx`, `MobileOpsShell.tsx` | `chat-container-mobile.test.ts`, `MobileOpsShell.test.tsx` |
| Composer and mention UX | `ChatInput.tsx`, `ChatInputActionButton.tsx`, `ChatInputMenus.tsx` | mobile + draft persistence tests |
| Update and connection noise compression | `PwaUpdateController.tsx`, `ConnectionStatusBar.tsx` | controller/status tests |
| Ambiguous-send reconciliation | `useSendMessage.ts`, `messages.ts` | Web hook tests + API delivery-mode race tests |
| Acceptance roster truth | `acceptance-roster-gate.ts`, API startup | `acceptance-roster-gate.test.js` + isolated startup evidence |

## Dogfood-Your-Slice

Scope verdict: **required and exercised**.

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

## Fresh verification

| Check | Result |
| --- | --- |
| Web focused Vitest | 12 files / 80 tests PASS |
| API focused Node tests | 39/39 PASS |
| Web TypeScript | PASS |
| API build | PASS |
| Web lint | exit 0; baseline warnings only |
| Targeted Biome | PASS |
| `check:features` | PASS; 254 feature docs scanned |
| `check:capability-tips` | PASS; unrelated stale-anchor warnings recorded |
| Next/PWA config | 8/8 PASS |
| Hardcoded-color rule harness | PASS |
| Production Web build | PASS; 22 routes; custom worker generated |
| `git diff --check` | PASS |

Repository-wide limitations are not promoted to green:

- The full Web test wrapper cannot spawn bare `pnpm` on this Windows host; the direct full suite has pre-existing failures in unrelated `ensureSession` mocks and Windows-only commands.
- Root `pnpm check` remains red only on untouched `packages/api/src/infrastructure/websocket/SocketManager.ts` formatting.
- `scripts/check-hotfix-pattern.mjs`, `scripts/check-fallback-layers.mjs`, and `check:architecture-ownership` are absent in this worktree, so no synthetic verdict is reported.

## Design and artifact checks

- Matching `designs/**/*.pen`: none; UI changed without a Pencil design, so design comparison is marked unavailable.
- Root media/design artifacts in worktree or commit diff: none.
- Architecture cells: `hub-action-surface`, `bubble-pipeline`, `dispatch`; map delta `none`. No new Store/Queue/Router/Adapter/Dispatcher/Binding ownership boundary was introduced.
- Capability tips: exempted in F010 frontmatter because the slice changes passive layout, reliability and error projection rather than adding a discoverable action.

## Visual evidence boundary

Hub Browser Preview was opened on the exact current thread and current production build. Three current-build screenshots are archived under `project-evidence/f010-mobile-pwa/`:

- `recovery-20260718-mobile-390x844.png`
- `recovery-20260718-mobile-430x932.png`
- `recovery-20260718-desktop-1024x768.png`

The two mobile runs used Chromium device metrics. Their measured `innerWidth`, root `clientWidth`, VisualViewport width, document `scrollWidth`, and Dock width all matched 390px or 430px exactly. The composer textarea and compact primary action remained inside the frame, and visual inspection confirmed all four Dock destinations and header actions were visible. A first set made with the raw browser-window flag was rejected rather than archived because Chromium kept a wider CSS viewport and cropped the bitmap; it is not acceptance evidence.

The available preview tooling does not expose a virtual iOS keyboard. No 15-second real-iPhone recording was fabricated. The original four iPhone screenshots remain pre-fix problem evidence; the final iPhone 13 Pro Safari/PWA Chinese-IME touch journey is the only remaining release-acceptance evidence.

[宪宪/gpt-5.6-sol🐾]
