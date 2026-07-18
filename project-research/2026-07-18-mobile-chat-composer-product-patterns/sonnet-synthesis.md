# F010 mobile chat composer product-pattern synthesis

Date: 2026-07-18
Author: Sonnet
Scope: reporting-iPhone mobile Safari / installed PWA chat surface

## Decision

The mobile terminal state is a content-first chat surface with one compact app-owned composer row. When the software keyboard is visible, app-owned navigation, persistent diagnostics, task/status chrome, and modal sheets do not share the remaining visual viewport with the transcript and composer.

The white Previous / Next / Done strip in the reporting-iPhone screenshots is Safari's system-owned form assistant. It is not a Clowder control and there is no supported web API to remove it. The product must budget for it instead of stacking another tall application surface above it.

## Adopt

1. Keep one 44px-minimum attachment action, one single-line editable surface that can grow to roughly three lines, and one 44px-minimum primary action in a 52–56px idle row.
2. Keep the transcript as the only chat scroll owner. Opening the status sheet first blurs the composer, dismisses the keyboard, and resets the sheet to its header.
3. Programmatic composer focus uses `focus({ preventScroll: true })`; the product decides transcript position instead of delegating it to the browser's default focus scrolling.
4. Replace the full mobile Agent hook diagnostic card with a one-row summary and a compact sync action. Hide even that summary while composing. Preserve the full diagnostic on desktop and in the status/governance surface.
5. Keep the mobile header as one line and keep all persistent interactive targets at least 44×44 CSS px.
6. Signal pending authorization on the existing mobile status action; dismiss the keyboard before revealing the full 44px authorization controls in that status surface. Critical authorization stays discoverable without reintroducing a card above the IME.
7. Keep recoverable PWA update actions available while browsing, but remove their floating prompt from the keyboard-constrained projection and resurface it when composing ends.

## Reject

- CSS or JavaScript tricks that attempt to suppress Safari's form assistant.
- Removing the app composer: an IME still requires an editable target and the application still owns message submission, attachments, drafts, mentions, and multiline text.
- Another VisualViewport fallback, user-agent sniff, fixed iPhone height, duplicate safe-area reserve, or `scrollTo(0, 0)` loop.
- A full configuration/403 diagnostic card in the mobile transcript.
- Letting a bottom sheet and the software keyboard remain active at the same time.
- Hiding authorization with ordinary secondary chrome, or restoring the full authorization card above the software keyboard.
- Letting a nonurgent waiting-worker prompt cover the transcript while the keyboard is open.

## Acceptance contract

- Opening mobile status while the composer is focused blurs the composer before the sheet becomes visible.
- Every sheet open starts at `scrollTop = 0`; the sheet header is visible.
- Programmatic focus paths opt out of browser scroll.
- At widths below `lg`, hook-health diagnostics are one row when browsing and consume no layout space while composing.
- The idle single-line composer row is at most 56px high by CSS contract; the editable surface and both actions retain 44px targets.
- At `lg` and above, the existing detailed notice and desktop controls remain available.
- Pending mobile authorization remains discoverable while composing, and all toolbar/authorization actions retain 44px-minimum touch height.
- A waiting-worker prompt may remain mounted for lifecycle safety, but its computed height is zero below `lg` while the mobile keyboard projection is active.

## Primary evidence

- Apple documents that the available webpage area changes when the keyboard appears and that Safari supplies a form assistant above it: [Designing Forms](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/DesigningForms/DesigningForms.html).
- WebKit documents Visual Viewport as the geometry that accounts for the onscreen keyboard and is intended for positioning overlays around it: [WebKit features in Safari 13](https://webkit.org/blog/9674/new-webkit-features-in-safari-13/).
- The platform focus API scrolls by default and provides `preventScroll` for application-owned positioning: [HTMLElement.focus()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus).
- Apple recommends adapting layouts to context changes and retaining 44×44pt interaction targets: [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).
