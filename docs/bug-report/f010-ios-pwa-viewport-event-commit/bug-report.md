# F010 iOS installed-PWA viewport event commit failure

**Status:** code Green — independent review and reporting-iPhone replay pending  
**Reporter:** co-creator, reporting iPhone installed PWA  
**Date:** 2026-07-19  
**Feature:** F010  
**Thread:** `thread_mrogfco44bos1sgn`

## Bug diagnosis capsule

| Field | Evidence |
| --- | --- |
| **1. Symptom** | On composer focus, the entire chat shell collapses into blank space; the composer and Dock later reappear high above the keyboard, the Dock remains present during typing, and the mention picker remains open after `@opus，...`. Expected: the fixed shell stays at origin, only settled geometry is committed, composing chrome owns the visible bottom, and punctuation ends the mention token. |
| **2. Evidence** | Source video: `C:\Users\myh_1\Desktop\8c99ee100752d336619be399e65e3090.mp4`, 23.966s, 592×1280. Shared decoded evidence: `%TEMP%\f010-video-8c99ee100752d336619be399e65e3090\contact.png`; `frame-004.png` (~1.5s blank shell), `frame-008.png` (~3.5s suspended composer/Dock), `frame-016.png` (~7.5s keyboard open with Dock), `frame-019.png` and `frame-022.png` (punctuation-completed mention still open). |
| **3. Root cause** | `e27ee2d` correctly stopped projecting `visualViewport.offsetTop/offsetLeft` into the fixed AppShell, but it also removed the `visualViewport.scroll` subscription. That conflated an event source with a coordinate consumer and misses a terminal scroll-only state/geometry re-read. The hook also writes every animation-time `height` directly into `--app-viewport-height`, so an installed-PWA intermediate frame can collapse the entire shell. Keyboard detection subtracts `offsetTop` from baseline shrink, so a focused pan can erase the open signal even when the settled height itself is correct. Independently, `detectMenuTrigger` treats only whitespace as a mention terminator. |
| **4. Diagnostic strategy** | Reverse-trace `visualViewport` event → hook frame → root CSS variables/dataset → AppShell/Dock consumers. Freeze the real event chronology as tests: resize intermediate frame, scroll-only final frame, stable close, fixed origin, Dock/secondary chrome projection, punctuation-completed mention. |
| **5. Timeout strategy** | If the event-sequence Red does not reproduce the source defect, add an internal event ledger for `event type / innerHeight / vv.height / vv.offsetTop / keyboard state`; do not ask the operator for another diagnostic-only round and do not patch consumers. |
| **6. Warning strategy** | Direction is wrong if it reintroduces root `top/left`, adds a device reserve, uses `scrollIntoView`, hides only the Dock without fixing state, or commits arbitrary raw heights. Three-plus failed repairs already require a state-machine/spec correction before another patch. |
| **7. User-visible correction** | Composer focus no longer produces blank frames or a permanent blank band; Dock and secondary chrome leave layout for the entire keyboard journey; the mention picker closes at Chinese/ASCII punctuation without changing the draft. |
| **8. Acceptance** | New hook tests prove scroll-only delivery, provisional resize geometry, open-state latch and stable close; mention tests prove `，`/`,`/symbols close while Chinese and hyphenated handles remain valid. Focused/broad Web tests, TypeScript, Biome, build, isolated 4310 runtime journey, and independent Terra/Kimi review must pass. Reporting-iPhone replay remains release truth, not another diagnosis round. |

## Runtime preflight

- `PORT=4310`
- `PID=45656`
- `START_TIME=2026-07-19T00:28:01.8184854+08:00`
- `HEAD=85e3284c5eedad183b811cc51561186ca1edb383`
- `TARGET_COMMIT=ffafb56cda54912dacfea89232a1c1c5562839ad`
- `PROCESS_AFTER_TARGET=yes`
- `LOG_EVIDENCE=none_persisted_for_web_pid_45656`; stronger served-artifact proof: HTTP 200 and HTML contains BUILD_ID `2JhXmOBICvwybpU-Kig8T`

The video file timestamp is after the target build. An old bundle is not an admissible explanation for this recording.

## Team convergence

### Common ground

- Keep AppShell `top/left` at zero; `offsetTop` is a state signal, not a translation.
- Restore `visualViewport.scroll` as an input event and cover the scroll-only installed-PWA path.
- Stop committing animation-time geometry directly to the whole fixed shell.
- Treat the mention punctuation defect as a separate P2 with its own Red contract.

### Preserved disagreement and decision

Kimi proposed immediately replacing viewport-sized AppShell geometry with a stable `100dvh` shell plus compositor-transformed composer and a debug HUD. Terra argued that the video proves missing event synchronization but does not yet prove the final `visualViewport.height` itself is invalid. The chosen first repair stays inside the existing single owner and changes its commit semantics: keyboard state reacts to focused shrink/pan, geometry commits only after the event stream settles, and scroll-only terminal frames are observed. A transform architecture remains rejected unless the settled-frame contract still fails with measured terminal geometry.

## Fix plan

1. Add Red tests for resize-intermediate → scroll-only-final → stable-close chronology.
2. Split immediate keyboard-state latching from settled geometry commit in `useVisualViewportCssVars`.
3. Restore `visualViewport.scroll` listener and cleanup without restoring root translation.
4. End mention detection on Unicode punctuation/symbol boundaries while retaining letters, numbers, combining marks, `_`, and `-`.
5. Sweep every `--app-viewport-height` / `data-mobile-keyboard-open` consumer and run current F010 regression/build gates.

## Red → Green and verification

- RED: the focused viewport/mention run failed 4 assertions while the old hook ignored scroll-only delivery, exposed the `112px` animation frame, and kept short punctuation-completed mention tokens active.
- GREEN: the same two files pass **26/26**. The hook contract covers immediate open latch, provisional geometry, scroll-only terminal commit, fixed root origin, blur-time latch, stable close, open-keyboard orientation, and cleanup-owned event sources. Mention contracts cover punctuation/symbol termination plus Chinese, hyphenated, numeric, combining-mark, and underscore handles.
- Broader affected selection: **13 files / 137 tests passed**, covering viewport projection, composer/drafts/mentions, mobile shell/status/toolbar, AppShell navigation, PWA install/update projection, and Markdown ownership.
- Web TypeScript, targeted Biome, feature truth, capability tips, `git diff --check`, and the production Web build pass.
- Production artifact after the fresh-context repairs: BUILD_ID `davuSC0P3wlGS5zAgfHp-`. Temporary runtime verification is recorded in the quality gate. Existing Web `4310` still serves BUILD_ID `2JhXmOBICvwybpU-Kig8T`; API `4311` was untouched.
- Full Web Vitest was attempted transparently but did not terminate within 303.4 seconds and was stopped by the command timeout amid the repository's known unrelated mock/act failures. No full-suite pass or count is claimed; the bounded affected gate above completed cleanly.
- Consumer audit: `useVisualViewportCssVars` remains the only CSS-variable/data-state producer. `.app-viewport`, `.mobile-visual-viewport`, `.mobile-visual-bottom`, mobile Dock/secondary chrome, and `PwaInstallPrompt` consume the same projection; no second geometry owner was introduced.
- Fresh-context scan found three P2s: an orientation-time baseline poisoning edge, missing pending-timer/listener cleanup proof, and incomplete Unicode category coverage. The orientation test failed before the baseline repair; all three are now covered and Green.

## Convergence check

1. Rejected option → ADR? **No.** The transform-shell alternative is a local F010 hypothesis, recorded here; it has not become a cross-feature architecture rule.
2. New lesson → public lessons? **Yes.** LL-090 records that removing a coordinate consumer does not authorize removing the event source; event chronology belongs in the harness.
3. New operating rule → global guide? **No.** The state-machine edge and test belong to F010 source/spec.

[丢丢/gpt-5.6-sol🐾]
