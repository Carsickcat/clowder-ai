---
feature_ids: [F317]
related_features: [F056, F172, F190, F232]
topics: [fashion-design, garment-dna, image-editing, versioning, technical-flat, hub]
doc_kind: spec
created: 2026-09-13
tips_exempt: F317 model adapter and publication tranche; no Hub entry is delivered yet, and the approved Atelier UI/tips remain in the active implementation task.
---

# F317: Atelier Fashion Design Cafe — 结构受控局部改款与可追溯款式线稿

> **Status**: in-progress | **Owner**: opus（产品）+ sonnet（共创）+ 烁烁（UI）+ 丢丢max/gpt-6-astra（实现） | **Priority**: P1

## Why

服装设计师需要的不是再一个自由生图入口，而是一个可信的改款闭环：上传一张服装图后，看见系统识别了哪些设计点，只修改自己选中的部位，确认其他部位没有被暗改，并把最终采用的结构变成可追溯的黑白款式线稿。若图片、文字描述和线稿各自独立生成，设计事实会在每轮改动中漂移；F317 因而把 **Garment DNA 的冻结版本**设为唯一业务真相，图片只是该真相的视觉投影。

operator 授权转述（2026-09-13）：上传一张服装图 → 可见设计点结构化拆解 → 选中部位并以文字或参考部件图替换 → 每次替换自动生成预览 → 确认后生成与已确认设计点对应的黑白款式线稿；单图不可见信息不得伪造。

## Current State / 现状基线

- F172 已提供生成图片的统一 publication contract：稳定 `/uploads/...` URL、`media_gallery`、最小 provenance、retry/replay 幂等。
- F232 已提供 thread/global 产物聚合和内容查看，但 `ThreadArtifactDTO` 仅表达展示投影，不包含服装结构、确认、版本谱系或采用状态。
- Hub 已有图片上传、消息持久化和 F056/F190 Console 设计系统；尚无服装领域状态机、设计点模型、受保护区域编辑、服装版本真相或 DNA → SVG 款式线稿链路。
- 当前交互设计在 `docs/design/atelier-fashion-studio-wireframe.md`，状态为 `design-gate-pending`。

## Product Boundary / V1 边界

V1 是“单件服装、至少一张起始图、结构受控的局部改款工作台”。入口只需一张图；用户可在后续补充正面、背面或侧面证据，但系统不得合成缺失视图。

### In Scope

1. 将图片中可见服装结构拆解到固定 8 个编辑域，提供域内属性、实例和可点击几何。
2. 将照片可见性、证据来源、用户确认三个轴分开记录。
3. 用户校正并确认初始 Garment DNA；模型置信度不能自动晋升为事实。
4. 每次编辑一个目标域，可使用文字、参考部件图或二者组合。
5. 其余域自动进入保护集合；有几何时由服务端物化 edit mask。
6. 每次编辑产生候选版本和一张主预览；“再出一版”才产生新的候选。
7. 提供生成中、失败重试、前后对比、采用、丢弃和恢复旧版本。
8. 正式线稿只消费冻结的 `ConfirmedSnapshot`，输出可追溯 SVG，并通过 F172/F232 归档展示。

### Non-goals

- 不推断背面、内里、隐藏缝份、不可见结构或面料成分。
- 不承诺纸样、放码、POM/BOM、Tech Pack、面料物性或生产可行性。
- 不做 3D 样衣、虚拟试穿、多款系列管理或多人实时共编。
- 不允许一句话同时自由重设计多个域。
- 不把普通 image-to-line 结果命名为技术款式线稿。
- 不在 F172 或 F232 内保存 Garment DNA、采用指针和版本谱系。

## What

### Phase A: Garment DNA 与初始确认

#### 固定 8 域

| domainId | 用户名称 | 域内典型属性/实例 |
|----------|----------|-------------------|
| `silhouette` | 廓形 | 廓形分类、松量 |
| `collar` | 领/帽 | 领型、驳头宽、帽型 |
| `sleeve` | 肩/袖 | 肩型、袖型、袖长 |
| `body-panel` | 大身分割 | 公主线、刀背缝、育克，可多实例 |
| `closure` | 门襟/闭合 | 开合方式、扣位；扣子是属性 |
| `pocket` | 口袋 | 袋型、位置，可多实例 |
| `hem` | 下摆 | 摆型、长度、开衩 |
| `fabric` | 面料/色彩 | 材质外观、色彩、肌理 |

固定的是编辑域，不是模型动态识别出来的自由标签。动态分析只能创建域内 component、instanceType 和属性，不能新增第九域。“后背”是视图与可见性状态，不是设计域。

#### 三轴事实模型

- `confirmation`: `unconfirmed | confirmed`
- `visibilityByView`: 每个视图独立记录 `visible | partial | not-visible`
- `evidenceOrigin`: `photo | user-specified`

文字补充只能增加 `user-specified` 证据，不能把 `not-visible` 改写成 `visible`。只有补充了相应视图照片，照片可见性才可变化。

### Phase B: 受保护编辑、预览与版本

1. 编辑请求必须引用 `baseVersionId` 和一个 `targetDomainId`。
2. 目标域解锁，其余域的 component IDs 写入 `protectedComponentIds`。
3. 服务端先生成候选 DNA patch，再生成视觉预览；候选不自动改变 `activeVersionId`。
4. 预览返回 `affectedPartIds` 与 `protectedDriftPartIds`。
5. `protectedDriftPartIds.length > 0` 时，采用操作硬阻断。用户只能：
   - 保留原意重试；或
   - 显式创建一个新的编辑 proposal，把希望保留的变化写入新意图。旧候选不得通过勾选直接越过保护门。
6. 采用只确认本次目标域内实际变化的 part；所有未变化 part 复用原 confirmation，前提是 `partHash` 不变。
7. 恢复旧版本创建新的 adopted version 与审计记录，不移动或删除历史对象。
8. 所有持久化对象默认 TTL=0；刷新后候选、失败、丢弃与采用谱系均可恢复。

### Phase C: 冻结快照与可追溯线稿

1. “讨论示意草图”和“技术款式线稿”是两个不同出口。
2. 技术款式线稿仅在目标输出视图所需 component 全部具有有效 confirmation 时解锁。
3. 生成前物化 `ConfirmedSnapshot`：对每个 component 校验当前 `partHash` 与 confirmation 绑定的 `partHash` 相同，并冻结几何、属性、来源和版本谱系。
4. 线稿服务只接受 `confirmedSnapshotId`，不接受自由 prompt 或“原图直接转线稿”。
5. SVG 每个结构组携带 `componentId / partHash / evidenceOrigin / sourceVersionId`；PNG 只是同一 SVG 的导出投影。
6. `sourcePreviewId` 可帮助视觉对齐，但不具有事实权威。
7. 未确认或不可见部位不进入正式线稿；如用户用文字确认，必须永久保留“用户指定（照片不可见）”来源标记。

## Terminal Data Contract / 服装 DNA 终态契约

```ts
type GarmentDomainId =
  | 'silhouette'
  | 'collar'
  | 'sleeve'
  | 'body-panel'
  | 'closure'
  | 'pocket'
  | 'hem'
  | 'fabric';

type GarmentView = 'front' | 'back' | 'left-side' | 'right-side';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface GeometryEvidence {
  polygon: Array<[number, number]>; // 0..1 normalized image coordinates
  maskAssetId?: string;             // service-materialized raster mask
}

interface EvidenceRef {
  origin: 'photo' | 'user-specified';
  view?: GarmentView;
  assetId?: string;
  geometry?: GeometryEvidence;
  userStatement?: string;
}

interface FashionDesign {
  id: string;
  userId: string;
  threadId: string;
  title: string;
  sourceAssetIdsByView: Partial<Record<GarmentView, string>>;
  activeVersionId: string | null; // 当前采用胚样
  schemaVersion: 1;
  createdAt: number;
  updatedAt: number;
}

interface GarmentVersion {
  id: string;
  designId: string;
  parentVersionId: string | null;
  status: 'draft' | 'candidate' | 'adopted' | 'discarded';
  previewAssetId: string | null;
  domains: Record<GarmentDomainId, DomainSnapshot>;
  editProposalId: string | null;
  restoredFromVersionId?: string;
  versionHash: string;
  createdAt: number;
}

interface DomainSnapshot {
  domainId: GarmentDomainId;
  components: GarmentComponentSnapshot[];
}

interface GarmentComponentSnapshot {
  partId: string;                 // 跨版本稳定
  domainId: GarmentDomainId;
  instanceType: string;           // 由 domain schema 校验
  label: string;
  attributes: Record<string, JsonValue>;
  geometryByView: Partial<Record<GarmentView, GeometryEvidence>>;
  visibilityByView: Partial<Record<GarmentView, 'visible' | 'partial' | 'not-visible'>>;
  evidence: EvidenceRef[];
  partHash: string;               // 结构属性 + 几何的 canonical hash
  confirmationId: string | null;
}

interface ConfirmationRecord {
  id: string;
  designId: string;
  partId: string;
  partHash: string;
  versionId: string;              // 用户确认发生在哪个版本
  evidenceOrigin: 'photo' | 'user-specified';
  confirmedBy: string;
  confirmedAt: number;
}

interface EditProposal {
  id: string;
  designId: string;
  baseVersionId: string;
  targetDomainId: GarmentDomainId;
  targetPartIds: string[];
  instruction?: string;
  referenceAssetId?: string;
  protectedComponentIds: string[];
  editMaskAssetId?: string;
  status: 'queued' | 'generating' | 'ready' | 'failed' | 'accepted' | 'rejected';
  idempotencyKey: string;
  createdAt: number;
}

interface PreviewValidation {
  proposalId: string;
  affectedPartIds: string[];
  protectedDriftPartIds: string[];
  adoptionBlocked: boolean;
}

interface ConfirmedSnapshot {
  id: string;
  designId: string;
  versionId: string;
  view: GarmentView;
  parts: Array<{
    partId: string;
    partHash: string;
    confirmationId: string;
    sourceVersionId: string;
    evidenceOrigin: 'photo' | 'user-specified';
    geometry: GeometryEvidence;
    attributes: Record<string, JsonValue>;
  }>;
  omittedUnknownPartIds: string[];
  snapshotHash: string;
  frozenAt: number;
}

interface TechnicalFlatArtifact {
  id: string;
  designId: string;
  confirmedSnapshotId: string;
  snapshotHash: string;
  svgAssetId: string;
  pngAssetId: string;
  includedPartIds: string[];
  createdAt: number;
}
```

### Contract Invariants

- `activeVersionId` 只能指向 `status='adopted'` 的版本。
- GarmentVersion、ConfirmationRecord、ConfirmedSnapshot 均不可变；修订一律创建新对象。
- confirmation 的有效性由 `(partId, partHash, versionId)` 建立；当前 component 的 `partHash` 改变后，旧 confirmation 自动失效。
- 非目标域的 component 在候选 DNA 中必须与 base version 相同。
- `protectedDriftPartIds` 非空时 `adoptionBlocked=true`，服务端拒绝采用，而非只靠 UI disabled。
- 正式线稿的每个 SVG component 都必须在 `ConfirmedSnapshot.parts` 中有一一对应项。
- F172 的 `publicationKey` 对同一 generation attempt 幂等；用户选择“再出一版”时创建新的 attempt/key。
- F172/F232 保存和展示图片产物；F317 Store 保存领域真相，二者通过 asset ID 与 provenance 关联而不互相冒充。

## API Semantics

```text
POST /api/fashion-designs
POST /api/fashion-designs/:id/analyze
POST /api/fashion-designs/:id/confirmations
POST /api/fashion-designs/:id/edit-proposals
POST /api/fashion-designs/:id/edit-proposals/:proposalId/retry
POST /api/fashion-designs/:id/edit-proposals/:proposalId/decision
POST /api/fashion-designs/:id/restore
POST /api/fashion-designs/:id/confirmed-snapshots
POST /api/fashion-designs/:id/technical-flats
GET  /api/fashion-designs/:id
```

- 分析与生成接口返回 `202 + operationId/status`。
- 生成、采用和恢复请求必须携带 `baseVersionId`；当前版本已变化时返回 `409 stale_version`，不得静默覆盖。
- retry 复用原 proposal/idempotency key；“再出一版”创建新 proposal attempt。
- 采用请求若命中 protected drift，返回 `409 protected_drift` 和具体 part IDs。

## User Journey

### Primary Journey: 只换一个设计部位并得到可信线稿

- **Scope unit**: thread
- **Actor**: 服装设计师
- **Entry**: 从 Hub thread 打开“缝纫间 Atelier”，上传至少一张服装图。
- **Flow**:
  1. 用户上传正面图 → 画布显示图片与 8 域拆解进度。
  2. 用户点击图片热点或左侧域 → 查看照片可见性、证据来源、域内部件与属性。
  3. 用户校正分析结果并确认 → 系统形成第一版 adopted Garment DNA。
  4. 用户选择“肩/袖”，输入“把泡泡袖改为落肩长袖”或上传参考袖图 → 其他域显示为已保护。
  5. 系统生成候选预览 → 用户查看结构 diff 与卷帘对比。
  6. 无保护区漂移时用户采用 → `activeVersionId` 推进；有漂移则采用被阻断并展示具体部位。
  7. 当前视图必需部位全部确认后，用户点击“生成技术款式线稿” → 得到可点击溯源的 SVG 与 PNG。
  8. 用户刷新或进入产物面板 → 仍能打开原图、各版本预览和线稿，并回到来源消息。
- **Success evidence**: 浅/深色关键状态截图、15 秒主流程录屏、端到端测试、刷新重放测试、SVG `componentId → ConfirmedSnapshot` 映射测试。
- **Non-goals**: 缺失背面自动补画、生产级纸样/Tech Pack、自由多域重设计。

### Supporting Journeys

| ID | Scope unit | Actor | Flow | Evidence |
|----|------------|-------|------|----------|
| S1 | thread | 服装设计师 | 背面 tab 空态 → 补充背面照片 → 独立确认背面可见设计点 → 生成背面正式线稿 | E2E + 截图 |
| S2 | thread | 服装设计师 | 候选出现保护区漂移 → 采用被阻断 → 重试或建立新编辑意图 | API integration + UI test |
| S3 | thread | 服装设计师 | 从 v5 恢复 v2 → 系统创建 v6 adopted version，v3-v5 仍可查看 | store test + E2E |

## Acceptance Criteria

<!-- 每条 AC 必须 trace 回 Why 的“可见拆解 / 只改选中部位 / 不伪造 / 可回退 / 线稿可追溯”之一，并给出非作者可复核证据。 -->

### Phase A（Garment DNA 与初始确认）

- [ ] AC-A1: 上传合法服装图片后创建 user-scoped FashionDesign，刷新后仍可加载；复用现有 MIME、大小与魔数校验。验证：API integration + Redis-backed test。
- [ ] AC-A2: 分析结果严格落入固定 8 域；动态识别不能创建第九域。验证：schema test + adversarial fixture。
- [ ] AC-A3: 每个识别出的 component 同时具备域内属性和可点击几何；无可靠几何时 UI 退化为域清单，不伪造热点。验证：contract test + screenshot。
- [ ] AC-A4: `confirmation / visibilityByView / evidenceOrigin` 三轴独立；文字补充不会把照片 `not-visible` 改成 `visible`。验证：state transition test。
- [ ] AC-A5: front-only fixture 不生成自动确认的 back component；正式背面线稿入口 disabled，并列出所缺证据。验证：E2E + screenshot。
- [ ] AC-A6: 模型分析在用户确认前不产生 canonical confirmation；确认记录绑定 `partId + partHash + versionId`。验证：store test。

### Phase B（受保护编辑、预览与版本）

- [ ] AC-B1: 编辑请求必须包含 `baseVersionId`、一个固定目标域，以及文字或参考图至少一种；非法请求返回结构化 4xx。验证：API contract test。
- [ ] AC-B2: 候选版本的非目标域结构与 base version 相同；`protectedComponentIds` 完整覆盖其余域。验证：canonical diff test。
- [ ] AC-B3: 每次有效编辑自动创建一张主预览；失败不推进 `activeVersionId`，retry 保留输入且不重复发布 artifact。验证：integration test。
- [ ] AC-B4: 预览产生 protected drift 时，前端显示具体部位且服务端拒绝采用；不能通过 UI 勾选绕过。验证：API 409 test + UI test。
- [ ] AC-B5: 采用只更新目标域发生变化的 component confirmation；未变化 partHash 的 confirmation 保持有效，其他域确认状态不变。验证：revision/confirmation test。
- [ ] AC-B6: 过期 `baseVersionId` 返回 `409 stale_version`；UI 提供基于最新版重生成、查看差异、放弃草稿三条恢复路径。验证：concurrency integration + screenshot。
- [ ] AC-B7: 丢弃不改变 active version；恢复旧版创建新的 adopted version 且不删除任何历史。验证：store test + E2E。
- [ ] AC-B8: 所有版本和确认状态 TTL=0；服务重启/页面刷新后完整恢复。验证：Redis restart-backed test。
- [ ] AC-B9: 预览统一通过 F172 发布，并在 F232 产物面板消费同一 `/uploads/...` URL；replay/retry 无重复 rich block。验证：cross-feature integration test。

### Phase C（冻结快照与可追溯线稿）

- [ ] AC-C1: 正式线稿接口只接受 `confirmedSnapshotId`；传入自由 prompt、raw image 或未冻结 version 均拒绝。验证：API negative tests。
- [ ] AC-C2: 物化 ConfirmedSnapshot 时逐项校验当前 `partHash` 与 confirmation；任一必需 component 缺失或失效则 fail closed。验证：snapshot test。
- [ ] AC-C3: SVG 每个结构组都包含 `componentId / partHash / evidenceOrigin / sourceVersionId`，且与 ConfirmedSnapshot 一一对应。验证：SVG parser test。
- [ ] AC-C4: 未确认部位不出现在技术款式线稿；`user-specified + not-visible` 部位永久携带来源标记。验证：golden SVG fixture + screenshot。
- [ ] AC-C5: SVG 为主产物，PNG 由同一 SVG 导出；二者 provenance 包含 snapshot ID/hash 并通过 F172/F232 归档。验证：artifact integration test。
- [ ] AC-C6: 讨论示意草图与技术款式线稿在按钮、图纸标题和文件名上明确区分，不共用正式出口。验证：UI test + screenshots。
- [ ] AC-C7: 真实 Hub 在浅色/深色下覆盖空态、拆解、确认、生成、对比、drift、失败、线稿八类关键状态；无硬编码颜色，状态不只依赖色彩。验证：Playwright baseline + F056 lint。

## 需求点 Checklist

| ID | 需求点（operator experience/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | “上传一张服装图”并进入设计工作流 | AC-A1, AC-A3 | integration + screenshot | [ ] |
| R2 | “可见设计点结构化拆解” | AC-A2, AC-A3, AC-A4 | schema + UI | [ ] |
| R3 | “选中部位并以文字或参考部件图替换” | AC-B1, AC-B2 | API + E2E | [ ] |
| R4 | “每次替换都自动生成预览图” | AC-B3, AC-B9 | integration + replay | [ ] |
| R5 | “锁定未变部位”不能只是 prompt 承诺 | AC-B2, AC-B4, AC-B5 | diff + 409 + UI | [ ] |
| R6 | 采用、丢弃、回退可恢复且有版本谱系 | AC-B6, AC-B7, AC-B8 | store + E2E | [ ] |
| R7 | “单图不可见信息不得伪造” | AC-A4, AC-A5, AC-C4 | negative fixture + SVG | [ ] |
| R8 | “确认后生成与已确认设计点对应的黑白款式线稿” | AC-C1, AC-C2, AC-C3, AC-C5 | API + SVG parser | [ ] |
| R9 | 遵循 F056 Cozy Swiss 与真实 Hub 在地设计 | AC-C6, AC-C7 | screenshots + lint | [ ] |
| R10 | 预览与版本产物复用 F172/F232 | AC-B9, AC-C5 | cross-feature integration | [ ] |

### 覆盖检查

- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [x] 前端需求已准备需求→证据映射表（见设计稿与 AC-C7）

## Architecture Ownership

Architecture cell: `fashion-design`（服装领域、HTTP 与预览 worker）+ `hub-action-surface`（UI/产物入口）
Map delta: `update required` — `docs/architecture/ownership/cells/fashion-design.md` 已记录核心与本批 HTTP/worker anchors。
Why: F317 独立拥有 Garment DNA、版本和确认真相；F172/F232 保持图片发布与展示职责。

## Dependencies

- **Evolved from**: N/A（全新垂直领域能力）
- **Design Gate approval**: co-creator 消息 `0001791278223205-000003-74b52d8f`：“我都批准”；L1 实施门禁已解除。
- **Related**: F056（Cozy Swiss 设计语言与 token 门禁）
- **Related**: F172（预览图与 PNG 线稿 publication contract）
- **Related**: F190（Console AppShell 与在地页面结构）
- **Related**: F232（thread/global 产物查看）

## Risk

| 风险 | 缓解 |
|------|------|
| 将“其他部位尽量不变”误当保证 | 结构 diff + protected mask + 服务端 drift 阻断，三层共同承重 |
| 单图补全不可见结构 | 三轴事实模型；缺失视图 fail closed；用户指定永久保留来源 |
| 线稿再次自由生成而偏离确认结构 | 仅消费冻结 ConfirmedSnapshot；SVG component 与快照一一映射 |
| F172/F232 被扩成第二套领域状态 | 图片/聚合与 F317 领域 store 明确分层，只通过 asset/provenance 关联 |
| 版本并发导致采用错基线 | `baseVersionId` 乐观并发控制 + 409 冲突恢复 |
| taxonomy 动态增长导致 UI/计量/线稿失稳 | 固定 8 域，变化只发生在域内 schema 与实例 |
| AI 分析或生成失败使流程断裂 | 单域重试、保留编辑输入、失败不推进 active version |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 图片生成 provider 的可靠局部 mask 能力与最小区域合成方案 | ⬜ Architecture Gate 验证 |
| OQ-2 | 多实例域的画布热点与左侧二级行如何互相定位 | ⬜ UI Design Gate |
| OQ-3 | 首版 SVG geometry renderer 的能力边界及 domain schema 最小集合 | ⬜ Architecture Gate |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | V1 固定 8 个编辑域，动态模型只填域内属性/实例 | 稳定热点、确认计量与线稿映射 | 2026-09-13 |
| KD-2 | 后背是视图与可见性，不是设计点；缺背面证据不生成正式背面线稿 | 单图不可见信息不得伪造 | 2026-09-13 |
| KD-3 | `activeVersionId` 指向当前采用胚样；confirmation 绑定 `partId + partHash + versionId` | 让未变化部位复用确认，同时使变化自动失效 | 2026-09-13 |
| KD-4 | 正式线稿只消费冻结 ConfirmedSnapshot；preview 仅作视觉参照 | 款式图事实源必须是确认结构 | 2026-09-13 |
| KD-5 | protected drift 是服务端 adoption blocker，不是 UI 警告 | 防止生成模型暗改被直接采用 | 2026-09-13 |
| KD-6 | F172/F232 只承载图片发布和产物查看，F317 单独拥有领域真相 | 保持单一真相源与清晰 ownership | 2026-09-13 |
| KD-7 | 正式线稿与讨论示意分离命名、解锁条件和导出格式 | 防止示意图被误当技术交付物 | 2026-09-13 |

## Tips Contribution（F244）

- 新增一条服装设计使用提示：上传后先确认可见设计点，再开始局部替换；未确认结构不能生成正式技术线稿。
- 新增一条真实性提示：缺失背/侧视图时补充图片或明确文字事实，系统不会自动编造不可见部位。
- sourceRef: `docs/features/F317-atelier-fashion-design-cafe.md#user-journey`

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-09-13 | co-creator 授权开始构建；多猫第一轮产品、架构、UI 独立设计 |
| 2026-09-13 | 产品收敛：固定 8 域、背面策略 A、冻结 ConfirmedSnapshot、protected drift 硬阻断 |
| 2026-10-06 | operator 批准开工；核心层 `f55eae5` 获 opus 明确放行（消息 `0001791288051903-000027-fa9f44f0`），26 项测试通过；尚未合入/发布 |
| 2026-10-06 | 继续 HTTP 上传/归属与异步预览执行批次；真实模型、mask、F172/F232 发布、SVG 和 UI 仍待实现，未宣称完整产品可用 |
| 2026-10-06 | HTTP/worker `fd1020f` 获 opus 放行（消息 `0001791289410618-000029-0dfca526`）。接入 Codex 只读模型 adapter、服务端局部合成、最终图视觉复核、F172/F232 幂等发布与 API root 注入；56 项 fashion 测试通过。原生分析已验证 8 域/11 点；真实预览与采用证据见本批 review note。SVG、Hub UI、完整产品验收继续实施 |

## Review Gate

- Design Gate：operator 在真实 Hub 页面确认 `docs/design/atelier-fashion-studio-wireframe.md`。
- Architecture Gate：确认 F317 domain ownership、局部 mask 能力、持久化 store 与 SVG renderer 边界。
- 实现完成：quality-gate → fresh-context-review → 跨个体 review → merge-gate。

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| Design | `docs/design/atelier-fashion-studio-wireframe.md` | 真实 Hub 在地交互规格与线框 |
| Related Feature | `docs/features/F056-cat-cafe-design-language.md` | Cozy Swiss 与设计系统 |
| Related Feature | `docs/features/F172-generated-image-publication.md` | 图片 publication contract |
| Related Feature | `docs/features/F232-thread-artifacts-panel.md` | 产物聚合与查看 |
