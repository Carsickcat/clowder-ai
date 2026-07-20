# F010 provider-failure truth — quality gate

Date: 2026-07-20
Author: 丢丢 / `gpt-5.6-sol`
Branch: `feat/f010-mobile-pwa`
Base HEAD audited: `72af6a63aa57be433f0040efb0a5326d5f378fa7`

## Vision and scope

The operator reported an app that appeared paralyzed by repeated timeouts and silent Kimi failures. The runtime audit separated three states:

1. the public Web/API/Socket path is currently reachable;
2. the historical one-hour deadlock and Socket origin regressions were already repaired in the live acceptance runtime;
3. Kimi currently exits on an external provider quota 403, but the API classified fragmented non-JSON diagnostics as unknown and falsely marked an error-only parent invocation `succeeded`.

This change repairs the third state across every parent `routeExecution` consumer. It does not switch Kimi's provider/model, relax CORS, or claim to manufacture provider quota.

## RED → GREEN evidence

- RED: fragmented Kimi quota output classified as unknown; direct, queued, and retry error-only executions ended `succeeded`.
- GREEN: shared parent outcome tracker applied to direct messages, retries, queue processing, connector dispatch, A2A callback, multi-mention callback, and podcast generation.
- Affected route/orchestrator suites: **228/228 pass** across 21 suites.
- Complete `cli-spawn.test.js`: **75/75 runnable pass**, 4 expected Windows skips; the new fragmented-quota/privacy regression passes.

## Fresh-context findings resolved

The pre-review scan produced four P2 findings and no P1/P3. All four were reproduced with RED tests before implementation:

1. multi-mention known provider failures waited for timeout and were mislabeled; failed responses are now first-class aggregate results in direct, queued, and thrown-dispatch paths;
2. connector provider failures emitted a duplicate generic error attributed to the default cat; the original target-attributed provider event is now the single Socket error;
3. retry cancellation lost precedence when a buffered provider error arrived during shutdown; aggregate cancellation is now resolved first;
4. a synthetic-only sibling `done` hid another cat's provider failure; only substantive text/tool output counts as successful sibling output.

## Formal review round 1

Terra returned one P1 (`[FC:new]`): the direct multi-mention catch path wrote the
InvocationRecord as `canceled` but then unconditionally recorded and flushed an aggregate
failure when the provider/router threw during cancellation.

- RED: the new route-level regression observed `status: done` and a flushed aggregate after
  the target controller was aborted.
- GREEN: an aborted catch now returns after the best-effort canceled record update; `finally`
  still releases the tracker slot, while the target remains absent for the existing
  timeout/resume policy.
- Focused route suite: **21/21 pass**.
- Failure-mode sweep: all new/modified cancellation-versus-failure convergence points were
  scanned. Retry, messages, A2A, queue post-loop, and the normal multi-mention path already
  resolve cancellation first; this catch was the only missing branch in the current delta.

## Fresh verification ledger

| Check | Result |
| --- | --- |
| `pnpm lint` | PASS (existing Web warnings only) |
| `pnpm -r --if-present run build` | PASS, all five workspace packages |
| Targeted Biome, 21 changed source/test files | PASS |
| `pnpm check:features` | PASS |
| `pnpm check:capability-tips` | PASS; existing F010 `tips_exempt` applies because this restores failure truth rather than adding a discoverable action |
| `git diff --check` | PASS |
| `pnpm check` | BASELINE/PLATFORM RED before semantic checks: 3,781 repository-wide CRLF formatter differences, including untouched root files |
| `pnpm test` | PLATFORM RED in the API package wrapper: Windows `cmd` cannot execute the Unix-style inline `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1` assignment |
| Direct full API test command | INCONCLUSIVE at the 10-minute harness limit: no assertion summary; hook/preview/start-dev child tests remained active. The exact test tree was stopped, its untracked `.claude/` artifact removed, and isolated Redis `4879` stopped with `SAVE`. Product Redis and live services were untouched. |

The review-delta recheck also confirmed that `check:architecture-ownership`,
`scripts/check-hotfix-pattern.mjs`, and `scripts/check-fallback-layers.mjs` do not exist in this
snapshot. Manual diff inspection found one new cancellation guard and no fallback-layer growth;
architecture ownership remains the existing `dispatch` cell with `Map delta: none`.

The repository-wide reds are not hidden or relabeled green. The affected functional surface, full CLI-spawn suite, TypeScript lint, and builds are green.

## Live read-only preflight

- Public root and `/api/health`: HTTP 200.
- Phone origin Socket.IO handshake: HTTP 200.
- Desktop `http://localhost:4310` Socket.IO handshake: HTTP 200.
- Hostile origin handshake: HTTP 403.
- Five-cat roster is present; stable `@opus`, `@sonnet`, `@opus-45`, and Kimi aliases are present.
- Live Web remains PID `37656`, build `n3DpKBgj77uXohgXH0FVl`; live API remains PID `15812` until formal review.

## Failure-mode audit

- Arbitrary malformed stdout is classification-only and never an automatically trusted public excerpt.
- A successful sibling keeps a mixed multi-cat parent successful, preventing whole-batch retries from duplicating delivered replies.
- Cancellation, persistence failure, and governance failure keep their existing precedence.
- No UI/design file changed; no `.pen` comparison is applicable.
- No production or acceptance Redis data was deleted, flushed, or rewritten.

## Gate status

**Review candidate only.** The affected behavior is green, but live deployment remains gated on independent cross-individual review and an end-to-end post-deploy re-smoke.

[丢丢/gpt-5.6-sol🐾]
