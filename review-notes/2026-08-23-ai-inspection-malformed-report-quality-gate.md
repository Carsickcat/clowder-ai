---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [aiops, inspection, run-history, persistence-boundary, quality-gate]
doc_kind: quality_gate_report
created: 2026-08-23
---

# AI Inspection malformed Run report — targeted quality gate

Baseline reviewed SHA: `b46a1253d9741134c66febfbacb491d816a81c61`

## Vision and spec alignment

The V2 design says a damaged history record must degrade evidence while leaving the saved Definition directly runnable. This repair closes that exact AC-V5 / INV-V6 gap. It does not change the accepted information architecture, persisted Definition shape, immutable Run ledger, trend comparison, sharing, or mobile layout.

| Requirement | Result | Evidence |
|---|---|---|
| Malformed Run is isolated at hydration | Met | `validReportContract()`, journey regression |
| Definition survives and card reports degraded history | Met | journey regression, offline Chrome |
| History surface opens without rendering malformed evidence | Met | journey regression, offline Chrome |
| Direct execution remains available | Met | journey regression, offline Chrome |
| Legacy Run without `executionResults` remains compatible | Met | unchanged optional branch plus existing legacy comparison test |

There are no unmet or waived acceptance criteria in this targeted repair. Feature closure remains gated by the independent reviewer; this report does not authorize merge or release.

## Architecture ownership

- Architecture cell: AI inspection offline demo / standalone product artifact.
- Map delta: none.
- Why: the existing domain contract now defines the report shape already consumed by the existing persistence boundary and renderer. No Store, Queue, Router, Adapter, Dispatcher, Binding, or second source of truth was added.
- Contract drift check: compiler/scenario report producers, persisted Run validation, historical rendering, sharing, and legacy `executionResults` compatibility were inspected together.

## Fallback and tool guards

- No fallback layer was added; malformed data is rejected once at the canonical persistence boundary.
- This checkout has no `check-hotfix-pattern.mjs`, `check-fallback-layers.mjs`, `check:architecture-ownership`, or `check:capability-tips` command. Manual diff inspection found no hotfix marker or fallback stack.
- Tips exemption remains declared in the implementation plan because this is a standalone offline artifact without a Cat Café runtime discovery surface.
- No AI-inspection `.pen` file exists; the only repository `.pen` belongs to unrelated F070. The terminal visual contract remains `DESIGN-V2-RUN-HISTORY.md`.
- Root artifact hygiene checks found no media or design files at repository root.

## Dogfood-your-slice

Scope verdict: required and completed.

End-to-end path: persist one valid Definition and sole Run → replace only `run.report` with `{}` → reload offline artifact → observe `历史暂不可用` → open history without an exception → start the same Definition directly.

Observed result: the invalid Run is omitted, the Definition remains visible, history shows the degraded empty state, direct execution enters `execution`, and Chrome reports 0 network requests and 0 browser errors.

## Red → Green evidence

- Red: `node --test tests/journeys.test.mjs` → 22 passed, 1 expected failure (`available / rejectedRunCount: 0`).
- Green: the same suite → 23/23 passed.
- Refactor verification: domain + saved-inspection + journey suites → 38/38 passed.

## Fresh verification

- Product `pnpm check`: 82/82 Node tests; offline Chrome acceptance passed; 0 HTTP(S) requests; 0 browser errors.
- Repository `pnpm check`: passed, including 1,944-file Biome scan and repository truth/profile checks. Git Bash was added only to the command process's `PATH` because the installed executable was not inherited by PowerShell.
- Repository `pnpm lint`: exit 0; existing unrelated warnings only.
- Repository `pnpm build`: exit 0; existing unrelated warnings only.
- `git diff --check`: exit 0.
- Root media/design artifact checks: no matches.

## Ragdoll search → Read check

Memory search located the current thread and exact review finding; the original `DESIGN-V2-RUN-HISTORY.md`, `journeys.test.mjs`, compiler report producers, persistence validator, selector, and renderer were then read directly before implementation. No conclusion in this report relies on a search-result summary alone.

## Gate verdict

Targeted quality gate passed. Independent re-review of the new exact SHA is still required.

[丢丢/gpt-5.6-sol🐾]
