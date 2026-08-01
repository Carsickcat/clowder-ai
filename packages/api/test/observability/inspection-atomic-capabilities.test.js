import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import Database from 'better-sqlite3';

import { applyMigrations, CURRENT_SCHEMA_VERSION } from '../../dist/domains/memory/schema.js';
import { ReplayObservabilitySource } from '../../dist/domains/observability/adapters/ReplayObservabilitySource.js';
import {
  InspectionSelectionConflictError,
  InspectionService,
} from '../../dist/domains/observability/InspectionService.js';
import { SqliteInspectionStore } from '../../dist/domains/observability/SqliteInspectionStore.js';

const NOW = '2026-08-02T01:00:00.000Z';
const CONTEXT = {
  intent: '帮我巡检 payments-router v3.18.0 的支付路由配置变更',
  service: 'payments-router',
  environment: 'acceptance',
  connectorRef: 'replay-acceptance',
  changeId: 'CHG-23841',
  version: 'v3.18.0',
};

function createIds() {
  let sequence = 0;
  return (kind) => `${kind}-${++sequence}`;
}

describe('NOVA atomic inspection capabilities', () => {
  let db;
  let service;
  let store;

  beforeEach(() => {
    db = new Database(':memory:');
    applyMigrations(db);
    store = new SqliteInspectionStore(db, {
      idFactory: createIds(),
      now: () => NOW,
    });
    const source = new ReplayObservabilitySource({
      sourceId: 'replay-acceptance',
      collectedAt: NOW,
      observations: {
        availability: { observedAt: NOW, query: 'safe_availability_metric', value: 0.999 },
        latency: { observedAt: NOW, query: 'safe_metric', value: 184 },
        'error-rate': { observedAt: NOW, query: 'safe_error_rate_metric', value: 0.002 },
      },
    });
    service = new InspectionService({
      now: () => new Date(NOW),
      sources: [
        {
          id: source.sourceId,
          kind: 'replay',
          label: 'Acceptance replay',
          scope: 'acceptance',
          source,
        },
      ],
      store,
    });
  });

  afterEach(() => db.close());

  test('persists immutable candidate sets without TTL and can reopen them', () => {
    const candidateSet = service.generateCandidateSet('user-a', CONTEXT);

    assert.ok(CURRENT_SCHEMA_VERSION >= 12);
    assert.equal(store.getCandidateSet('user-a', candidateSet.id).changeContext.changeId, 'CHG-23841');
    assert.deepEqual(store.listCandidateSets('user-a'), [candidateSet]);
    const columns = db
      .prepare('PRAGMA table_info(inspection_candidate_sets)')
      .all()
      .map((row) => row.name);
    assert.equal(columns.includes('expires_at'), false);
    assert.equal(columns.includes('ttl'), false);
    assert.throws(
      () =>
        db.prepare('UPDATE inspection_candidate_sets SET intent = ? WHERE id = ?').run('rewritten', candidateSet.id),
      /immutable/i,
    );
  });

  test('requires a waiver when a required candidate is omitted and records the candidate origin', () => {
    const candidateSet = service.generateCandidateSet('user-a', CONTEXT);
    assert.throws(
      () =>
        service.materializeCandidateSet('user-a', candidateSet.id, {
          name: 'Payments route verification',
          selectedCandidateIds: ['latency', 'error-rate'],
          waivers: [],
        }),
      InspectionSelectionConflictError,
    );

    const created = service.materializeCandidateSet('user-a', candidateSet.id, {
      name: 'Payments route verification',
      selectedCandidateIds: ['latency', 'error-rate'],
      waivers: [{ candidateId: 'availability', reason: 'Covered by the external synthetic transaction gate.' }],
    });

    assert.deepEqual(created.revision.origin, {
      candidateSetId: candidateSet.id,
      selectedCandidateIds: ['latency', 'error-rate'],
      waivers: [{ candidateId: 'availability', reason: 'Covered by the external synthetic transaction gate.' }],
    });
    assert.deepEqual(
      created.revision.checks.map((check) => check.id),
      ['latency', 'error-rate'],
    );
  });

  test('preserves candidate origin when a revision tunes checks without changing the selected candidates', () => {
    const candidateSet = service.generateCandidateSet('user-a', CONTEXT);
    const created = service.materializeCandidateSet('user-a', candidateSet.id, {
      name: 'Payments route verification',
      selectedCandidateIds: ['availability', 'latency', 'error-rate'],
      waivers: [],
    });

    const revised = service.reviseJob('user-a', created.job.id, {
      expectedRevision: 1,
      checks: created.revision.checks.map((check) => (check.id === 'latency' ? { ...check, threshold: 225 } : check)),
    });

    assert.equal(revised.revision.revision, 2);
    assert.equal(revised.revision.checks.find((check) => check.id === 'latency').threshold, 225);
    assert.deepEqual(revised.revision.origin, created.revision.origin);
  });

  test('projects an evidence report and assessment without letting coverage omissions rewrite the machine verdict', async () => {
    const candidateSet = service.generateCandidateSet('user-a', CONTEXT);
    const created = service.materializeCandidateSet('user-a', candidateSet.id, {
      name: 'Payments route verification',
      selectedCandidateIds: ['availability', 'latency', 'error-rate'],
      waivers: [],
    });
    const inspectionCase = service.createCase('user-a', {
      jobId: created.job.id,
      changeId: CONTEXT.changeId,
      version: CONTEXT.version,
    });
    const run = await service.startRun('user-a', inspectionCase.id, 'stage-admission-1', { purpose: 'admission' });
    await service.startRun('user-a', inspectionCase.id, 'stage-post-change-1', { purpose: 'post_change' });
    const workspace = service.getCase('user-a', inspectionCase.id);

    assert.equal(run.verdict, 'passed');
    assert.equal(workspace.stageReports.length, 2);
    assert.deepEqual(workspace.stageReports[0].resultCounts, { passed: 3, risk: 0, unknown: 0 });
    assert.equal(workspace.stageReports[0].evidenceQuality.status, 'complete');
    assert.equal(workspace.assessment.machineVerdict, 'passed');
    assert.equal(workspace.assessment.coverageStatus, 'omission');
    assert.equal(workspace.assessment.decisionReadiness, 'review_required');
    assert.equal(
      workspace.assessment.unknowns.some((item) => item.code === 'COVERAGE_OMISSION'),
      true,
    );
    assert.equal(
      workspace.assessment.facts.every((item) => item.evidenceRefs.length > 0),
      true,
    );
    assert.equal(workspace.candidateSet.id, candidateSet.id);
    assert.equal(workspace.abReport.comparability, 'valid');
    assert.equal(workspace.abReport.baselineRunId, run.id);
    assert.equal(
      workspace.abReport.checks.every((check) => check.comparable),
      true,
    );
  });
});
