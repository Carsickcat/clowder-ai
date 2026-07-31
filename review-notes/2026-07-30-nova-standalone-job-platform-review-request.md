# NOVA Standalone Job Platform — Review Request

Review-Target-ID: `aiops-observability-platform-hifi-v3`  
Branch: `feat/aiops-observability-platform-hifi-v3`  
Fixed implementation SHA: `afd329f`  
Author: `[丢丢/gpt-5.6-sol🐾]`

## What

Please independently review the saved inspection-job platform and the regenerated offline demo:

- adds three reusable inspection job templates with recent-run summaries;
- selecting a job creates a fresh, reviewable `ChangeInspectionCase` with zero inherited evidence;
- preserves explicit plan confirmation and the existing pre-change → canary → post-change journey;
- allows switching jobs only before execution or after completion;
- ships the whole mock journey in one self-contained `file://` HTML.

## Original Requirements

Truth source:

- `docs/prompts/2026-07-30-change-lifecycle-inspection-research-prompt.md`
- operator follow-up in thread `thread_mrrzdymcf3z6bx77`, reflected in
  `feature-specs/2026-07-30-nova-change-inspection-journey.md:30-38`

Please judge the implementation against this operator experience:

1. “生成一个最小的 html”，可复制到外部系统给领导演示。
2. Demo data may be mocked, but the basic inspection journey must be operable.
3. Users should not have to re-describe every recurring inspection in Claw.
4. Previously prepared inspection definitions should be saved as reusable jobs.
5. Selecting a saved job must remain safe: review the plan first, then explicitly start it.
6. Every execution must produce a fresh Case, Runs, findings, decisions, and report.
7. Historical evidence must never leak into or mutate a new inspection execution.

## Why

The earlier single-Case prototype demonstrated one journey but made recurring work look
chat-only and disposable. This delta adds a lightweight job platform in the same workspace:
it reuses inspection definitions while keeping execution evidence immutable and Case-owned.

## Architecture Ownership

- Architecture cell: `NOVA prototype / ChangeInspectionCase experience layer`
- Map delta: `none`
- Why: the delta adds immutable fixture templates and a UI selector inside the existing
  prototype. It does not introduce or replace a Store, Queue, Router, Adapter, Dispatcher,
  Binding, backend contract, or production execution boundary.

Please verify that the diff is consistent with `Map delta: none`.

## Tradeoffs

- Jobs and run summaries are mock fixtures embedded in the standalone artifact; this is
  deliberate for the requested external demo and is not presented as production persistence.
- The job platform is not a second execution state machine. A selected job only prepares a
  fresh Case; `ChangeInspectionCase` remains the sole owner of execution transitions.
- The generated HTML is 314,842 bytes rather than hand-minified because it embeds the tested
  application bundle, styles, and fixtures without network dependencies.

## Verification Evidence

Quality gate:

- `review-notes/2026-07-30-nova-standalone-job-platform-quality-gate-sonnet.md`

Author-run results:

- `npm test`: 50/50 pass.
- `npm run check` in the prototype package: pass (Prettier, build, 50 tests, standalone browser).
- `npm run test:standalone:browser`: pass for standalone acceptance and committed `file://`
  golden path; network requests 0, console errors 0.
- `BASE_URL=http://localhost:5290 node tests/golden-path.browser.mjs`: pass.
- Browser dogfood: select saved job → review → confirm → 25% → remediation record →
  Verification Run → 100% → post-change report; page/console errors 0.
- Root `pnpm check`: fails on the repository's pre-existing 2,427 Biome/CRLF diagnostics;
  the scoped package gate and owned-file `git diff --check` pass.
- Working-tree root media gate: none.
- Committed-diff root media gate: none.

Author preview used web port `5290`; there is no API process for this static prototype.
Reviewer should use an isolated port or open the committed standalone HTML directly.

## Review Focus

1. Does job selection always start with a clean Case and zero historical evidence?
2. Can an operator accidentally switch the job during an active execution?
3. Does the standalone HTML contain the same job journey with zero network dependency?
4. Is the job rail understandable at desktop, 720px, and 390px?
5. Does the implementation stay inside the existing `ChangeInspectionCase` boundary?

## Open Questions

Technical OQ: none known; please report every finding as P1/P2/P3 with a clear verdict.

Value OQ: none. This implements the operator's stated external-demo and reusable-job scenario
without expanding into production persistence or execution.

## Next Action

Return `APPROVE` or `REQUEST CHANGES` for fixed SHA `afd329f`. If approved, the author can
proceed to merge gate; if changes are requested, route back to `@sonnet`.
