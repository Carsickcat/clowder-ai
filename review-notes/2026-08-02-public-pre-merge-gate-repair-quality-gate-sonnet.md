# Public Pre-Merge Gate Repair — Quality Gate

**Date:** 2026-08-02

**Author:** 丢丢 / gpt-5.6-sol

**Branch:** `feat/nova-inspection-atomic-mvp`

**Base:** `75d991ee09d2c31edcfcb44b0f13b5586a598f9b` (`origin/main`)

**Truth sources:**

- `feature-specs/2026-08-02-public-pre-merge-gate-repair.md`
- `docs/bug-report/public-pre-merge-gate-missing/bug-report.md`
- `docs/SOP.md` — Full Sync Gate
- `.github/workflows/ci.yml` and `.github/workflows/windows-smoke.yml`
- co-creator authorization in `thread_mrrzdymcf3z6bx77`: “那你修吧，按照你的建议来”

## Verdict

**Author evidence is complete and ready for independent review. This is not a merge approval.**

The repair restores an honest public-repository gate: every platform checks, lints, builds and starts the built API in an isolated temporary environment; Windows runs its checked-in smoke contract and explicitly requires the Ubuntu `Test (Public)` PR check, while non-Windows runs that public suite locally. No test exclusion was added.

Because this is a fix-family change and the public snapshot's hotfix checker is absent, independent reviewer approval remains mandatory.

## Original requirement coverage

1. `pnpm gate` must no longer point to a missing repository script.
2. The gate must rebase onto current `origin/main` and fail closed on dirty input, moving HEAD or dirty output.
3. Windows local verification must not pretend Linux-only public tests passed.
4. The checked-in Ubuntu `Test (Public)` workflow remains authoritative for the Linux public suite.
5. The built API must pass a real startup/health probe without inherited Redis, credentials or runtime/user data paths.
6. The fix must add no new test-file exclusion and must preserve the requirement that both PR platform checks pass before merge.

All six are covered by the plan, implementation, contract tests and real `pnpm gate` dogfood.

## Invariant matrix

| Invariant | Implementation | Evidence | Result |
|---|---|---|---|
| dirty input/output fails | two `git status --porcelain` guards; final guard ordered after startup and HEAD comparison | removal/reordering mutations + real clean gate | PASS |
| HEAD cannot move during verification | capture and compare `GATE_HEAD` after startup | removal mutation + real clean gate | PASS |
| Windows cannot claim Linux public coverage | OS branch runs workflow-owned smoke tests and prints `Remote required: Test (Public)` | script/workflow contract test | PASS |
| non-Windows matches Ubuntu command | `pnpm --filter @cat-cafe/api run test:public` | CI workflow contract test | PASS |
| startup cannot inherit persistent/runtime state | empty-by-default env, minimal OS allowlist, `MEMORY_STORE=1`, unique temp roots | hostile-env IMAP/PAT/proxy/unknown-var test + real built API startup | PASS |
| cleanup only targets owned resources | exact child handle and `mkdtemp` return are retained; no process search | healthy/early-exit process-boundary tests | PASS |
| no new test exclusion | platform split reuses the two checked-in workflows | diff and failure-mode audit | PASS |

## Architecture ownership

Architecture cell: `public delivery / repository quality harness`

Map delta: `none`

Why: this repairs orchestration and CI evidence handoff. It adds no runtime product Store, Queue, Router, Adapter, Dispatcher or Binding. The startup child uses existing API output and a disposable in-memory/temp configuration only.

## Dogfood-Your-Slice

Scope verdict: **required** — `pnpm gate` is a cat-visible developer path.

Real path: clean feature HEAD → `pnpm gate` → fetch/rebase → check → lint → build → Windows Smoke → isolated API health → exact-child cleanup → HEAD/worktree evidence.

Observed twice after implementation commits: exit 0 in 61 seconds; `origin/main` merge-base remained `75d991e`; worktree remained clean. A final exact-HEAD run is required after committing these review notes and is reported in the signed review request message.

Dogfood bugs found and fixed:

- source-style root `pnpm test` was not the public target contract;
- Biome's implicit LF setting rejected the CRLF Windows checkout;
- shutdown left a referenced five-second timer, fixed with cancellable exact-child exit waiting;
- `merge-gate/SKILL.md` still described the old root-test contract, now aligned with the platform/remote evidence split.

## Verification evidence

- Red 1: `pnpm gate` exited 127 because `scripts/pre-merge-check.sh` was absent.
- Red 2: source-style root tests failed on Windows; environment-isolated `test:public` still failed Linux path/mode/tmux/SQLite-WAL semantics, confirming the checked-in platform split rather than a new exclusion list.
- gate/startup regression: **10/10 passed**.
- `pnpm check`: exit 0; 1,891 Biome-scanned files plus feature/env/profile/gate checks.
- `pnpm lint`: exit 0 across shared/API/MCP/Web; existing Web warnings only.
- `pnpm build`: exit 0 across shared/API/MCP/Web.
- Windows workflow commands: **31 passed, 9 platform-declared skips, 0 failed**.
- `pnpm test:startup`: real built API health passed with memory/temp storage.
- `pnpm gate` on clean `e998bf6`: exit 0 in 61 seconds.
- `bash -n scripts/pre-merge-check.sh`: exit 0.
- skill frontmatter/T0 description contract: parse passed; Common Mistakes now names the Windows-Smoke/Public-Suite confusion.
- root media/design artifact scan: empty.
- `.pen` match: none; no UI files changed in the gate-repair range.

## Independent review closure

| Finding | Red | Green |
|---|---|---|
| P1: ambient IMAP/PAT credentials reached the startup child | hostile-env test observed `GITHUB_REVIEW_IMAP_USER` in `buildAcceptanceEnv()` | the child env now begins empty; IMAP user/pass, `GITHUB_MCP_PAT`, proxies, `NODE_OPTIONS` and unknown flags are absent, while home/temp/XDG paths are owned by the acceptance root |
| P2: final gate invariants were not mutation-locked | removing the HEAD guard and moving cleanliness before startup left the old checker green | explicit order assertions plus removal/reordering mutations pass |

Failure-mode audit: P1 and P2 are distinct mechanisms but share an unproven-boundary shape. The full startup environment boundary and every terminal success guard were scanned. The generalized defenses are allowlist construction and ordered mutation tests, not additional denylist entries or point assertions. No fallback layer was added; the repository's fallback checker remains absent as documented below.

## Applicable limitations, stated rather than hidden

- Root `pnpm test` is not the public Windows contract. The existing Ubuntu `Test (Public)` job is required after push and cannot be substituted by local Windows success.
- `pnpm check:skills` cannot start because this public snapshot exposes `scripts/check-skills-mount.sh` but does not contain that source-only script. The same public-export family is documented in the bug report; restoring unrelated source mount machinery is outside this repair. Frontmatter parsing, T0 manual review and `pnpm check` passed.
- `check-hotfix-pattern.mjs`, `check-fallback-layers.mjs`, `check:architecture-ownership` and `check:capability-tips` are also absent from this public snapshot. Manual scans found no fallback stack, ownership mismatch, user-visible tip obligation or deferred P1/P2 tail in this repair.

---

[丢丢/gpt-5.6-sol🐾]
