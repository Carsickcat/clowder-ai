import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import Database from 'better-sqlite3';

import { applyMigrations } from '../../dist/domains/memory/schema.js';
import { InspectionPlanningResolver } from '../../dist/domains/observability/InspectionPlanningResolver.js';
import { InspectionPlanningDriftError, InspectionService } from '../../dist/domains/observability/InspectionService.js';
import { createQueryDigest } from '../../dist/domains/observability/ports/ObservabilitySource.js';
import { SqliteInspectionStore } from '../../dist/domains/observability/SqliteInspectionStore.js';

const NOW = '2026-08-30T01:00:00.000Z';

function createMutablePlanningSources() {
  const state = { calls: 0, version: 'v3.18.0' };
  return {
    state,
    resolver: new InspectionPlanningResolver({
      now: () => new Date(NOW),
      changeSource: {
        sourceId: 'change-api',
        async resolve({ changeRef }) {
          state.calls += 1;
          return {
            sourceId: 'change-api',
            capturedAt: NOW,
            changeRef,
            service: 'payments-router',
            environment: 'staging',
            connectorRef: 'prometheus-staging',
            changeId: 'CHG-23841',
            version: state.version,
          };
        },
      },
      topologySource: {
        sourceId: 'topology-api',
        async resolve({ service }) {
          state.calls += 1;
          return {
            sourceId: 'topology-api',
            capturedAt: NOW,
            catalogVersion: 'topology-42',
            rootService: service,
            dependencies: [],
          };
        },
      },
    }),
  };
}

function createMetricSource() {
  return {
    sourceId: 'prometheus-staging',
    async collect({ checks, window }) {
      return {
        collectedAt: NOW,
        sourceId: 'prometheus-staging',
        window,
        observations: checks.map((check) => ({
          baselineValue: null,
          checkId: check.id,
          observedAt: NOW,
          partial: false,
          queryDigest: createQueryDigest(check.query),
          status: 'ok',
          value: check.id === 'availability' ? 0.999 : check.id === 'latency' ? 184 : 0.002,
        })),
      };
    },
  };
}

describe('inspection pre-run planning drift guard', () => {
  let db;
  let planning;
  let service;
  let store;

  beforeEach(() => {
    db = new Database(':memory:');
    applyMigrations(db);
    let sequence = 0;
    store = new SqliteInspectionStore(db, {
      idFactory: (kind) => `${kind}-${++sequence}`,
      now: () => NOW,
    });
    planning = createMutablePlanningSources();
    const metrics = createMetricSource();
    service = new InspectionService({
      store,
      planningSources: planning.resolver,
      sources: [
        {
          id: metrics.sourceId,
          kind: 'prometheus',
          label: 'Staging metrics',
          scope: 'staging',
          source: metrics,
        },
      ],
      now: () => new Date(NOW),
    });
  });

  afterEach(() => db.close());

  async function createPlannedCase() {
    const candidateSet = await service.generateCandidateSet('user-a', {
      changeRef: 'ticket/CHG-23841',
      intent: 'verify the payments change',
    });
    const materialized = service.materializeCandidateSet('user-a', candidateSet.id, {
      name: 'Payments route verification',
      selectedCandidateIds: candidateSet.candidates.map((candidate) => candidate.id),
      waivers: [],
    });
    return service.createCase('user-a', { jobId: materialized.job.id });
  }

  test('returns an existing idempotent run before re-resolving changed planning facts', async () => {
    const inspectionCase = await createPlannedCase();
    const completed = await service.startRun('user-a', inspectionCase.id, 'run-1', { purpose: 'admission' });
    const callsAfterRun = planning.state.calls;
    planning.state.version = 'v3.19.0';

    const retry = await service.startRun('user-a', inspectionCase.id, 'run-1', { purpose: 'admission' });

    assert.equal(retry.id, completed.id);
    assert.equal(planning.state.calls, callsAfterRun);
    assert.equal(store.listRuns('user-a', inspectionCase.id).length, 1);
  });

  test('rejects drift before creating a new run and exposes only bounded hash differences', async () => {
    const inspectionCase = await createPlannedCase();
    await service.startRun('user-a', inspectionCase.id, 'run-1', { purpose: 'admission' });
    planning.state.version = 'v3.19.0';

    await assert.rejects(
      () => service.startRun('user-a', inspectionCase.id, 'run-2', { purpose: 'canary' }),
      (error) => {
        assert.ok(error instanceof InspectionPlanningDriftError);
        assert.deepEqual(
          error.differences.map((difference) => difference.source),
          ['change'],
        );
        assert.match(error.differences[0].expectedHash, /^sha256:[a-f0-9]{64}$/);
        assert.match(error.differences[0].actualHash, /^sha256:[a-f0-9]{64}$/);
        assert.equal(JSON.stringify(error).includes('v3.19.0'), false);
        return true;
      },
    );
    assert.equal(store.listRuns('user-a', inspectionCase.id).length, 1);
  });
});
