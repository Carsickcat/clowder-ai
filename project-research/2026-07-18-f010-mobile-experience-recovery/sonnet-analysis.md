# F010 mobile experience recovery — Sonnet independent analysis

Date: 2026-07-18
Role: lead synthesis input for the multi-cat convergence round
Status: evidence-backed independent proposal; canonical F010 docs should be updated only after convergence

## Executive decision

The screenshots do not show an iPhone 13 Pro resolution mismatch. All four files are exactly 1170 x 2532 pixels, the device's 3x portrait raster. The product is failing because its CSS coordinate systems and task hierarchy are inconsistent.

Build provenance correction: the active Web build was produced at 23:21 and started at 23:23, while commit `72b995f` was created at 23:30. The screenshots around 23:53 therefore show the pre-patch bundle. They are valid evidence for the broader mobile-shell and information-hierarchy failures, but they do not prove that `72b995f` failed. That commit remains unaccepted until it is rebuilt, restarted and exercised on the same iPhone.

The recovery should not be another keyboard offset patch. It should establish one mobile workspace contract:

1. one visual-viewport frame owns the app shell;
2. one message canvas owns vertical scrolling;
3. keyboard-open is a composition mode, not a smaller copy of the browsing mode;
4. global navigation disappears while composing and the composer occupies its bottom slot;
5. transient infrastructure state is compressed into a small status affordance;
6. an unacknowledged POST is reconciled before it is called a failure.

## What the four screenshots prove

| Evidence | Observation | Root cause | User effect |
| --- | --- | --- | --- |
| P1/P2, keyboard open | Composer sits far above the keyboard with a large empty band | The fixed mobile nav is moved above the keyboard while `ChatContainer` still reserves its 4rem slot; the shell also mixes visual height, layout origin and a separate keyboard inset | Most of the already-small visual viewport becomes unusable |
| P1/P2, input focused | Content scale and horizontal position appear unstable | The composer textarea is `text-sm` (14 CSS px), and the root lacks a complete mobile text/scroll contract; focus and viewport changes expose nested scroll owners | Focus feels like an accidental zoom and dragging can move the wrong layer |
| P1/P2, mention popup | Desktop-style 256px popup occupies the top of the remaining viewport | Mention completion is absolutely positioned above the composer without a keyboard-mode height budget | The user cannot see the message context they are replying to |
| P3 | `Failed to send message: Load failed` is displayed while the message and Terra invocation are visible | The client classifies every fetch exception as a definitive failure, even when the server committed the message but the acknowledgement was lost | Contradictory state and loss of trust |
| P4 | Large update error plus three stacked connection cards | A swallowed update-check exception becomes a persistent fixed banner; one degraded Socket expands three health dimensions into cards | Infrastructure dominates the task surface |
| P4 | Top status, execution rail, composer and bottom nav all remain resident | Several components independently claim permanent vertical space | The message canvas becomes a narrow strip |

## Local code and runtime findings

### 1. Viewport ownership is split

- `globals.css` sets `.app-viewport` to `visualViewport.height + offsetTop`.
- `useVisualViewportCssVars.ts` separately publishes a keyboard inset.
- `MobileOpsShell.tsx` applies that inset to the fixed bottom navigation.
- `ChatContainer.tsx` always reserves `4rem + safe-area-inset-bottom` for that navigation.
- `AppShell.tsx` owns an outer `overflow-y-auto` while `ChatContainer.tsx` owns another `overflow-y-auto` message surface.

The `height + offsetTop` patch preserves a bottom-edge arithmetic invariant, but it does not create one coordinate frame. It also leaves two independent consumers compensating for the keyboard. Because the supplied screenshots predate the patch, this is an architectural concern to test in the replacement spike, not a claim that the patch caused the photographed behavior.

### 2. The composer invites focus-scale instability

`ChatInput.tsx` renders both the textarea and ghost text with `text-sm`, which resolves to 14 CSS px. The mobile contract should use at least 16 CSS px for editable fields, while preserving user pinch zoom. Disabling zoom is explicitly rejected.

### 3. The update error is over-promoted and under-diagnosed

`PwaUpdateController.tsx` catches `getRegistration()` and `registration.update()` failures without preserving their reason, then renders a large fixed banner until manual retry. At the time of this audit, the public `sw.js`, `manifest.json`, `/api/health`, and Socket.IO polling endpoint all return HTTP 200. Therefore the screenshot is evidence of a transient check failure, not evidence that the current page is unusable.

The correct user-visible event is `update-ready` (a waiting worker exists), not `update-check failed`.

### 4. The send error is a false negative

The persisted default-thread history contains:

- user message `@opus 晚上好` at id `0001784303548157-000000-d2e369e7`;
- Terra's reply immediately afterward.

The client nevertheless appended `Failed to send message: Load failed`. `useSendMessage.ts` already sends a UUID idempotency key, and the invocation store deduplicates it, but the immediate message append omits the message idempotency key and the duplicate response does not include the original `userMessageId`. The protocol has most of the mechanism but not a complete acknowledgement/reconciliation contract.

### 5. Roster visibility is not dispatch readiness

The acceptance `/api/cats` response displays five cats, including `cat-komzvl9r` (Kimi K3). The persisted `@烁烁 晚上好` has no reply, and the runtime previously logged `Unknown cat ID: cat-komzvl9r`. Copying the catalog made the cat visible but did not prove the execution registry could route it.

The roster contract must distinguish `visible` from `dispatchReady`. Auto-configuration is complete only when a preflight proves catalog, account/client, adapter and execution service agree on the same cat ID.

## Target mobile workspace model

### A. One visual viewport frame

The app root maps the complete `VisualViewport` rectangle, not a derived height:

- `top = offsetTop`
- `left = offsetLeft`
- `width = width`
- `height = height`

The shell is fixed/contained inside that rectangle. VisualViewport writes are coalesced with `requestAnimationFrame`. Layout viewport units remain fallbacks only when the API is unavailable.

The document and outer shell do not scroll horizontally or vertically. Only explicitly designated content surfaces scroll.

### B. One message scroll owner

`AppShell` becomes `min-height: 0; overflow: hidden`. The message list is the only vertical scroll owner in chat. Code blocks, tables, CLI output and galleries may own local horizontal scrolling, but they must not widen the root.

### C. Two mobile modes

#### Browsing mode (keyboard closed)

- compact conversation header;
- message canvas takes all remaining height;
- composer is one compact row;
- four-tab navigation occupies the bottom safe area.

#### Composition mode (keyboard open)

- global bottom navigation is hidden, following the native pattern of replacing navigation with the focused input surface;
- composer sits directly on the visual viewport bottom;
- the message canvas resizes above it and preserves the anchored message;
- header reduces to one line if the remaining height is constrained;
- mention completion uses a bounded sheet/list inside the visual viewport, never an unconstrained desktop popup.

No hard-coded iPhone model or 1170 x 2532 layout is introduced. The acceptance unit is the 390 x 844 CSS-pixel viewport plus dynamic safe areas and keyboard state.

## Chrome budget and information hierarchy

The chat task gets first claim on vertical space.

| State | Persistent surface | Presentation |
| --- | --- | --- |
| Healthy | none | No connection UI |
| Socket reconnecting, API usable | one compact chip/rail | `实时连接恢复中` with tap for details; REST reconciliation continues |
| Offline/read-only | compact blocking rail | Explain what remains readable and how sending is disabled |
| Update check failed | none | Retry silently with bounded backoff; log diagnostic reason |
| Update ready | one compact action toast/rail | `新版本已就绪 · 更新` after preserving drafts |
| Cat running | one execution rail | Merge duplicate “replying/running/queue” banners into one owner |
| Action required | contextual sheet/card | Only when the user can actually resolve it |

The three connection dimensions remain available in a details sheet or settings diagnostics; they do not stack as three cards in the timeline.

## Reliable message-delivery contract

1. Create one client UUID before optimistic insertion.
2. Persist it on both InvocationRecord and the user Message for all delivery modes.
3. On duplicate POST, return `status`, `invocationId`, and the existing `userMessageId`.
4. If fetch throws after submission, move the bubble to `confirming`, then reconcile using the same key or a receipt endpoint.
5. If found, replace the optimistic ID and continue normally.
6. If not found after a bounded retry, show a retry affordance on the user's bubble; never inject a contradictory red system message into the conversation.

This produces at-least-once transport with exactly-once user-visible acknowledgement under the existing idempotency boundary.

## Roster readiness contract

The cat auto-configuration pipeline should produce one readiness result per cat:

```text
catalog entry
  -> account/client resolves
  -> adapter executable is available
  -> execution service registers the same CatId
  -> dry preflight succeeds
  -> dispatchReady=true
```

The UI may display a non-ready cat in management surfaces, but mention/autocomplete must disable it with a concrete reason. The acceptance environment must never advertise a cat as callable merely because its catalog YAML was copied.

## Implementation waves

### Wave 0 — observability and red tests

- Make build commit, build time and runtime BUILD_ID visible in the diagnostics surface, then rebuild/restart the current head before comparing device behavior.
- Add a viewport debug snapshot gated to the acceptance build: inner size, visual rectangle, scale, keyboard state, composer rect and nav rect.
- Add regression tests for a 390 x 844 viewport with representative iPhone keyboard rectangles.
- Add a test proving an acknowledged durable message never produces a send-failure system bubble.
- Add a test proving update-check rejection is non-blocking and diagnostic-only.
- Add a readiness test proving catalog-only cats are not callable.

### Wave 1 — viewport and composer

- Replace the arithmetic shell height with an exact visual-viewport frame.
- Lock root/outer scrolling; retain one message scroll owner.
- Raise editable text to 16 CSS px and keep zoom accessible.
- Hide bottom navigation during composition and remove its reserved padding in the same state.
- Bound mention/path menus to the current visual viewport.

### Wave 2 — task-surface compression

- Replace the three-card mobile connection status with one compact chip plus details sheet.
- Remove persistent UI for update-check errors; surface only a real waiting update.
- Consolidate invocation, queue and reply indicators into one execution rail.
- Reduce the mobile header to its essential identity/action line.

### Wave 3 — transport and roster correctness

- Complete idempotent message acknowledgement and ambiguous-send reconciliation.
- Add Socket-loss REST catch-up while an invocation is active.
- Introduce `dispatchReady` preflight and disable unavailable cats in mention surfaces.

### Wave 4 — real-device acceptance

Run the following on the operator's installed iPhone PWA and Safari, then Android Chrome/PWA:

1. open/close keyboard ten times without accumulating offset;
2. type Chinese, English and `@` mention text without focus zoom;
3. drag the message list, code blocks and popup surfaces without moving the root page;
4. rotate portrait/landscape and return;
5. background/foreground with the keyboard both open and closed;
6. send while Socket is disconnected but API remains reachable;
7. lose the POST response after server commit and verify silent reconciliation;
8. install a waiting service worker while a draft exists;
9. invoke every displayed cat and verify either a reply or an explicit unavailable state;
10. record screenshots at 390 x 844, 430 x 932, 768 x 1024 and desktop regression widths.

Completion requires the real-device journey, not only component tests or desktop emulation.

## Rejected alternatives

- `maximum-scale=1` / `user-scalable=no`: harms accessibility and does not repair the coordinate model.
- Hard-code iPhone 13 Pro dimensions: treats a raster as a layout contract and breaks Display Zoom, orientation and other devices.
- Add another keyboard inset or UA sniff: repeats the failed patch pattern.
- Keep the bottom nav above the keyboard: duplicates the composer role and wastes the most constrained state.
- Show every infrastructure exception as a banner: converts diagnostics into task interruption.
- Switch to Capacitor/native now: wraps the same broken layout without removing its root causes.

## Primary references

- WebKit added VisualViewport specifically to account for zoom and the onscreen keyboard: https://webkit.org/blog/9674/new-webkit-features-in-safari-13/
- MDN VisualViewport model: https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
- Chrome's viewport/OSK behavior comparison, including why fixed elements and viewport units diverge: https://developer.chrome.com/blog/viewport-resize-behavior
- Apple HIG shows a focused bottom search field replacing/hiding the tab bar while the keyboard is present: https://developer.apple.com/design/human-interface-guidelines/search-fields
- Apple HIG recommends adaptable layouts, dynamic safe areas and 44 x 44 pt default controls: https://developer.apple.com/design/human-interface-guidelines/layout and https://developer.apple.com/design/human-interface-guidelines/accessibility
- Chrome/Workbox recommends prompting on an actually waiting update; not every update check needs an interruptive prompt: https://developer.chrome.com/docs/workbox/handling-service-worker-updates
- WebKit preserves user zoom even when pages try to disable it: https://webkit.org/blog/7367/new-interaction-behaviors-in-ios-10/

## Confidence

- High: build-version mismatch, duplicated bottom-space ownership, nested scroll owners, 14px editable control, persistent update-error promotion, false-negative send, and roster-readiness mismatch are directly evidenced by code/runtime data.
- Medium-high: the exact visual-viewport frame plus keyboard-mode transition is the correct replacement architecture; it still requires a real-device implementation spike because Safari event ordering varies across versions.
- Open: the exact original `registration.update()` exception cannot be recovered because current code discards it. The fix must preserve diagnostics before attempting to label the specific browser failure.

[宪宪/gpt-5.6-sol🐾]
