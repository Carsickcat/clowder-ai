import {
  type EditProposal,
  type EditProposalInput,
  EditProposalInputSchema,
  type FashionDesignState,
  type FashionImageAsset,
  type GarmentComponentInput,
  type GarmentDomains,
  GarmentDomainsSchema,
  type GarmentVersion,
  type PreviewValidation,
} from '@cat-cafe/shared';
import {
  allParts,
  appendVersion,
  assertPhotoEvidence,
  audit,
  currentBase,
  FashionError,
  fashionHash,
  fashionId,
  hashPart,
} from './fashion-invariants.js';

export interface PreviewResult {
  components: GarmentComponentInput[];
  previewAssetId: string;
  affectedPartIds: string[];
  protectedDriftPartIds: string[];
  previewAsset?: FashionImageAsset;
  publication?: FashionImageAsset['publication'];
}

function validatePreview(
  proposal: EditProposal,
  base: GarmentVersion,
  domains: GarmentDomains,
  reported: Pick<PreviewResult, 'affectedPartIds' | 'protectedDriftPartIds'>,
): PreviewValidation {
  const before = new Map(allParts(base).map((part) => [part.partId, part.partHash]));
  const after = new Map(
    Object.values(domains).flatMap((domain) => domain.components.map((part) => [part.partId, part.partHash] as const)),
  );
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter((id) => before.get(id) !== after.get(id));
  const selected = new Set(proposal.targetPartIds);
  // Provider reports can add visual drift; omissions cannot hide canonical changes.
  const affectedPartIds = [...new Set([...changed, ...reported.affectedPartIds])];
  const protectedDriftPartIds = [
    ...new Set([...reported.protectedDriftPartIds, ...affectedPartIds.filter((id) => !selected.has(id))]),
  ];
  return {
    proposalId: proposal.id,
    affectedPartIds,
    protectedDriftPartIds,
    adoptionBlocked: protectedDriftPartIds.length > 0,
  };
}

export function proposeEdit(state: FashionDesignState, raw: EditProposalInput) {
  const input = EditProposalInputSchema.parse(raw);
  const existing = Object.values(state.proposals).find((p) => p.idempotencyKey === input.idempotencyKey);
  if (existing) {
    if (
      fashionHash(
        EditProposalInputSchema.parse({
          baseVersionId: existing.baseVersionId,
          targetDomainId: existing.targetDomainId,
          targetPartIds: existing.targetPartIds,
          instruction: existing.instruction,
          referenceAssetId: existing.referenceAssetId,
          idempotencyKey: existing.idempotencyKey,
        }),
      ) !== fashionHash(input)
    )
      throw new FashionError('idempotency_conflict');
    return existing;
  }
  const base = currentBase(state, input.baseVersionId);
  if (base.status !== 'adopted') throw new FashionError('initial_confirmation_required');
  const parts = base.domains[input.targetDomainId].components;
  if (
    new Set(input.targetPartIds).size !== input.targetPartIds.length ||
    input.targetPartIds.some((id) => !parts.some((p) => p.partId === id))
  ) {
    throw new FashionError('invalid_target_parts', 400);
  }
  const proposal = {
    ...input,
    id: fashionId(),
    designId: state.design.id,
    protectedComponentIds: allParts(base)
      .filter((p) => !input.targetPartIds.includes(p.partId))
      .map((p) => p.partId),
    status: 'queued' as const,
    operationId: fashionId(),
    candidateVersionId: null,
    adoptedVersionId: null,
    failure: null,
    createdAt: Date.now(),
  };
  state.proposals[proposal.id] = proposal;
  return proposal;
}
export function getProposal(state: FashionDesignState, id: string) {
  const proposal = state.proposals[id];
  if (!proposal) throw new FashionError('proposal_not_found', 404);
  return proposal;
}
export function retryPreview(state: FashionDesignState, id: string, baseVersionId: string) {
  const proposal = getProposal(state, id);
  currentBase(state, baseVersionId);
  if (proposal.baseVersionId !== baseVersionId) throw new FashionError('stale_version');
  if (proposal.status === 'generating' && proposal.workerLease && proposal.workerLease.expiresAt <= Date.now()) {
    proposal.status = 'failed';
    proposal.failure = 'preview_worker_expired';
  }
  if (proposal.status === 'queued' || proposal.status === 'generating' || proposal.status === 'ready') return proposal;
  if (proposal.status !== 'failed') throw new FashionError('proposal_terminal');
  proposal.status = 'queued';
  proposal.operationId = fashionId();
  delete proposal.workerLease;
  proposal.failure = null;
  return proposal;
}
export function completePreview(
  state: FashionDesignState,
  id: string,
  operationId: string,
  result: PreviewResult,
  leaseToken?: string,
) {
  const proposal = getProposal(state, id);
  if (proposal.operationId !== operationId || !['queued', 'generating'].includes(proposal.status)) return proposal;
  if (
    proposal.workerLease &&
    (proposal.workerLease.token !== leaseToken || proposal.workerLease.expiresAt <= Date.now())
  )
    return proposal;
  if (!result.previewAssetId) throw new FashionError('preview_asset_required', 400);
  if (result.previewAsset) {
    if (
      result.previewAsset.id !== result.previewAssetId ||
      result.previewAsset.kind !== 'preview' ||
      state.design.assets?.[result.previewAssetId]
    )
      throw new FashionError('invalid_preview_asset', 400);
    state.design.assets = {
      ...state.design.assets,
      [result.previewAssetId]: {
        ...result.previewAsset,
        ...(result.publication ? { publication: result.publication } : {}),
      },
    };
  }
  const base = state.versions[proposal.baseVersionId];
  const input = Object.fromEntries(
    Object.entries(base.domains).map(([domainId, domain]) => [
      domainId,
      {
        domainId,
        components:
          domainId === proposal.targetDomainId
            ? result.components
            : domain.components.map(({ partHash: _hash, confirmationId: _confirmation, ...part }) => part),
      },
    ]),
  );
  const parsed = GarmentDomainsSchema.parse(input);
  const old = base.domains[proposal.targetDomainId].components;
  const domains = structuredClone(base.domains);
  domains[proposal.targetDomainId].components = parsed[proposal.targetDomainId].components.map((part) => {
    const previous = old.find((p) => p.partId === part.partId);
    assertPhotoEvidence(state, part);
    if (previous && hashPart(part) === previous.partHash) return structuredClone(previous);
    // Generated replacements are designer-directed facts, never new photographic evidence.
    if (previous && fashionHash(previous.visibilityByView) !== fashionHash(part.visibilityByView))
      throw new FashionError('visibility_drift', 409, [part.partId]);
    const edited = {
      ...part,
      evidence: [
        ...part.evidence,
        {
          origin: 'user-specified' as const,
          userStatement: proposal.instruction ?? `Reference: ${proposal.referenceAssetId}`,
        },
      ],
    };
    return { ...edited, partHash: hashPart(edited), confirmationId: null };
  });
  state.validations[proposal.id] = validatePreview(proposal, base, domains, result);
  const candidate = appendVersion(state, {
    id: fashionId(),
    designId: state.design.id,
    parentVersionId: base.id,
    status: 'candidate',
    domains,
    previewAssetId: result.previewAssetId,
    editProposalId: proposal.id,
  });
  proposal.candidateVersionId = candidate.id;
  proposal.status = 'ready';
  proposal.failure = null;
  return proposal;
}
export function decidePreview(
  state: FashionDesignState,
  id: string,
  baseVersionId: string,
  decision: 'accept' | 'reject',
): GarmentVersion {
  const proposal = getProposal(state, id);
  if (proposal.baseVersionId !== baseVersionId) throw new FashionError('stale_version');
  if (proposal.status === 'accepted' && decision === 'accept') return state.versions[proposal.adoptedVersionId!];
  if (proposal.status === 'rejected' && decision === 'reject') {
    return Object.values(state.versions).find((v) => v.editProposalId === id && v.status === 'discarded')!;
  }
  const base = currentBase(state, baseVersionId);
  if (proposal.status !== 'ready' || !proposal.candidateVersionId) throw new FashionError('preview_not_ready');
  const candidate = state.versions[proposal.candidateVersionId];
  if (decision === 'accept') {
    // Recheck persisted candidates without rewriting their immutable validation receipts.
    const validation = validatePreview(proposal, base, candidate.domains, state.validations[id]);
    if (validation.adoptionBlocked || state.validations[id].adoptionBlocked) {
      throw new FashionError('protected_drift', 409, validation.protectedDriftPartIds);
    }
  }
  if (decision !== 'accept' && decision !== 'reject') throw new FashionError('invalid_decision', 400);
  const domains = structuredClone(candidate.domains);
  const versionId = fashionId();
  if (decision === 'accept')
    for (const part of domains[proposal.targetDomainId].components) {
      const previous = base.domains[proposal.targetDomainId].components.find((p) => p.partId === part.partId);
      if (previous?.partHash === part.partHash) continue;
      part.confirmationId = fashionId();
      state.confirmations[part.confirmationId] = {
        id: part.confirmationId,
        designId: state.design.id,
        partId: part.partId,
        partHash: part.partHash,
        versionId,
        evidenceOrigin: 'user-specified',
        confirmedBy: state.design.userId,
        confirmedAt: Date.now(),
      };
    }
  const version = appendVersion(state, {
    ...candidate,
    id: versionId,
    parentVersionId: base.id,
    status: decision === 'accept' ? 'adopted' : 'discarded',
    domains,
  });
  proposal.status = decision === 'accept' ? 'accepted' : 'rejected';
  if (decision === 'accept') proposal.adoptedVersionId = version.id;
  audit(state, decision === 'accept' ? 'adopted' : 'discarded', version.id, candidate.id);
  return version;
}
