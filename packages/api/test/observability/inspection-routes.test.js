import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import Fastify from 'fastify';
import { InspectionPlanningSourceError } from '../../dist/domains/observability/InspectionPlanningResolver.js';
import {
  InspectionDecisionConflictError,
  InspectionPlanningDriftError,
} from '../../dist/domains/observability/InspectionService.js';
import { InspectionRunSequenceConflictError } from '../../dist/domains/observability/SqliteInspectionStore.js';

const USER_HEADER = { 'x-cat-cafe-user': 'user-a' };

function createServiceDouble() {
  const calls = [];
  return {
    calls,
    listSources() {
      return [{ id: 'sandbox-prom', kind: 'prometheus', label: 'Sandbox Prometheus' }];
    },
    listJobs(userId) {
      calls.push(['listJobs', userId]);
      return [];
    },
    getJobDetail(userId, jobId) {
      calls.push(['getJobDetail', userId, jobId]);
      if (userId !== 'user-a' || jobId !== 'job-1') return null;
      return {
        job: {
          id: jobId,
          userId,
          name: 'Payments inspection',
          service: 'payments-router',
          environment: 'staging',
          connectorRef: 'sandbox-prom',
          currentRevision: 1,
          archivedAt: null,
          createdAt: '2026-07-31T00:00:00.000Z',
          updatedAt: '2026-07-31T00:00:00.000Z',
        },
        revision: {
          id: 'job-1-r1',
          jobId,
          revision: 1,
          checks: [],
          createdBy: userId,
          createdAt: '2026-07-31T00:00:00.000Z',
        },
      };
    },
    createCase(userId, input) {
      calls.push(['createCase', userId, input]);
      return {
        id: 'case-1',
        userId,
        jobId: input.jobId,
        jobRevisionId: 'job-1-r1',
        changeId: 'CHG-42',
        version: 'v3.18.0',
        status: 'ready',
        createdAt: '2026-07-31T00:00:00.000Z',
        updatedAt: '2026-07-31T00:00:00.000Z',
      };
    },
    getCase(userId, caseId) {
      calls.push(['getCase', userId, caseId]);
      return null;
    },
    listCases(userId, jobId) {
      calls.push(['listCases', userId, jobId]);
      return [];
    },
    startRun(userId, caseId, idempotencyKey, input) {
      calls.push(['startRun', userId, caseId, idempotencyKey, input]);
      return {
        id: 'run-1',
        caseId,
        purpose: input.purpose,
        status: 'completed',
        verdict: 'passed',
        sourceSnapshot: {
          connectorRef: 'sandbox-prom',
          sourceKind: 'prometheus',
          observedAt: '2026-07-31T00:00:00.000Z',
        },
        checkResults: [],
        errorSummary: null,
        startedAt: '2026-07-31T00:00:00.000Z',
        finishedAt: '2026-07-31T00:00:01.000Z',
      };
    },
    recordDecision(userId, caseId, input) {
      calls.push(['recordDecision', userId, caseId, input]);
      return {
        id: 'decision-1',
        caseId,
        runId: input.runId ?? null,
        kind: input.kind,
        actorId: userId,
        note: input.note,
        createdAt: '2026-07-31T00:00:00.000Z',
      };
    },
  };
}

describe('inspection routes', () => {
  let service;

  beforeEach(() => {
    service = createServiceDouble();
  });

  async function createApp() {
    const { inspectionsRoutes } = await import('../../dist/routes/inspections.js');
    const app = Fastify();
    await app.register(inspectionsRoutes, { service });
    return app;
  }

  test('requires header identity for reads and mutations', async () => {
    const app = await createApp();

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/observability/inspection-cases',
    });
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-cases',
      payload: {},
    });

    assert.equal(listResponse.statusCode, 401);
    assert.equal(createResponse.statusCode, 401);
  });

  test('keeps job detail readable while direct browser job mutations are unavailable', async () => {
    const app = await createApp();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-jobs',
      headers: USER_HEADER,
      payload: {
        name: '支付服务发布巡检',
        service: 'payments-router',
        environment: 'staging',
        connectorRef: 'sandbox-prom',
        checks: [
          {
            id: 'availability',
            name: '可用率',
            query: 'avg(up{job="payments-router"})',
            operator: 'gte',
            threshold: 0.99,
            unit: 'ratio',
            maxAgeMs: 120_000,
          },
        ],
      },
    });
    const reviseResponse = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-jobs/job-1/revisions',
      headers: USER_HEADER,
      payload: { expectedRevision: 1, checks: [] },
    });
    const detailResponse = await app.inject({
      method: 'GET',
      url: '/api/observability/inspection-jobs/job-1',
      headers: USER_HEADER,
    });

    assert.equal(createResponse.statusCode, 404);
    assert.equal(reviseResponse.statusCode, 404);
    assert.equal(detailResponse.statusCode, 200);
    assert.equal(detailResponse.json().job.id, 'job-1');
    assert.equal(detailResponse.json().revision.revision, 1);
    assert.deepEqual(service.calls, [['getJobDetail', 'user-a', 'job-1']]);
  });

  test('derives case change identity from the materialized revision and rejects browser duplicates', async () => {
    const app = await createApp();
    const forged = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-cases',
      headers: USER_HEADER,
      payload: { jobId: 'job-1', changeId: 'FORGED', version: 'forged-version' },
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-cases',
      headers: USER_HEADER,
      payload: { jobId: 'job-1' },
    });

    assert.equal(forged.statusCode, 400);
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().changeId, 'CHG-42');
    assert.equal(created.json().version, 'v3.18.0');
    assert.deepEqual(service.calls, [['createCase', 'user-a', { jobId: 'job-1' }]]);
  });

  test('rejects client-authored observations, verdicts and source URLs', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-cases/case-1/runs',
      headers: {
        ...USER_HEADER,
        'idempotency-key': 'run-key-1',
      },
      payload: {
        purpose: 'admission',
        verdict: 'passed',
        observations: [{ value: 1 }],
        sourceUrl: 'http://example.invalid',
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(
      service.calls.some((call) => call[0] === 'startRun'),
      false,
    );
  });

  test('requires a bounded idempotency key to start a run', async () => {
    const app = await createApp();
    const missing = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-cases/case-1/runs',
      headers: USER_HEADER,
      payload: { purpose: 'admission' },
    });
    const tooLong = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-cases/case-1/runs',
      headers: {
        ...USER_HEADER,
        'idempotency-key': 'x'.repeat(201),
      },
      payload: { purpose: 'admission' },
    });

    assert.equal(missing.statusCode, 400);
    assert.equal(tooLong.statusCode, 400);
  });

  test('passes only case, purpose and idempotency key to the service', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-cases/case-1/runs',
      headers: {
        ...USER_HEADER,
        'idempotency-key': 'run-key-1',
      },
      payload: { purpose: 'verification' },
    });

    assert.equal(response.statusCode, 201);
    assert.deepEqual(service.calls[0], ['startRun', 'user-a', 'case-1', 'run-key-1', { purpose: 'verification' }]);
  });

  test('returns 404 when scoped jobs and cases are not visible to this user', async () => {
    const app = await createApp();
    const caseResponse = await app.inject({
      method: 'GET',
      url: '/api/observability/inspection-cases/case-from-user-b',
      headers: USER_HEADER,
    });
    const jobResponse = await app.inject({
      method: 'GET',
      url: '/api/observability/inspection-jobs/job-from-user-b',
      headers: USER_HEADER,
    });

    assert.equal(caseResponse.statusCode, 404);
    assert.equal(jobResponse.statusCode, 404);
    assert.deepEqual(jobResponse.json(), { error: 'Inspection job not found' });
    assert.deepEqual(service.calls[0], ['getCase', 'user-a', 'case-from-user-b']);
    assert.deepEqual(service.calls[1], ['getJobDetail', 'user-a', 'job-from-user-b']);
  });

  test('records a decision without accepting actor or external action fields', async () => {
    const app = await createApp();
    const rejected = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-cases/case-1/decisions',
      headers: USER_HEADER,
      payload: {
        kind: 'approve',
        note: '人工确认外部测试环境已进入灰度',
        actorId: 'forged-user',
        deploy: true,
      },
    });
    const accepted = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-cases/case-1/decisions',
      headers: USER_HEADER,
      payload: {
        runId: 'run-1',
        kind: 'approve',
        note: '人工确认外部测试环境已进入灰度',
      },
    });

    assert.equal(rejected.statusCode, 400);
    assert.equal(accepted.statusCode, 201);
    assert.deepEqual(service.calls[0].slice(0, 3), ['recordDecision', 'user-a', 'case-1']);
  });

  test('maps decision and run sequence conflicts to bounded API errors', async () => {
    service.recordDecision = () => {
      throw new InspectionDecisionConflictError('not ready');
    };
    service.startRun = () => {
      throw new InspectionRunSequenceConflictError('admission must run first');
    };
    const app = await createApp();

    const invalidDecision = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-cases/case-1/decisions',
      headers: USER_HEADER,
      payload: {
        kind: 'accept',
        note: 'No terminal run exists.',
      },
    });
    const invalidRun = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-cases/case-1/runs',
      headers: { ...USER_HEADER, 'idempotency-key': 'skip-stage' },
      payload: { purpose: 'post_change' },
    });

    assert.equal(invalidDecision.statusCode, 409);
    assert.deepEqual(invalidDecision.json(), { error: 'Inspection state conflict' });
    assert.equal(invalidRun.statusCode, 409);
    assert.deepEqual(invalidRun.json(), { error: 'Inspection state conflict' });
  });

  test('returns typed bounded planning drift details without raw source facts', async () => {
    service.startRun = () => {
      throw new InspectionPlanningDriftError([
        {
          source: 'change',
          expectedHash: `sha256:${'a'.repeat(64)}`,
          actualHash: `sha256:${'b'.repeat(64)}`,
        },
      ]);
    };
    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-cases/case-1/runs',
      headers: { ...USER_HEADER, 'idempotency-key': 'drifted-run' },
      payload: { purpose: 'admission' },
    });

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), {
      error: 'Inspection planning facts changed',
      details: {
        code: 'INSPECTION_PLANNING_DRIFT',
        differences: [
          {
            source: 'change',
            expectedHash: `sha256:${'a'.repeat(64)}`,
            actualHash: `sha256:${'b'.repeat(64)}`,
          },
        ],
      },
    });
  });

  test('returns a bounded planning source error without provider payloads', async () => {
    service.startRun = () => {
      throw new InspectionPlanningSourceError('topology_unavailable', 'secret provider response');
    };
    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-cases/case-1/runs',
      headers: { ...USER_HEADER, 'idempotency-key': 'unavailable-run' },
      payload: { purpose: 'admission' },
    });

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), {
      error: 'Inspection planning source unavailable',
      details: { code: 'topology_unavailable' },
    });
    assert.equal(response.body.includes('secret provider response'), false);
  });
});
