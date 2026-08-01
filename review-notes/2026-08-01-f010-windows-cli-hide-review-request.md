# F010 Windows CLI Window Suppression — Review Request

Review-Target-ID: f010-windows-cli-hide
Branch: `fix/f010-windows-cli-hide`
Implementation target: `a157fff8a14203890f60db1dfd45d7abe144c483`

## What

The shared Windows path in `packages/api/src/utils/cli-spawn.ts` now passes
`windowsHide: true` to Node's child-process spawn call. The option covers both
resolved CLI shims and the `shell: true` fallback. A regression test injects a
Windows spawn function and asserts the option is present.

## Original Requirement

The operator reported that `node.exe` consoles repeatedly appeared during an
ongoing 8443 conversation and asked whether more had appeared. Investigation
identified the visible window as a child CLI process launched by the F010 API;
the requested outcome is that the isolated 8443 runtime remains usable without
interrupting desktop use or games.

## Why

The runtime used the generic `spawnCli` boundary for agent invocations. On
Windows, that boundary did not request hidden child windows, so every supported
agent CLI could create a visible console.

## Architecture Ownership

- Architecture cell: existing API CLI process-spawn utility.
- Map delta: none.
- Why: this is a process-launch option at the existing shared boundary; it adds
  no store, queue, router, adapter, dispatcher, or persistence path.

## Tradeoff

Only Windows child windows are hidden. Stdout, stderr, exit handling, timeout,
and CLI shim resolution remain unchanged. The change does not suppress error
capture or alter agent execution.

## Verification Evidence

- RED: the new assertion failed with `windowsHide === undefined` before the
  implementation option was added.
- GREEN: `pnpm --filter @cat-cafe/api build` completed successfully.
- `node --test test/cli-spawn.test.js` under Git Bash: 76 pass, 0 fail,
  4 platform skips.
- `node --test test/cli-spawn-win.test.js`: 29 pass, 0 fail, 5 Unix-only skips.
- `pnpm exec biome check --formatter-enabled=false src/utils/cli-spawn.ts
  test/cli-spawn.test.js`: 0 errors; 4 existing source warnings and 20 existing
  test infos.
- `git diff --check`: clean before commit. No root-level media/design artifacts.
- Full `pnpm check` remains blocked before scope checks by this F010 snapshot's
  pre-existing CRLF formatter baseline (4,506 errors across 4,509 files,
  including unchanged root configuration); no formatter rewrite was included.

## Review Focus

1. Confirm `windowsHide: true` is set on every Windows shared-spawn path,
   including `shell: true` fallback.
2. Confirm the test seam cannot change normal Unix or production behavior.
3. Check that error observability and CLI timeout/stream behavior are preserved.
4. Report an explicit `APPROVE` or `REQUEST_CHANGES` with P1/P2/P3 counts.

## Open Questions

- Technical: none known; deployment requires a controlled restart of only F010
  API 4311 after approval.
- Value: none.
