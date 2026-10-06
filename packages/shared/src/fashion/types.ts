import type { RichFileBlock, RichMediaGalleryBlock } from '../types/rich.js';
import type {
  EditProposalInput,
  FashionJsonValue,
  FlatGeometry,
  GarmentComponentInput,
  GarmentDomainId,
  GarmentView,
  GeometryEvidence,
} from './schema.js';

export interface FashionDesign {
  id: string;
  userId: string;
  threadId: string;
  title: string;
  sourceAssetIdsByView: Partial<Record<GarmentView, string>>;
  assets?: Record<string, FashionImageAsset>;
  activeVersionId: string | null;
  schemaVersion: 1;
  revision: number;
  createdAt: number;
  updatedAt: number;
}
export interface FashionImageAsset {
  id: string;
  urlPath: `/uploads/${string}`;
  mimeType: string;
  kind: 'source' | 'reference' | 'preview' | 'technical-flat';
  publication?: { catId: string; block: RichMediaGalleryBlock };
}
export interface GarmentComponentSnapshot extends GarmentComponentInput {
  partHash: string;
  confirmationId: string | null;
}
export interface DomainSnapshot {
  domainId: GarmentDomainId;
  components: GarmentComponentSnapshot[];
}
export type GarmentDomains = Record<GarmentDomainId, DomainSnapshot>;
export interface GarmentVersion {
  id: string;
  designId: string;
  parentVersionId: string | null;
  status: 'draft' | 'candidate' | 'adopted' | 'discarded';
  previewAssetId: string | null;
  domains: GarmentDomains;
  editProposalId: string | null;
  restoredFromVersionId?: string;
  versionHash: string;
  createdAt: number;
}
export interface ConfirmationRecord {
  id: string;
  designId: string;
  partId: string;
  partHash: string;
  versionId: string;
  evidenceOrigin: 'photo' | 'user-specified';
  confirmedBy: string;
  confirmedAt: number;
}
export interface EditProposal extends EditProposalInput {
  id: string;
  designId: string;
  protectedComponentIds: string[];
  editMaskAssetId?: string;
  status: 'queued' | 'generating' | 'ready' | 'failed' | 'accepted' | 'rejected';
  operationId: string;
  workerLease?: { token: string; expiresAt: number };
  candidateVersionId: string | null;
  adoptedVersionId: string | null;
  failure: string | null;
  createdAt: number;
}
export interface PreviewValidation {
  proposalId: string;
  affectedPartIds: string[];
  protectedDriftPartIds: string[];
  adoptionBlocked: boolean;
}
export interface ConfirmedSnapshot {
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
    /** Absent only on legacy snapshots; renderer requires explicit drawing geometry. */
    flatGeometry?: FlatGeometry;
    domainId?: GarmentDomainId;
    label?: string;
    attributes: Record<string, FashionJsonValue>;
  }>;
  omittedUnknownPartIds: string[];
  snapshotHash: string;
  frozenAt: number;
}
export interface TechnicalFlatArtifact {
  id: string;
  designId: string;
  confirmedSnapshotId: string;
  snapshotHash: string;
  svgAssetId: string;
  pngAssetId: string;
  includedPartIds: string[];
  rendererVersion: string;
  publication: { blocks: Array<RichMediaGalleryBlock | RichFileBlock> };
  createdAt: number;
}
export interface FashionAuditEvent {
  id: string;
  kind: 'analyzed' | 'confirmed' | 'adopted' | 'discarded' | 'restored' | 'frozen' | 'flat-rendered';
  userId: string;
  versionId: string;
  sourceId: string | null;
  createdAt: number;
}
/** One revision-checked aggregate; immutable records are append-only, proposals own job lifecycle. */
export interface FashionDesignState {
  design: FashionDesign;
  versions: Record<string, GarmentVersion>;
  confirmations: Record<string, ConfirmationRecord>;
  proposals: Record<string, EditProposal>;
  validations: Record<string, PreviewValidation>;
  snapshots: Record<string, ConfirmedSnapshot>;
  technicalFlats?: Record<string, TechnicalFlatArtifact>;
  events: FashionAuditEvent[];
}
