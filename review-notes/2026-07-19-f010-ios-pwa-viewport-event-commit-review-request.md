# Review Request: F010 installed-PWA viewport event commit

Review-Target-ID: f010

Branch: `feat/f010-mobile-pwa`

Exact implementation SHA: `87ffdd5aa52a819b5ca8025c1800f9969b459136`

## What

- Restore `visualViewport.scroll` as an event source without restoring root offset projection.
- Latch keyboard state immediately, but commit whole-shell width/height only after one 120ms quiet window.
- Preserve the last closed-height baseline across an open-keyboard orientation change until blur plus height restoration.
- Terminate mention filters at Unicode punctuation/symbols while retaining multilingual letters, numbers, marks, `_`, and `-`.
- Add event-chronology, orientation, cleanup, and Unicode Red→Green contracts.

## Why

The 23.966-second reporting-iPhone recording shows a resize-time intermediate height collapsing the fixed shell, the keyboard remaining visible while the Dock stays in layout, and the mention picker remaining open after punctuation. Clear frames prove the settled height itself is correct: the missing composing projection comes from event/detector semantics, not another reserve or root offset.

## Original Requirements

> “你读取下桌面8c99ee100752d336619be399e65e3090.mp4这个文件呢，问题依然存在，和terra和kimi一起修复下问题吧……我已经很疲惫这样反复尝试了。”

- Source: `docs/bug-report/f010-ios-pwa-viewport-event-commit/bug-report.md`
- Discussion: `feature-discussions/2026-07-18-f010-mobile-experience-recovery-meeting-notes.md#10-2026-07-19-seventh-true-device-convergence-event-source-vs-coordinate-consumer`
- Spec: `feature-specs/2026-07-18-f010-mobile-experience-recovery.md#task-9-commit-installed-pwa-keyboard-geometry-as-a-state-machine`
- Please judge the delivery against the continuous journey: zero shell-collapse commits, composing chrome stays projected, root origin stays zero, and punctuation closes the picker.

## Tradeoff

The repair keeps the current VisualViewport-owned shell instead of immediately replacing it with Kimi's proposed stable `100dvh` shell plus composer transform. Kimi's own clear-frame recheck proved the settled height is correct, so the smaller state-machine correction directly addresses the measured failure. The transform architecture remains available only if the reviewed settled-frame contract still fails on device.

The 120ms timer is one owner-level quiet window, not a scroll retry or device delay. It makes the app briefly retain the last stable geometry during keyboard animation rather than exposing arbitrary WebKit intermediate heights.

## Architecture Ownership

Architecture cell: AppShell VisualViewport projection and mobile chat composer geometry

Map delta: none

Why: `useVisualViewportCssVars` remains the sole state/geometry producer; existing CSS and PWA prompt consumers are unchanged, and no Store/Queue/Router/Adapter/Dispatcher/Binding is added.

Please verify the diff matches `Map delta: none` and no hidden second owner or offset consumer has appeared.

## Open Questions

### Technical OQ for Terra

- Does `87ffdd5` preserve the keyboard latch through resize-intermediate → scroll-only-final → stable close?
- Is the pending-width baseline correct through an open-keyboard orientation change, including cleanup and terminal restoration?
- Can any timer/rAF/listener outlive unmount or publish a raw animation height?

### Technical OQ for Kimi

- Against `frame-004.png`, `frame-008.png`, `frame-016.png`, `frame-019.png`, and `frame-022.png`, does this commit remove the two proven mechanisms without reintroducing root translation/reserve?
- Are mention punctuation/symbol boundaries correct for the recorded journey?
- Does any video evidence still require the `100dvh + transform` architecture now that clear frames prove settled height is correct?

### Value OQ

None. The implementation is reversible, changes no persistent user data or external contract, and preserves the existing editor/product model.

## Fresh-Context Findings

Agent: isolated Codex fresh-context finding generator (not an approval authority)

SHA scanned: `85e3284 + worktree diff`; fixes frozen in `87ffdd5`

Total findings: 3 (0 P1, 3 P2, 0 P3)

| # | Finding | Author disposition | Status |
| --- | --- | --- | --- |
| FC-1 | Open-keyboard orientation could poison the new-width baseline and clear composing at settle. | fixed in `87ffdd5`; orientation test Red then Green | closed |
| FC-2 | Pending settle timer/rAF and resize/scroll cleanup lacked direct proof. | fixed in `87ffdd5`; unmount-while-pending regression | closed |
| FC-3 | Symbol termination and numeric/combining-mark/underscore validity were untested. | fixed in `87ffdd5`; explicit Unicode category cases | closed |

Reviewer delta tracking: tag findings `[FC:covered]`, `[FC:new]`, or `[FC:N/A]` where applicable.

## Next Action

- Terra: complete. Message `0001784401196987-000017-cd17c0f4` continuation-approves `7086e37` with **P1=0, P2=0, P3=0**.
- Kimi: complete. Message `0001784401000653-000019-cd6cb063` approves `87ffdd5` with **P1=0, P2=0, P3=1**; the P3 is a non-blocking punctuation-in-display-name filter boundary outside the current roster and recording journey.
- Do not operate 4310/4311. The author will replace 4310 only after both P1/P2 sets are zero.

## Review Sandbox

- Path: `E:\ClowderAI\clowder-ai-f010-local-sandbox` (runtime code SHA `87ffdd5`; doc-only diff-check repair `f65aa32`)
- Start command: not required; focused tests are headless and production artifact evidence is already recorded.
- Ports: none required; do not touch Web `4310` or API `4311`.

## Self-check evidence

### Spec compliance

Quality gate: `review-notes/2026-07-19-f010-ios-pwa-viewport-event-commit-quality-gate.md` — author PASS, device acceptance pending.

### Test and runtime results

- Focused viewport/mention: **26/26**.
- Broader affected selection: **13 files / 137 tests**.
- Web TypeScript, targeted Biome, feature truth, and capability tips: pass.
- Diff-check correction: Terra found four committed trailing spaces because the author had checked only the clean worktree. `f65aa32` removes all four; `git diff --check 85e3284..f65aa32` passes.
- Production Web build: pass; BUILD_ID `davuSC0P3wlGS5zAgfHp-`.
- Reviewed runtime 4310: local and Tailscale HTTPS roots return HTTP 200 from PID `17084` with exact BUILD_ID `davuSC0P3wlGS5zAgfHp-`; Hub Browser Preview opened `/`. API 4311 remains PID `7580`.
- Full Web attempt: transparently non-terminal at 303.4s amid known unrelated mock/act families; no full-suite pass/count claimed.
- Root media status and diff scans: clean.

### Relevant documents

- Diagnosis: `docs/bug-report/f010-ios-pwa-viewport-event-commit/bug-report.md`
- Plan/spec: `feature-specs/2026-07-18-f010-mobile-experience-recovery.md` Task 9
- Team convergence: `feature-discussions/2026-07-18-f010-mobile-experience-recovery-meeting-notes.md` section 10
- Reusable lesson: `docs/public-lessons.md` LL-090

[丢丢/gpt-5.6-sol🐾]
