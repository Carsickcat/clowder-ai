# F010 mobile chat shell chrome density

**Reporter:** co-creator
**Date:** 2026-07-18
**Runtime under test:** isolated Web `4310` / API `4311`; screenshots taken from the iPhone PWA
**Scope:** F010 mobile experience recovery; no new feature or persistent state

## Bug diagnosis capsule

| Field | Finding |
|---|---|
| **1. Symptom** | On iPhone, focusing the composer leaves the four-item Dock and multiple status/action rows above the keyboard. The desktop-style header wraps the brand and subtitle into several lines. The transcript becomes a narrow strip even before the mention picker opens. |
| **2. Evidence** | True-device screenshots `1784346245459-047c7886.jpg`, `1784346245461-f1608fcd.png`, and `1784346245461-9a011e62.jpg`; source inspection of `ChatContainerHeader`, `ChatContainer`, `ChatInput`, `MobileOpsShell`, `globals.css`, and `useVisualViewportCssVars`; RED tests reproduced simultaneous layout/visual viewport shrink and duplicate bottom inset consumption. |
| **3. Root cause** | Four chrome owners competed inside one visual viewport: a desktop header, liveness/status rows, composer safe-area padding, and the Dock reserve. Keyboard detection only compared `innerHeight` with `visualViewport.height`; an iOS/PWA geometry where both shrink together produced a zero difference, so composing mode never activated. The picker amplified this failure but did not cause it. |
| **4. Terminal model** | Two projections only. **Browsing:** one 56px mobile header row, transcript, compact composer, one Dock reserve. **Composing:** the same compact header, transcript, composer at the visual-viewport bottom; Dock reserve is zero and secondary Thinking/Execution/Queue/Vote chrome exits layout. The existing `data-mobile-keyboard-open` remains the sole ephemeral projection. |
| **5. Detector rule** | Preserve the direct visual/layout viewport difference. Add one guarded path for the alternate iOS geometry: the active element must be inside `data-chat-input-composer` and the visual viewport must have shrunk at least 80px from a stable same-width baseline. A material width change resets the baseline. |
| **6. Safety boundary** | No UA/model sniffing, no fixed iPhone height, no second keyboard inset, no persistent keyboard store, and no conditional remount of `ChatInput`. The stop action remains in the composer while secondary status chrome is hidden. |
| **7. Visible correction** | Mobile header keeps only sidebar, one-line thread title, and status; logo/brand subtitle/export/voice controls move out of the mobile primary row. Composer no longer consumes a second safe-area inset, uses tighter mobile padding, and caps auto-grow near three lines. Dock core height reduces from 64px to 56px and disappears without reserve while composing. |
| **8. Verification** | RED→GREEN viewport and shell contracts; focused Web suites; production build; isolated browser preview at compact/medium widths; then independent review and co-creator iPhone PWA acceptance. |

## Failure-mode audit

- A smaller mention picker alone is rejected: it cannot fix header, Dock, safe-area, or status-row competition.
- Keeping the Dock visible and adding padding is rejected: it preserves the geometry conflict seen in all three screenshots.
- Hiding the entire header is rejected: a compact row preserves thread orientation and the two global actions without consuming a desktop header.
- An unguarded “viewport got shorter” heuristic is rejected: browser toolbar movement could look like a keyboard. Composer focus plus a stable baseline is the guard.
- If true-device acceptance still fails, capture `innerHeight`, `visualViewport.{height,width,offsetTop}`, focus target, and the projected data attribute from that exact build before adding another geometry rule.

## External claim ledger

| Claim | Primary source | Audit verdict | Use in design |
|---|---|---|---|
| A mobile toolbar should prioritize the most important items and use a concise contextual title rather than the app name. | [Apple Human Interface Guidelines — Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | **use** — first-party platform guidance; qualitative, not a pixel mandate | Keep two 44px global actions and a single-line thread title; remove app branding and low-frequency controls from the mobile row. |
| A tab bar represents top-level navigation and should keep labels concise and the item count limited. | [Apple Human Interface Guidelines — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | **use** — first-party platform guidance | Keep the four destinations in browsing mode, but do not treat the Dock as a keyboard accessory. |
| Mobile browsers have distinct layout and visual viewports; the on-screen keyboard can shrink the visual viewport. | [MDN — Visual Viewport API](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport), [WebKit — New WebKit Features in Safari 13](https://webkit.org/blog/9674/new-webkit-features-in-safari-13/) | **use with implementation evidence** — general model is authoritative; exact installed-PWA geometry is verified by our source/test/device evidence | Keep `VisualViewport` as geometry truth and support both observed shrink models without UA sniffing. |
| Interactive widgets can resize the visual viewport, resize both viewports, or overlay content. | [CSS Viewport Module Level 1](https://www.w3.org/TR/css-viewport-1/#interactive-widget-section) | **use with caveat** — standards text describes multiple models; implementation details vary | Do not infer keyboard state from one viewport difference alone. |

## Reproduction and regression proof

1. Open the isolated PWA on iPhone and focus the composer, with and without `@` picker.
2. Observe whether the Dock remains above the keyboard and whether liveness rows continue consuming transcript height.
3. Automated reproduction sets both `window.innerHeight` and `visualViewport.height` from `844` to `500` while the composer is focused. Before the fix, `data-mobile-keyboard-open` stayed absent.
4. The repaired test requires the composing projection to activate and clear again when the viewport returns to `844`.

[宪宪/gpt-5.6-sol🐾]
