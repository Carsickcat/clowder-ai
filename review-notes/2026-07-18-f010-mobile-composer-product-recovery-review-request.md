# Review request — F010 mobile composer product recovery

Review-Target-ID: f010

Branch: `feat/f010-mobile-pwa`

Implementation commits: `20adebde118b08e2b1cfb0b8e92a056846f8739a`, reviewer P2 repair `066762d`, browser failure-mode repair `49a4853`, reporting-iPhone repair `3667199`, mobile-shell extraction `3956aa5`

Final evidence HEAD: `40f972628992562c308d89233a8f6651268c9f02`.

Author: Sonnet

Reviewer requested: Terra (`@opus`), independent read-only review.

## What

Review the complete reporting-iPhone product recovery and its fourth-round modal/Form Assistant repair. The final candidate keeps the earlier compact composer and cross-route fixes, then makes the status sheet a real exclusive modal: sheet and backdrop share one React state, the chat surface becomes inert while open, and composer focus closes the status journey. It also keeps one bottom-reserve owner, budgets 3.5rem for Safari's native Form Assistant only on the iOS coarse-touch composing projection, and lets WebKit's late VisualViewport geometry settle without a timer or UA sniff.

## Why

The reporting iPhone still landed on stale status content after client thread navigation and then stacked a full 403 diagnostics card, the application composer, and Safari's system form assistant above the Chinese IME. Component/breakpoint tests had passed, but they did not cover focus ownership, sheet lifecycle, or measured chrome density.

Original product report: message `0001784357537884-000498-e55d75f5`, screenshots `1784357537844-455e30ef.png` and `1784357537845-e8f055b9.jpg`. Fourth-round report: message `0001784367014842-000534-46c6f81d`, screenshots `1784367014821-3bd66f12.png` and `1784367014823-aff1e7f2.png`. The latest evidence showed two independent failures: opening the status journey could leave the entire fixed shell in an unreachable scrolled state, and the native Previous/Next/Done assistant overlaid the app composer.

## Tradeoff

- Safari's Previous/Next/Done row remains system-owned; the Web app cannot remove it and now budgets around it instead of attempting unsupported suppression.
- Mobile hook failure retains a one-line sync action; raw error details and five target pills remain on desktop/governance surfaces.
- Status opening deliberately blurs the composer, so the keyboard closes before the sheet becomes usable.
- The iOS assistant budget is applied only below `lg`, with coarse pointer and WebKit capability support, while Android/desktop keep a zero keyboard reserve.
- No persisted keyboard flag, UA sniff, fixed iPhone height, scroll loop, timer, or second reserve owner was added.

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
9. Confirm status sheet and backdrop cannot diverge: when open, the underlying chat is inert and focus cannot enter it; when closed, the backdrop has no pointer ownership and the composer can regain focus.
10. Confirm `--mobile-chat-bottom-reserve` remains the sole bottom-reserve owner and the 3.5rem native-assistant budget is scoped to iOS coarse-touch composing below 1024px.
11. Confirm keyboard state survives blur while the viewport remains shrunken and the second animation-frame sample handles late WebKit VisualViewport offsets without delaying ordinary browsers.
12. Confirm `mobile-shell.css` is registered in the app and vendor asset pipeline and restores every global CSS entrypoint below the 350-line architecture limit.

## Verification

- Earlier product-recovery affected Vitest: **10 files / 79 tests passed**.
- Count provenance: relative to Terra's independently reported 77, the author's explicitly listed 79-test roster includes the two `authorization-card-mobile` action tests that directly cover the authorization P2.
- TypeScript: exit 0.
- Targeted Biome: zero errors; existing warnings only.
- Capability tips guard: 11/11 plus hard check pass; existing origin/stale-anchor warnings only.
- `git diff --check`: exit 0.
- Production Web build: exit 0, 22 routes.
- Fourth-round RED→GREEN: 10 initial failures; **51/51** directly affected tests pass and **53/53** pass with the CSS architecture guard.
- Full Web Vitest remains baseline-red. The managed JSON after `3667199` was **5062/5130**, 68 failures versus the previous **5055/5123**, 68 failures: all seven added tests pass. Its sole added failure was the global CSS 350-line guard; `3956aa5` closes that guard, and the exact architecture tests are green. No full-suite green is claimed.
- Final runtime: BUILD_ID `dekHachDoovqQ-6QxRcBT`, isolated Web `4310` PID `22696`, local and Tailscale HTTPS roots HTTP 200, isolated API `4311` untouched.
- Browser dogfood: 390×844 browsing/tool expansion, focus→status transition, and 390×430 composing projection with a real waiting worker. Toolbar actions and the status trigger measure 44px; composer bottom gap, Dock height, update-prompt height, and root scroll are all zero while composing. Exact metrics and three screenshots are in the quality-gate packet.
- Root media/design artifact gate: clear. Matching `.pen`: none.

Quality gate: `review-notes/2026-07-18-f010-mobile-composer-product-recovery-quality-gate.md`.

## Open

Technical: none intentionally deferred inside the code slice; reviewer findings must be fixed before merge.

Release: reporting-iPhone Safari/installed-PWA Chinese-IME acceptance remains open and is not replaced by Chrome projection.

## Next

Final verdict received: Terra approved review-packet HEAD `3ba72fb` in message `0001784373466883-000541-b9f0ba23` with **P1=0, P2=0, P3=0**. The fourth-round code scope requires no further review unless it changes. Release remains gated on reporting-iPhone installed-PWA Chinese-IME acceptance; do not treat Chrome projection as that proof.

[宪宪/gpt-5.6-sol🐾]
