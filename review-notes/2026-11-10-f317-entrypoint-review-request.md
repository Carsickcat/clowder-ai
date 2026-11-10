---
feature_ids: [F317]
doc_kind: review-request
created: 2026-11-10
---

# Review request — F317 real application entrypoint

Review-Target-ID: `f317`
Branch: `feat/f317-fashion-design-cafe`
Target SHA: `f95f62146ac0d8fddaa610db9dcc027db80e0912`

## What

This batch fixes the F317 API composition root: fashion routes are now registered in both supported storage modes. Redis remains the durable runtime; explicit `MEMORY_STORE=1` is a transient, warned degraded mode rather than a framework-level 404. It also adds an actual-index test that creates an isolated Redis, starts `packages/api/dist/index.js`, creates a thread, uploads a fashion image, restarts Redis and the API, and retrieves the same design through HTTP.

## Why

The co-creator found that the browser could load while the real API returned `Route GET ... not found` in memory mode. This violated the stated route contract and made fixture-only tests misleading. The original F317 product requirement is a trustworthy design history that survives refresh/restart; source: `docs/features/F317-atelier-fashion-design-cafe.md` (Why, Phase B item 8, AC-A1, AC-B8).

## Architecture ownership

- Architecture cell: `fashion-design`
- Map delta: updated
- Why: the change composes existing `RedisFashionDesignStore` and `MemoryFashionDesignStore`; it creates no parallel business store, queue, router or provider. The ownership cell now records the durable/degraded boundary.

## Evidence

Fresh commands and results:

```powershell
$env:FASHION_REDIS_TEST='1'
node --import tsx --test test/fashion/fashion-startup-entrypoint.test.ts
# 3 pass, 0 fail

$tests = Get-ChildItem test/fashion -Filter '*.test.ts' | Sort-Object Name | ForEach-Object FullName
node --import tsx --test $tests
# 70 pass, 0 fail, 0 skip

pnpm exec tsc --noEmit
# exit 0

pnpm exec biome check test/fashion/fashion-startup-entrypoint.test.ts
# clean
```

The complete self-check is in `review-notes/2026-11-10-f317-entrypoint-quality-gate.md`.

## Known non-F317 gate limits

- `pnpm check` fails before F317 checks because the pre-existing `packages/collective-client` Windows script uses `rm -rf dist`; the identical line exists at `ed24bfa`.
- `pnpm check:features` reports 108 missing feature-index references from this sparse checkout; F317 is not among them.

## Review focus

1. Confirm the actual test process cannot inherit production Redis, workspace, home/config or agent-key sidecar paths.
2. Confirm cleanup covers both successful and failed startup without touching non-owned processes.
3. Confirm `new URL('../scripts/...', import.meta.url)` is the correct runtime location for the shipped F247 module.
4. Confirm memory-mode route availability cannot be mistaken for durable persistence.

## Requested verdict

Please independently inspect and run the isolated entrypoint test. Return `APPROVE` or `REQUEST-CHANGES` with P1/P2/P3 findings tied to `f95f621`.
