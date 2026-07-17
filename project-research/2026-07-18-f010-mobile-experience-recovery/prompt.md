# Research Brief: F010 iPhone chat workspace recovery

## 1. Problem Frame

We need to recover the mobile PWA from four related failures observed on an iPhone 13 Pro: focus zoom / unstable scrolling, a composer that consumes the wrong part of the visual viewport, persistent non-actionable status chrome, and ambiguous message delivery failures.

Non-goals:

- building a native shell or a second mobile product;
- fixing the layout to one device's physical pixel dimensions;
- hiding browser zoom through accessibility-hostile viewport limits;
- adding a second message store or an offline chat queue.

This research is required because the real-device screenshots exposed broader mobile-shell failures. Build provenance later proved that those screenshots used the 23:21 bundle, while the keyboard patch was committed at 23:30, so they cannot be used to approve or reject that patch itself. The current patch still lacks real-device acceptance.

## 2. Current Hypotheses

1. The app mixes layout-viewport, visual-viewport, and fixed-element coordinates instead of mapping the shell to one visual viewport frame.
2. The mobile navigation and chat composer both reserve keyboard-adjacent space, producing the large blank region.
3. A 14 CSS px textarea contributes to focus-scale instability on iOS.
4. Update-check and socket health are being promoted above the message task even when no user action is required.
5. `Failed to send message: Load failed` is an ambiguous acknowledgement loss, not a confirmed send failure.

Evidence gaps:

- exact Safari event ordering on every supported iOS version;
- the original exception swallowed by `PwaUpdateController`;
- full real-device recordings after the replacement layout contract.

## 3. Disconfirm First

- Verify whether the screenshots match the actual iPhone 13 Pro raster before assuming a device-resolution mismatch.
- Verify the screenshot bundle timestamp against the tested commit before attributing behavior to the latest patch.
- Verify public `sw.js`, manifest, health and Socket.IO endpoints before calling the backend offline.
- Verify whether the allegedly failed message exists in the durable API history.
- Preserve pinch zoom and safe areas unless primary platform guidance proves they are the cause.

## 4. Source Mix

- local screenshots and production-runtime probes;
- local source code and persisted message history;
- WebKit / Apple HIG primary guidance;
- MDN and Chrome platform documentation for viewport and service-worker behavior.

## 5. Local Constraints

- one Next.js product and one durable thread/message truth;
- isolated acceptance data only;
- no runtime config mutation;
- real iPhone acceptance is mandatory; desktop emulation is not completion evidence;
- the mobile message canvas is the primary work surface.

## 6. Output Schema

- screenshot-to-root-cause matrix;
- proposed viewport and interaction state model;
- error/status presentation policy;
- implementation waves with TDD and device acceptance;
- risks, rejected alternatives, and evidence links.

## 7. Decision Interface

- Adopt: single visual-viewport frame, single scroll owner, keyboard composition mode, status compression, ambiguous-send reconciliation.
- Pilot: exact header collapse animation and mention-surface presentation.
- Reject: device-specific fixed resolution, disabled zoom, permanent update-error banner, stacked health cards in chat.

## 8. Risk Register

1. VisualViewport event churn can cause layout jank -> coalesce writes per animation frame and test focus, scroll, rotation and background/foreground transitions.
2. Hiding global navigation during composition can reduce orientation -> keep the current section identity in the compact header and restore the tab bar immediately on keyboard close.
3. Retrying ambiguous sends can duplicate work -> reuse the existing idempotency key and return the existing user message ID on duplicate acknowledgement.
