import { z } from 'zod';

export const GARMENT_DOMAIN_IDS = [
  'silhouette',
  'collar',
  'sleeve',
  'body-panel',
  'closure',
  'pocket',
  'hem',
  'fabric',
] as const;
export const GARMENT_VIEWS = ['front', 'back', 'left-side', 'right-side'] as const;
export const GarmentDomainIdSchema = z.enum(GARMENT_DOMAIN_IDS);
export const GarmentViewSchema = z.enum(GARMENT_VIEWS);
export type GarmentDomainId = z.infer<typeof GarmentDomainIdSchema>;
export type GarmentView = z.infer<typeof GarmentViewSchema>;
export type FashionJsonValue =
  | string
  | number
  | boolean
  | null
  | FashionJsonValue[]
  | { [key: string]: FashionJsonValue };
const JsonSchema: z.ZodType<FashionJsonValue> = z.lazy(() =>
  z.union([
    z.string().max(4000),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonSchema).max(128),
    z.record(JsonSchema),
  ]),
);
export const FashionIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_-]+$/);
const coordinate = z.number().finite().min(0).max(1);
export const GeometryEvidenceSchema = z
  .object({
    polygon: z
      .array(z.tuple([coordinate, coordinate]))
      .min(3)
      .max(512),
    maskAssetId: FashionIdSchema.optional(),
  })
  .strict();
export type GeometryEvidence = z.infer<typeof GeometryEvidenceSchema>;
export const EvidenceRefSchema = z.discriminatedUnion('origin', [
  z
    .object({
      origin: z.literal('photo'),
      view: GarmentViewSchema,
      assetId: FashionIdSchema,
      geometry: GeometryEvidenceSchema.optional(),
    })
    .strict(),
  z
    .object({
      origin: z.literal('user-specified'),
      userStatement: z.string().trim().min(1).max(4000),
      view: GarmentViewSchema.optional(),
    })
    .strict(),
]);
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
const viewGeometry = z
  .object(
    Object.fromEntries(GARMENT_VIEWS.map((v) => [v, GeometryEvidenceSchema.optional()])) as Record<
      GarmentView,
      z.ZodOptional<typeof GeometryEvidenceSchema>
    >,
  )
  .strict();
const visibility = z.enum(['visible', 'partial', 'not-visible']);
const viewVisibility = z
  .object(
    Object.fromEntries(GARMENT_VIEWS.map((v) => [v, visibility.optional()])) as Record<
      GarmentView,
      z.ZodOptional<typeof visibility>
    >,
  )
  .strict();
export const GARMENT_INSTANCE_TYPES: Record<GarmentDomainId, readonly string[]> = {
  silhouette: ['silhouette'],
  collar: ['collar', 'hood', 'none'],
  sleeve: ['sleeve', 'shoulder', 'none'],
  'body-panel': ['panel', 'seam', 'yoke', 'none'],
  closure: ['closure', 'none'],
  pocket: ['pocket', 'none'],
  hem: ['hem', 'slit'],
  fabric: ['fabric', 'trim'],
};
export const GarmentComponentInputSchema = z
  .object({
    partId: FashionIdSchema,
    domainId: GarmentDomainIdSchema,
    instanceType: z.string().min(1).max(80),
    label: z.string().trim().min(1).max(200),
    attributes: z.record(JsonSchema),
    geometryByView: viewGeometry,
    visibilityByView: viewVisibility,
    evidence: z.array(EvidenceRefSchema).max(32),
  })
  .strict()
  .superRefine((part, ctx) => {
    if (!GARMENT_INSTANCE_TYPES[part.domainId].includes(part.instanceType)) {
      ctx.addIssue({ code: 'custom', path: ['instanceType'], message: 'Instance type does not belong to this domain' });
    }
  });
export type GarmentComponentInput = z.infer<typeof GarmentComponentInputSchema>;
const domain = z
  .object({ domainId: GarmentDomainIdSchema, components: z.array(GarmentComponentInputSchema).max(128) })
  .strict();
export const GarmentDomainsSchema = z
  .object(Object.fromEntries(GARMENT_DOMAIN_IDS.map((id) => [id, domain])) as Record<GarmentDomainId, typeof domain>)
  .strict()
  .superRefine((domains, ctx) => {
    const ids = new Set<string>();
    for (const id of GARMENT_DOMAIN_IDS) {
      if (domains[id].domainId !== id)
        ctx.addIssue({ code: 'custom', path: [id], message: 'Domain identity mismatch' });
      for (const part of domains[id].components) {
        if (part.domainId !== id || ids.has(part.partId)) {
          ctx.addIssue({ code: 'custom', path: [id, 'components'], message: 'Duplicate or misplaced part' });
        }
        ids.add(part.partId);
      }
    }
  });
export type GarmentDomainsInput = z.infer<typeof GarmentDomainsSchema>;

export const EditProposalInputSchema = z
  .object({
    baseVersionId: FashionIdSchema,
    targetDomainId: GarmentDomainIdSchema,
    targetPartIds: z.array(FashionIdSchema).min(1).max(128),
    instruction: z.string().trim().min(1).max(4000).optional(),
    referenceAssetId: FashionIdSchema.optional(),
    idempotencyKey: FashionIdSchema,
  })
  .strict()
  .refine((input) => input.instruction || input.referenceAssetId, 'Text or reference image required');
export type EditProposalInput = z.infer<typeof EditProposalInputSchema>;
