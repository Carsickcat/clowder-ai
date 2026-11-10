---
feature_ids: [F317]
doc_kind: quality-gate
created: 2026-11-10
---

# F317 runtime-closure quality gate

## Scope and product alignment

This batch closes the gap between an Atelier page that renders and a product that can be used through the compiled API entrypoint.

The original requirement is a trustworthy garment-design loop: upload a garment image, inspect and confirm its visible structure, change only selected parts, block protected drift, adopt or restore a version, then export SVG/PNG from a frozen `ConfirmedSnapshot`; history must survive refresh and restart. See `docs/features/F317-atelier-fashion-design-cafe.md`, **Why**, Phase B/C and the primary user journey.

The implementation and its fresh evidence cover:

| Requirement | Fresh evidence |
| --- | --- |
| Actual application root exposes F317 routes in both declared storage modes | `fashion-startup-entrypoint.test.ts`, compiled `dist/index.js`, 7/7 pass |
| Durable user-visible state survives restart | Same test runs upload → analysis → confirmation → single-pocket preview → adoption → restore → snapshot → SVG/PNG, saves owned Redis, then restarts Redis and API and reads the exact design/snapshot/flat back |
| Memory mode is explicitly degraded, not a route-level 404 | Same root-entrypoint test asserts a routed domain response with no inherited runtime state |
| Startup test cannot touch user data or global CLI configuration | Environment allowlist, every discovered database/home/config/data path sandboxed, both sidecar suppressors asserted, cleanup registered before setup/spawn |
| Model semantic completion cannot leave an invocation running indefinitely | `cli-spawn` regression holds stdout open after `turn.completed`; bounded grace cleanup completes deterministically |
| Windows can run the standard web build command | `run-preserving-signal-exit` resolves a local package Node shim without a command shell; `pnpm --filter @cat-cafe/web build` passes |
| User-visible Atelier flow remains usable | Chrome browser journey passes through golden path, drift, failure, conflict, missing-back and mobile states; 26 light/dark screenshots |

## Architecture ownership

- Architecture cells: `fashion-design`, `hub-action-surface`
- Map delta: none in this batch; existing anchors remain authoritative.
- Why: no parallel fashion state, queue, renderer or surface was added. The work fixes composition, sandboxing, subprocess settlement, upload validation and Windows build execution around the existing canonical anchors.

## Verification

Fresh commands run from `E:/ClowderAI/cat-cafe-f317-fashion-design-cafe`:

```powershell
pnpm --filter @cat-cafe/api build
# pass

$env:FASHION_REDIS_TEST='1'
node --import tsx --test test/fashion/fashion-startup-entrypoint.test.ts
# 7 pass, 0 fail, 0 skip

node --import tsx --test test/fashion/*.test.ts
# 74 pass, 0 fail, 0 skip

node --test test/cli-spawn.test.js test/cli-spawn-win.test.js test/startup-cli-config.test.js scripts/run-preserving-signal-exit.test.mjs
# 112 pass, 0 fail, 12 Unix-only skip

pnpm --filter @cat-cafe/web build
# pass; /atelier appears in the generated route table

$env:FASHION_BROWSER_CHANNEL='chrome'
node --import tsx --test --test-concurrency=1 test/browser/f317-atelier.test.mjs
# pass; 26 screenshots
```

Focused TypeScript, Biome and whitespace checks pass. Root-level media/design-artifact scans are empty.

## Evidence boundary

The entrypoint integration test uses an **isolated deterministic Codex transport fixture** for repeatable analysis/preview results. It exercises the real compiled routes, authorization, workers, Redis store, F172/F232 publication and SVG renderer, but it is not a new paid/live-model claim. The prior native-provider evidence remains historical; a new live-model run has not been represented as a fixture result.

## Known gate limitation

`pnpm check` now gets past the Windows `rm -rf` and F290 path-separator failures fixed in this batch. It then stops at `pnpm biome check .` because the repository baseline contains CRLF-formatted configuration/source files; Biome reports 7,688 formatting errors outside this diff. This batch's changed-file Biome check passes. Reformatting the whole repository is intentionally out of scope and was not performed.

## Delivery entry

The managed persistent entry remains `pnpm start` from the repository root. It must run with the normal managed Redis configuration (`REDIS_URL`); `MEMORY_STORE=1` is only an explicitly warned, non-durable degraded mode. No service was restarted or pointed at user data during this verification.
