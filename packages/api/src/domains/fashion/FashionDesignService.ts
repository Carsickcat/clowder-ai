import {
  type EditProposalInput,
  type FashionDesign,
  type FashionDesignState,
  type FashionImageAsset,
  type GarmentDomainsInput,
  GarmentDomainsSchema,
  type GarmentView,
  GarmentViewSchema,
  type TechnicalFlatArtifact,
} from '@cat-cafe/shared';
import type { FashionDesignStore } from './FashionDesignStore.js';
import { type ConfirmPartsInput, confirmParts, freezeSnapshot, restoreVersion } from './fashion-confirmation.js';
import {
  allParts,
  appendVersion,
  assertPhotoEvidence,
  audit,
  canonicalJson,
  FashionError,
  fashionId,
  materializeDomains,
} from './fashion-invariants.js';
import {
  completePreview,
  decidePreview,
  getProposal,
  type PreviewResult,
  proposeEdit,
  retryPreview,
} from './fashion-preview.js';

export { FashionError } from './fashion-invariants.js';
export class FashionDesignService {
  constructor(private readonly store: FashionDesignStore) {}

  async create(input: Pick<FashionDesign, 'userId' | 'threadId' | 'title' | 'sourceAssetIdsByView' | 'assets'>) {
    if (
      !input.userId ||
      !input.threadId ||
      !input.title.trim() ||
      Object.keys(input.sourceAssetIdsByView).length === 0
    ) {
      throw new FashionError('invalid_design', 400);
    }
    for (const [view, asset] of Object.entries(input.sourceAssetIdsByView)) {
      GarmentViewSchema.parse(view);
      if (!asset) throw new FashionError('source_asset_required', 400);
    }
    const design: FashionDesign = {
      ...structuredClone(input),
      id: fashionId(),
      activeVersionId: null,
      schemaVersion: 1,
      revision: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const state: FashionDesignState = {
      design,
      versions: {},
      confirmations: {},
      proposals: {},
      validations: {},
      snapshots: {},
      events: [],
    };
    if (!(await this.store.create(state))) throw new FashionError('design_exists');
    return design;
  }
  async get(userId: string, designId: string) {
    const state = await this.store.read(userId, designId);
    if (!state || state.design.userId !== userId || state.design.id !== designId)
      throw new FashionError('not_found', 404);
    return state;
  }
  list(userId: string, threadId: string) {
    return this.store.list(userId, threadId);
  }
  addReferenceAsset(userId: string, designId: string, asset: FashionImageAsset) {
    return this.transact(userId, designId, (state) => {
      if (asset.kind !== 'reference' || state.design.assets?.[asset.id]) throw new FashionError('invalid_asset', 400);
      state.design.assets = { ...state.design.assets, [asset.id]: structuredClone(asset) };
      return asset;
    });
  }

  private async transact<T>(userId: string, designId: string, update: (state: FashionDesignState) => T): Promise<T> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const before = await this.get(userId, designId);
      const after = structuredClone(before);
      const result = update(after);
      if (canonicalJson(before) === canonicalJson(after)) return structuredClone(result);
      after.design.revision++;
      after.design.updatedAt = Date.now();
      if (await this.store.compareAndSwap(before, after)) return structuredClone(result);
      // Re-evaluate business guards against the winning state; never rebase user edits silently.
    }
    throw new FashionError('concurrent_update');
  }
  analyze(userId: string, designId: string, input: GarmentDomainsInput) {
    const parsed = GarmentDomainsSchema.parse(input);
    return this.transact(userId, designId, (state) => {
      if (Object.keys(state.versions).length) throw new FashionError('already_analyzed');
      const version = appendVersion(state, {
        id: fashionId(),
        designId,
        parentVersionId: null,
        status: 'draft',
        previewAssetId: null,
        domains: materializeDomains(parsed),
        editProposalId: null,
      });
      for (const part of allParts(version)) assertPhotoEvidence(state, part);
      audit(state, 'analyzed', version.id);
      return version;
    });
  }
  confirm(userId: string, designId: string, input: ConfirmPartsInput) {
    return this.transact(userId, designId, (state) => confirmParts(state, input));
  }
  propose(userId: string, designId: string, input: EditProposalInput) {
    return this.transact(userId, designId, (state) => proposeEdit(state, input));
  }
  retry(userId: string, designId: string, proposalId: string, baseVersionId: string) {
    return this.transact(userId, designId, (state) => retryPreview(state, proposalId, baseVersionId));
  }
  claimPreview(userId: string, designId: string, proposalId: string, operationId: string, leaseMs: number) {
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 1 || leaseMs > 600_000)
      throw new FashionError('invalid_worker_lease', 400);
    return this.transact(userId, designId, (state) => {
      const proposal = getProposal(state, proposalId);
      if (proposal.operationId !== operationId || proposal.status !== 'queued') return null;
      proposal.status = 'generating';
      proposal.workerLease = { token: fashionId(), expiresAt: Date.now() + leaseMs };
      return proposal.workerLease.token;
    });
  }
  completePreview(
    userId: string,
    designId: string,
    proposalId: string,
    operationId: string,
    result: PreviewResult,
    leaseToken?: string,
  ) {
    return this.transact(userId, designId, (state) =>
      completePreview(state, proposalId, operationId, result, leaseToken),
    );
  }
  failPreview(
    userId: string,
    designId: string,
    proposalId: string,
    operationId: string,
    reason: string,
    leaseToken?: string,
  ) {
    return this.transact(userId, designId, (state) => {
      const proposal = getProposal(state, proposalId);
      if (proposal.workerLease && proposal.workerLease.token !== leaseToken) return proposal;
      if (proposal.operationId === operationId && ['queued', 'generating'].includes(proposal.status)) {
        proposal.status = 'failed';
        proposal.failure = reason.slice(0, 1000);
      }
      return proposal;
    });
  }
  decide(userId: string, designId: string, proposalId: string, baseVersionId: string, decision: 'accept' | 'reject') {
    return this.transact(userId, designId, (state) => decidePreview(state, proposalId, baseVersionId, decision));
  }
  restore(userId: string, designId: string, baseVersionId: string, sourceVersionId: string) {
    return this.transact(userId, designId, (state) => restoreVersion(state, baseVersionId, sourceVersionId));
  }
  freeze(userId: string, designId: string, baseVersionId: string, view: GarmentView) {
    GarmentViewSchema.parse(view);
    return this.transact(userId, designId, (state) => freezeSnapshot(state, baseVersionId, view));
  }
  recordTechnicalFlat(userId: string, designId: string, artifact: TechnicalFlatArtifact, assets: FashionImageAsset[]) {
    return this.transact(userId, designId, (state) => {
      const snapshot = state.snapshots[artifact.confirmedSnapshotId];
      if (
        !snapshot ||
        artifact.designId !== designId ||
        artifact.snapshotHash !== snapshot.snapshotHash ||
        canonicalJson(artifact.includedPartIds) !== canonicalJson(snapshot.parts.map((p) => p.partId))
      )
        throw new FashionError('invalid_flat_snapshot');
      const existing = state.technicalFlats?.[artifact.id];
      if (existing) {
        // First successful CAS owns creation time; every semantic field must still match.
        if (canonicalJson(existing) !== canonicalJson({ ...artifact, createdAt: existing.createdAt }))
          throw new FashionError('immutable_record');
        return existing;
      }
      if (
        assets.length !== 2 ||
        assets[0].id !== artifact.svgAssetId ||
        assets[1].id !== artifact.pngAssetId ||
        assets.some((a) => a.kind !== 'technical-flat' || state.design.assets?.[a.id])
      )
        throw new FashionError('invalid_flat_asset');
      state.design.assets = {
        ...state.design.assets,
        ...Object.fromEntries(assets.map((a) => [a.id, structuredClone(a)])),
      };
      state.technicalFlats = { ...state.technicalFlats, [artifact.id]: structuredClone(artifact) };
      audit(state, 'flat-rendered', snapshot.versionId, artifact.id);
      return artifact;
    });
  }
}
