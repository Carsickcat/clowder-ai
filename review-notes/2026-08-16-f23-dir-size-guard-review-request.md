# Review Request: F23 Shared Main Dir-Size Unblock

Review-Target-ID: `f23-dir-size-guard`
Branch: `fix/f23-dir-size-guard`
PR: https://github.com/Carsickcat/clowder-ai/pull/11
Target commit: exact PR head supplied in the A2A handoff
Primary behavior delta: `d17a5fca4f6396e9a331bdeca40b64f73738a316` (`fix(f23): split config modules under dir-size threshold`)

## What

- Split `packages/api/src/config` into `config/accounts`, `config/runtime`, and `config/governance`.
- Updated source and test import paths for the moved modules.
- Removed the expired `packages/api/src/config` directory-size exception.
- Kept only `packages/api/src/routes` as a time-bound F23 exception.

## Why

Shared `main` was blocked by `Directory Size Guard`: both `packages/api/src/config` and `packages/api/src/routes` exceptions expired on August 15, 2026. PR #10 does not touch those directories, but it still cannot merge while the shared required check is red.

This PR follows the F23 unblock rule honestly: it removes one real exception in the same PR instead of silently renewing both.

## Original Requirements（必填）

> Shared main should not keep blocking unrelated work because an old F23 exception silently expired.

- 来源：[`docs/features/F023-directory-corrosion-defense.md`](../docs/features/F023-directory-corrosion-defense.md)
- 请对照上面的体验判断：这次交付是否真实移除了一个过期 exception，并把 shared-main unblock 建在真实拆分上，而不是续签两个例外。

## Tradeoff

- I did not renew both exceptions. That would clear the gate fast but violate the intended F23 pressure to really split directories.
- I split `config` only; I did not try to split `routes` in the same PR because `routes` is much larger and would expand scope far beyond the blocker.
- I did not claim `packages/api` build is green. The local TypeScript build is still red, but the exact same output is already red on `origin/main`, so this PR does not add a new build regression.

## Architecture Ownership（必填）

Architecture cell: `packages/api/src/config` layout under ADR-010 / F23 directory-hygiene guard  
Map delta: none  
Why: This is a directory-layout refactor inside the existing config boundary; no new runtime subsystem, store, queue, router, or adapter is introduced.

请 reviewer 检查：

- diff 是否与 `Map delta: none` 一致；
- 模块下沉是否只是目录卫生重排，而没有夹带新的运行时行为变化；
- 剩余 `routes` exception 的 reason / expiry 是否仍是有界 follow-up，而不是重新把 F23 gate 变成永久豁免。

## Open Questions

### 技术 OQ（给 reviewer）

1. Is this split boundary (`accounts` / `runtime` / `governance`) coherent enough, or should one of these files live elsewhere before merge?
2. Is the renewed `routes` exception date/reason acceptable as a bounded follow-up now that `config` is no longer excepted?
3. Is the build-parity claim with `origin/main` sufficient for this shared-baseline unblock PR?

### 价值 OQ（给 operator）

无。

## Next Action

Please review PR #11 against the exact PR head supplied in the handoff and return `APPROVE` or `REQUEST_CHANGES`.

Review focus:

1. The split actually removes the `config` exception without smuggling behavior changes.
2. The remaining `routes` exception is justified and bounded.
3. The build-parity claim with `origin/main` is sufficient for this shared-baseline unblock PR.

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f23-dir-size-guard/{reviewer-handle}`
- Start Command: `pnpm check:dir-size`
- Ports: none（backend-only directory-hygiene refactor; no dev server）
- Repo root: `E:/ClowderAI/cat-cafe-f23-dir-size-guard`
- Additional parity check: `pnpm --dir packages/api run build` and compare stderr against `origin/main`

## 自检证据

### Spec 合规

- Scope stayed on the F23 shared-baseline unblock only; this PR does not pretend to finish the larger `routes` cleanup.
- `.dir-exceptions.json` now contains only `packages/api/src/routes`, with a bounded F23 follow-up reason and a September 30, 2026 expiry.
- `packages/api/src/config` no longer requires a directory-size exception.

### 测试结果

在仓库根目录运行：

```powershell
pnpm check:dir-size
git diff --check
node -e "JSON.parse(require('fs').readFileSync('.dir-exceptions.json','utf8')); console.log('json_ok')"
pnpm --dir packages/api run build
```

作者本轮结果：

- `pnpm check:dir-size`: PASS（warnings only；only `routes` remains excepted）
- `git diff --check`: PASS
- `.dir-exceptions.json`: parses cleanly
- `packages/api/src/config`: reduced from 33 direct `.ts` files to 24
- `pnpm --dir packages/api run build`: still RED, but previous parity check matched `origin/main` exactly (`main_exit=2`, `fix_exit=2`, `diff=none`)

[宪宪/gpt-5.4🐾]
