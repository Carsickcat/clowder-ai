# Review Request: F010 mobile chat shell viewport reclamation

Review-Target-ID: `f010`

Branch: `feat/f010-mobile-pwa`

Implementation SHA: `78ebe807f7c3303a4a26bf5b50137d098f7a1a9c`

Review range: `b17ca8b0b18c7ddb8701448e27394ef2616fb03f..78ebe807f7c3303a4a26bf5b50137d098f7a1a9c`

P2 repair SHA: `b480c1ddfb13314fef5aec4f1e4b54fe2d612172`

P2 re-review range: `d3dae1a0c061a826d481b5cab643646f09c2e9f3..b480c1ddfb13314fef5aec4f1e4b54fe2d612172`

Author worktree: `E:\ClowderAI\clowder-ai-f010-local-sandbox`

Preferred reviewer sandbox: `/tmp/cat-cafe-review/f010/opus` (or an equivalent isolated local checkout). This branch has no usable remote URL/PR, so the local SHA above is the review truth. Do not edit, push, merge, or start a reviewer runtime on the author ports `4310`/`4311`.

## Original requirement excerpt

Source: co-creator message `0001784346245464-000456-503eb180`, with true-device screenshots:

- `packages/api/uploads/1784346245459-047c7886.jpg`
- `packages/api/uploads/1784346245461-f1608fcd.png`
- `packages/api/uploads/1784346245461-9a011e62.jpg`

> 我感觉你的思路有一些问题，可以看下p1，为什么每次展开对话框，下面都有这些无效页块往上挤压面积。
>
> 你可以参考下当前业内对于对话框的设计要求，没有你这么玩的。
>
> p2和p3由于你顶层和底部的固定设计，导致可视面积非常少。
>
> 顶部的字体排列甚至因为换行在挤压面积，这有什么意义吗。
>
> 底部每次拉起对话框，同时会把底部button区域也都顶上来，又一次挤压了面积。
>
> 你和terra好好设计一下，并且修改吧，体验太差太差了。

## Five-piece handoff

### What

The mobile chat surface now has two shell projections instead of four competing chrome owners:

- Browsing: one 56px header row, transcript, compact composer, one Dock reserve.
- Composing: the same compact header, transcript, composer at VisualViewport bottom; Dock reserve is zero and secondary liveness/execution/queue/vote chrome exits layout.
- Mobile header retains sidebar, one-line thread title, and status only. Desktop branding/export/voice affordances remain unchanged at `lg`.
- `useVisualViewportCssVars` now recognizes the iOS/PWA model where layout and visual viewport heights shrink together, guarded by composer focus and a stable same-width baseline.

### Why

The true-device screenshots show a shell coordinate failure, not a mention-picker sizing bug. The desktop header, liveness/status rows, composer safe-area padding, Dock reserve, and iOS keyboard all consumed the same visual viewport. The prior detector compared only `innerHeight - visualViewport.height`, so it could miss a keyboard when both heights shrank together.

### Tradeoff

Mobile removes low-frequency chrome from the primary row and hides secondary status rows during composition to protect the conversation surface. Those capabilities remain reachable through the status/global surfaces, and the stop action remains in the composer. The focused-baseline detector is intentionally narrower than UA/device sniffing; reviewer should look for false positives/negatives rather than adding a second inset owner.

### Open

No product/design choice is open. Release acceptance still needs one reporting-iPhone after screenshot with the Chinese IME and `@` picker; browser projection is not represented as a substitute for real iOS chrome/safe-area behavior.

### Next

Please independently review the implementation range and return one verdict: `APPROVE` or `REQUEST_CHANGES`, with every finding labeled P1/P2/P3. This is code review only; do not push or merge.

## Exact contracts to review

1. Mobile/tablet header remains one row: exactly two 44×44 global actions plus one truncated thread title; desktop layout is restored at `lg`.
2. `--mobile-dock-reserve` is the only Dock/safe-area owner. `ChatInput` must not add `safe-area-bottom`.
3. Below `wide=1024`, keyboard open means Dock `display:none`, reserve `0px`, and `.mobile-keyboard-secondary-chrome` leaves layout; at and above 1024px, secondary desktop status remains visible. Composer stays mounted.
4. Direct visual/layout obscured height still works. The alternate path requires composer focus plus at least 80px shrink from a stable same-width baseline, and material width change resets that baseline.
5. No UA/device sniff, fixed iPhone height, second keyboard inset, persistent keyboard store, or new Store/Queue/Router/Adapter/Dispatcher/Binding.

## Reviewer focus

- Baseline lifecycle: orientation/width changes, focus in/out, keyboard close, and browser-toolbar movement must not leave stale composing state.
- Accessibility: two mobile actions retain names and 44×44 targets; hidden mobile controls remain present on desktop.
- Layout ownership: no hidden secondary wrapper or Dock reserve may still consume height; no duplicate safe-area padding.
- Regression boundary: `ChatInput` identity/draft state and existing desktop header capabilities remain stable.

## Verification evidence

RED before implementation: 5 targeted failures.

GREEN after implementation:

```powershell
$env:NODE_ENV='test'
pnpm.cmd exec vitest run `
  src/hooks/__tests__/useVisualViewportCssVars.test.tsx `
  src/components/__tests__/chat-input-mobile.test.ts `
  src/components/__tests__/mobile-overflow-contract.test.ts `
  src/components/__tests__/chat-container-header-thread-indicator.test.ts
# 4 files / 32 tests PASS after the P2 boundary repair

node --test packages/web/test/next-config.test.cjs
# 8/8 PASS

node packages/web/eslint-plugins/no-hardcoded-colors.test.js
# PASS

pnpm.cmd check:features
# PASS

pnpm.cmd check:capability-tips
# 11/11 PASS; disclosed no-origin/main and stale-anchor warnings
```

- Targeted Biome and `git diff --check`: PASS.
- Current production Web build: PASS in 36.8s, 22 routes, BUILD_ID `w_4Uqp53TT0EkwyWK4D1U`; API/Socket/uploads rewrites target 4311.
- Isolated browser projection:
  - 390×500 composing with both viewport heights shrunk: header 57px, composer bottom 500, Dock/secondary chrome none, reserve 0, document 390×500.
  - 430×932 and 768×1024 browsing: composer bottom equals Dock top, Dock 56px, document equals viewport.
- Full Web baseline remains red: **5036/5105 passed**, 69 failures in 16 pre-existing files. No changed file appears in that failure list; this is not represented as a full-suite pass.
- No matching `.pen`, root media, or diff media. Pencil tooling was unavailable; true-device screenshots plus exact browser metrics are the design evidence.

## P2 repair delta

Terra's first implementation review returned `REQUEST_CHANGES` because the keyboard selector hid secondary chrome at every width, contradicting the `lg=1024` desktop restoration contract.

- RED: `mobile-overflow-contract.test.ts` was **4/5**, missing a shared-wide boundary.
- FIX: `b480c1d` scopes only `.mobile-keyboard-secondary-chrome` hiding to `max-width:1023px`; the global detector and existing Dock/reserve ownership remain unchanged.
- GREEN: exact contract **5/5**; complete affected selection **32/32**; Next/PWA **8/8**, hardcoded-color rule, targeted Biome, production build and diff check pass.
- Browser proof from the current 4310 bundle with the keyboard attribute forced true: 1024px → two wrappers `block`; 1023px → the same two wrappers `none`.
- Audit: `.mobile-ops-nav` already carries `lg:hidden`, while ChatContainer reserve already carries `lg:pb-0`; no sibling boundary leak required another patch.

Re-review verdict: Terra approved `b480c1d` in message `0001784350462169-000473-efbef0d2` with **P1/P2/P3 = 0**. Real iPhone acceptance remains separate.

## Truth sources

- `docs/bug-report/f010-mobile-chat-shell-chrome-density/bug-report.md`
- `feature-specs/2026-07-18-f010-mobile-experience-recovery.md` Task 8
- `feature-discussions/2026-07-18-f010-mobile-experience-recovery-meeting-notes.md` section 9
- `review-notes/2026-07-18-f010-mobile-chat-shell-quality-gate.md`
- `project-evidence/f010-mobile-pwa/README.md`

[宪宪/gpt-5.6-sol🐾]
