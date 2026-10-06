import {
  EditProposalInputSchema,
  FashionIdSchema,
  type FashionImageAsset,
  GarmentComponentInputSchema,
  type GarmentView,
  GarmentViewSchema,
} from '@cat-cafe/shared';
import multipart from '@fastify/multipart';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { FashionDesignService } from '../domains/fashion/FashionDesignService.js';
import { FashionError } from '../domains/fashion/fashion-invariants.js';
import { ImageUploadError } from '../utils/image-storage.js';
import { resolveDirectLocalAuthorizationUserId } from '../utils/request-identity.js';
import { readFashionImages, saveFashionImage } from './fashion-images.js';

export interface FashionPreviewScheduler {
  schedule(userId: string, designId: string, proposalId: string, operationId: string): void;
}
export interface FashionDesignRoutesOptions {
  service: FashionDesignService;
  uploadDir: string;
  threadStore: { get(id: string): { createdBy: string } | null | Promise<{ createdBy: string } | null> };
  previewWorker?: FashionPreviewScheduler;
}
const baseSchema = z.object({ baseVersionId: FashionIdSchema }).strict();
const confirmSchema = baseSchema
  .extend({
    parts: z
      .array(
        z
          .object({
            partId: FashionIdSchema,
            partHash: z.string().regex(/^[a-f0-9]{64}$/),
            evidenceOrigin: z.enum(['photo', 'user-specified']),
            userStatement: z.string().trim().min(1).max(4000).optional(),
            replacement: GarmentComponentInputSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(1024),
  })
  .strict();
const paramsSchema = z.object({ id: FashionIdSchema, proposalId: FashionIdSchema.optional() }).strict();
const operation = (proposal: { id: string; operationId: string; status: string }) => ({
  proposalId: proposal.id,
  operationId: proposal.operationId,
  status: proposal.status,
});

export const fashionDesignRoutes: FastifyPluginAsync<FashionDesignRoutesOptions> = async (app, opts) => {
  const { service } = opts;
  await app.register(multipart);
  app.addHook('onRequest', async (request) => {
    if (!resolveDirectLocalAuthorizationUserId(request)) throw new FashionError('authentication_required', 401);
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof FashionError)
      return reply.code(error.statusCode).send({ error: error.code, partIds: error.partIds });
    if (error instanceof z.ZodError || error instanceof ImageUploadError)
      return reply.code(400).send({ error: 'invalid_request' });
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500)
      return reply.code(error.statusCode).send({ error: 'invalid_request' });
    request.log.error({ err: error }, 'Fashion request failed');
    return reply.code(500).send({ error: 'internal_error' });
  });
  const user = (request: FastifyRequest) => resolveDirectLocalAuthorizationUserId(request)!;
  async function ownedThread(userId: string, threadId: string) {
    const thread = await opts.threadStore.get(threadId);
    if (!thread || thread.createdBy !== userId) throw new FashionError('not_found', 404);
  }
  async function owned(request: FastifyRequest) {
    const { id, proposalId } = paramsSchema.parse(request.params);
    const userId = user(request);
    const state = await service.get(userId, id);
    await ownedThread(userId, state.design.threadId);
    return { id, proposalId, userId, state };
  }
  app.post('/api/fashion-designs', async (request, reply) => {
    const { fields, images } = await readFashionImages(request, 'source');
    const input = z
      .object({ threadId: FashionIdSchema, title: z.string().trim().min(1).max(200) })
      .strict()
      .parse(fields);
    const userId = user(request);
    await ownedThread(userId, input.threadId);
    const assets: Record<string, FashionImageAsset> = {};
    const sourceAssetIdsByView: Partial<Record<GarmentView, string>> = {};
    for (const image of images) {
      const asset = await saveFashionImage(image, opts.uploadDir, 'source');
      assets[asset.id] = asset;
      sourceAssetIdsByView[GarmentViewSchema.parse(image.field)] = asset.id;
    }
    const design = await service.create({ ...input, userId, sourceAssetIdsByView, assets });
    return reply.code(201).send({ design });
  });
  app.get('/api/fashion-designs', async (request) => {
    const { threadId } = z.object({ threadId: FashionIdSchema }).strict().parse(request.query);
    await ownedThread(user(request), threadId);
    return { designs: (await service.list(user(request), threadId)).map((state) => state.design) };
  });
  app.get('/api/fashion-designs/:id', async (request) => (await owned(request)).state);
  app.post('/api/fashion-designs/:id/reference-images', async (request, reply) => {
    const { userId, id } = await owned(request);
    const { images } = await readFashionImages(request, 'reference');
    const asset = await saveFashionImage(images[0], opts.uploadDir, 'reference');
    await service.addReferenceAsset(userId, id, asset);
    return reply.code(201).send({ asset });
  });
  app.post('/api/fashion-designs/:id/confirmations', { bodyLimit: 512 * 1024 }, async (request) => {
    const { userId, id } = await owned(request);
    return { version: await service.confirm(userId, id, confirmSchema.parse(request.body)) };
  });
  app.post('/api/fashion-designs/:id/edit-proposals', { bodyLimit: 32 * 1024 }, async (request, reply) => {
    const { userId, id, state } = await owned(request);
    if (!opts.previewWorker) throw new FashionError('preview_provider_unavailable', 503);
    const input = EditProposalInputSchema.parse(request.body);
    if (input.referenceAssetId && state.design.assets?.[input.referenceAssetId]?.kind !== 'reference')
      throw new FashionError('reference_not_found', 404);
    const proposal = await service.propose(userId, id, input);
    opts.previewWorker.schedule(userId, id, proposal.id, proposal.operationId);
    return reply.code(202).send(operation(proposal));
  });
  app.get('/api/fashion-designs/:id/edit-proposals/:proposalId', async (request) => {
    const { state, proposalId } = await owned(request);
    const proposal = state.proposals[proposalId!];
    if (!proposal) throw new FashionError('proposal_not_found', 404);
    return {
      ...operation(proposal),
      failure: proposal.failure,
      candidateVersionId: proposal.candidateVersionId,
      validation: state.validations[proposal.id] ?? null,
    };
  });
  app.post('/api/fashion-designs/:id/edit-proposals/:proposalId/retry', async (request, reply) => {
    const { userId, id, proposalId } = await owned(request);
    if (!opts.previewWorker) throw new FashionError('preview_provider_unavailable', 503);
    const { baseVersionId } = baseSchema.parse(request.body);
    const proposal = await service.retry(userId, id, proposalId!, baseVersionId);
    opts.previewWorker.schedule(userId, id, proposal.id, proposal.operationId);
    return reply.code(202).send(operation(proposal));
  });
  app.post('/api/fashion-designs/:id/edit-proposals/:proposalId/decision', async (request) => {
    const { userId, id, proposalId } = await owned(request);
    const body = baseSchema
      .extend({ decision: z.enum(['accept', 'reject']) })
      .strict()
      .parse(request.body);
    return { version: await service.decide(userId, id, proposalId!, body.baseVersionId, body.decision) };
  });
  app.post('/api/fashion-designs/:id/restore', async (request) => {
    const { userId, id } = await owned(request);
    const body = baseSchema.extend({ sourceVersionId: FashionIdSchema }).strict().parse(request.body);
    return { version: await service.restore(userId, id, body.baseVersionId, body.sourceVersionId) };
  });
  app.post('/api/fashion-designs/:id/confirmed-snapshots', async (request, reply) => {
    const { userId, id } = await owned(request);
    const body = baseSchema.extend({ view: GarmentViewSchema }).strict().parse(request.body);
    return reply.code(201).send({ snapshot: await service.freeze(userId, id, body.baseVersionId, body.view) });
  });
};
