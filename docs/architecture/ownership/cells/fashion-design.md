---
feature_ids: [F317]
topics: [fashion-design, domain-ownership, persistence]
doc_kind: reference
created: 2026-10-06
cell_id: fashion-design
title: Fashion Design
summary: Garment structure, immutable version and confirmation lineage, proposal lifecycle, and frozen snapshot business truth.
canonical_features: [F317]
code_anchors:
  - packages/shared/src/fashion/schema.ts
  - packages/shared/src/fashion/types.ts
  - packages/api/src/domains/fashion/FashionDesignService.ts
  - packages/api/src/domains/fashion/FashionDesignStore.ts
  - packages/api/src/domains/fashion/fashion-confirmation.ts
  - packages/api/src/domains/fashion/fashion-preview.ts
  - packages/api/src/domains/fashion/FashionPreviewWorker.ts
  - packages/api/src/domains/fashion/FashionAgentProvider.ts
  - packages/api/src/domains/fashion/fashion-model-images.ts
  - packages/api/src/domains/fashion/fashion-pipeline.ts
  - packages/api/src/routes/fashion-designs.ts
  - packages/api/src/routes/fashion-images.ts
doc_anchors:
  - docs/features/F317-atelier-fashion-design-cafe.md
static_scan_hints: [FashionDesign, GarmentVersion, ConfirmedSnapshot, protectedDriftPartIds]
cited_by:
  - {feature: F317, date: 2026-10-06, delta: new cell}
---

# Fashion Design

F317 owns garment business state. `FashionDesignService` is the lifecycle owner; the store supplies atomic compare-and-swap and append-only history enforcement. Only the design pointer and proposal job lifecycle are mutable. Versions, confirmations, validation receipts, snapshots and audit events are immutable once stored.

F172 owns image publication and asset provenance. F232 and `hub-action-surface` own display projections. Neither may change garment adoption, confirmation or snapshot truth. Fashion HTTP routes use the existing direct-local authorization resolver and verify thread ownership on every access. Multipart uploads create design-owned source/reference asset records; callers cannot nominate arbitrary file paths. The API root registers these routes only when persistent Redis is available.

Extend the shared eight-domain schema and this service. Do not persist garment state in rich blocks or artifact DTOs, add a second adoption endpoint, or mutate historical versions to express a new decision. Restoration appends a new adopted version with a source reference.

The current store persists a revision-checked aggregate per design, using one Lua write to commit pointer, records and proposal state together. User/thread indexes are created atomically and have no expiry. Aggregate writes exceeding 16 MiB are rejected atomically; no automatic history deletion or expiry is used.

`FashionPreviewWorker` owns asynchronous provider execution. Proposal operation IDs and expiring CAS worker leases fence duplicate/late completions. Queued work can be resumed by repeating admission or retry; interrupted running work can be retried after its lease expires. The worker does not scan all users on startup. This is a domain provider boundary, not a second job truth store.

`FashionAgentProvider` consumes complete Codex exec-json turns through the registered AgentService and requires its enforced read-only policy (no inherited MCP/apps). Each invocation reads only staged garment images in an isolated temporary Git workspace. Source image analysis returns an unconfirmed draft through the authorized HTTP analysis endpoint. The current preview path requires selected visible front polygons; host composition preserves all pixels outside the raster mask, then a separate vision call inspects the final composite. Domain canonical diff and adoption guards remain in FashionDesignService. Missing compatible providers fail admission with 503.

`fashion-pipeline.ts` composes the registered provider, worker, ownership checks and F172/F232 publication at API root. The candidate and its owned image/publication metadata commit together. That durable candidate is the publication outbox: polling or repeating admission replays `MessageStore.appendIdempotent` under a stable design/proposal key. Cross-thread ownership changes prevent completion/publication. Neither the model nor a rich block can select the active version.
