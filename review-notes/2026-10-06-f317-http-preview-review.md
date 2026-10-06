---
feature_ids: [F317]
topics: [fashion-design, http, authorization, worker, review]
doc_kind: review
created: 2026-10-06
---

# F317 HTTP and preview execution tranche

Author: 丢丢max/gpt-6-astra
Reviewer: opus/gpt-5.6-terra
Review-Target-ID: f317
Review base / previous localPeerReviewSha: f55eae56fca8c6e3f3c73c89d8e1becbda4d7828
Core approval: message 0001791288051903-000027-fa9f44f0
Checkout: E:/ClowderAI/cat-cafe-f317-fashion-design-cafe

## What / Why

The approved core can now be called through authenticated HTTP routes. Uploading a garment creates a persisted owner-scoped design and source-image records. Reference images are uploaded into that same design. Confirmation, snapshots, restoration and proposal decisions call the existing service, preserving its stale-base and protected-drift guards.

The operator requested uploading a garment, editing only selected parts, receiving previews, and obtaining a confirmed flat. This batch implements the API boundary and asynchronous preview execution mechanism. The reviewer explicitly requested this next tranche in the above message. It does not claim completion of the full user journey.

HTTP: multipart `POST /api/fashion-designs` takes `threadId`, `title` and image files named `front`, `back`, `left-side`, `right-side`; reference upload takes one file named `reference`. JSON mutation bodies are strict. Identity comes from the existing direct-local authorization resolver; body identity and unauthenticated browser headers cannot override it. Every design access also checks literal thread ownership. Remote unpaired identities remain unsupported by this resolver.

API-root registration requires Redis, so an in-memory fallback cannot silently lose uploaded work. The existing upload utility supplies MIME/size/storage behavior; the fashion boundary adds matching PNG/JPEG/GIF/WebP signatures before saving any files. Asset URLs and IDs are server-generated and persisted in the design. No arbitrary source/reference URL or path is accepted. The shared `/uploads/` serving policy is unchanged.

## Async state contract

| State/action | Behavior |
|---|---|
| POST proposal | Validate owner/reference; persist proposal; return 202 with proposalId/operationId/status; schedule worker |
| Duplicate admission | Same intent/key returns same proposal; local pending map deduplicates; CAS claim prevents a second worker from calling provider |
| Claim | Queued → generating with persisted token/expiry; only current operation can claim |
| Completion | Operation and lease token/expiry must match; canonical core validation creates candidate; active version stays unchanged |
| Failure/timeout | Persist safe failure code; raw provider errors only go to diagnostic callback; failed attempt remains retryable |
| Process interruption | Receipt/lease survives Redis restart; queued work resumes on repeated admission/retry; expired running attempt gets a fresh operation on retry |
| Late prior completion | Ignored after retry; never settles the new attempt |
| Missing provider | 503 before admitting work; no unattended queued request is created |

The worker accepts an injected `FashionPreviewProvider`; it does not select an external model or expose completion to browser clients. The current API root deliberately supplies no concrete provider, so generation returns `preview_provider_unavailable`. Real analysis, image editing/mask, F172/F232 publication, SVG and Atelier UI remain implementation work. There is no startup sweep or automatic paid replay of expired work.

## Validation

Red evidence: the first seven HTTP tests failed against absent routes; the first four worker tests failed against absent worker behavior, and the aggregate-capacity regression failed because an oversized write succeeded. They pass after implementation. Additional integration coverage checks real session cookies, async 202/polling, duplicate admission, instance-drift 409, reference ownership, and persisted lease recovery through a real Redis restart.

Commands from checkout:

```powershell
pnpm --filter @cat-cafe/shared build
pnpm --dir packages/api exec tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck src/domains/fashion/FashionDesignService.ts src/domains/fashion/FashionDesignStore.ts src/domains/fashion/FashionPreviewWorker.ts src/routes/fashion-designs.ts src/routes/fashion-images.ts
pnpm exec biome check packages/shared/src/fashion packages/api/src/domains/fashion packages/api/src/routes/fashion-designs.ts packages/api/src/routes/fashion-images.ts packages/api/src/index.ts packages/api/test/fashion --diagnostic-level=error
git diff --check
```

From `packages/api`:

```powershell
$env:FASHION_REDIS_TEST='1'
node --import tsx --test test/fashion/*.test.ts
```

Observed: **41 tests passed, 0 failed, 0 skipped**, including Redis restart recovery of an expired worker lease and rejection of its late completion. Shared build, strict TypeScript for changed domain/routes, Biome and diff checks passed. Test providers are controlled fixtures, not evidence of real model output. Fastify injection exercises actual routes/service/worker; the suite owns only its isolated Redis 6398 process. No production service was started, queried or modified.

Repository-wide limitations: `pnpm check:architecture-ownership` is absent from this baseline's package scripts. `node scripts/check-feature-truth.mjs` reports 108 backlog/index references absent from the sparse checkout (for example F038 is tracked with skip-worktree and its document is not present). These are not passing gates; this batch does not claim full-repository `pnpm gate`, a booted full API server, or merge readiness. The changed ownership anchors are included for semantic review.

Fallback scan against f55eae5: net +12 pattern matches, triggering the mechanical threshold. Eight are boolean validation/identity/lease guards; one supplies the worker timeout default; one projects an absent validation as null. The two worker catches have distinct jobs: persist provider/timeout failure, and contain a background store/claim failure for diagnostics. They do not retry a different provider, invent results, or fall back to volatile persistence. The state model remains one proposal/operation/lease; removing these guards or the background rejection handler would weaken isolation or leave unhandled promises. No nested provider failover chain was introduced.

## Tradeoff / Open / Next

Architecture cell: `fashion-design`; updated anchors include HTTP, uploads and the worker. No additional queue truth store. Writes above 16 MiB fail with 413 and preserve history; this limits aggregate growth without deleting or expiring user records. File writes and Redis commits are not transactional: a failed metadata commit can retain an orphan file, never a claimed successful design. No cleanup/deletion is introduced.

Please review this delta for identity/thread/asset boundaries, lease races, HTTP core invariant propagation and request-size behavior. Core approval covers only f55eae5; this behavioral delta needs fresh local approval. No PR/merge/full-feature completion is claimed. The next product work is the real model/analysis and publication adapter, followed by SVG/UI on the established API.

[丢丢max/gpt-6-astra🐾]
