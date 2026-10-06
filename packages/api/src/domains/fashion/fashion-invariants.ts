import { createHash, randomUUID } from 'node:crypto';
import type {
  FashionAuditEvent,
  FashionDesignState,
  GarmentComponentInput,
  GarmentComponentSnapshot,
  GarmentDomains,
  GarmentDomainsInput,
  GarmentVersion,
} from '@cat-cafe/shared';

export class FashionError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode = 409,
    public readonly partIds: string[] = [],
  ) {
    super(code);
    this.name = 'FashionError';
  }
}
export const fashionId = () => randomUUID();

/** Object key order is irrelevant; array order remains meaningful. Not a prompt/model hash. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    // Optional TS properties may be present as undefined; JSON persistence omits them.
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  throw new FashionError('non_json_value', 400);
}
export const fashionHash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
export function hashPart(input: GarmentComponentInput): string {
  // Include evidence/visibility so a confirmation cannot silently change its provenance.
  const { partId, domainId, instanceType, label, attributes, geometryByView, visibilityByView, evidence } = input;
  return fashionHash({ partId, domainId, instanceType, label, attributes, geometryByView, visibilityByView, evidence });
}
export function materializeDomains(input: GarmentDomainsInput): GarmentDomains {
  return Object.fromEntries(
    Object.entries(input).map(([id, domain]) => [
      id,
      {
        domainId: domain.domainId,
        components: domain.components.map((part) => ({
          ...structuredClone(part),
          partHash: hashPart(part),
          confirmationId: null,
        })),
      },
    ]),
  ) as GarmentDomains;
}
export const allParts = (version: GarmentVersion) => Object.values(version.domains).flatMap((d) => d.components);
export function currentBase(state: FashionDesignState, id: string): GarmentVersion {
  const version = state.versions[id];
  if (
    !version ||
    (state.design.activeVersionId !== id && !(state.design.activeVersionId === null && version.status === 'draft'))
  ) {
    throw new FashionError('stale_version');
  }
  return version;
}
export function appendVersion(
  state: FashionDesignState,
  input: Omit<GarmentVersion, 'versionHash' | 'createdAt'>,
): GarmentVersion {
  const version = { ...input, versionHash: fashionHash(input.domains), createdAt: Date.now() };
  state.versions[version.id] = version;
  if (version.status === 'adopted') state.design.activeVersionId = version.id;
  return version;
}
export function audit(
  state: FashionDesignState,
  kind: FashionAuditEvent['kind'],
  versionId: string,
  sourceId: string | null = null,
) {
  state.events.push({ id: fashionId(), kind, versionId, sourceId, userId: state.design.userId, createdAt: Date.now() });
}
export function validConfirmation(state: FashionDesignState, part: GarmentComponentSnapshot) {
  if (!part.confirmationId) return null;
  const record = state.confirmations[part.confirmationId];
  if (
    !record ||
    record.designId !== state.design.id ||
    record.partId !== part.partId ||
    record.partHash !== hashPart(part)
  )
    return null;
  const source = state.versions[record.versionId];
  return source &&
    allParts(source).some(
      (p) => p.partId === part.partId && p.partHash === record.partHash && p.confirmationId === record.id,
    )
    ? record
    : null;
}
export function assertPhotoEvidence(state: FashionDesignState, part: GarmentComponentInput) {
  for (const evidence of part.evidence) {
    if (evidence.origin === 'photo' && state.design.sourceAssetIdsByView[evidence.view] !== evidence.assetId) {
      throw new FashionError('invalid_photo_evidence', 400, [part.partId]);
    }
  }
  for (const [view, visibility] of Object.entries(part.visibilityByView)) {
    if (visibility !== 'not-visible' && !part.evidence.some((e) => e.origin === 'photo' && e.view === view)) {
      throw new FashionError('missing_photo_evidence', 400, [part.partId]);
    }
  }
}
