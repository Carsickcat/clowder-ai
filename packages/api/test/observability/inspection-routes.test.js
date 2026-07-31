import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import Fastify from 'fastify';
import {
  InspectionDecisionConflictError,
  InspectionSourceScopeMismatchError,
  InspectionSourceUnavailableError,
} from '../../dist/domains/observability/InspectionService.js';
import { InspectionRevisionConflictError } from '../../dist/domains/observability/SqliteInspectionStore.js';

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
    createJob(userId, input) {
      calls.push(['createJob', userId, input]);
      return {
        job: {
          id: 'job-1',
          userId,
          name: input.name,
          service: input.service,
          environment: input.environment,
          connectorRef: input.connectorRef,
          currentRevision: 1,
          archivedAt: null,
          createdAt: '2026-07-31T00:00:00.000Z',
          updatedAt: '2026-07-31T00:00:00.000Z',
        },
        revision: {
          id: 'job-1-r1',
          jobId: 'job-1',
          revision: 1,
          checks: input.checks,
          createdBy: userId,
          createdAt: '2026-07-31T00:00:00.000Z',
        },
      };
    },
    reviseJob(userId, jobId, input) {
      calls.push(['reviseJob', userId, jobId, input]);
      return null;
    },
    createCase(userId, input) {
      calls.push(['createCase', userId, input]);
      return {
        id: 'case-1',
        userId,
        jobId: input.jobId,
        jobRevisionId: 'job-1-r1',
        changeId: input.changeId,
        version: input.version,
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
      url: '/api/observability/inspection-jobs',
    });
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-jobs',
      payload: {},
    });

    assert.equal(listResponse.statusCode, 401);
    assert.equal(createResponse.statusCode, 401);
  });

  test('creates a versioned job with server-resolved identity', async () => {
    const app = await createApp();
    const response = await app.inject({
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

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().revision.revision, 1);
    assert.deepEqual(service.calls[0].slice(0, 2), ['createJob', 'user-a']);
    assert.equal('userId' in service.calls[0][2], false);
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

  test('returns 404 when a scoped case is not visible to this user', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/observability/inspection-cases/case-from-user-b',
      headers: USER_HEADER,
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(service.calls[0], ['getCase', 'user-a', 'case-from-user-b']);
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

  test('maps connector, revision and decision conflicts to bounded API errors', async () => {
    service.createJob = () => {
      throw new InspectionSourceUnavailableError('not-registered');
    };
    service.reviseJob = () => {
      throw new InspectionRevisionConflictError();
    };
    service.recordDecision = () => {
      throw new InspectionDecisionConflictError('not ready');
    };
    const app = await createApp();

    const unavailable = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-jobs',
      headers: USER_HEADER,
      payload: {
        name: 'Safe job',
        service: 'payments',
        environment: 'acceptance',
        connectorRef: 'not-registered',
        checks: [
          {
            id: 'latency',
            name: 'Latency',
            query: 'safe_metric',
            operator: 'lte',
            threshold: 250,
            unit: 'ms',
            maxAgeMs: 120_000,
          },
        ],
      },
    });
    const conflict = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-jobs/job-1/revisions',
      headers: USER_HEADER,
      payload: {
        expectedRevision: 1,
        checks: [
          {
            id: 'latency',
            name: 'Latency',
            query: 'safe_metric',
            operator: 'lte',
            threshold: 200,
            unit: 'ms',
            maxAgeMs: 120_000,
          },
        ],
      },
    });
    const invalidDecision = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-cases/case-1/decisions',
      headers: USER_HEADER,
      payload: {
        kind: 'accept',
        note: 'No terminal run exists.',
      },
    });

    assert.equal(unavailable.statusCode, 503);
    assert.deepEqual(unavailable.json(), { error: 'Inspection source unavailable' });
    assert.equal(conflict.statusCode, 409);
    assert.deepEqual(conflict.json(), { error: 'Inspection state conflict' });
    assert.equal(invalidDecision.statusCode, 409);
    assert.deepEqual(invalidDecision.json(), { error: 'Inspection state conflict' });
  });

  test('maps a server-owned source scope mismatch to a bounded conflict', async () => {
    service.createJob = () => {
      throw new InspectionSourceScopeMismatchError('replay-acceptance', 'acceptance');
    };
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-jobs',
      headers: USER_HEADER,
      payload: {
        name: 'Mislabeled job',
        service: 'payments-router',
        environment: 'production',
        connectorRef: 'replay-acceptance',
        checks: [
          {
            id: 'latency',
            name: 'Latency',
            query: 'safe_metric',
            operator: 'lte',
            threshold: 250,
            unit: 'ms',
            maxAgeMs: 120_000,
          },
        ],
      },
    });

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { error: 'Inspection source scope mismatch' });
  });
});
