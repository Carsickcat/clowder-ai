# F010 mobile mention picker quality gate

Date: 2026-07-18

Status: **implementation deployed for operator acceptance; formal quality gate remains open**

Spec: `feature-specs/2026-07-18-f010-mobile-experience-recovery.md`, Task 3 / INV-4 / INV-8

Original requirement: the co-creator's 10:24 report and iPhone screenshot show that the `@` candidate list remains visually clipped, unattractive, and hard to select with the Chinese keyboard open. The same report says Sonnet invocation fails despite the intended configuration.

## Vision coverage

| Operator need | Implementation / finding | Status |
| --- | --- | --- |
| Cats must be easy to choose in the keyboard-shrunken frame. | Compact two-column grid, 48px targets, hidden mobile descriptions, 8px insets, bounded internal scroll. | Code/build verified; iPhone touch pass pending. |
| Desktop detail must not regress. | `sm:` restores single-column rows, descriptions, 320px bound, and keyboard hint. | Component regression passed. |
| Long rosters must remain discoverable. | Overflow is contained and “还有更多猫猫” recomputes on closed→open and option-count changes. | RED→GREEN regression passed. |
| Sonnet must invoke its current configured model. | The 10:19 failure used pre-patch `claude.cmd`; the operator's 10:20 PATCH hot-rebound Sonnet. A fresh invocation proves `codex.cmd`, `gpt-5.6-sol`, OAuth, final live `done`, no error. | Resolved and runtime verified. |

## Functional acceptance

| Requirement | Code / evidence | Verification |
| --- | --- | --- |
| Compact picker layout | `packages/web/src/components/ChatInputMenus.tsx` | `chat-input-mobile-mention-menu.test.tsx` |
| Mobile overflow contract | `ChatInputMenus.tsx` | `mobile-overflow-contract.test.ts` |
| Keyboard/empty-option safety | existing ChatInput integration | `chat-input-mention-guard.test.ts` |
| Provider provenance | API PID 7580 acceptance log | invocations `25abd9e1…`, `80e14818…`, `380acba6…` |

## Architecture ownership

- Architecture cell: `hub-action-surface`
- Map delta: none
- Why: this changes the projection of the existing mention tray and fixes its overflow measurement lifecycle; it adds no Store, Queue, Router, Adapter, Dispatcher, or Binding.
- `pnpm check:architecture-ownership` is unavailable in this branch snapshot (`Command "check:architecture-ownership" not found`), so mechanical ownership validation is recorded as unavailable rather than passed.

## Design and artifact hygiene

- Matching `designs/**/*.pen` for F010/mobile/mention: none. This UI repair therefore has no Pencil design artifact to compare; operator screenshots are the visual source.
- Root media/design artifact scan: no matches.
- No screenshot was manufactured after the Chrome automation failed to cross React hydration; the failed harness is not represented as product evidence.

## Dogfood-your-slice

Scope verdict: required.

- Worktree: `E:\ClowderAI\clowder-ai-f010-local-sandbox`
- Current target: `https://desktop-9o1va3o.tail58c13e.ts.net:8443/thread/thread_mrogfco44bos1sgn`
- Production evidence: implementation commit `e193c08`, BUILD_ID `ujsC5M4kKDym9Hgqxg0J_`, Web PID `41148`, HTTPS 200, HTML build identity matched, API health `ok`, manifest and service worker 200, four-cat roster, Hub Browser Preview opened.
- Interactive `@` dogfood: pending on the reporting iPhone. Headless Chrome loaded the composer, but CDP value injection happened before/through hydration and React reset the controlled field; this was stopped rather than treated as product failure or patched with a test-only route.

## Fresh verification

- Focused picker/layout/keyboard guards: **9/9 passed**.
- Broader ChatInput selection: **108/110 passed**. The two repeatable failures are untouched baseline behavior: stale upload-error wording and current history-store append semantics.
- Web TypeScript: exit 0.
- Targeted Biome: exit 0 with existing warnings; `git diff --check`: exit 0.
- `pnpm lint`: exit 0 with repository warnings.
- `pnpm -r --if-present run build`: exit 0; all five available workspace projects built; Web generated 22 routes.
- Isolated acceptance Web rebuild with explicit `API_SERVER_PORT=4311`, `FRONTEND_PORT=4310`, and public `NEXT_PUBLIC_API_URL`: exit 0; all three rewrites point to 4311.
- `pnpm check:capability-tips`: passed (11/11 hard-check tests); warnings are missing origin/main and pre-existing stale anchors. The feature spec already carries `tips_exempt`.
- `pnpm test`: blocked in the API package by the Windows-incompatible POSIX environment assignment `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1`; finance 12/12 and shared 85/85 passed before that launcher failure.
- `pnpm check`: blocked by pre-existing formatting debt in untouched `packages/api/src/infrastructure/websocket/SocketManager.ts`.
- `check-hotfix-pattern.mjs` and `check-fallback-layers.mjs`: referenced by the current skill but absent from both this branch snapshot and the main workspace; unavailable, not passed.

## Gate verdict

No P1/P2 omission was found in the mention-picker implementation or current Sonnet binding. The deployed slice is ready for the co-creator's real-iPhone check, but formal quality-gate approval is withheld until:

1. the reporting iPhone confirms the picker stays inside the Chinese-keyboard frame and cats are directly tappable;
2. an after screenshot records the actual result;
3. the independent review stage runs after that evidence is committed.

[宪宪/gpt-5.6-sol🐾]
