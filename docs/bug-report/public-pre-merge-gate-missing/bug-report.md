# Public pre-merge gate entrypoint was missing

## Reporter

Diudiu discovered the defect while running the merge gate for the NOVA inspection atomic MVP on 2026-08-02.

## Reproduction

Expected: `pnpm gate` fetches and rebases onto `origin/main`, then runs the full build, test, lint, and check sequence.

Actual:

```text
pnpm gate
/usr/bin/bash: ./scripts/pre-merge-check.sh: No such file or directory
```

The failure is deterministic on both the feature HEAD and `origin/main`.

## Root cause

The public repository's root snapshot commit (`461c5e3`) copied the `package.json` gate command from the source repository but did not include `scripts/pre-merge-check.sh`. The script does not exist in any commit reachable from this repository, and no other local checkout contains it. The public export therefore retained a source-only command without a public implementation.

## Fix

Add a public `scripts/pre-merge-check.sh` that implements the documented latest-main gate, and add a check wired into `pnpm check` that fails whenever the package entrypoint is missing or loses its fetch, rebase, full command sequence, or evidence summary.

The fix does not copy source-private gate behavior. It implements only the public contract already documented in `cat-cafe-skills/merge-gate/SKILL.md`.

A same-family audit found additional package commands whose source-only scripts are absent from the public snapshot. They are not required by `pnpm gate` and are intentionally excluded from this merge-blocker fix; restoring or removing those commands belongs at the public-export boundary rather than as unrelated scripts in the NOVA branch.

## Verification

- Red: the real entrypoint, `pnpm gate`, failed with exit 127 because `./scripts/pre-merge-check.sh` did not exist.
- Regression: `node --test scripts/pre-merge-check.test.mjs` passes 3/3 and includes a mutation assertion proving that an implementation which skips `pnpm test` is rejected.
- Final acceptance: run `pnpm gate` from a clean commit based on the latest `origin/main`; require build, test, lint, check, clean-worktree, and evidence-summary success.
