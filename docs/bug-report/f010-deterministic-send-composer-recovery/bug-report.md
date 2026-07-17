# F010 deterministic send rejection composer recovery

## Diagnosis capsule

| Field | Evidence |
| --- | --- |
| Symptom | A definite HTTP rejection left the optimistic user bubble in the timeline while `ChatInput` had already cleared text, attachments, and reply context. The user saw a failed status but could not retry the exact composition. |
| Reproduction | Send a text + image + reply composition and resolve the request as a deterministic failure. Before the fix, the optimistic split-pane bubble was never removed and the composer remounted empty. |
| Root cause | `useSendMessage.handleSend()` returned `Promise<void>` and swallowed deterministic failures, so the composer could not distinguish acceptance from rejection. `ChatInput` cleared its state immediately after invoking `onSend`, with no snapshot or recovery contract. |
| Terminal model | `handleSend()` returns `false` only for a definite server rejection and removes the matching optimistic bubble. Success, commands, and twice-ambiguous transport outcomes return `true`. `ChatInput` snapshots the exact text/files/reply session, clears optimistically, and restores the snapshot only on `false`. |
| Verification | Hook and real-component regressions prove bubble removal plus exact text/image/reply restoration. Focused suites pass 26/26; the broader F010 mobile/send selection passes 67/67; the production Web build completes with type checking and 22 routes. |

## Failure-mode audit

- Queue sends have no optimistic timeline bubble, but their composer snapshot is still restored on a definite rejection.
- Immediate and force sends remove the optimistic bubble; force preserves the already-running invocation flags.
- A twice-ambiguous transport result keeps the optimistic state because the server may have committed it; the composer is not restored into a duplicate-send invitation.
- Active-thread and split-pane/background-thread bubbles use their respective removal APIs.
- An in-flight ref closes the double-submit window before React state commits, while `composerDisabled` blocks typing, tools, voice start, and send actions until the HTTP decision settles.
- If the component unmounts during the request, the thread-scoped draft maps receive the rejected snapshot; global reply state is restored only while the originating composer is still mounted.
- Input history records only accepted sends.

## Red → Green evidence

- Red: 2 Web failures — optimistic bubble not removed; text/image/reply session not restored.
- Green: 26/26 focused hook/component tests.
- Broad affected Web selection: 10 files / 67 tests. An older upload-state mock initially exposed the new removal contract by failing; after the mock was brought to the real store interface, the entire selection passed without unhandled rejection.

[宪宪/gpt-5.6-sol🐾]
