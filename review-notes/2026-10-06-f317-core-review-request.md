---
feature_ids: [F317]
topics: [fashion-design, review, persistence, versioning]
doc_kind: review
created: 2026-10-06
---

# F317 core lifecycle review request

Author: 银渐层/丢丢max, gpt-6-astra
Reviewer: 英短猫/山本, gpt-5.6-terra
Review-Target-ID: f317
Branch: feat/f317-fashion-design-cafe
Base: 25b129ddc995217fe72b7d66594500179aa874b3
Checkout: E:/ClowderAI/cat-cafe-f317-fashion-design-cafe

## What / Why

This first core tranche turns the frozen product contract into runtime schemas, a revision-checked service, memory/Redis stores, and executable lifecycle tests. It prevents previews from replacing the adopted design, rejects protected drift, preserves unchanged confirmations, and freezes snapshots independently of later edits or restoration.

Original requirement: co-creator messages `0001789301160040-000018-9af87672` and `0001791278223205-000003-74b52d8f`.

> 每次替换都生成预览图展示。
> 核心代码由gpt6编写。
> 不要做太多轮的验证，聚焦产品功能的实现即可。

Spec: `docs/features/F317-atelier-fashion-design-cafe.md`. Review against its single-domain protection, immutable history, factual provenance and snapshot invariants. This is a core review, not full feature acceptance.

## Tradeoff / Architecture

Architecture cell: `fashion-design`; UI will consume through `hub-action-surface`.
Map delta: new cell required — included in this diff.
Why: F172/F232 are asset publication/display owners, not garment state owners.

A design is one CAS aggregate, keeping pointer, confirmations, versions and audit in the same commit. This avoids multi-key partial writes. It also rewrites growing history; public API admission limits and scale measurements remain necessary before exposing unbounded workloads. Stores receive a Redis client, never choose a production URL.

## State transitions and invariants

| Object | Events and transitions | Enforcement / evidence |
|---|---|---|
| Design | create revision 0; each committed mutation increments revision; active points only to adopted | CAS contention test; owner-scoped get/list |
| Version | analyzed draft; preview creates candidate; confirm/accept/restore append adopted; reject appends discarded | historical objects never change; restore is new ID |
| Proposal | queued → generating → ready/failed; failed → queued with new operation ID; ready → accepted/rejected | same intent/key deduplicates; different intent/key conflicts; late old operation cannot settle a retry |
| Confirmation | appended on explicit confirmation or changed target adoption | part ID/hash/source version binding; unchanged parts reuse records |
| Snapshot | explicit freeze on valid confirmed view; immutable thereafter | rejects missing back evidence or unconfirmed required parts; retains exact prior content after restore |
| Store/index | create atomically; CAS whole aggregate; TTL=0 | real Redis, key-prefix test, single winner, restart round-trip |

INV-1: User scope is checked before reads/mutations. INV-2: All immutable maps and audit prefixes remain append-only. INV-3: A stale base never silently rebases. INV-4: Candidate target patches cannot mutate non-target domains. INV-5: Protected visual drift blocks adoption. INV-6: Source provenance cannot be relabeled as photo after a designer-directed edit. INV-7: Late preview work only settles its own current operation. INV-8: Persisted state has no expiry.

## Current validation

Run from `packages/api` in the above checkout (PowerShell):

```powershell
$env:FASHION_REDIS_TEST='1'
node --import tsx --test test/fashion/fashion-contract.test.ts test/fashion/fashion-hash.test.ts test/fashion/fashion-service.test.ts test/fashion/fashion-redis.test.ts
```

Observed: **15 tests, 15 pass, 0 fail, 0 skip**. Redis test starts its own process on unused dev port 6398, database 15 and a fresh temporary directory; it refuses to attach to an existing listener and shuts down only its own process. A saved RDB is retained for diagnosis; no delete/flush operation is used.

Additional commands:

```powershell
pnpm --filter @cat-cafe/shared build
pnpm --dir packages/api exec tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck src/domains/fashion/FashionDesignService.ts src/domains/fashion/FashionDesignStore.ts src/domains/fashion/fashion-invariants.ts src/domains/fashion/fashion-confirmation.ts src/domains/fashion/fashion-preview.ts
pnpm exec biome check packages/shared/src/fashion packages/shared/src/index.ts packages/api/src/domains/fashion packages/api/test/fashion --diagnostic-level=error
git diff --check
```

Scope follows the operator's request for focused verification and terra's latest instruction to deliver a core verdict before UI/SVG expansion. No full-repository gate, browser demo or full-feature completion is claimed. Internal domain slice: UI dogfood/tip contribution is deferred until the UI/route tranche; no user-visible entry is added here.

## Red → green evidence

The original schema tests failed 3/3 before the contract existed; lifecycle tests failed 9/9 before the service existed. This turn's first real service run was 11/12: duplicate intent comparison constructed an absent optional property as `undefined`, which canonical JSON rejected. A focused hash regression failed, then passed after object-property omission was aligned with JSON persistence (arrays and invalid numbers still reject).

A further regression proved that re-confirming an adopted generated sleeve could relabel it as original photo evidence. The service now rejects this as `new_photo_required`; supplying text alone never changes visibility.

## Open / Next

No product decision is pending. Please review the core state machine and CAS/provenance invariants, especially retry freshness, immutable confirmation reuse and snapshot omission rules. Return P1/P2 findings to the author.

Not implemented in this tranche: upload ownership/MIME checks, HTTP/worker entry points, actual model analysis/image editing, mask/drift provider, SVG/PNG renderer/publication, supplementary view workflow, and Atelier UI. The task remains doing. The schemas and core APIs are foundations for those remaining paths, not an operational product demo.

[丢丢max/gpt-6-astra🐾]
