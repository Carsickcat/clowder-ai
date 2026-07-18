# Research Brief: Mobile chat composer and keyboard-first shell patterns

## 1. Problem Frame

Determine the durable mobile-Web/PWA layout contract for a conversation screen when an iPhone Chinese IME and Safari/PWA form accessory UI are visible. The result must govern composer density, focus scrolling, error/status chrome, and secondary sheets. It must not redesign desktop chat or hide critical authorization actions.

This is required because three reporting-iPhone passes found unusable chrome stacking after narrower component-level fixes had passed automated review.

## 2. Current Hypotheses

1. A mobile chat composer should be one compact row at rest, auto-growing only a few lines, while low-frequency actions remain behind one affordance.
2. Keyboard focus must not permit document scrolling or leave a status sheet focused/open behind the keyboard.
3. Diagnostics belong in a compact dismissible summary or an on-demand status surface, not as a full persistent card in the message work surface.
4. Safari/PWA input accessory UI is system-owned and Web content must budget around it rather than trying to duplicate or suppress it.

Evidence gaps: official platform constraints for Safari/PWA accessory UI; primary-source guidance for keyboard avoidance, touch targets, composer growth, and nonblocking error presentation.

## 3. Disconfirm First

Look first for successful conversation products that keep persistent diagnostic cards, multiple composer rows, or a keyboard-visible navigation Dock. Identify any accessibility reason that would require preserving those patterns.

## 4. Source Mix Quota

- Apple HIG/WebKit primary guidance for virtual keyboards, safe areas, focus, and input accessories.
- Official Material/Android guidance for text input and transient errors.
- Official product or open-source implementations from established conversation apps where available.
- Secondary screenshots may illustrate patterns but cannot establish platform capability claims.

## 5. Local Constraints

- React/Next PWA; no native `WKWebView` API and no UA/device sniffing.
- iPhone Chinese IME, installed standalone PWA, and Safari must remain supported.
- One chat scroll owner, one bottom-reserve owner, 16px editable text, 44px touch targets.
- Composer draft and thread state must not remount or be lost.
- Desktop behavior remains at `lg >= 1024px`.

Local anchors: `docs/features/F010-mobile-cat.md`, `feature-specs/2026-07-18-f010-mobile-experience-recovery.md`, and the three reporting-iPhone correction rounds in `project-evidence/f010-mobile-pwa/README.md`.

## 6. Output Schema

For each pattern, report supporting evidence, counterevidence, confidence, whether it is platform-required or product convention, and an exact testable contract for this codebase.

## 7. Decision Interface

Classify each finding as adopt, pilot, or reject. Map adopted findings to `ChatInput`, `ChatContainer`, `MobileStatusSheet`, `AgentHookHealthNotice`, VisualViewport handling, and 390px acceptance tests.

## 8. Risk Register

1. Confusing native-only APIs with Safari/PWA capabilities.
2. Hiding critical authorization or send-failure state while removing diagnostic chrome.
3. Fixing one iOS viewport model while regressing the simultaneous-shrink model.
4. Treating Chrome emulation as proof of iOS focus behavior.
