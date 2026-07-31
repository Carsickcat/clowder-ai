import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  InspectionDecisionConflictError,
  InspectionSourceScopeMismatchError,
  InspectionSourceUnavailableError,
} from '../domains/observability/InspectionService.js';
import {
  InspectionIdempotencyConflictError,
  InspectionImmutableRecordError,
  InspectionNotFoundError,
  InspectionRevisionConflictError,
} from '../domains/observability/SqliteInspectionStore.js';
import { resolveHeaderUserId } from '../utils/request-identity.js';

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._-]+$/);

const checkSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(120),
    query: z.string().trim().min(1).max(500),
    operator: z.enum(['lte', 'gte', 'relative_lte', 'relative_gte']),
    threshold: z.number().finite(),
    unit: z.string().trim().min(1).max(32),
    maxAgeMs: z.number().int().min(15_000).max(86_400_000),
  })
  .strict();

const checksSchema = z.array(checkSchema).min(1).max(8);

const createJobSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    service: idSchema,
    environment: idSchema,
    connectorRef: idSchema,
    checks: checksSchema,
  })
  .strict();

const reviseJobSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    checks: checksSchema,
  })
  .strict();

const createCaseSchema = z
  .object({
    jobId: idSchema,
    changeId: idSchema,
    version: z.string().trim().min(1).max(120),
  })
  .strict();

const runSchema = z
  .object({
    purpose: z.enum(['admission', 'canary', 'verification', 'post_change']),
  })
  .strict();

const decisionSchema = z
  .object({
    runId: idSchema.optional(),
    kind: z.enum(['approve', 'pause', 'resume', 'accept']),
    note: z.string().trim().min(1).max(1_000),
  })
  .strict();

export interface InspectionRoutesService {
  listSources(): unknown | Promise<unknown>;
  listJobs(userId: string): unknown | Promise<unknown>;
  createJob(userId: string, input: z.infer<typeof createJobSchema>): unknown | Promise<unknown>;
  reviseJob(
    userId: string,
    jobId: string,
    input: z.infer<typeof reviseJobSchema>,
  ): unknown | null | Promise<unknown | null>;
  createCase(userId: string, input: z.infer<typeof createCaseSchema>): unknown | Promise<unknown>;
  getCase(userId: string, caseId: string): unknown | null | Promise<unknown | null>;
  listCases(userId: string, jobId?: string): unknown | Promise<unknown>;
  startRun(
    userId: string,
    caseId: string,
    idempotencyKey: string,
    input: z.infer<typeof runSchema>,
  ): unknown | null | Promise<unknown | null>;
  recordDecision(
    userId: string,
    caseId: string,
    input: z.infer<typeof decisionSchema>,
  ): unknown | null | Promise<unknown | null>;
}

export interface InspectionsRoutesOptions {
  service: InspectionRoutesService;
}

function requireUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  const userId = resolveHeaderUserId(request);
  if (!userId) {
    reply.status(401).send({ error: 'Authentication required' });
    return null;
  }
  return userId;
}

function invalidBody(reply: FastifyReply, error: z.ZodError): void {
  reply.status(400).send({ error: 'Invalid request body', details: error.issues });
}

function idempotencyKey(request: FastifyRequest): string | null {
  const value = request.headers['idempotency-key'];
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 200 ? normalized : null;
}

export const inspectionsRoutes: FastifyPluginAsync<InspectionsRoutesOptions> = async (app, opts) => {
  const { service } = opts;

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof InspectionSourceUnavailableError) {
      reply.status(503).send({ error: 'Inspection source unavailable' });
      return;
    }
    if (error instanceof InspectionNotFoundError) {
      reply.status(404).send({ error: 'Inspection resource not found' });
      return;
    }
    if (
      error instanceof InspectionRevisionConflictError ||
      error instanceof InspectionIdempotencyConflictError ||
      error instanceof InspectionImmutableRecordError ||
      error instanceof InspectionDecisionConflictError ||
      error instanceof InspectionSourceScopeMismatchError
    ) {
      reply.status(409).send({
        error:
          error instanceof InspectionSourceScopeMismatchError
            ? 'Inspection source scope mismatch'
            : 'Inspection state conflict',
      });
      return;
    }
    if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      reply.status(error.statusCode).send({ error: 'Invalid request' });
      return;
    }
    request.log.error({ err: error }, 'inspection route failed');
    reply.status(500).send({ error: 'Inspection request failed' });
  });

  app.get('/api/observability/sources', async (request, reply) => {
    if (!requireUserId(request, reply)) return;
    return service.listSources();
  });

  app.get('/api/observability/inspection-jobs', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    return service.listJobs(userId);
  });

  app.post('/api/observability/inspection-jobs', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    const input = createJobSchema.safeParse(request.body);
    if (!input.success) {
      invalidBody(reply, input.error);
      return;
    }
    const created = await service.createJob(userId, input.data);
    reply.status(201);
    return created;
  });

  app.post('/api/observability/inspection-jobs/:id/revisions', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    const input = reviseJobSchema.safeParse(request.body);
    if (!input.success) {
      invalidBody(reply, input.error);
      return;
    }
    const { id } = request.params as { id: string };
    const revision = await service.reviseJob(userId, id, input.data);
    if (!revision) {
      reply.status(404);
      return { error: 'Inspection job not found' };
    }
    reply.status(201);
    return revision;
  });

  app.post('/api/observability/inspection-cases', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    const input = createCaseSchema.safeParse(request.body);
    if (!input.success) {
      invalidBody(reply, input.error);
      return;
    }
    const inspectionCase = await service.createCase(userId, input.data);
    reply.status(201);
    return inspectionCase;
  });

  app.get('/api/observability/inspection-cases/:id', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    const { id } = request.params as { id: string };
    const inspectionCase = await service.getCase(userId, id);
    if (!inspectionCase) {
      reply.status(404);
      return { error: 'Inspection case not found' };
    }
    return inspectionCase;
  });

  app.get('/api/observability/inspection-cases', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    const { jobId } = request.query as { jobId?: string };
    return service.listCases(userId, jobId);
  });

  app.post('/api/observability/inspection-cases/:id/runs', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    const input = runSchema.safeParse(request.body);
    if (!input.success) {
      invalidBody(reply, input.error);
      return;
    }
    const key = idempotencyKey(request);
    if (!key) {
      reply.status(400);
      return { error: 'A non-empty Idempotency-Key of at most 200 characters is required' };
    }
    const { id } = request.params as { id: string };
    const run = await service.startRun(userId, id, key, input.data);
    if (!run) {
      reply.status(404);
      return { error: 'Inspection case not found' };
    }
    reply.status(201);
    return run;
  });

  app.post('/api/observability/inspection-cases/:id/decisions', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    const input = decisionSchema.safeParse(request.body);
    if (!input.success) {
      invalidBody(reply, input.error);
      return;
    }
    const { id } = request.params as { id: string };
    const decision = await service.recordDecision(userId, id, input.data);
    if (!decision) {
      reply.status(404);
      return { error: 'Inspection case not found' };
    }
    reply.status(201);
    return decision;
  });
};
