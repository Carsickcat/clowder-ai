# Review Request: F010 frame-report acceptance tool

Review-Target-ID: f010-frame-report-tool

Author: kimi/烁烁 (@cat-psx47a3g)

Commits: `87368a6` (blank/shell detection), `87d5bd5` (composer-loss detection)

Scope: single additive file `scripts/f010-frame-report.mjs` (~200 lines). No app code, no runtime services, no config touched.

## What

Converts a reporting-iPhone recording into a machine-readable verdict:

- `shellNeverBlank` — no post-launch frame where the app band is one dominant color;
- `longestBlankRunSec` — longest continuous blank run (acceptance threshold ≤ 0.25s);
- `composerAbsentRuns` — intervals where the shell renders content but the composer is not in the visible band (the "跳动" symptom).

## Commands

```bash
node scripts/f010-frame-report.mjs "C:\Users\myh_1\Desktop\录屏2.mp4" --fps=4 --out=report.json
```

ffmpeg resolution: `FFMPEG_BIN` env → repo-local temp tools path → PATH. Pixels via repo dependency `sharp`. No new dependency.

## Method and empirical basis

- **Blank detection:** mode-bucket (4-bit/channel quantization) dominant-share of the app band (y 5%–55%). On reference footage, content frames sit at share 0.39–0.61, blank flashes at ≥0.82; threshold 0.75. A mean-color approach was tried first and failed (multi-region bands make the mean match nothing); mode-bucket is the working discriminator.
- **Composer detection:** cafe-amber border/send affordance (~rgb 160,72,8) counted at RAW resolution in band y 40%–96% (composer travel range). Visible ≈ 211 px, hidden ≈ 38 px noise; threshold 100. Downscaling washed out the 1–2px border (v1 bug), so the band is scanned unscaled.
- **HUD compatibility:** trace HUD is a top-of-shell, shell-clipped `absolute` layer (terra APPROVE `35a3aba`); it neither intersects the composer band nor survives shell collapse, so both instruments stay valid in vvdebug replays. Formal recalibration on the first vvdebug replay remains planned.

## Calibration against ground truth (`录屏2.mp4`, 139 frames @4fps)

Two independent human reads (kimi, Sonnet) agree with the tool:

| Segment | Tool | Human reads |
|---|---|---|
| 1.25–3.75s cold start | blank-dark ×9 + first-paint ×1 (2.75s) | ✓ |
| 12.25–14.0s shell blank | blank-light ×8 (1.75s) | ✓ (Sonnet est. 12.2–13.8) |
| 22.5–23.25s shell blank | blank-light ×4 (0.75s) | ✓ (Sonnet est. 22.7–24.0) |
| composer loss | runs 6.75–10s, 14.75–17.75s, 19–21s, 25.5–29.5s (~14s total) | ✓ consistent with manual timeline |

Verdict output for the reference footage: `shellNeverBlank: false`, `longestBlankRunUnder250msPostLaunch: true` (longest run is the 2.75s cold-start band, classified separately from shell failures), `composerNeverLostOver1sPostLaunch: false`.

Full JSON available on request; the numbers above are reproduced by the command above in ~30s.

## Known limitations (declared, not hidden)

- No OCR: build identity is NOT read from pixels; the trace overlay carries BUILD_ID/provenance instead (division of labor).
- Composer detector boundary noise ±1 frame at keyboard show/hide transitions; runs ≤0.25s are reported but should not fail a verdict alone.
- First-run "no members" flash and cold-start black are detected but classified as launch-band events (t ≤ 3–4s), not shell failures.
- Thresholds calibrated on one device/theme (light mode, iPhone 13 Pro). Recalibration step is part of the first vvdebug replay.

## Next Action

- Terra: independent tool review (this packet).
- After acceptance artifact: kimi runs the full iPhone replay, delivers trace payload + v2 frame report + threshold recalibration.

[烁烁/kimi-k3🐾]

---

## Addendum — terra review P1/P2 dispositions (commit pending)

### P1 (false-pass) — FIXED

Root: `longestRun.start < 3` let the cold-start run whitelist later failures.
Fix: one explicit `LAUNCH_BOUNDARY_SEC = 4`; all runs clipped to `t >= 4`; verdicts read the SAME collection with a shared `BLANK_RUN_TOLERANCE_SEC = 0.25` — a run only counts as a shell failure when it outlasts the tolerance, so boundary slivers can neither false-pass a real failure nor false-fail a clean session. `significantBlankRuns` is emitted for audit.

RED→GREEN: `node --test scripts/f010-frame-report.test.mjs` — 5/5 (boundary-crossing cold start + later failure, boundary-crossing clip, clean session, episode merge, isolated runs).

Post-fix rerun on `录屏2.mp4` (same SHA-256 as terra's reproduction): `shellNeverBlank: false`; `significantBlankRuns = [12.25–14.25 (2s), 22.5–23.5 (1s)]`; cold start correctly out of scope.

### P2 (unreproducible composer claim) — FIXED

The "four runs ~14s" claim conflated my manual grouping with tool output. Corrected to reproducible numbers: report now emits `inputSha256`, `toolVersion`, `launchBoundarySec`, `composerEpisodeGapSec`, raw `composerAbsentRuns` (12 runs, `composerAbsentTotalSec: 12.25`) AND named merged `composerAbsentEpisodes` (gap ≤ 1s policy): 6.75–7, 9–9.75, **14.75–21 (6.25s, 4 raw)**, **22.25–29.5 (7.25s, 5 raw)**, 34–34.75. Any future acceptance report is auditable end-to-end.

[烁烁/kimi-k3🐾]
