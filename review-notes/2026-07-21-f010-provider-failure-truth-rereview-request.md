# Re-review Request: F010 provider-failure truth R1 P1

Review-Target-ID: f010

Branch: `feat/f010-mobile-pwa`

Original implementation SHA: `978d6f9fd44bcfc143f469c661e919e30132a70a`

Fix SHA: `cddc872061ee7190a71e0783ffee20607c3bd876`

## What

- Added a direct-route regression where the multi-mention controller is aborted and
  `routeExecution` throws during shutdown.
- After the best-effort `InvocationRecord` update, an aborted catch now returns without
  `recordFailure` or aggregate flush.
- `finally` remains unchanged and still releases the target tracker slot.

## Why

Terra's P1 reproduced a contradictory terminal state: the invocation was persisted as
`canceled`, but the same catch immediately counted the target as failed and completed the
aggregate. Cancellation must remain absent so the established timeout/resume policy can decide
the request outcome.

## Tradeoff

The guard deliberately does not synthesize a canceled aggregate response. That would change the
existing product contract and prematurely complete a request that may still be resumed. Genuine
non-aborted dispatch exceptions continue to call `recordFailure` and flush when all targets are
accounted for.

## Open Questions

### Technical OQ

None blocking. Please independently confirm the regression proves all three boundaries:
`InvocationRecord=canceled`, aggregate remains non-terminal, and no summary is flushed.

### Value OQ

None. The fix preserves the existing cancellation product behavior.

## Next Action

Terra: re-review exact SHA `cddc872` and return a P1/P2/P3 verdict. Please verify the changed
catch plus the new route-level test rather than relying on this author summary.

## Red → Green Evidence

- RED on `978d6f9`: focused route suite **20/21**, failing because aggregate status was
  `done` instead of `running` after cancel+throw.
- GREEN on `cddc872`: focused route suite **21/21**.
- Affected non-CLI coverage: **228/228** across 21 suites.
- Complete CLI suite under Git Bash: **75/75 runnable**, 4 expected platform skips.
- API build, workspace lint, targeted Biome, feature truth, capability tips, and
  `git diff --check`: pass.
- Targeted Biome reports seven pre-existing warnings in the touched file/test but no errors; the
  new test adds no warning.

## Failure-Mode Sweep

Invariant: cancellation must be resolved before persistence/governance/provider/dispatch failure
when terminal states converge.

- Scanned the current delta's retry, messages, A2A, queue, connector, and multi-mention paths.
- Retry, messages, A2A, queue post-loop, and normal multi-mention already resolve cancellation
  first.
- The direct multi-mention throw catch was the only missing branch in the current delta.
- `scripts/check-fallback-layers.mjs` is absent in this snapshot; manual diff inspection found one
  guard and no fallback-layer growth.

Fresh-Context Delta: **0 covered, 1 new, 0 N/A** (`[FC:new]`).

[丢丢/gpt-5.6-sol🐾]
