---
feature_ids: []
topics: [public-repository, merge-gate, ci, windows, startup-acceptance]
doc_kind: plan
created: 2026-08-02
updated: 2026-08-02
---

# Public Pre-Merge Gate Repair Implementation Plan

**Feature:** Bug — `docs/bug-report/public-pre-merge-gate-missing/bug-report.md`
**Goal:** Make `pnpm gate` an honest public-repository gate that is executable on Windows, delegates the Linux-only public API suite to the existing required Ubuntu CI job, and proves the built API starts without touching runtime or user data.
**Acceptance Criteria:** The local gate is fail-closed on dirty or moving HEAD; runs public check, lint, build, platform-appropriate tests, and isolated startup acceptance; the Ubuntu workflow remains the authority for `test:public`; no newly failing test is hidden by an exclusion.
**Architecture cell:** public delivery / repository quality harness
**Map delta:** none
**Map delta why:** This repairs an existing developer gate and CI handoff; it adds no runtime product ownership.
**Architecture:** `scripts/pre-merge-check.sh` owns local orchestration. Windows runs the repository's explicit Windows smoke suite, while non-Windows runs `@cat-cafe/api test:public`; the checked-in Ubuntu workflow is contract-tested as the remote Linux authority. A Node startup probe launches one exact child API with a temporary config/data root and in-memory stores, waits for `/health`, then closes only that child.
**Tech Stack:** Bash, Node.js test runner, GitHub Actions, Fastify health endpoint.
**前端验证:** No — no user interface changes.

---

## Finish line

From a clean feature HEAD on Windows, `pnpm gate` passes local public checks without pretending Linux-only tests ran. After the branch is pushed, the existing Ubuntu `Test (Public)` check must also pass before merge. The gate never reads or writes runtime Redis, runtime SQLite, or the operator's `.cat-cafe` catalog.

Not building: a cross-platform rewrite of every Linux-oriented API test, a second test exclusion list, or a local GitHub-status polling client.

## Lifecycle census

| Object | Owner | States | Terminal rule |
|---|---|---|---|
| Local gate invocation | `pre-merge-check.sh` | preflight → rebased → verifying → passed/failed | `passed` only on exact unchanged HEAD and clean worktree |
| Startup API child | `public-startup-acceptance.mjs` | spawned → healthy → stopping → exited | only the exact spawned child may be signalled |
| Acceptance temp root | startup probe | created → populated → in-use → removed | removal is limited to the `mkdtemp` result after child exit |
| Remote Linux check | GitHub Actions | queued → running → success/failure | merge requires `Test (Public)=success`; local Windows output never substitutes for it |

## Invariants

- **INV-1:** Dirty input or dirty output fails the local gate.
- **INV-2:** The HEAD captured after rebase is identical at completion.
- **INV-3:** Windows local verification cannot claim that `test:public` ran; it must name the required Ubuntu check.
- **INV-4:** Non-Windows local verification runs the same API public command as Ubuntu CI.
- **INV-5:** Startup acceptance passes through only the OS keys needed to execute the child, uses `MEMORY_STORE=1`, and redirects home/cache/temp/data/config state into one unique temporary root.
- **INV-6:** Startup cleanup never searches for or terminates unrelated processes.
- **INV-7:** The repair adds no test-file exclusion beyond the existing `test:public` contract.

## Adversarial scenarios

| Scenario | Expected evidence |
|---|---|
| Parent shell exports credentials, proxies or production/runtime variables | startup child receives none of them; only the OS execution allowlist survives and all writable roots are temporary |
| API never becomes healthy | probe times out, prints child output tail, stops exact child, exits non-zero |
| API exits before health | probe reports exit code/output and fails |
| Windows checkout runs Linux-only tests | local gate selects the checked-in Windows smoke commands and states remote Linux requirement |
| CI workflow loses `test:public` | contract test fails before gate can pass |
| Verification changes files or HEAD | final hygiene check fails |

## Task 1: Correct the public gate contract (Red)

**Files:**
- Modify: `scripts/pre-merge-check.test.mjs`
- Read: `.github/workflows/ci.yml`
- Read: `.github/workflows/windows-smoke.yml`

1. Change the contract test to require ordered `pnpm check`, `pnpm lint`, `pnpm build`, platform test selection, and `pnpm test:startup`.
2. Require the Ubuntu workflow to contain `Test (Public)` and `pnpm --filter @cat-cafe/api run test:public`.
3. Require the Windows branch to contain exactly the two checked-in smoke commands.
4. Run `node --test scripts/pre-merge-check.test.mjs` and observe failure because the current script still calls root `pnpm test` and has no startup probe.

## Task 2: Add isolated startup acceptance (Red → Green)

**Files:**
- Create: `scripts/public-startup-acceptance.mjs`
- Create: `scripts/public-startup-acceptance.test.mjs`
- Modify: `package.json`

1. Test environment construction with hostile inherited Redis/config/data variables; assert an isolated temp root, `MEMORY_STORE=1`, loopback host, and no `REDIS_URL`.
2. Test a healthy fixture child and an early-exit fixture child through the real process boundary.
3. Implement free-port allocation, temp config copy, exact-child spawn, bounded `/health` polling, output-tail diagnostics, child shutdown, and temp cleanup.
4. Register `test:startup` as `node scripts/public-startup-acceptance.mjs`.
5. Run the startup unit tests, then the real `pnpm test:startup` against the built API.

## Task 3: Implement platform-aware local orchestration (Green)

**Files:**
- Modify: `scripts/pre-merge-check.sh`
- Modify: `scripts/pre-merge-check.test.mjs`

1. Preserve clean-worktree, fetch/rebase, exact-HEAD, and final hygiene guards.
2. Run public commands in SOP order: check, lint, build, platform tests, startup acceptance.
3. On `MINGW/MSYS/CYGWIN`, run the two Windows smoke files and print `Remote required: Test (Public)`.
4. Otherwise run `pnpm --filter @cat-cafe/api run test:public`.
5. Run the contract suite and mutation assertions to prove removing either platform test branch fails.

## Task 4: Archive the root cause and verify

**Files:**
- Modify: `docs/bug-report/public-pre-merge-gate-missing/bug-report.md`
- Modify: `feature-specs/2026-08-02-public-pre-merge-gate-repair.md`

1. Record the three-layer root cause: missing exported entrypoint, a source-gate command copied into a public target whose platform contract is split across Ubuntu CI and Windows smoke, and a fixed-LF formatter default that rejected the Windows checkout.
2. Record Red evidence: root `pnpm test` is not the public contract; an isolated Windows `test:public` still fails Linux-semantic tests, while current `origin/main` Ubuntu `Test (Public)` is green.
3. Run targeted tests, `pnpm check`, `pnpm lint`, `pnpm build`, real startup acceptance, and finally `pnpm gate` from a clean exact commit.
4. Request independent review of the gate delta before push/PR; after push, require Ubuntu `Test (Public)` and Windows Smoke success before merge.

## Review closure: ambient environment and terminal gate guards

Independent review found two unproven boundaries in the first version: the environment denylist missed IMAP/PAT variables, and contract tests did not reject deletion of the final HEAD guard or premature cleanliness verification. The repair changes the coordinate system rather than extending either list:

1. Environment construction starts empty and copies only `PATH`, `PATHEXT`, `SYSTEMROOT`, `WINDIR` and `COMSPEC` case-insensitively; all home/temp/XDG roots are explicit children of the owned `mkdtemp` root.
2. The contract checker requires `startup < final HEAD < final cleanliness < success evidence`, with mutation tests for guard removal and reordering.
3. Run the hostile-env and mutation suite, real built startup, check, lint, build, then one clean exact-HEAD `pnpm gate` before requesting re-review.
