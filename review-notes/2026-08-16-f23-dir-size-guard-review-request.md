## Review Request: F23 Shared Main Dir-Size Unblock

Review-Target-ID: f23-dir-size-guard
Branch: fix/f23-dir-size-guard
PR: https://github.com/Carsickcat/clowder-ai/pull/11
Exact HEAD: `d17a5fca4f6396e9a331bdeca40b64f73738a316`

### What
- Split `packages/api/src/config` into `config/accounts`, `config/runtime`, and `config/governance`.
- Updated source and test import paths for the moved modules.
- Removed the expired `packages/api/src/config` directory-size exception.
- Kept only `packages/api/src/routes` as a time-bound F23 exception.

### Why
Shared `main` was blocked by `Directory Size Guard`: both `packages/api/src/config` and `packages/api/src/routes` exceptions expired on August 15, 2026. PR #10 does not touch those directories, but it still cannot merge while the shared required check is red.

This PR follows the F23 third-round unblock rule honestly: it removes one real exception in the same PR instead of silently renewing both.

Original requirement / operator experience:
- Shared main should not keep blocking unrelated work because an old F23 exception silently expired.
- Source: [F023 feature note](../docs/features/F023-directory-corrosion-defense.md)

### Tradeoff
- I did not renew both exceptions. That would clear the gate fast but violate the intended F23 pressure to really split directories.
- I split `config` only; I did not try to split `routes` in the same PR because `routes` is much larger and would expand scope far beyond the blocker.
- I did not claim `packages/api` build is green. The local TypeScript build is still red, but the exact same output is already red on `origin/main`, so this PR does not add a new build regression.

### Open Questions
- Technical OQ: Is this split boundary (`accounts` / `runtime` / `governance`) coherent enough, or should one of these files live elsewhere before merge?
- Technical OQ: Is the renewed `routes` exception date/reason acceptable as a bounded follow-up now that `config` is no longer excepted?
- Value OQ: none.

### Architecture Ownership
- Architecture cell: `packages/api/src/config` layout under ADR-010 / F23 directory-hygiene guard
- Map delta: none
- Why: This is a directory-layout refactor inside the existing config boundary; no new runtime subsystem, store, queue, router, or adapter is introduced.

### Verification
- `scripts/check-dir-size.sh`: PASS (warnings only; no error-threshold directories besides the still-excepted `routes`)
- `packages/api/src/config`: reduced from 33 direct `.ts` files to 24
- `git diff --check`: PASS
- `.dir-exceptions.json` parses cleanly via `JSON.parse(...)`
- `pnpm --dir packages/api run build`: still RED, but matches `origin/main` exactly (`main_exit=2`, `fix_exit=2`, `diff=none`)

### Next Action
Please review PR #11 against the exact SHA above and return `APPROVE` or `REQUEST_CHANGES`.

Review focus:
1. The split actually removes the `config` exception without smuggling behavior changes.
2. The remaining `routes` exception is justified and bounded.
3. The build-parity claim with `origin/main` is sufficient for this shared-baseline unblock PR.
