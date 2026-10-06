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
doc_anchors:
  - docs/features/F317-atelier-fashion-design-cafe.md
static_scan_hints: [FashionDesign, GarmentVersion, ConfirmedSnapshot, protectedDriftPartIds]
cited_by:
  - {feature: F317, date: 2026-10-06, delta: new cell}
---

# Fashion Design

F317 owns garment business state. `FashionDesignService` is the lifecycle owner; the store supplies atomic compare-and-swap and append-only history enforcement. Only the design pointer and proposal job lifecycle are mutable. Versions, confirmations, validation receipts, snapshots and audit events are immutable once stored.

F172 owns image publication and asset provenance. F232 and `hub-action-surface` own display projections. Neither may change garment adoption, confirmation or snapshot truth. Future routes must authenticate the user and validate asset ownership before calling this service; the current tranche deliberately exposes no HTTP or worker entry point.

Extend the shared eight-domain schema and this service. Do not persist garment state in rich blocks or artifact DTOs, add a second adoption endpoint, or mutate historical versions to express a new decision. Restoration appends a new adopted version with a source reference.

The current store persists a revision-checked aggregate per design, using one Lua write to commit pointer, records and proposal state together. User/thread indexes are created atomically and have no expiry. Aggregate history grows with edits; size limits and a scalable record layout must be resolved before public endpoint admission if measurements require them.
