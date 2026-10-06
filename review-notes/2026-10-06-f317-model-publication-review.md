---
feature_ids: [F317, F172]
topics: [fashion-design, model-adapter, image-publication, review]
doc_kind: review-request
created: 2026-10-06
---

# F317 model / mask / publication review

Author: 丢丢max / gpt-6-astra. Reviewer: 山本 / gpt-5.6-terra.
review-target-id: f317. Branch: feat/f317-fashion-design-cafe.
Review delta: fd1020f..HEAD. This is the next implementation tranche requested in message `0001791289410618-000029-0dfca526`, not complete feature/release acceptance.

## Original requirements

Source: `docs/features/F317-atelier-fashion-design-cafe.md`, Why / Product Boundary / Phase B.

> 上传服装图，识别可见设计点，确认后只改选中的部位；预览为候选，采用不能越过受保护漂移；线稿消费冻结确认结构。

## What / Why

- Authorized `POST /api/fashion-designs/:id/analysis` calls vision on owned staged images, validates the eight-domain contract, rechecks thread ownership and saves an unconfirmed draft. Repeating after success returns the original draft. Analysis is a bounded HTTP operation (180 seconds), not an unowned background job.
- API root now composes a registered Codex provider, CAS preview worker and publication callback. Admission requires a carrier that supports the enforced read-only policy. No runtime config, new external dependency or production store was changed.
- Selected front polygons become a host raster mask. Final PNG pixels outside it are copied from the adopted base (or initial source). A second vision invocation checks the **composed** result; canonical ID/hash diff still independently blocks unselected structural changes. Wrong aspect ratio/empty masks/missing host image records fail closed.
- F172 publishes the composite. Its owned asset and publication metadata commit with the candidate. Polling repairs interrupted publication using MessageStore atomic idempotency; F232 consumes the resulting media gallery. There is no second garment truth store and no automatic adoption.
- Removed unused `startPreview` entry. Execution uses CAS leases throughout.
- Live dogfood found a canonical F172 Windows bug: absent HOME resolved to relative `.codex`, while Codex wrote under USERPROFILE. `resolveCodexImageHome` now follows effective child env, CODEX_HOME, Windows USERPROFILE or OS home, including account overrides. Only its canonical scanner and Codex caller changed outside F317.

## Architecture

Architecture cell: fashion-design. Map delta: updated adapter, image composition and pipeline anchors in the cell. F172 remains publication owner. The neighboring scanner correction is included for explicit cross-individual review by its feature owner, opus.

## Evidence

- Shared build and strict TypeScript of changed production modules plus new tests: PASS.
- `FASHION_REDIS_TEST=1 node --import tsx --test test/fashion/*.test.ts`: **56 pass / 0 fail / 0 skip**, isolated Redis 6398 restart included.
- Canonical F172 scanner + generated-image-publication tests: **13 pass / 0 fail / 0 skip** (targeted tsc emits their unchanged dependencies before the JS tests).
- Controlled Fastify API: upload → actual adapter with controlled AgentService transport → analysis → confirmation → 202 preview → poll → F232 media artifact → adoption. Publication failure and changed ownership are independently injected. Controlled transport is explicitly separate from native model smoke below.
- Red→green evidence: missing analysis route; unsigned/signed native JSON transport; read-only policy delivery; Windows/OS image home; publication failure repaired by polling; raw image drift replaced by final-composite visual verification.
- Biome and diff whitespace checks: PASS. No frontend files or root media artifacts.
- `pnpm check:capability-tips`: PASS with 230 existing missing-source warnings from sparse checkout. Full feature-truth gate remains unavailable because unrelated roadmap feature documents are not checked out; no full-repository gate claim.

## Native dogfood

Command (PowerShell, `packages/api`):

```powershell
$env:FASHION_NATIVE_SMOKE='1'
$env:FASHION_NATIVE_MODEL='gpt-6-astra'
node --import tsx test/fashion/native-smoke.ts
```

The checkout's historical `gpt-5.3-codex` default was rejected by the account (`model_not_found`). The smoke uses the locally advertised gpt-6-astra model through a per-command constructor override; no config file changes. Production continues using the registered member model, without silent model failover.

Native read-only analysis PASS: 8 domains, 11 components; output `C:/Users/myh_1/AppData/Local/Temp/f317-native-SzKXNs/analysis.json`. Native generation + F172 Windows publication + masked candidate PASS: `C:/Users/myh_1/AppData/Local/Temp/f317-native-OXou6v/preview-state.json`; inspected image shows only the left pocket blue. That first candidate conservatively blocked adoption due to raw-image drift reports; final-composite revalidation was added and regression-tested before this review.

Final native revalidation/adoption run **PASS** (13:07 UTC): native image generation → host composition → independent native vision on final pixels → ready candidate → `decide(accept)` → adopted version. Evidence directory: `C:/Users/myh_1/AppData/Local/Temp/f317-native-LVlhK9/` (`analysis.json`, `preview-state.json`, `accepted-version.json`, `pixel-evidence.json`, published PNG). Re-run with `FASHION_NATIVE_PREVIEW=1` and optional `FASHION_NATIVE_DRAFT` pointing at the previously validated analysis of this same synthetic fixture; reuse is printed explicitly, never represented as a fresh analysis.

Final evidence: `affectedPartIds=[pocket_front_image_left]`, `protectedDriftPartIds=[]`, `adoptionBlocked=false`, adopted status. Independent pixel comparison found **0 changed pixels outside the selected rectangle plus a two-pixel anti-alias margin**, 3575 changed pixels inside; visual inspection confirms a blue left pocket and unchanged right pocket. This pixel check is on the synthetic fixture, not a general claim about model segmentation accuracy.

## Fallback / coordinate check

No provider switching, model substitution or acceptance bypass exists. Adapter null handling distinguishes initial source from an adopted preview and absent optional event text; errors are rejected. Image-module OR conditions are path, size, frame and aspect-ratio guards. The F172 home precedence is the native process contract (explicit CODEX_HOME → platform home variable → OS home), not a second image store. Worker catch blocks preserve durable failure and allow idempotent publication replay. None of these paths converts a failed model call into a successful candidate. Full-feature close gates are not being claimed for this tranche.

## Tradeoff / remaining product scope

The concrete adapter supports the configured Codex exec-json read-only carrier and visible front edit regions. Analysis accepts all uploaded evidence views and does not invent unseen views. Each preview uses generation plus final-image vision verification; 300-second worker timeout bounds the combined operation. Temporary model workspaces are retained for diagnostics; garment state and published assets have no TTL.

This tranche adds no Hub UI or SVG renderer and is not a production rollout. F317 remains doing. Vision judgments still require user review; geometric masking and canonical structural drift checks are enforced by code.

## Review focus / next action

Check F172 effective home resolution, model-output framing (complete messages/signature decoration), read-only carrier enforcement, final-composite drift semantics, candidate/publication atomicity and replay after process loss. After this tranche passes, continue frozen-snapshot SVG and Atelier UI, then full product acceptance. No product approval is being re-requested.

[丢丢max/gpt-6-astra🐾]
