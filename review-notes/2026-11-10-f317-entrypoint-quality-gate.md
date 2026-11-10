---
feature_ids: [F317]
doc_kind: quality-gate
created: 2026-11-10
---

# F317 real-entrypoint quality gate

## Scope

This is an implementation sub-batch, not a claim that the whole F317 feature is complete. It repairs the actual API composition root and proves the declared storage modes against a real `dist/index.js` process:

- Fashion routes are registered in explicit `MEMORY_STORE=1` mode and warn that state is transient.
- Redis remains the formal durable mode. An actual API upload survives an owned Redis and API restart.
- The test harness is hermetic: it owns its loopback Redis, dynamic port, child processes, user/config/data paths and cleanup, and never inherits production Redis or workspace state.
- The startup path no longer assumes `process.cwd()` is the source checkout when loading the shipped F247 installer module.

## Vision and acceptance alignment

Original product requirement: the F317 user journey ends with artifacts and version history that remain available after refresh/restart; Garment DNA is domain truth, not a route-dependent or display-only projection. Source: `docs/features/F317-atelier-fashion-design-cafe.md` — Why, Phase B item 8, AC-A1 and AC-B8.

| Requirement | Evidence |
|---|---|
| Actual application entry exposes the declared fashion HTTP contract | `fashion-startup-entrypoint.test.ts`: memory mode receives domain `404 not_found` for a missing design rather than framework-route `404` |
| Formal durable runtime persists user-scoped uploaded design after restart | Same test creates a real thread, uploads a PNG, calls Redis `SAVE`, restarts owned Redis and API, then reads the same design through HTTP |
| Memory mode does not masquerade as durable | `packages/api/src/index.ts` emits explicit degraded-storage warning; ownership cell documents the boundary |
| Startup/cleanup cannot write user data or leak children after failure | The test whitelists OS environment values, redirects every discovered data/home/config path into its sandbox, disables the global sidecar by both relevant flags, and checks startup-failure cleanup |

## Architecture ownership

- Architecture cell: `fashion-design`
- Map delta: updated `docs/architecture/ownership/cells/fashion-design.md`
- Why: no new domain store/queue/adapter was introduced. The API composition root now chooses the existing Redis store or existing memory store explicitly, while the cell records the durable-vs-degraded contract.

## Dogfood-your-slice

Required: yes — this changes a user-visible REST entry path.

Fresh end-to-end evidence from an isolated actual application process:

```text
node --import tsx --test test/fashion/fashion-startup-entrypoint.test.ts
pass 3, fail 0

persists an uploaded design through actual API and owned Redis restarts
```

The path is `POST /api/threads` -> multipart `POST /api/fashion-designs` -> Redis `SAVE` -> owned Redis/API restart -> `GET /api/fashion-designs/:id`.

## Verification evidence

```text
$env:FASHION_REDIS_TEST='1'
node --import tsx --test <all packages/api/test/fashion/*.test.ts>
tests 70, pass 70, fail 0, skip 0

pnpm exec tsc --noEmit
exit 0

pnpm exec biome check test/fashion/fashion-startup-entrypoint.test.ts
Checked 1 file, no fixes applied
```

`pnpm check` was run fresh and is blocked before F317 checks by a baseline Windows portability defect: `packages/collective-client` runs `rm -rf dist`; `rm` is unavailable in this PowerShell environment. `git show ed24bfa:packages/collective-client/package.json` confirms the same script is present at the branch base. This is reported, not attributed to F317.

`pnpm check:features` is also blocked by this sparse checkout's missing feature-index documents (108 pre-existing `ROADMAP` references; F317 is not among the reported missing IDs). `pnpm check:capability-tips` passes, with pre-existing missing-source warnings caused by the same sparse documentation set.

## Hygiene

- `git diff --check`: passed.
- Root-level media/design artifact scans: no matches.
- No production Redis 6399, existing API process, workspace, user home or global CLI configuration was used or modified by the tests.
- No UI files changed in this sub-batch, so no `.pen` or browser screenshot comparison applies.

## Review focus

1. Verify all startup-test paths and cleanup actions are confined to the per-test sandbox.
2. Verify Redis persistence is tested through the actual API composition root, rather than an injected fixture route.
3. Verify the F247 module resolution change is deployable outside a source-checkout CWD.
