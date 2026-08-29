import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import Database from 'better-sqlite3';

import { applyMigrations, CURRENT_SCHEMA_VERSION } from '../../dist/domains/memory/schema.js';
import { ReplayObservabilitySource } from '../../dist/domains/observability/adapters/ReplayObservabilitySource.js';
import { generateInspectionCandidateDraft } from '../../dist/domains/observability/InspectionCandidateGenerator.js';
import { InspectionPlanningResolver } from '../../dist/domains/observability/InspectionPlanningResolver.js';
import { InspectionService } from '../../dist/domains/observability/InspectionService.js';
import { SqliteInspectionStore } from '../../dist/domains/observability/SqliteInspectionStore.js';

const NOW = '2026-08-30T01:00:00.000Z';

function createPlanningSources() {
  return {
    now: () => new Date(NOW),
    changeSource: {
      sourceId: 'change-api',
      async resolve({ changeRef }) {
        return {
          sourceId: 'change-api',
          capturedAt: NOW,
          changeRef,
          service: 'payments-router',
          environment: 'staging',
          connectorRef: 'prometheus-staging',
          changeId: 'CHG-23841',
          version: 'v3.18.0',
        };
      },
    },
    topologySource: {
      sourceId: 'topology-api',
      async resolve({ service }) {
        return {
          sourceId: 'topology-api',
          capturedAt: NOW,
          catalogVersion: 'topology-42',
          rootService: service,
          dependencies: [],
        };
      },
    },
  };
}

describe('inspection planning snapshot persistence', () => {
  let db;
  let store;

  beforeEach(() => {
    db = new Database(':memory:');
    applyMigrations(db);
    let sequence = 0;
    store = new SqliteInspectionStore(db, {
      idFactory: (kind) => `${kind}-${++sequence}`,
      now: () => NOW,
    });
  });

  afterEach(() => db.close());

  test('migrates V14 and round-trips an immutable planning snapshot', async () => {
    const resolved = await new InspectionPlanningResolver(createPlanningSources()).resolve({
      changeRef: 'ticket/CHG-23841',
      intent: 'verify the payments change',
    });
    const draft = generateInspectionCandidateDraft(resolved.changeContext, { now: () => new Date(NOW) });
    const created = store.createCandidateSet({
      userId: 'user-a',
      ...draft,
      topologySnapshot: resolved.topologySnapshot,
      planningSnapshot: resolved.planningSnapshot,
    });
    const reopened = new SqliteInspectionStore(db).getCandidateSet('user-a', created.id);
    const columns = db
      .prepare('PRAGMA table_info(inspection_candidate_sets)')
      .all()
      .map((row) => row.name);

    assert.ok(CURRENT_SCHEMA_VERSION >= 14);
    assert.equal(columns.includes('planning_snapshot_json'), true);
    assert.deepEqual(created.planningSnapshot, resolved.planningSnapshot);
    assert.deepEqual(reopened.planningSnapshot, resolved.planningSnapshot);
    assert.throws(
      () =>
        db.prepare('UPDATE inspection_candidate_sets SET planning_snapshot_json = NULL WHERE id = ?').run(created.id),
      /immutable/i,
    );
  });

  test('anchors a materialized revision to the candidate planningDigest', async () => {
    const resolved = await new InspectionPlanningResolver(createPlanningSources()).resolve({
      changeRef: 'ticket/CHG-23841',
    });
    const draft = generateInspectionCandidateDraft(resolved.changeContext, { now: () => new Date(NOW) });
    const candidateSet = store.createCandidateSet({
      userId: 'user-a',
      ...draft,
      topologySnapshot: resolved.topologySnapshot,
      planningSnapshot: resolved.planningSnapshot,
    });
    const source = new ReplayObservabilitySource({
      sourceId: 'prometheus-staging',
      collectedAt: NOW,
      observations: {},
    });
    const service = new InspectionService({
      store,
      sources: [
        {
          id: source.sourceId,
          kind: 'replay',
          label: 'Staging metrics',
          scope: 'staging',
          source,
        },
      ],
    });
    const created = service.materializeCandidateSet('user-a', candidateSet.id, {
      name: 'Payments route verification',
      selectedCandidateIds: candidateSet.candidates.map((candidate) => candidate.id),
      waivers: [],
    });

    assert.equal(created.revision.origin.planningDigest, resolved.planningSnapshot.planningDigest);
  });

  test('InspectionService resolves and persists authoritative planning from changeRef', async () => {
    const source = new ReplayObservabilitySource({
      sourceId: 'prometheus-staging',
      collectedAt: NOW,
      observations: {},
    });
    const planningSources = new InspectionPlanningResolver(createPlanningSources());
    const service = new InspectionService({
      store,
      planningSources,
      sources: [
        {
          id: source.sourceId,
          kind: 'replay',
          label: 'Staging metrics',
          scope: 'staging',
          source,
        },
      ],
    });

    const candidateSet = await service.generateCandidateSet('user-a', {
      changeRef: 'ticket/CHG-23841',
      intent: 'verify the payments change',
    });

    assert.equal(candidateSet.changeContext.service, 'payments-router');
    assert.equal(candidateSet.topologySnapshot.catalogVersion, 'topology-42');
    assert.equal(candidateSet.planningSnapshot.change.changeRef, 'ticket/CHG-23841');
    assert.deepEqual(store.getCandidateSet('user-a', candidateSet.id), candidateSet);
  });
});
