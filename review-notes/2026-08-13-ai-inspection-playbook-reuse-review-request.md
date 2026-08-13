---
feature_ids: [AI_INSPECTION_PLAYBOOK_REUSE]
topics: [aiops, inspection, playbook, review-request]
doc_kind: review-request
created: 2026-08-13
---

# Inspection Playbook Reuse — Formal Review Request

Review-Target-ID: `ai-inspection-playbook-reuse`

PR: `https://github.com/Carsickcat/clowder-ai/pull/7`

Branch: `feat/ai-inspection-offline-demo`

Review target: use the exact HEAD supplied in the A2A handoff that references this note.

## Original requirement

Source thread: `thread_msg13xc7dv3dp4fb`

> 历史上建好的巡检任务，是不是可以考虑保存可以服用，
> 下次根据业务场景直接执行就可以，
> 不用每次重新生成。
>
> 你跟 kimi 一起讨论下高保真设计，
> kimi 主导高保真设计，
> 你来完成吧。

The accepted product interpretation is narrower than replaying an old task: immutable historical task instances remain audit records, while an approved, versioned Inspection Playbook reuses only the decision/check structure. Every new run revalidates current entities, metrics, traces, dependencies, permissions and template freshness, then creates a new task instance and new evidence.

## What

- Adds an immutable Playbook catalog and catalog-driven matcher.
- Projects no match, exact match, minor drift and major drift into one in-context match card rather than a separate template dashboard.
- Adds immutable Task Instance and pending-approval Playbook Proposal lifecycles to the reducer.
- Preserves current reconciliation and evidence collection on every reused run.
- Adds exact/minor/major/report UI, 390px behavior, browser evidence and deterministic standalone delivery.

## Why

Stable operational scenarios should not pay the full plan-generation cost on every run. Reuse is safe only when current facts remain authoritative and the old task/evidence cannot be rewritten or replayed as if they were current.

## Tradeoff

This remains an offline acceptance slice with a checked-in mock catalog. It intentionally does not add a production persistence service, approval backend or standalone Playbook dashboard. The matcher consumes structured catalog rules and selects the latest applicable version; current drift classification remains deterministic mock behavior for the product demo.

## Architecture ownership

- Architecture cell: Inspection Request Compiler / Plan Compiler / Evidence Ledger.
- Map delta: update required and completed in `designs/ai-inspection-copilot-offline-demo/ARCHITECTURE.md`.
- New boundaries: Playbook Matcher, Task Instance and Playbook Proposal.
- No new Store, Queue, Router, Dispatcher or production runtime dependency.

## Fresh-context findings and resolution

- FC-1 P2: checked-in standalone artifact was not checkout-deterministic on Windows. Closed by package-local `.gitattributes`, a failing-then-green LF contract test, rebuilt artifact and clean post-build worktree.
- FC-2 P3: matcher ignored catalog `matchRules`. Closed by structured rules, latest-applicable-version selection and a known-service/unmatched-intent regression.
- FC-3 P3: implementation-plan whitespace. Closed; `git diff --check origin/main...HEAD` is clean.

## Evidence

- Kimi-led high-fidelity review: `DESIGN APPROVE`, no P1/P2; accepted mobile inline-card and explicit-review-gate deviations.
- Product gate: 41/41 Node tests pass.
- Browser gate: unmatched, exact, minor drift and major drift journeys pass; zero HTTP(S) requests and zero browser errors.
- Responsive evidence: 390px major drift and report paths have zero horizontal overflow.
- Artifact: 104175 bytes; SHA-256 `80EB14A8FE8977B1CC6CB7B1D46938437E4386A49212FAD253532AA60A224BF8`; consecutive builds are identical.
- Root Windows-equivalent gate: Biome, feature truth, lint, build, Windows CLI/process smoke and public startup acceptance pass.
- Worktree is clean after rebuilding the standalone artifact.

## Open questions for reviewer

Technical:

- Can any event bypass exact/minor/major guards, mutate a locked task or create duplicate proposals?
- Does RESET fully isolate match, decision, task reference and proposal state?
- Does catalog-driven selection avoid hard-coded service matching while keeping major drift reference-only?
- Does every reuse route collect current evidence and generate a new task ID?
- Are the desktop and 390px CTA semantics faithful to the one-primary-action design?

Value: none. The operator already selected Playbook reuse and the design owner approved the implemented product shape.

## Next action

Review the complete PR diff in a detached/read-only sandbox at the exact handoff SHA. The product is a `file://` artifact and requires no dev server or reserved ports. Run `pnpm --dir designs/ai-inspection-copilot-offline-demo check` and inspect the built `index.html` or archived evidence. Return `APPROVE` or `REQUEST_CHANGES` with explicit P1/P2 findings and the reviewed SHA.
