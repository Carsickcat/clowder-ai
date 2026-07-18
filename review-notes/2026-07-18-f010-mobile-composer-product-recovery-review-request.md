# Review request — F010 mobile composer product recovery

Review-Target-ID: f010

Branch: `feat/f010-mobile-pwa`

Implementation commits: `20adebde118b08e2b1cfb0b8e92a056846f8739a`, reviewer P2 repair `066762d`, browser failure-mode repair `49a4853`

Final evidence HEAD: supplied in the review handoff after this packet is committed.

Author: Sonnet

Reviewer requested: Terra (`@opus`), independent read-only review.

## What

Review the third reporting-iPhone product recovery for the mobile conversation surface and its two follow-up repairs. The candidate makes status and composing mutually exclusive, keys transient sheet state to the current thread, prevents internal focus scrolling, reduces the app-owned composer to a measured 52px row, collapses mobile Agent-hook diagnostics, keeps critical authorization discoverable through the existing mobile status journey, gives every exposed toolbar/authorization action a 44px target, and removes both ordinary secondary chrome and the waiting-worker prompt from the keyboard projection without changing desktop behavior.

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
7. Confirm pending authorization is signaled on the mobile status action and rendered at the top of the status sheet, not hidden with ordinary secondary chrome or restored above the IME.
8. Confirm a waiting PWA update remains actionable while browsing and exits layout only while the mobile keyboard projection is active.

## Verification

- Final affected Vitest: **10 files / 79 tests passed**.
- Count provenance: relative to Terra's independently reported 77, the author's explicitly listed 79-test roster includes the two `authorization-card-mobile` action tests that directly cover the authorization P2.
- TypeScript: exit 0.
- Targeted Biome: zero errors; existing warnings only.
- Capability tips guard: 11/11 plus hard check pass; existing origin/stale-anchor warnings only.
- `git diff --check`: exit 0.
- Production Web build: exit 0, 22 routes.
- Full Web Vitest: baseline-red. Latest managed JSON was **5055/5123**, 68 failures in the same 14-file roster; the sole new raw-pixel guard was fixed and its targeted F190 check is green. The waiting-worker follow-up is green in its 8/8 controller suite and build; no full-suite green is claimed.
- Final runtime: BUILD_ID `jcnYuX0LWcqvp7oKHGqSM`, isolated Web `4310` PID `39524`, HTTP 200, isolated API `4311` untouched.
- Browser dogfood: 390×844 browsing/tool expansion, focus→status transition, and 390×430 composing projection with a real waiting worker. Toolbar actions and the status trigger measure 44px; composer bottom gap, Dock height, update-prompt height, and root scroll are all zero while composing. Exact metrics and three screenshots are in the quality-gate packet.
- Root media/design artifact gate: clear. Matching `.pen`: none.

Quality gate: `review-notes/2026-07-18-f010-mobile-composer-product-recovery-quality-gate.md`.

## Open

Technical: none intentionally deferred inside the code slice; reviewer findings must be fixed before merge.

Release: reporting-iPhone Safari/installed-PWA Chinese-IME acceptance remains open and is not replaced by Chrome projection.

## Next

Final verdict received: Terra approved `ad32068` in message `0001784365910648-000530-9e400c32` with P1=0, P2=0, P3=1. The nonblocking P3 count discrepancy is resolved by the explicit suite breakdown in the quality gate; no further code review is required. Do not modify the author worktree or restart ports 4310/4311.

[宪宪/gpt-5.6-sol🐾]
