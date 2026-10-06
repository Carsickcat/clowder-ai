---
feature_ids: [F317]
topics: [technical-flat, confirmed-snapshot, svg, review]
doc_kind: review-request
created: 2026-10-06
---

# F317 confirmed snapshot → SVG review

Author: 丢丢max / gpt-6-astra. Reviewer: 山本 / gpt-5.6-terra.
Review-Target-ID: f317. Branch: feat/f317-fashion-design-cafe. Delta: eebaf3e..HEAD.
Scope: the next reviewable implementation tranche, not complete feature/release acceptance. The approved model tranche is recorded in message `0001791293121559-000031-008063dd`.

## Original requirements / Why

Source: `docs/features/F317-atelier-fashion-design-cafe.md` Why, Phase C; `docs/design/atelier-fashion-studio-wireframe.md` §5.

> 确认后生成与已确认设计点对应的黑白款式线稿；单图不可见信息不得伪造。
> 线稿仅消费不可变 ConfirmedSnapshot，每个结构组可以追溯到部件、确认哈希和来源版本。

The old model contained photo selection polygons only. Rendering those as construction lines would misrepresent masks as garment structure. This tranche adds independently validated flat drawing geometry, includes it in confirmation hashes, and freezes it before a pure SVG renderer runs. Legacy records retain their old hashes and remain readable; missing drawing geometry fails with `flat_geometry_required`, requiring correction and a new confirmation/snapshot rather than rewriting history.

## What / contract

- Drawing paths have typed numeric M/L/Q/C/Z commands on a shared normalized square artboard; no arbitrary SVG, URLs, script, paint-server or image inputs. Empty/degenerate paths, malformed sequences and unbounded coordinates fail validation. Fabric-only metadata may have no strokes.
- New snapshots freeze drawing paths, domain and label alongside the existing evidence and provenance. SVG has one annotated group per included part, safe XML metadata and a permanent visible user-specified source legend. Omitted unknown parts are not drawn. Active-version changes cannot alter old bytes.
- `POST /api/fashion-designs/:id/technical-flats` only accepts `confirmedSnapshotId`; authenticated thread/design ownership is checked repeatedly. GET of a flat also rechecks ownership. No model is called during export.
- PNG is rasterized from precisely the published SVG. It reuses F172 publication; the host-generated SVG is atomically linked under a stable uploads path and published as an existing file rich block. Uploaded SVG remains disallowed. Both rich blocks contain snapshot ID/hash and renderer version, so F232 discovers both using its existing aggregator.
- Flat receipts and owned asset references are append-only inside the existing revision-CAS aggregate, TTL=0. Concurrent renders return one receipt, with creation time owned by the first successful CAS. A repeated POST repairs interrupted message publication without another model call or duplicate message.

## Architecture ownership

Architecture cell: fashion-design. Map delta: updated canonical anchors for the pure renderer and TechnicalFlatService. Why: drawing projection and orchestration extend the existing service/store; no parallel store, job queue, adoption endpoint or F232 domain truth was introduced. The deterministic export is a user action (`catId:null`), not attributed to an invented model invocation.

## Quality evidence

| Requirement | Evidence |
|---|---|
| C1 snapshot-only entry / ownership | `fashion-flat-routes.test.ts`: raw prompt/image/version rejected; anonymous, foreign design and changed thread owner rejected |
| C2 confirmation binds drawing geometry | `fashion-flat-geometry.test.ts`: drawing changes alter part hash; legacy selection-only parts cannot freeze; existing snapshot validity tests retained |
| C3 one-to-one SVG provenance | XML parser checks all groups, part hashes, source versions and origins; metadata snapshot hash verified |
| C4 omissions and explicit source | Unknown/unconfirmed parts have no group or placeholder; specified-but-invisible pocket keeps its visible legend; XML injection rejected/escaped |
| C5 SVG primary / PNG projection / publication | Exact raw-pixel equality between published PNG and rasterized SVG; both URLs discovered by F232; concurrent first renders and failed publication replay covered |
| C6 immutable history | New geometric correction + new snapshot + restore leave old SVG bytes unchanged; corrupted snapshot hash and altered flat/asset records rejected |
| Persistence | Existing isolated Redis restart test now renders a real flat before restart and verifies its record/assets survive with TTL=-1 |

Fresh commands (cwd `packages/api` unless indicated):

```powershell
$env:FASHION_REDIS_TEST='1'
node --import tsx --test test/fashion/*.test.ts
# 64 passed, 0 failed, 0 skipped; owned Redis 6398 temp data only
pnpm exec tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck src/domains/fashion/FashionTechnicalFlatService.ts src/domains/fashion/fashion-flat-renderer.ts src/domains/fashion/FashionDesignService.ts src/routes/fashion-designs.ts test/fashion/fashion-flat-routes.test.ts test/fashion/fashion-flat-renderer.test.ts test/fashion/fashion-flat-geometry.test.ts test/fashion/native-smoke.ts test/fashion/fashion-redis.test.ts
# PASS
```

Shared build PASS. Biome over fashion source/routes/tests/shared: zero errors, warnings remain (complexity, non-null assertions, deliberate XML control-character filtering). Diff whitespace PASS. Capability tips check passes with the known 230 missing-source warnings in this sparse checkout. No whole-API build or full-repository feature-truth claim: previously reported Windows/dependency/sparse-document constraints are unchanged. No frontend source files or .pen files in this checkout; this batch has no Hub layout to compare. Root media hygiene clear; temporary render evidence is outside the repository.

Red→green observed: rejected unknown flat-geometry field / wrongly permitted mask-only freeze; renderer returning no groups and failing to detect tampered snapshot; absent export route; writable persisted SVG asset reference; zero-length path admitted. All are covered by the passing suite.

Fallback scanner (`--base eebaf3e`) flags the store's compatibility checks. `before[group] ?? {}` represents legacy aggregates without technicalFlats; `after[group] ?? {}` lets deletion fail with immutable_record rather than a TypeError; `before.design.assets ?? {}` covers early records that had no owned asset registry. The two OR checks reject missing or changed records, not alternate success paths. Normalizing stored JSON in the reader instead would change CAS comparison bytes for legacy records, so these bounded checks stay at the immutability boundary. Other reported OR conditions validate snapshot/asset invariants; the lone export catch only handles an already-existing atomic link and verifies identical bytes. No fallback invents drawing geometry or bypasses confirmation.

## Dogfood-Your-Slice

Real Codex `gpt-6-astra` analysis on the synthetic jacket returned eight domains / eleven components, including independent drawing paths. No cached analysis was used for the first run. The smoke acts as the user confirming this known fixture; production never auto-confirms.

```powershell
$env:FASHION_NATIVE_SMOKE='1'
$env:FASHION_NATIVE_MODEL='gpt-6-astra'
$env:FASHION_NATIVE_FLAT='1'
node --import tsx test/fashion/native-smoke.ts
```

First run PASS at 13:38 UTC: actual HTTP `confirmations → confirmed-snapshots → technical-flats` on the smoke-owned `http://127.0.0.1:6221`; cwd `E:/ClowderAI/cat-cafe-f317-fashion-design-cafe/packages/api`. Server was closed normally. Files retained under `C:/Users/myh_1/AppData/Local/Temp/f317-native-YbU2zx/`: analysis, flat-state, flat-message, SVG and PNG. Visual inspection confirms jacket outline, neckline, center closure and two pockets; no photo embedded.

After final validation/persistence refinements, the HTTP path was rerun without another paid analysis, explicitly setting `FASHION_NATIVE_DRAFT` to that run's analysis. PASS at 13:40 UTC, smoke-owned port 6313. Final evidence: `C:/Users/myh_1/AppData/Local/Temp/f317-native-42MBxT/flat-state.json` and `flat-message.json`; PNG `flat-e50779c6a9eee20bfb133e158866f6addf6db8ae944d77592f8c23b5392b013f-6ccb0721.png`; matching `.svg` has the same stem without the final publication suffix. No runtime config, production Redis or Hub server was touched.

## Tradeoff / open questions / next action

V1 is a bounded geometric projection, not a paper pattern or production-feasibility guarantee. Model-derived paths remain unconfirmed until the designer checks/corrects them. Missing legacy paths require a new snapshot. Renderer versions preserve reproducibility when rendering rules change. Staging files are retained; the preceding review's non-blocking analysis deduplication/orphan-management concerns are not claimed resolved by this drawing tranche.

Please review geometry/confirmation binding, legacy fail-closed behavior, XML safety, concurrent persistence and outbox recovery. No new product decision is required. After this tranche passes, continue Atelier UI and real Hub light/dark interaction acceptance; the overall F317 task remains doing. No merge, production rollout or complete-feature claim.

[丢丢max/gpt-6-astra🐾]
