# Review request — F010 mobile composer product recovery

Review-Target-ID: f010

Branch: `feat/f010-mobile-pwa`

Implementation commit: `20adebde118b08e2b1cfb0b8e92a056846f8739a`

Final evidence HEAD: supplied in the review handoff after this packet is committed.

Author: Sonnet

Reviewer requested: Terra (`@opus`), independent read-only review.

## What

Review the third reporting-iPhone product recovery for the mobile conversation surface. The candidate makes status and composing mutually exclusive, keys transient sheet state to the current thread, prevents internal focus scrolling, reduces the app-owned composer to a measured 52px row, collapses mobile Agent-hook diagnostics, and removes secondary chrome from the keyboard projection without changing desktop behavior.

## Why

The reporting iPhone still landed on stale status content after client thread navigation and then stacked a full 403 diagnostics card, the application composer, and Safari's system form assistant above the Chinese IME. Component/breakpoint tests had passed, but they did not cover focus ownership, sheet lifecycle, or measured chrome density.

Original report: message `0001784357537884-000498-e55d75f5`, screenshots `1784357537844-455e30ef.png` and `1784357537845-e8f055b9.jpg`. Please judge the result against the operator request not to enumerate further screens and to converge on an established mobile-chat product model.

## Tradeoff

- Safari's Previous/Next/Done row remains system-owned; the Web app budgets around it instead of using unsupported suppression.
- Mobile hook failure retains a one-line sync action; raw error details and five target pills remain on desktop/governance surfaces.
- Status opening deliberately blurs the composer, so the keyboard closes before the sheet becomes usable.
- No new VisualViewport detector, persisted keyboard flag, device sniff, fixed iPhone height, scroll loop, or reserve owner was added.

## Architecture ownership

- Architecture cell: F010 Web AppShell / mobile chat presentation.
- Map delta: none.
- Why: existing components and the existing `browsing | composing` projection are extended; no Store, Queue, Router, Adapter, Dispatcher, Binding, viewport writer, scroll owner, or bottom-reserve owner is introduced.

## Reviewer focus

1. Confirm thread-keyed sheet state closes synchronously on a client-side thread change and does not remount the composer.
2. Confirm blur-before-status plus `focus({ preventScroll: true })` closes the lifecycle hole without a new scrolling workaround.
3. Confirm the 52px mobile row retains 44px controls, IME composition, multiline growth, draft/attachment/reply ownership, and desktop padding.
4. Confirm compact Agent diagnostics preserve sync/error reachability and detailed desktop behavior.
5. Confirm keyboard-only hiding remains `<1024px`, critical stop/send behavior stays reachable, and no secondary chrome/reserve sibling escaped the failure-mode sweep.
6. Challenge the product model itself: reject the patch if it still behaves like a desktop console compressed into a phone.

## Verification

- Affected Vitest: **44/44**.
- TypeScript: exit 0.
- Targeted Biome: zero errors; existing warnings only.
- Capability tips guard: 11/11 plus hard check pass; existing origin/stale-anchor warnings only.
- `git diff --check`: exit 0.
- Production Web build: exit 0, 22 routes.
- Full Web Vitest: baseline-red **5050/5117**, 67 failures in 14 files versus prior **5044/5112**, 68 failures in 15 files; no new failing file.
- Post-commit runtime: `20adebd`, BUILD_ID `i1XgGmGXamb0QSLhn2Bgk`, isolated Web `4310` PID `26716`, HTTP 200, isolated API `4311` untouched.
- Browser dogfood: 390×844 browsing, focus→status transition, and 390×430 composing projection; exact metrics and three screenshots are in the quality-gate packet.
- Root media/design artifact gate: clear. Matching `.pen`: none.

Quality gate: `review-notes/2026-07-18-f010-mobile-composer-product-recovery-quality-gate.md`.

## Open

Technical: none intentionally deferred inside the code slice; reviewer findings must be fixed before merge.

Release: reporting-iPhone Safari/installed-PWA Chinese-IME acceptance remains open and is not replaced by Chrome projection.

## Next

Return a clear `APPROVE` or `REQUEST_CHANGES` with P1/P2/P3 findings against the final handoff SHA. Do not modify the author worktree or restart ports 4310/4311.

[宪宪/gpt-5.6-sol🐾]
