# Review Request: F010 provider-failure truth

Review-Target-ID: f010

Branch: `feat/f010-mobile-pwa`

Exact implementation SHA: `978d6f9fd44bcfc143f469c661e919e30132a70a`

## What

- Classify fragmented non-JSON provider diagnostics without exposing arbitrary raw stdout as a public excerpt.
- Record an error-only routed execution as `failed` instead of allowing its synthetic `done` event to become a false success.
- Apply one outcome contract to all seven production `routeExecution` consumers.
- Preserve cancellation, persistence, and governance precedence; keep mixed multi-cat parents successful when another cat produced substantive output.
- Record direct and queued multi-mention provider failures as terminal aggregate results instead of waiting to mislabel them as timeouts.

## Why

A live Kimi request correctly reached its CLI, which returned a fragmented provider HTTP 403 quota response. The API discarded those fragments for classification, showed an unknown exit, and persisted the error-only parent invocation as `succeeded`. That combination made a recoverable external provider failure look like another silent application hang and made the record non-retryable.

## Original Requirements

> “kimi今天好多问题，对话框好多好多超时，你们今天基本啥也没干，我的app应用也基本瘫痪，请你们整体审视并修复一遍功能吧”

- Thread source: `thread_mrogfco44bos1sgn`, message `0001784558898374-000198-a1487314`.
- Diagnosis source: `docs/bug-report/f010-provider-failure-truth/bug-report.md`.
- Operator experience to judge:
  1. a provider failure must not be stored as success;
  2. the UI must receive a useful classified reason instead of an unexplained timeout/exit;
  3. malformed provider output must not leak arbitrary content into the public error excerpt;
  4. cancel/retry/queue/direct/connector/callback paths must agree on terminal truth;
  5. one failed cat must not cause successful sibling replies to be replayed.

## Tradeoff

The parent tracker intentionally models “usable output from at least one cat” as success for mixed multi-cat execution. This avoids whole-parent retries duplicating an already delivered sibling response; the individual failed cat remains visible through its emitted error. A synthetic `done` event is never proof of success.

This repair does not switch Kimi's provider/model, add quota, relax CORS, or change the live acceptance process before review. It improves failure truth; it cannot turn an exhausted external quota into a real model response.

## Architecture Ownership

Architecture cell: `dispatch` / invocation execution outcome, with the existing F045 NDJSON observability contract

Map delta: none

Why: the new tracker is an internal outcome primitive used by existing Queue/Router consumers. It adds no Store, Queue, Router, Adapter, Dispatcher, Binding, persistence owner, or external contract, and it does not move an ownership boundary.

Please verify that the diff matches `Map delta: none` and that all production `routeExecution` consumers apply the same terminal model.

## Open Questions

### Technical OQ

- Is “any substantive sibling output prevents whole-parent provider failure” the correct duplication-safe aggregate rule?
- Can a cancellation, persistence failure, or governance block still be overwritten by a provider error on any entry path?
- Can fragmented malformed stdout influence classification without entering the public safe excerpt?
- Are multi-mention failed responses terminal and immediately flushable in direct, queued, and thrown-dispatch paths?

### Value OQ

None. The change is reversible, does not mutate user data or security boundaries, and does not choose a replacement provider for the operator.

## Fresh-Context Findings

Agent: isolated fresh-context finding generator, not approval authority

SHA scanned: `72af6a6 + worktree diff`; fixes frozen in `978d6f9`

Total findings: 4 (0 P1, 4 P2, 0 P3)

| # | Finding | Author disposition | Status |
| --- | --- | --- | --- |
| FC-1 | Known multi-mention provider failures waited for timeout and were mislabeled. | Added first-class failed aggregate results and immediate flush; RED then GREEN. | closed |
| FC-2 | Connector failure emitted a duplicate generic error attributed to the default cat. | Preserve the original target-attributed provider event; RED then GREEN. | closed |
| FC-3 | Retry provider error could override cancellation during shutdown. | Resolve aggregate cancellation before other terminal failures; RED then GREEN. | closed |
| FC-4 | A bare sibling `done` could mask another cat's failure. | Only text/tool output proves sibling success; RED then GREEN. | closed |

Reviewer delta tracking: mark findings `[FC:covered]`, `[FC:new]`, or `[FC:N/A]` where applicable.

## Failure-Mode Sweep

Pattern: route consumers inferred parent success from generator exhaustion.

- Scanned: every production `routeExecution` consumer (7/7).
- Fixed: direct messages, retry, queue processor, connector, A2A callback, multi-mention callback, podcast generation.
- N/A: `AgentRouter.routeExecution` is the producer/definition, not a parent terminal-state consumer.

## Review Sandbox

- Source worktree: `E:\ClowderAI\clowder-ai-f010-local-sandbox`
- Review target: detached/read-only checkout of `978d6f9fd44bcfc143f469c661e919e30132a70a`
- Start command: not required; review should not touch live Web `4310` or API `4311`.
- Ports: none required.

## Self-check Evidence

- Quality gate: `review-notes/2026-07-20-f010-provider-failure-truth-quality-gate.md`.
- Affected route/orchestrator suites: **227/227 pass** across 21 suites.
- Complete `cli-spawn.test.js`: **75/75 runnable pass**, 4 expected Windows skips.
- Workspace build, API rebuild, lint, targeted Biome (21 files), feature truth, capability tips, and `git diff --check`: pass.
- Root-media worktree scan: empty. The historical F010 branch has no common ancestor with `origin/main`, so the branch-range form of that scan cannot be treated as a valid provenance check.
- Repository-wide limitations are disclosed, not called green: `pnpm check` hits baseline CRLF formatter debt; the root `pnpm test` API wrapper uses Unix inline env syntax under Windows; a direct full API attempt exceeded the 10-minute harness limit without an assertion summary.
- Live runtime remains unchanged pending independent review: Web PID `37656`, API PID `15812`.

## Next Action

Independent reviewer: inspect exact SHA `978d6f9`, independently rerun the focused tests, and return a P1/P2/P3 verdict. Deployment and live Kimi failure re-smoke remain blocked until P1/P2 are zero.

[丢丢/gpt-5.6-sol🐾]
