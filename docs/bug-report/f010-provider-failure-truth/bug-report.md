# F010 provider failure truth and fragmented CLI diagnostics

## Diagnosis capsule

| Field | Evidence |
| --- | --- |
| Symptom | The public app could show a generic Kimi CLI exit while the parent `InvocationRecord` was marked `succeeded`. The operator saw repeated timeouts and no usable Kimi reply. |
| Reproduction | A real `@Kimi` message on the live acceptance API routed to Kimi, emitted an error and `done`, persisted no assistant reply, yet left parent invocation `6e6b0f57-b512-4972-ba0d-9f489e38569a` as `succeeded`. Raw archive `06f8e2e6-cd1e-42f6-8274-fd1ab30fafdd.ndjson` contains four non-JSON fragments spelling a provider HTTP 403 usage-limit response. |
| Root cause | `spawnCli` yielded NDJSON parse errors but excluded their text from diagnostic classification. Separately, route consumers treated normal async-generator exhaustion as success even when the only terminal provider signal was `error`; the following synthetic `done` erased failure truth at the parent layer. |
| Terminal model | Non-JSON output may participate in private error classification but is not an automatically trusted public excerpt. A route is provider-failed when it emits provider errors and produces no successful output from any cat. Mixed multi-cat output remains successful to avoid retrying and duplicating already delivered replies. Cancellation, persistence failure, and governance failures retain precedence. |
| Verification | Red regressions reproduced fragmented Kimi quota misclassification plus direct, queued, and retry error-only executions being marked successful. Formal review then reproduced a cancel/throw race that incorrectly completed a multi-mention aggregate; the fix preserves cancellation precedence. The shared tracker is applied to all seven `routeExecution` consumers; 228 affected route/orchestrator tests pass across 21 suites, and the complete `cli-spawn` suite passes 75/75 runnable tests with 4 platform skips. Live acceptance re-smoke remains gated on reviewer confirmation. |

## Runtime preflight

- Active worktree: `E:/ClowderAI/clowder-ai-f010-local-sandbox`, branch `feat/f010-mobile-pwa`, audited HEAD `72af6a6`.
- Acceptance API: port `4311`, PID `15812`, started after deadlock fix `75eddda`; phone and desktop Socket.IO origins return 200 while a hostile origin returns 403.
- Acceptance Web: port `4310`, PID `37656`, build ID `n3DpKBgj77uXohgXH0FVl`.
- Current API PID has no matching disk-log line in the previous acceptance log, so the raw per-invocation archive is the decisive Kimi source.
- Production ports `3013/3014` are outside this repair and remain untouched.

## Failure-mode audit

- Do not switch Kimi's provider/model or relax API security boundaries to conceal exhausted quota.
- Do not expose arbitrary malformed stdout as a user-visible excerpt; classification may use it, disclosure may not.
- A successful sibling or recovery output keeps a multi-cat parent successful, preventing whole-batch retry duplication.
- Error-only executions must remain retryable by recording `failed`, including direct, queued, retry, connector, callback, and internal signal entry points.

[丢丢/gpt-5.6-sol🐾]
