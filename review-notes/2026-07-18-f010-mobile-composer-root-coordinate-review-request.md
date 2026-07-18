# F010 mobile composer root-coordinate review request

Review-Target-ID: f010

Branch: `feat/f010-mobile-pwa`

Implementation commit: `e27ee2daf9bbfb986754385b7068935f19c4833e`

Evidence head before this request note: `91c7128db360c6ad6608afc0ffaca48ca589ddda`

## Original requirements

Reporting iPhone evidence:

- `C:\Users\myh_1\Desktop\07a4d1f3c1d2cdf4acc422ab2fe0512e.mp4`
- `packages/api/uploads/1784388882630-270baf4d.png`

Operator experience excerpt:

> 当前主要阻塞流程遗留有问题；另外截图你看下，我标识了页面上存在的三个主要问题，希望你可以好好优化一下。本次一次性优化好吧。

The annotated requirements are: remove the focus-triggered blank jump, compress the application composer region, stop duplicating the iOS Form Assistant height, and align composer/message typography without breaking Chinese IME, mentions, drafts, attachments, or desktop.

## Architecture ownership

- Architecture cell: AppShell VisualViewport projection and mobile chat composer geometry.
- Map delta: none.
- Why: the canonical owners remain `useVisualViewportCssVars`, `.app-viewport`, `mobile-shell.css`, and `ChatInput`; the change removes cross-owner coordinate feedback and duplicate reserve rather than adding a new store, adapter, router, queue, or binding.

## What

- Fixed AppShell at literal `top: 0; left: 0`; VisualViewport supplies width/height only.
- Removed the fixed 3.5rem application reserve for Safari's native form assistant.
- Reduced the mobile composer to one 48px row with 44px textarea/actions.
- Made tools and IME mutually exclusive while retaining the textarea primitive.
- Aligned mobile message body and composer text at 16px.
- Added root-origin, zero-reserve, density, typography, and interaction contracts.
- Recorded full-suite, production-build, and 390px runtime evidence.

## Why

The new continuous recording shows the whole shell moving away together after focus. That is incompatible with a transcript-only scroll or a stale sheet and directly matches the fixed root consuming iOS's already-applied visual viewport pan. The annotated blank band also matches Clowder's extra assistant reserve, not an application confirmation control.

## Tradeoff

The implementation accepts Safari's native Previous/Next/Done row instead of attempting to suppress it. It deliberately keeps `<textarea>` rather than moving to `contenteditable`, preserving IME composition, selection, accessibility, drafts, and mentions. Tools now dismiss the IME instead of sharing the constrained frame.

Rejected alternatives: UA/device magic, another RAF or timeout, `scrollIntoView`, a fixed assistant-height guess, sub-16px input text, offscreen closed UI, or a second geometry owner.

## Open questions

Technical:

- Does any path still allow `offsetTop` to influence an ancestor of `.app-viewport`?
- Does the zero-reserve model preserve browsing Dock ownership and desktop behavior?
- Do tool/IME exclusivity and 48px density retain all draft/mention/composition paths?

Value: none. The reporting iPhone replay is acceptance evidence, not a pending product choice.

## Self-check evidence

- Focused selection: **33/33**.
- Broader affected selection: **12 files / 108 tests**.
- Full Web Vitest: **5067/5134**, 67 failures in the same 14 historical files; exactly three new tests pass relative to **5064/5131**.
- Web TypeScript, targeted Biome (zero errors), and `git diff --check` pass.
- Production BUILD_ID: `7FDxNHXymbVxqdC4HjWmh`.
- Isolated Web: `4310`, PID `2656`, HTTP 200; API `4311` untouched.
- 390×430: root top/scroll `0`, reserve `0`, Dock `0`, composer `48`, bottom gap `0`.
- Synthetic 96px offset variable cannot move the root; pointer journey proves tools/IME mutual exclusion.
- Worktree and root-media worktree scans are clean. The root-media branch scan could not compare `origin/main...HEAD` because this local branch has no merge base with that ref; no root media is present in the current worktree or committed change list.

Detailed gate: `review-notes/2026-07-18-f010-mobile-composer-root-coordinate-quality-gate.md`.

## Next action

Please independently review the exact final HEAD. Return `APPROVE` or `REQUEST_CHANGES` with P1/P2/P3 findings. Focus on root-coordinate invariance, the single reserve owner, IME/editor behavior, desktop boundary, and whether the tests can detect the recorded failure rather than only the intended CSS text.

[宪宪/gpt-5.6-sol🐾]
