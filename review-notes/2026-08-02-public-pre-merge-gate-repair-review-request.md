# Review Request: Public Pre-Merge Gate Repair

Review-Target-ID: `nova-inspection-atomic-mvp`

Branch: `feat/nova-inspection-atomic-mvp`

Scoped range: `e916cbf..HEAD`; review-fix delta: `d5536b5..HEAD`

## What

Restore the missing public `pnpm gate` entrypoint and align it with the repository's checked-in platform contract:

- fail closed before/after verification and pin HEAD after latest-main rebase;
- run check, lint, build, platform-owned tests and isolated startup acceptance;
- run Windows Smoke locally on Windows and require PR `Test (Public)` explicitly;
- run the Ubuntu-owned `@cat-cafe/api test:public` command on non-Windows;
- make Biome line endings follow the checkout platform;
- probe the built API on loopback with in-memory/temp state, stop only the exact child and remove only its owned temp root;
- update the merge-gate skill so future cats do not confuse Windows Smoke with Public Suite success.

## Why

The public snapshot exposed `pnpm gate` but omitted its backing script. The first restoration copied a source-repository root-test assumption that is not the public contract and fails on Windows for Linux semantics. The final design reuses the repository's existing Linux and Windows workflow ownership instead of inventing exclusions or claiming false coverage.

## Original Requirements

> 1. Repair the missing public pre-merge gate rather than waive the E5 blocker.
> 2. Rebase and verify the exact latest-main HEAD with clean-worktree guards.
> 3. Keep local Windows evidence honest: Windows Smoke is not the Linux Public Suite.
> 4. Preserve Ubuntu `Test (Public)` as a required PR authority.
> 5. Prove the built API actually starts without touching runtime Redis, SQLite, credentials or operator state.
> 6. Add no new test exclusion; both remote platform checks remain mandatory before merge.

Source: co-creator authorization in `thread_mrrzdymcf3z6bx77` after the invariant-preserving repair proposal; executable detail is frozen in `feature-specs/2026-08-02-public-pre-merge-gate-repair.md`.

Please judge the scoped diff against these requirements, not against the source repository's root-test sequence.

## Architecture Ownership

Architecture cell: `public delivery / repository quality harness`

Map delta: `none`

Why: no product runtime ownership changes. The only spawned process is a disposable acceptance child of the existing built API; no persistent Store/Queue/Router/Adapter/Dispatcher/Binding is added.

## Tradeoffs and boundaries

- This does not port every Linux-oriented API test to Windows and does not add an exclusion list.
- Windows local output explicitly names the missing remote authority instead of polling GitHub itself.
- The startup probe copies repository config into a unique temporary root, strips inherited credentials/runtime storage, and uses `MEMORY_STORE=1`.
- Other source-only package commands missing from the public export remain a separately documented export-boundary defect.

## Technical Open Questions for reviewer

1. Can any preparation, spawn, health timeout or shutdown path leak the child or delete outside the exact `mkdtemp` root?
2. Is the environment deny/replace boundary sufficient to prevent Redis, credentials and operator runtime state from reaching the child?
3. Can the gate claim success if a platform branch, workflow command, HEAD or worktree invariant is weakened?
4. Does `lineEnding: auto` preserve Linux CI behavior while eliminating Windows CRLF false failures?
5. Does the updated merge-gate skill state the local/remote evidence boundary without surprising source-repository users?

Value OQ for operator: none. The co-creator already selected the invariant-preserving repair.

## Self-check evidence

- Quality report: `review-notes/2026-08-02-public-pre-merge-gate-repair-quality-gate-sonnet.md`
- Plan: `feature-specs/2026-08-02-public-pre-merge-gate-repair.md`
- Root cause: `docs/bug-report/public-pre-merge-gate-missing/bug-report.md`
- targeted gate/startup tests: **10/10 pass**, including hostile ambient IMAP/PAT/proxy variables and final-guard removal/reordering mutations
- `pnpm check`, `pnpm lint`, `pnpm build`: exit 0
- Windows workflow commands: **31 pass, 9 declared skips, 0 fail**
- real built API startup: pass with memory/temp state
- clean `pnpm gate` on `e998bf6`: exit 0 in 61 seconds
- root media/design artifact scan: empty; no UI/`.pen` delta
- `pnpm check:skills` remains unavailable because the public snapshot omits its referenced source-only script; manual T0/frontmatter audit passed and the limitation is explicit in the quality report

## Review-fix confirmation

The first independent pass requested two changes:

1. P1: replace the incomplete inherited-environment denylist. The acceptance child now receives only five case-insensitive OS execution keys; writable home/temp/XDG state is redirected under its owned temporary root. Hostile coverage includes IMAP user/pass, `GITHUB_MCP_PAT`, `NODE_OPTIONS`, a proxy and an unrelated runtime flag.
2. P2: mutation-lock the terminal invariants. The contract now enforces `startup < final HEAD < final cleanliness < success evidence`, and fails when either guard is removed or cleanliness is moved early.

The final clean exact-HEAD `pnpm gate` is intentionally run after committing this archived packet; its SHA and exit evidence are supplied in the routed re-review message.

## Requested review scope

Review only the gate-repair delta after the already approved NOVA behavioral head `e916cbf`. Re-run the highest-risk process/storage/platform tests independently. Give an explicit `APPROVE` or `REQUEST CHANGES`; label every finding P1/P2/P3.

Suggested sandbox: `E:/ClowderAI/review-sandboxes/nova-inspection-atomic-mvp/opus-gate`

---

[丢丢/gpt-5.6-sol🐾]
