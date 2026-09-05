---
feature_ids: [GPT6_ASTRA_CAT]
topics: [cat-roster, gpt-6-astra, runtime-catalog, rereview]
doc_kind: review_request
created: 2026-09-06
---

# Re-review Request: GPT-6 Astra runtime catalog upgrade

Review-Target-ID: gpt6-astra-cat-catalog-upgrade
Branch: `feat/gpt6-astra-cat`
Code SHA: `4ef67b6ba06de79bffc10e59a54791015815f88e`
Previous reviewed SHA: `85462ac9c0047371485ff07c133a3a87eef3be4f`

## What

- Existing `.cat-cafe/cat-catalog.json` files now receive missing seed breeds and variants during catalog bootstrap.
- The migration is append-only by resolved `catId`: it preserves existing breed fields, variants, accounts, roster entries, and runtime edits.
- Roster metadata is copied only for seed cats added by this migration; existing entries remain authoritative.
- Added an exact startup regression through `bootstrapDefaultCatCatalog()` plus a store-level regression covering both a new breed and a new variant in an existing breed.

## Why

An existing installation previously treated its persisted catalog as complete. After upgrading to a release that ships `gpt6`, startup continued to expose the old catalog, so `gpt6` was absent from the registry and API even though the new template contained it.

## Tradeoff

Seed removals and edits are not forced onto existing catalogs. This migration restores only newly shipped seed identities, preserving user-owned runtime state and avoiding a destructive catalog replacement.

## Open Questions

None for this finding.

## Verification Evidence

- Red: the store regression failed because the persisted runtime catalog did not contain the new `silver-chinchilla` breed.
- Green:
  - `cat-config-loader.test.js`: 69/69
  - `cat-catalog-store.test.js`: 19/19
  - `cat-account-binding.test.js`: 4/4
  - `account-startup.test.js`: 7/7
  - `cats-routes-runtime-catalog.test.js`: 6/6
  - `cats-routes-runtime-crud.test.js`: 25/25
- Complete workspace build passed for shared, API, MCP, and Web.
- `pnpm check:features` passed (`features=152`, `roadmap_active=42`).
- Affected-file Biome check passed with only five pre-existing warnings in `cat-catalog-store.ts`; no new warning or error was introduced.
- `git diff --check` passed and the author worktree was clean after the code commit.

## Failure-mode Audit

Both known runtime paths that depend on bootstrap are covered: startup via `bootstrapDefaultCatCatalog()` and catalog-backed API/CRUD reads via `bootstrapCatCatalog()`. A host-injected `CAT_CAFE_CONFIG_ROOT` initially redirected route tests to the development runtime; after clearing that external test contaminant, both route suites passed in isolated temporary roots.

## Next Action

Review only `85462ac..4ef67b6` and reply with `APPROVE — 4ef67b6` or `REQUEST CHANGES` with severity and a minimal reproduction.

[丢丢/gpt-5.6-sol🐾]
