# Public pre-merge gate entrypoint was missing

## Reporter

Diudiu discovered the defect while running the merge gate for the NOVA inspection atomic MVP on 2026-08-02.

## Reproduction

Expected: `pnpm gate` fetches and rebases onto `origin/main`, runs the public repository's local checks for the current platform, and leaves the branch ready for the required Ubuntu `Test (Public)` CI check.

Actual:

```text
pnpm gate
/usr/bin/bash: ./scripts/pre-merge-check.sh: No such file or directory
```

Before this repair, the failure was deterministic on both the feature HEAD and `origin/main`.

## Root cause

There were three coupled defects:

1. The public repository's root snapshot commit (`461c5e3`) copied the `package.json` gate command from the source repository but did not include `scripts/pre-merge-check.sh`. Before this repair, the script did not exist in any commit reachable from `origin/main`. The public export therefore retained a source-only command without a public implementation.
2. The first restored implementation copied the source-repository `pnpm test` assumption. That is not the public target contract documented in `docs/SOP.md`: the public API suite is Linux-oriented and runs in the checked-in Ubuntu `Test (Public)` workflow, while Windows has a separate checked-in smoke workflow. Running the root recursive test command on Windows mixed internal/Redis suites with Linux path, Unix mode and tmux expectations.
3. Biome's implicit LF formatter default conflicted with the repository's CRLF Windows checkout. The same tracked files passed on Linux but appeared as 1,885 formatting failures locally, so the gate was not portable even after the command contract was corrected.

The second defect was confirmed rather than guessed: an environment-isolated Windows `test:public` reduced failures from 45 files to 30, with the remainder dominated by POSIX path, Unix file-mode, tmux and SQLite WAL semantics. None of those failed test files overlap the NOVA branch diff. Meanwhile `origin/main` commit `75d991e` has successful remote checks for Build, Lint, Directory Size Guard and `Test (Public)` on Ubuntu.

## Fix

Add a public `scripts/pre-merge-check.sh` that implements the documented latest-main gate and respects the repository's platform split:

- all platforms: check, lint, build and isolated API startup acceptance;
- Windows: the two commands owned by `.github/workflows/windows-smoke.yml`, with an explicit `Remote required: Test (Public)` handoff;
- non-Windows: the same `@cat-cafe/api test:public` command owned by the Ubuntu workflow.

Add `scripts/public-startup-acceptance.mjs` to start one exact built API child on a loopback ephemeral port with `MEMORY_STORE=1`, copied temporary cat config, and temporary data/log/home/cache roots. The child receives only a minimal OS execution allowlist from the parent environment; credentials, proxies, runtime flags, `NODE_OPTIONS`, Redis and all unknown ambient variables are absent by construction. It polls `/health`, stops only the child it spawned, and removes only its `mkdtemp` directory.

The contract test is wired into `pnpm check` and fails whenever the package entrypoint is missing, either platform test branch disappears, the Ubuntu workflow loses `test:public`, startup acceptance disappears, or fetch/rebase/HEAD/worktree hygiene weakens.

Biome now uses its supported `lineEnding: auto` policy, which preserves CRLF on Windows and LF on Linux instead of making checkout platform look like a repository-wide formatting defect.

The fix does not copy source-private gate behavior and does not add a new test exclusion. It follows the public target contract in `docs/SOP.md` and the repository's existing workflows.

A same-family audit found additional package commands whose source-only scripts are absent from the public snapshot. They are not required by `pnpm gate` and are intentionally excluded from this merge-blocker fix; restoring or removing those commands belongs at the public-export boundary rather than as unrelated scripts in the NOVA branch.

## Verification

- Red: the real entrypoint, `pnpm gate`, failed with exit 127 because `./scripts/pre-merge-check.sh` did not exist.
- Red 2: the source-style root test command failed under Windows and an isolated `test:public` still exposed Linux-only semantics; this disproved a local mass-fix/exclusion approach.
- Review Red: a hostile environment proved that `GITHUB_REVIEW_IMAP_USER`, `GITHUB_REVIEW_IMAP_PASS` and `GITHUB_MCP_PAT` reached the child under the original denylist; removing the final HEAD guard or moving the final cleanliness guard before startup also escaped the original contract tests.
- Regression: the gate and startup suites pass 10/10. Hostile-env coverage proves credentials and unknown configuration are absent, while mutation assertions reject platform-test removal, final-HEAD removal, final-cleanliness removal and final-cleanliness reordering.
- Startup: `pnpm test:startup` passes against the real built API without Redis or runtime data.
- Cross-platform formatting: `pnpm check` passes from the CRLF Windows checkout; `origin/main`'s LF Ubuntu check remains the remote authority before merge.
- Local platform verification: `pnpm lint` and `pnpm build` pass; the two Windows workflow commands pass 31 tests with 9 platform-declared skips and no failures.
- Final acceptance: run `pnpm gate` from a clean exact commit, request independent review, then require both Ubuntu `Test (Public)` and Windows Smoke success on the PR before merge.
