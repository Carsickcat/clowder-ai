# Review Request: F010 mobile experience recovery

Review-Target-ID: f010
Branch: `feat/f010-mobile-pwa`
Code SHA: `85d0cb13844e7547069558a5ffe0771fca1583f1`
Re-review base: `7d2bca8627258a7bc043fb3b2c79569dc4710a73`

## What

This recovery slice replaces the competing iOS viewport/fixed-chrome model with one VisualViewport rectangle, one AppShell frame, one transcript scroll owner, and one Dock reserve. The current re-review delta `85d0cb1` closes the remaining message lifecycle gaps: a durable message survives recoverable record-backfill failure, and a deterministic HTTP rejection removes its optimistic bubble while restoring the exact text/image/reply composition.

## Why

The reporting iPhone showed zooming, incorrect scroll geometry, a clipped composer, a keyboard-obstructed reading area, a permanent update-check error, and contradictory `Load failed` UI after a message had apparently reached the server. The operator explicitly required a working result, not a design-only handoff.

## Original Requirements (required)

> The iPhone 13 Pro layout must stop zooming and mis-scrolling; the composer must be comfortable to use with the keyboard; the permanent update-check error and excess fixed chrome must stop consuming the conversation; and the whole mobile experience must be treated as a product-quality problem, not only a functional patch.

- Source: `feature-discussions/2026-07-18-f010-mobile-experience-recovery-meeting-notes.md`
- Please judge the delivery against the operator experience above, not only against unit-test coverage.

## Tradeoff

The implementation does not hard-code an iPhone size, prohibit user zoom, or add another keyboard offset fallback. For message recovery, the durable message store is the commit point and `InvocationRecord.userMessageId` is repairable metadata. Only a definite server rejection restores the composer; a twice-ambiguous transport outcome keeps the optimistic state because the server may already have committed the UUID. Real iOS Chinese-IME and installed-PWA behavior remains a device-owned acceptance step because desktop Chromium cannot prove the native keyboard frame.

## Architecture Ownership (required)

Architecture cell: `hub-action-surface`, `bubble-pipeline`, `dispatch`
Map delta: none
Why: the slice repairs the existing mobile surface, message projection, and dispatch acknowledgment paths. The existing message-store port/adapters gain one scoped idempotency lookup; no parallel Store, Queue, Router, Adapter, Dispatcher, or Binding is introduced.

Please verify:

- the diff agrees with `Map delta: none`;
- no parallel ownership abstraction was introduced;
- the acceptance roster gate remains an environment-scoped startup assertion rather than a second product readiness model.

## Open Questions

### Technical OQ (for reviewers)

- Does the VisualViewport rectangle get consumed exactly once, with safe area only at frame/Dock edges and no double-counted keyboard inset?
- Do immediate, queue, TOCTOU queue, multipart, and force paths preserve the same idempotency key and distinguish `acknowledged`, `confirming`, durable failure, and invariant violation without creating a contradictory failed bubble?
- If `InvocationRecord.userMessageId` backfill fails after append, does replay resolve the original durable message without duplicate append/owner or unsafe Redis stale-index deletion?
- Does a deterministic rejection remove the correct active/split-pane optimistic bubble and restore exactly the originating thread's text, images, and reply, while ambiguous outcomes avoid duplicate-send invitation?
- Can keyboard/viewport/Dock changes remount or reset the composer's text, image, or reply context?
- Is the acceptance-only roster gate fail-closed without changing production identity/dispatch semantics?

### Value OQ (for operator)

None. These are reversible implementation choices within the approved recovery direction.

## Next Action

Opus 4.5: independently inspect `7d2bca8..85d0cb1` and rerun the high-risk validation chain. Return a formal `APPROVE` or `REQUEST_CHANGES` verdict with every finding classified P1/P2/P3. Approval covers code SHA `85d0cb1`; the reporting iPhone touch journey remains a separate release-acceptance boundary.

## Review Sandbox (required)

- Path: `/tmp/cat-cafe-review/f010/{reviewer-handle}` (Windows equivalent is acceptable)
- Start Command: `pnpm review:start`, or reuse the author's read-only isolated production acceptance environment
- Author acceptance ports: `web=4310`, `api=4311`, Redis `6398/15`
- Reviewer-created ports must avoid `3003/3004/3011/3012/4111` and be recorded in the verdict.

### Sandbox Bootstrap

```powershell
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
pnpm install --frozen-lockfile
pnpm --filter @cat-cafe/shared build
pnpm --filter @cat-cafe/api run build
```

## Self-check evidence

### Spec compliance

`review-notes/2026-07-18-f010-mobile-experience-recovery-quality-gate.md` records a PASS for independent code review. It maps every operator complaint to an implementation invariant, documents the isolated roster fail/pass exercise, records baseline limitations, and leaves the native iPhone touch journey explicitly open.

### Test results

Post-review repair:

```powershell
# API durable-message reconciliation and store adapters
pnpm --filter @cat-cafe/api run build
node --test packages/api/test/messages-delivery-mode.test.js packages/api/test/message-store.test.js packages/api/test/redis-message-idempotency-index.test.js packages/api/test/redis-message-store.test.js
# 73/73 passed; isolated Redis integration skips without its isolation flag

# Web deterministic rejection and real-composer recovery
pnpm --filter @cat-cafe/web exec vitest run `
  src/hooks/__tests__/useSendMessage-thread-source.test.ts `
  src/hooks/__tests__/useSendMessage-upload-state.test.ts `
  src/components/__tests__/chat-input-draft-persistence.test.ts
# 3 files / 28 tests passed
```

Broader affected selections: API **196/196**, Web **10 files / 67 tests**. Repository `pnpm lint`, production API/Web builds, targeted Biome, capability tips, and `git diff --check` pass. A fresh full-Web run remains baseline-red only in unrelated failure families; root `pnpm check` remains red only on untouched `SocketManager.ts` formatting.

Original recovery evidence:

```powershell
# API high-risk races and acceptance roster gate
pnpm --filter @cat-cafe/api run build
node --test packages/api/test/messages-delivery-mode.test.js packages/api/test/acceptance-roster-gate.test.js
# 39/39 passed

# Web affected suites (the author ran 12 files)
pnpm --filter @cat-cafe/web exec vitest run `
  src/hooks/__tests__/useVisualViewportCssVars.test.tsx `
  src/hooks/__tests__/useSendMessage-thread-source.test.ts `
  src/hooks/__tests__/useSendMessage-upload-state.test.ts `
  src/components/__tests__/MobileOpsShell.test.tsx `
  src/components/__tests__/chat-container-mobile.test.ts `
  src/components/__tests__/chat-input-draft-persistence.test.ts `
  src/components/__tests__/chat-input-mobile.test.ts `
  src/components/__tests__/connection-status-bar.test.tsx `
  src/components/__tests__/mobile-overflow-contract.test.ts `
  src/components/__tests__/pwa-update-controller.test.tsx
# Full recorded selection: 12 files / 80 tests passed

pnpm --filter @cat-cafe/web exec tsc --noEmit
pnpm --filter @cat-cafe/web lint
pnpm --filter @cat-cafe/web build
# PASS; lint has repository baseline warnings only; build generated 22 routes and custom worker
```

Additional original passes: targeted Biome, `check:features` (254 docs), `check:capability-tips`, Next/PWA config 8/8, hardcoded-color harness, and `git diff --check`. Repository-wide Windows/baseline failures are listed rather than promoted to green in the quality report.

### Browser evidence

- `project-evidence/f010-mobile-pwa/recovery-20260718-mobile-390x844.png`
- `project-evidence/f010-mobile-pwa/recovery-20260718-mobile-430x932.png`
- `project-evidence/f010-mobile-pwa/recovery-20260718-desktop-1024x768.png`

At both mobile widths, device metrics reported matching viewport/client/VisualViewport/document-scroll/Dock widths and visual inspection showed all four Dock destinations, the composer action, and header actions inside the frame.

### Artifact gate

- Root media/design artifacts in worktree: none.
- Root media/design artifacts in the implementation commit range: none.
- Matching `designs/**/*.pen`: none; no design-comparison claim is made.

## Related documents

- Discussion: `feature-discussions/2026-07-18-f010-mobile-experience-recovery-meeting-notes.md`
- Plan: `feature-specs/2026-07-18-f010-mobile-experience-recovery.md`
- Design standard: `docs/design/F010-mobile-pwa-standard.md`
- Feature truth: `docs/features/F010-mobile-cat.md`
- Evidence ledger: `project-evidence/f010-mobile-pwa/README.md`
- API diagnosis: `docs/bug-report/f010-message-backfill-reconciliation/bug-report.md`
- Web diagnosis: `docs/bug-report/f010-deterministic-send-composer-recovery/bug-report.md`

[宪宪/gpt-5.6-sol🐾]
