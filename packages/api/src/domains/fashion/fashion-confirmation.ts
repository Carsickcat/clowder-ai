import {
  type ConfirmedSnapshot,
  type FashionDesignState,
  GARMENT_DOMAIN_IDS,
  type GarmentComponentInput,
  GarmentComponentInputSchema,
  type GarmentVersion,
  type GarmentView,
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
  validConfirmation,
} from './fashion-invariants.js';

export interface ConfirmPartsInput {
  baseVersionId: string;
  parts: Array<{
    partId: string;
    partHash: string;
    evidenceOrigin: 'photo' | 'user-specified';
    userStatement?: string;
    replacement?: GarmentComponentInput;
  }>;
}
export function confirmParts(state: FashionDesignState, input: ConfirmPartsInput) {
  const base = currentBase(state, input.baseVersionId);
  if (!input.parts.length || new Set(input.parts.map((p) => p.partId)).size !== input.parts.length)
    throw new FashionError('invalid_confirmation', 400);
  const domains = structuredClone(base.domains);
  const versionId = fashionId();
  for (const item of input.parts) {
    const old = allParts(base).find((p) => p.partId === item.partId);
    if (!old || old.partHash !== item.partHash) throw new FashionError('stale_part', 409, [item.partId]);
    // Reconfirming cannot turn a designer-directed edit into a fact from the old source photo.
    if (item.evidenceOrigin === 'photo' && old.evidence.some((e) => e.origin === 'user-specified')) {
      throw new FashionError('new_photo_required', 409, [item.partId]);
    }
    let part = domains[old.domainId].components.find((p) => p.partId === item.partId)!;
    if (item.replacement) {
      const replacement = GarmentComponentInputSchema.parse(item.replacement);
      if (
        replacement.partId !== old.partId ||
        replacement.domainId !== old.domainId ||
        fashionHash(replacement.visibilityByView) !== fashionHash(old.visibilityByView)
      )
        throw new FashionError('invalid_correction', 400);
      part = { ...replacement, partHash: '', confirmationId: null };
      domains[old.domainId].components = domains[old.domainId].components.map((p) =>
        p.partId === part.partId ? part : p,
      );
    }
    if (item.evidenceOrigin === 'user-specified') {
      if (!item.userStatement?.trim()) throw new FashionError('user_statement_required', 400);
      part.evidence = [...part.evidence, { origin: 'user-specified', userStatement: item.userStatement.trim() }];
    } else if (
      item.evidenceOrigin !== 'photo' ||
      !part.evidence.some((e) => e.origin === 'photo' && part.visibilityByView[e.view] !== 'not-visible')
    ) {
      throw new FashionError('not_visible', 409, [part.partId]);
    }
    assertPhotoEvidence(state, part);
    part.partHash = hashPart(part);
    part.confirmationId = fashionId();
    state.confirmations[part.confirmationId] = {
      id: part.confirmationId,
      designId: state.design.id,
      partId: part.partId,
      partHash: part.partHash,
      versionId,
      evidenceOrigin: item.evidenceOrigin,
      confirmedBy: state.design.userId,
      confirmedAt: Date.now(),
    };
  }
  const version = appendVersion(state, {
    ...base,
    id: versionId,
    parentVersionId: base.id,
    status: 'adopted',
    domains,
  });
  audit(state, 'confirmed', version.id, base.id);
  return version;
}

export function freezeSnapshot(state: FashionDesignState, baseVersionId: string, view: GarmentView): ConfirmedSnapshot {
  const version = currentBase(state, baseVersionId);
  if (!state.design.sourceAssetIdsByView[view]) throw new FashionError('missing_view_evidence');
  const parts: ConfirmedSnapshot['parts'] = [];
  const omitted: string[] = [];
  const missing: string[] = [];
  const missingDrawing: string[] = [];
  for (const domainId of GARMENT_DOMAIN_IDS) {
    const components = version.domains[domainId].components;
    if (!components.length) missing.push(domainId);
    for (const part of components) {
      const confirmation = validConfirmation(state, part);
      const visible = part.visibilityByView[view] === 'visible' || part.visibilityByView[view] === 'partial';
      const specified =
        confirmation?.evidenceOrigin === 'user-specified' &&
        part.evidence.some((e) => e.origin === 'user-specified' && (!e.view || e.view === view));
      if (!visible && !specified) {
        omitted.push(part.partId);
        continue;
      }
      if (!confirmation) {
        missing.push(part.partId);
        continue;
      }
      // An explicitly confirmed absence has no line to render.
      if (part.instanceType === 'none') continue;
      const geometry = part.geometryByView[view];
      if (!geometry) {
        missing.push(part.partId);
        continue;
      }
      const flatGeometry = part.flatGeometryByView?.[view];
      if (!flatGeometry || (part.domainId !== 'fabric' && !flatGeometry.paths.length)) {
        missingDrawing.push(part.partId);
        continue;
      }
      parts.push({
        partId: part.partId,
        partHash: part.partHash,
        confirmationId: confirmation.id,
        sourceVersionId: confirmation.versionId,
        evidenceOrigin: confirmation.evidenceOrigin,
        geometry: structuredClone(geometry),
        flatGeometry: structuredClone(flatGeometry),
        domainId: part.domainId,
        label: part.label,
        attributes: structuredClone(part.attributes),
      });
    }
  }
  if (missing.length || version.status !== 'adopted') throw new FashionError('unconfirmed_parts', 409, missing);
  if (missingDrawing.length) throw new FashionError('flat_geometry_required', 409, missingDrawing);
  if (!parts.length) throw new FashionError('unconfirmed_parts', 409);
  const payload = { designId: state.design.id, versionId: version.id, view, parts, omittedUnknownPartIds: omitted };
  const snapshot = { ...payload, id: fashionId(), snapshotHash: fashionHash(payload), frozenAt: Date.now() };
  state.snapshots[snapshot.id] = snapshot;
  audit(state, 'frozen', version.id, snapshot.id);
  return snapshot;
}

export function restoreVersion(state: FashionDesignState, baseVersionId: string, sourceId: string): GarmentVersion {
  const base = currentBase(state, baseVersionId);
  const source = state.versions[sourceId];
  if (!source || source.status !== 'adopted') throw new FashionError('not_adopted', 400);
  const restored = appendVersion(state, {
    ...structuredClone(source),
    id: fashionId(),
    parentVersionId: base.id,
    restoredFromVersionId: sourceId,
    editProposalId: null,
    status: 'adopted',
  });
  audit(state, 'restored', restored.id, source.id);
  return restored;
}
