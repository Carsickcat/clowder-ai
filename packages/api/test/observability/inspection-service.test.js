import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import Database from 'better-sqlite3';

import { applyMigrations } from '../../dist/domains/memory/schema.js';
import {
  InspectionService,
  InspectionSourceUnavailableError,
} from '../../dist/domains/observability/InspectionService.js';
import { createQueryDigest } from '../../dist/domains/observability/ports/ObservabilitySource.js';
import {
  InspectionImmutableRecordError,
  SqliteInspectionStore,
} from '../../dist/domains/observability/SqliteInspectionStore.js';

const NOW = '2026-07-31T08:00:00.000Z';
const CHECKS = [
  {
    id: 'latency',
    name: 'p95 latency',
    query: 'histogram_quantile(0.95, rate(http_server_duration_seconds_bucket[5m]))',
    unit: 'ms',
    operator: 'lte',
    threshold: 250,
    maxAgeMs: 120_000,
  },
];

function createIds() {
  let sequence = 0;
  return (kind) => `${kind}-${++sequence}`;
}

function createSource({
  collect = async () => ({
    collectedAt: '2026-07-31T07:59:30.000Z',
    observations: [
      {
        checkId: 'latency',
        observedAt: '2026-07-31T07:59:20.000Z',
        partial: false,
        queryDigest: createQueryDigest(CHECKS[0].query),
        status: 'ok',
        value: 184,
      },
    ],
    sourceId: 'replay-acceptance',
    window: '5m',
  }),
} = {}) {
  const calls = [];
  return {
    calls,
    sourceId: 'replay-acceptance',
    async collect(input) {
      calls.push(input);
      return collect(input);
    },
  };
}

describe('InspectionService', () => {
  let db;
  let source;
  let service;
  let store;

  beforeEach(() => {
    db = new Database(':memory:');
    applyMigrations(db);
    store = new SqliteInspectionStore(db, {
      idFactory: createIds(),
      now: () => NOW,
    });
    source = createSource();
    service = new InspectionService({
      now: () => new Date(NOW),
      sources: [
        {
          id: 'replay-acceptance',
          kind: 'replay',
          label: 'Acceptance replay',
          scope: 'acceptance',
          source,
        },
      ],
      store,
    });
  });

  afterEach(() => {
    db.close();
  });

  function createJob(connectorRef = 'replay-acceptance') {
    return service.createJob('user-a', {
      name: 'Payments canary inspection',
      service: 'payments-router',
      environment: 'acceptance',
      connectorRef,
      checks: CHECKS,
    });
  }

  function createCase() {
    const created = createJob();
    const inspectionCase = service.createCase('user-a', {
      jobId: created.job.id,
      changeId: 'CHG-42',
      version: 'v3.18.0',
    });
    return { created, inspectionCase };
  }

  test('publishes only safe source metadata and rejects an unregistered connector', () => {
    assert.deepEqual(service.listSources(), [
      {
        id: 'replay-acceptance',
        kind: 'replay',
        label: 'Acceptance replay',
        scope: 'acceptance',
      },
    ]);

    assert.throws(() => createJob('browser-supplied-url'), InspectionSourceUnavailableError);
  });

  test('rejects a job environment that does not match the server-owned source scope', () => {
    assert.throws(
      () =>
        service.createJob('user-a', {
          name: 'Mislabeled production inspection',
          service: 'payments-router',
          environment: 'production',
          connectorRef: 'replay-acceptance',
          checks: CHECKS,
        }),
      /scope/i,
    );
  });

  test('executes server-owned observations and reuses a completed run by idempotency key', async () => {
    const { inspectionCase } = createCase();

    const completed = await service.startRun('user-a', inspectionCase.id, 'request-1', { purpose: 'admission' });
    const retry = await service.startRun('user-a', inspectionCase.id, 'request-1', { purpose: 'admission' });

    assert.equal(source.calls.length, 1);
    assert.equal(completed.id, retry.id);
    assert.equal(completed.status, 'completed');
    assert.equal(completed.verdict, 'passed');
    assert.equal(completed.checkResults[0].value, 184);
    assert.deepEqual(completed.sourceSnapshot, {
      connectorRef: 'replay-acceptance',
      observedAt: '2026-07-31T07:59:30.000Z',
      sourceKind: 'replay',
      window: {
        from: '2026-07-31T07:54:30.000Z',
        to: '2026-07-31T07:59:30.000Z',
      },
    });
  });

  test('persists source failure as failed and unknown without leaking transport details', async () => {
    const secret = 'must-not-leak';
    source = createSource({
      collect: async () => {
        throw new Error(`transport broke with ${secret}`);
      },
    });
    service = new InspectionService({
      now: () => new Date(NOW),
      sources: [
        {
          id: 'replay-acceptance',
          kind: 'replay',
          label: 'Acceptance replay',
          scope: 'acceptance',
          source,
        },
      ],
      store,
    });
    const { inspectionCase } = createCase();

    const failed = await service.startRun('user-a', inspectionCase.id, 'request-failed', { purpose: 'verification' });

    assert.equal(failed.status, 'failed');
    assert.equal(failed.verdict, 'unknown');
    assert.match(failed.errorSummary, /observability source failed/i);
    assert.doesNotMatch(failed.errorSummary, new RegExp(secret));
    assert.deepEqual(store.getRun('user-a', failed.id), failed);
  });

  test('returns a scoped workspace and creates an immutable report only on accept', async () => {
    const { created, inspectionCase } = createCase();
    const run = await service.startRun('user-a', inspectionCase.id, 'request-report', { purpose: 'admission' });
    const recorded = service.recordDecision('user-a', inspectionCase.id, {
      runId: run.id,
      kind: 'accept',
      note: 'Reviewed connected evidence.',
    });
    const workspace = service.getCase('user-a', inspectionCase.id);

    assert.equal(recorded.decision.actorId, 'user-a');
    assert.equal(recorded.report.jobRevisionId, created.revision.id);
    assert.deepEqual(recorded.report.runIds, [run.id]);
    assert.deepEqual(recorded.report.decisionIds, [recorded.decision.id]);
    assert.deepEqual(workspace.report, recorded.report);
    assert.deepEqual(workspace.revision, created.revision);
    assert.equal(workspace.case.status, 'completed');
    assert.equal(service.getCase('user-b', inspectionCase.id), null);

    await assert.rejects(
      () => service.startRun('user-a', inspectionCase.id, 'request-after-report', { purpose: 'verification' }),
      InspectionImmutableRecordError,
    );
    assert.equal(source.calls.length, 1);
  });

  test('rejects accepting a non-passing run without creating a report', async () => {
    source = createSource({
      collect: async () => ({
        collectedAt: '2026-07-31T07:59:30.000Z',
        observations: [
          {
            checkId: 'latency',
            observedAt: '2026-07-31T07:59:20.000Z',
            partial: false,
            queryDigest: createQueryDigest(CHECKS[0].query),
            status: 'ok',
            value: 251,
          },
        ],
        sourceId: 'replay-acceptance',
        window: '5m',
      }),
    });
    service = new InspectionService({
      now: () => new Date(NOW),
      sources: [
        {
          id: 'replay-acceptance',
          kind: 'replay',
          label: 'Acceptance replay',
          scope: 'acceptance',
          source,
        },
      ],
      store,
    });
    const { inspectionCase } = createCase();
    const run = await service.startRun('user-a', inspectionCase.id, 'request-risk', { purpose: 'admission' });

    assert.equal(run.verdict, 'risk');
    assert.throws(
      () =>
        service.recordDecision('user-a', inspectionCase.id, {
          runId: run.id,
          kind: 'accept',
          note: 'This must be recorded as a pause, not an acceptance.',
        }),
      /passed inspection run/i,
    );
    assert.equal(store.getReportForCase('user-a', inspectionCase.id), null);
  });

  test('rejects accepting an earlier pass after later evidence becomes risky', async () => {
    const { inspectionCase } = createCase();
    const passed = await service.startRun('user-a', inspectionCase.id, 'request-passed', { purpose: 'admission' });
    const riskSource = createSource({
      collect: async () => ({
        collectedAt: '2026-07-31T07:59:30.000Z',
        observations: [
          {
            checkId: 'latency',
            observedAt: '2026-07-31T07:59:20.000Z',
            partial: false,
            queryDigest: createQueryDigest(CHECKS[0].query),
            status: 'ok',
            value: 251,
          },
        ],
        sourceId: 'replay-acceptance',
        window: '5m',
      }),
    });
    service = new InspectionService({
      now: () => new Date(NOW),
      sources: [
        {
          id: 'replay-acceptance',
          kind: 'replay',
          label: 'Acceptance replay',
          scope: 'acceptance',
          source: riskSource,
        },
      ],
      store,
    });
    const risk = await service.startRun('user-a', inspectionCase.id, 'request-risk', { purpose: 'canary' });

    assert.equal(passed.verdict, 'passed');
    assert.equal(risk.verdict, 'risk');
    assert.throws(
      () =>
        service.recordDecision('user-a', inspectionCase.id, {
          runId: passed.id,
          kind: 'accept',
          note: 'An earlier green run cannot override newer risk evidence.',
        }),
      /latest completed passed inspection run/i,
    );
    assert.equal(store.getReportForCase('user-a', inspectionCase.id), null);
  });
});
