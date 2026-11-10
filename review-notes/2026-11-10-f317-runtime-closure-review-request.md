---
feature_ids: [F317]
doc_kind: review-request
created: 2026-11-10
---

# Review request — F317 runtime closure

Review-Target-ID: `f317`

## What

This batch makes the F317 Atelier delivery runnable through the actual compiled API root and standard Windows web-build command. It hardens the isolated-entrypoint test so it owns all runtime paths and cleanup, adds a full durable user journey across Redis/API restart, fixes post-`turn.completed` subprocess hangs, and makes image uploads decode-validated.

It also fixes two Windows-only cross-package blockers discovered while verifying the product: a Unix-only `rm -rf` clean script and platform-specific path output in the F290 product-copy guard.

## Why

The co-creator's acceptance requirement is a real product, not a page returning 200 or a fixture-only screenshot. The F317 promise is persistent, protected garment versioning and traceable technical flats. Review against `docs/features/F317-atelier-fashion-design-cafe.md`, especially the **Why**, Phase B/C and primary journey.

## Architecture ownership

- Architecture cells: `fashion-design`, `hub-action-surface`
- Map delta: none
- Why: this batch repairs existing composition and operating seams. It adds no competing garment truth, generic UI state, queue or artifact store.

## Evidence

See `review-notes/2026-11-10-f317-runtime-closure-quality-gate.md` for exact commands and outputs:

- API build: pass.
- Fashion suite: 74/74 pass, zero skips.
- Compiled-root durable journey: 7/7 pass, including owned Redis/API restart recovery.
- CLI settlement and Windows shim tests: 112 pass, 12 platform-specific skips.
- Standard Web build: pass; `/atelier` emitted.
- Browser Atelier journey: pass; 26 light/dark state screenshots.

## Review focus

1. Confirm root-entrypoint sandboxing covers every writable path and cleanup cannot touch external processes or user state.
2. Confirm memory mode exposes routes while still making the lack of persistence explicit.
3. Confirm `turn.completed` cannot be swallowed by an open stdout stream or a trailing provider failure.
4. Confirm Windows package-bin execution avoids shell interpolation.
5. Confirm protected part selection, restart recovery and snapshot provenance still match the F317 product boundary.

## Known limitation

The deterministic transport used by the durable test is clearly labelled fixture evidence. Treat a newly executed paid/live model run as a separate evidence class. Full `pnpm check` is blocked by repository-wide CRLF baseline errors outside this diff; focused checks pass.

## Requested verdict

Please independently review the final commit, reproduce the compiled-root test and return `APPROVE` or `REQUEST-CHANGES`, with findings labeled P1/P2/P3.
