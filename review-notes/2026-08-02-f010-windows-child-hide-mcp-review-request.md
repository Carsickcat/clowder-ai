# Review Request — F010 Windows direct child console hide

## Scope

Implementation candidate: pending commit on `fix/f010-windows-cli-hide`, parent `a157fff8a14203890f60db1dfd45d7abe144c483`.

Files in scope:

- `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts`
- `packages/api/src/domains/cats/services/agents/providers/l0-compiler.ts`
- `packages/api/src/domains/cats/services/agents/providers/acp/AcpClient.ts`
- `packages/api/src/domains/cats/services/agents/providers/acp/AcpHttpStreamClient.ts`
- their four focused regression tests.

## What / Why

The operator reports that short-lived `node.exe` console windows steal focus while playing games. The prior approved fix hid the shared CLI launcher, but audit found four direct child-process paths outside that boundary: the Codex MCP environment wrapper, L0 compiler, ACP stdio, and ACP HTTP-stream client.

Each existing spawn option object now adds `windowsHide` only when running on Windows. No command, arguments, environment, working directory, stdio pipe, exit handling, or timeout behavior changes.

Architecture cell: `agents/providers process-spawn boundary`. Map delta: none; this is a Windows process-creation flag at existing boundaries, not a router or adapter.

## Evidence

- RED: focused MCP-wrapper, L0, ACP stdio, and ACP HTTP tests each failed because `windowsHide` was absent.
- GREEN: `pnpm --dir packages/api run build` plus the four focused test selections passed.
- `git diff --check` passed.
- `pnpm check` is not green in this isolated historical snapshot: its first Biome phase reports 4,506 pre-existing whole-repository CRLF/formatter errors (including unchanged root config), so it cannot establish a full-suite verdict for this delta.

## Review focus

1. Is every still-relevant Windows direct spawn path in this F010 invocation chain covered without changing Unix behavior?
2. Does `windowsHide` preserve `stdio`, lifecycle, and diagnostics semantics?
3. Is the generated MCP wrapper assertion robust and correctly cleaned up?
4. Any security or provider compatibility regression from this option?

## Runtime boundary

No runtime config or persistent data changes are part of this code review. Deployment, after approval, restarts only isolated API 4311 and sets its `TEMP`/`TMP` to an E-drive runtime directory; 4310, 3013, 3014, Redis data, and routing remain out of scope.

## Requested verdict

Return `APPROVE` or `REQUEST_CHANGES` with P1/P2/P3 findings for the exact implementation commit once supplied.

[山本/gpt-5.6-terra🐾]
