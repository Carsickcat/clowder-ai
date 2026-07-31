import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import Database from 'better-sqlite3';

import { applyMigrations, CURRENT_SCHEMA_VERSION, SCHEMA_V10_INSPECTIONS } from '../../dist/domains/memory/schema.js';
import {
  InspectionImmutableRecordError,
  InspectionRevisionConflictError,
  SqliteInspectionStore,
} from '../../dist/domains/observability/SqliteInspectionStore.js';

const CHECKS_V1 = [
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

const CHECKS_V2 = [
  ...CHECKS_V1,
  {
    id: 'errors',
    name: 'error rate',
    query: 'rate(http_server_requests_total{status=~"5.."}[5m])',
    unit: 'ratio',
    operator: 'lte',
    threshold: 0.005,
    maxAgeMs: 120_000,
  },
];

function createIds() {
  let sequence = 0;
  return (kind) => `${kind}-${++sequence}`;
}

describe('NOVA inspection SQLite state', () => {
  let db;
  let store;

  beforeEach(() => {
    db = new Database(':memory:');
    applyMigrations(db);
    store = new SqliteInspectionStore(db, {
      idFactory: createIds(),
      now: () => '2026-07-31T01:02:03.000Z',
    });
  });

  afterEach(() => {
    db.close();
  });

  function createJob(userId = 'user-a') {
    return store.createJob({
      userId,
      name: 'Payments canary inspection',
      service: 'payments-router',
      environment: 'production',
      connectorRef: 'prometheus-default',
      checks: CHECKS_V1,
      createdBy: userId,
    });
  }

  function startCase(jobId, userId = 'user-a') {
    return store.startCase({
      userId,
      jobId,
      changeId: 'CHG-42',
      version: 'v3.18.0',
    });
  }

  it('applies the durable inspection schema with no TTL columns', () => {
    assert.equal(CURRENT_SCHEMA_VERSION, 11);
    const expected = [
      'inspection_jobs',
      'inspection_job_revisions',
      'inspection_cases',
      'inspection_runs',
      'inspection_check_results',
      'inspection_decisions',
      'inspection_reports',
    ];
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'inspection_%' ORDER BY name")
      .all()
      .map((row) => row.name);
    assert.deepEqual(tables, expected.sort());

    for (const table of expected) {
      const columns = db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((row) => row.name);
      assert.equal(columns.includes('expires_at'), false, `${table} must not have expires_at`);
      assert.equal(columns.includes('ttl'), false, `${table} must not have ttl`);
    }
  });

  it('upgrades an existing V10 inspection schema with the V11 integrity triggers', () => {
    const legacyDb = new Database(':memory:');
    try {
      legacyDb.exec(`CREATE TABLE schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      )`);
      legacyDb.exec(SCHEMA_V10_INSPECTIONS);
      legacyDb.prepare('INSERT INTO schema_version (version, applied_at) VALUES (10, ?)').run('2026-07-31T00:00:00Z');

      applyMigrations(legacyDb);

      assert.equal(legacyDb.prepare('SELECT MAX(version) AS version FROM schema_version').get().version, 11);
      assert.ok(
        legacyDb
          .prepare("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name = ?")
          .get('inspection_check_results_terminal_insert'),
      );
    } finally {
      legacyDb.close();
    }
  });

  it('round-trips a job and immutable revision through a fresh store instance', () => {
    const created = createJob();
    const reopened = new SqliteInspectionStore(db);

    assert.deepEqual(reopened.getJob('user-a', created.job.id), created.job);
    assert.deepEqual(reopened.getJobRevision('user-a', created.revision.id), created.revision);
    assert.equal(created.job.currentRevision, 1);
    assert.deepEqual(created.revision.checks, CHECKS_V1);
    assert.throws(
      () =>
        db
          .prepare('UPDATE inspection_job_revisions SET checks_json = ? WHERE id = ?')
          .run(JSON.stringify(CHECKS_V2), created.revision.id),
      /immutable/i,
    );
  });

  it('revises with optimistic concurrency while existing cases keep the original revision', () => {
    const created = createJob();
    const firstCase = startCase(created.job.id);
    const revised = store.reviseJob({
      userId: 'user-a',
      jobId: created.job.id,
      expectedRevision: 1,
      checks: CHECKS_V2,
      createdBy: 'user-a',
    });

    assert.equal(revised.job.currentRevision, 2);
    assert.equal(revised.revision.revision, 2);
    assert.deepEqual(revised.revision.checks, CHECKS_V2);
    assert.equal(store.getCase('user-a', firstCase.id).jobRevisionId, created.revision.id);

    assert.throws(
      () =>
        store.reviseJob({
          userId: 'user-a',
          jobId: created.job.id,
          expectedRevision: 1,
          checks: CHECKS_V1,
          createdBy: 'user-a',
        }),
      InspectionRevisionConflictError,
    );
    assert.equal(store.listJobRevisions('user-a', created.job.id).length, 2);
  });

  it('reuses one job into disjoint cases and idempotent, case-owned runs', () => {
    const created = createJob();
    const firstCase = startCase(created.job.id);
    const secondCase = startCase(created.job.id);

    assert.notEqual(firstCase.id, secondCase.id);
    assert.equal(firstCase.jobRevisionId, secondCase.jobRevisionId);

    const firstRun = store.startRun({
      userId: 'user-a',
      caseId: firstCase.id,
      purpose: 'admission',
      idempotencyKey: 'request-1',
      sourceSnapshot: { connectorRef: 'forged-browser-source' },
      verdict: 'passed',
      checkResults: [{ status: 'passed', value: 0 }],
    });
    const retry = store.startRun({
      userId: 'user-a',
      caseId: firstCase.id,
      purpose: 'admission',
      idempotencyKey: 'request-1',
    });
    const secondRun = store.startRun({
      userId: 'user-a',
      caseId: secondCase.id,
      purpose: 'admission',
      idempotencyKey: 'request-1',
    });

    assert.equal(retry.id, firstRun.id);
    assert.notEqual(secondRun.id, firstRun.id);
    assert.equal(firstRun.verdict, 'unknown');
    assert.equal(firstRun.sourceSnapshot, null);
    assert.deepEqual(firstRun.checkResults, []);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM inspection_runs').get().count, 2);
  });

  it('lists only the requesting user cases with an optional job filter', () => {
    const firstJob = createJob();
    const secondJob = createJob();
    const firstCase = startCase(firstJob.job.id);
    const secondCase = startCase(secondJob.job.id);
    createJob('user-b');

    assert.deepEqual(
      store.listCases('user-a').map((item) => item.id),
      [secondCase.id, firstCase.id],
    );
    assert.deepEqual(
      store.listCases('user-a', firstJob.job.id).map((item) => item.id),
      [firstCase.id],
    );
    assert.deepEqual(store.listCases('user-b', firstJob.job.id), []);
  });

  it('scopes every resource lookup by user without leaking guessed ids', () => {
    const created = createJob();
    const inspectionCase = startCase(created.job.id);
    const run = store.startRun({
      userId: 'user-a',
      caseId: inspectionCase.id,
      purpose: 'admission',
      idempotencyKey: 'request-1',
    });

    assert.equal(store.getJob('user-b', created.job.id), null);
    assert.equal(store.getJobRevision('user-b', created.revision.id), null);
    assert.equal(store.getCase('user-b', inspectionCase.id), null);
    assert.equal(store.getRun('user-b', run.id), null);
    assert.throws(
      () =>
        store.startRun({
          userId: 'user-b',
          caseId: inspectionCase.id,
          purpose: 'admission',
          idempotencyKey: 'request-2',
        }),
      /not found/i,
    );
  });

  it('makes terminal runs and their evidence append-only', () => {
    const created = createJob();
    const inspectionCase = startCase(created.job.id);
    const run = store.startRun({
      userId: 'user-a',
      caseId: inspectionCase.id,
      purpose: 'admission',
      idempotencyKey: 'request-1',
    });
    const completed = store.completeRun({
      userId: 'user-a',
      runId: run.id,
      verdict: 'passed',
      sourceSnapshot: {
        connectorRef: 'prometheus-default',
        sourceKind: 'replay',
        observedAt: '2026-07-31T01:02:00.000Z',
        window: {
          from: '2026-07-31T00:52:00.000Z',
          to: '2026-07-31T01:02:00.000Z',
        },
      },
      checkResults: [
        {
          checkId: 'latency',
          status: 'passed',
          value: 184,
          baselineValue: 188,
          observedAt: '2026-07-31T01:02:00.000Z',
          queryDigest: 'sha256:latency',
          reason: null,
        },
      ],
    });

    assert.equal(completed.run.status, 'completed');
    assert.equal(completed.results.length, 1);
    assert.ok(completed.results[0].id);
    assert.throws(
      () =>
        store.completeRun({
          userId: 'user-a',
          runId: run.id,
          verdict: 'risk',
          sourceSnapshot: completed.run.sourceSnapshot,
          checkResults: [],
        }),
      InspectionImmutableRecordError,
    );
    assert.throws(
      () =>
        db.prepare('UPDATE inspection_check_results SET status = ? WHERE id = ?').run('risk', completed.results[0].id),
      /immutable/i,
    );
    assert.throws(
      () =>
        db
          .prepare(
            `INSERT INTO inspection_check_results
             (id, run_id, check_id, status, value, baseline_value, observed_at, query_digest, reason)
             VALUES (?, ?, ?, 'risk', 999, NULL, NULL, 'sha256:late', 'late evidence')`,
          )
          .run('result-late', run.id, 'late-check'),
      /terminal inspection run/i,
    );
    assert.throws(() => db.prepare('DELETE FROM inspection_runs WHERE id = ?').run(run.id), /immutable/i);
  });

  it('allows only one active run per case while preserving same-key idempotency', () => {
    const created = createJob();
    const inspectionCase = startCase(created.job.id);
    const active = store.startRun({
      userId: 'user-a',
      caseId: inspectionCase.id,
      purpose: 'admission',
      idempotencyKey: 'request-active',
    });

    assert.equal(
      store.startRun({
        userId: 'user-a',
        caseId: inspectionCase.id,
        purpose: 'admission',
        idempotencyKey: 'request-active',
      }).id,
      active.id,
    );
    assert.throws(
      () =>
        store.startRun({
          userId: 'user-a',
          caseId: inspectionCase.id,
          purpose: 'canary',
          idempotencyKey: 'request-distinct',
        }),
      /active inspection run/i,
    );
  });

  it('atomically recovers interrupted runs on store initialization and requires a new key', () => {
    const created = createJob();
    const inspectionCase = startCase(created.job.id);
    const interrupted = store.startRun({
      userId: 'user-a',
      caseId: inspectionCase.id,
      purpose: 'verification',
      idempotencyKey: 'request-before-restart',
    });

    const reopened = new SqliteInspectionStore(db, {
      idFactory: createIds(),
      now: () => '2026-07-31T01:03:03.000Z',
    });
    const recovered = reopened.getRun('user-a', interrupted.id);

    assert.equal(recovered.status, 'failed');
    assert.equal(recovered.verdict, 'unknown');
    assert.match(recovered.errorSummary, /restart/i);
    assert.equal(reopened.getCase('user-a', inspectionCase.id).status, 'blocked');
    assert.equal(
      reopened.startRun({
        userId: 'user-a',
        caseId: inspectionCase.id,
        purpose: 'verification',
        idempotencyKey: 'request-before-restart',
      }).id,
      interrupted.id,
    );
    assert.equal(
      reopened.startRun({
        userId: 'user-a',
        caseId: inspectionCase.id,
        purpose: 'verification',
        idempotencyKey: 'request-after-restart',
      }).status,
      'running',
    );
  });

  it('rolls back the accept decision when report creation fails', () => {
    const created = createJob();
    const inspectionCase = startCase(created.job.id);
    const run = store.startRun({
      userId: 'user-a',
      caseId: inspectionCase.id,
      purpose: 'post_change',
      idempotencyKey: 'request-atomic-accept',
    });
    store.completeRun({
      userId: 'user-a',
      runId: run.id,
      verdict: 'passed',
      sourceSnapshot: {
        connectorRef: 'prometheus-default',
        sourceKind: 'replay',
        observedAt: '2026-07-31T01:02:00.000Z',
        window: { from: '2026-07-31T00:57:00.000Z', to: '2026-07-31T01:02:00.000Z' },
      },
      checkResults: [],
    });
    db.exec(`CREATE TRIGGER inspection_reports_force_failure
      BEFORE INSERT ON inspection_reports BEGIN
        SELECT RAISE(ABORT, 'forced report failure');
      END`);

    assert.throws(
      () =>
        store.acceptLatestPassedRun({
          userId: 'user-a',
          caseId: inspectionCase.id,
          runId: run.id,
          actorId: 'user-a',
          note: 'Atomic acceptance.',
        }),
      /forced report failure/i,
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM inspection_decisions').get().count, 0);
    assert.equal(store.getReportForCase('user-a', inspectionCase.id), null);
  });

  it('rejects mismatched case, run, and report parent chains at the durable schema boundary', () => {
    const first = createJob();
    const second = createJob();

    assert.throws(
      () =>
        db
          .prepare(
            `INSERT INTO inspection_cases
             (id, user_id, job_id, job_revision_id, change_id, version, status, created_at, updated_at)
             VALUES ('case-mismatch', 'user-a', ?, ?, 'CHG-X', 'v1', 'ready', ?, ?)`,
          )
          .run(first.job.id, second.revision.id, '2026-07-31T01:02:03.000Z', '2026-07-31T01:02:03.000Z'),
      /revision.*job/i,
    );

    const firstCase = startCase(first.job.id);
    const secondCase = startCase(second.job.id);
    const secondRun = store.startRun({
      userId: 'user-a',
      caseId: secondCase.id,
      purpose: 'admission',
      idempotencyKey: 'request-second-case',
    });
    assert.throws(
      () =>
        db
          .prepare(
            `INSERT INTO inspection_decisions
             (id, user_id, case_id, run_id, kind, actor_id, note, created_at)
             VALUES ('decision-mismatch', 'user-a', ?, ?, 'pause', 'user-a', 'wrong case', ?)`,
          )
          .run(firstCase.id, secondRun.id, '2026-07-31T01:02:03.000Z'),
      /run.*case/i,
    );
    assert.throws(
      () =>
        db
          .prepare(
            `INSERT INTO inspection_reports
             (id, user_id, case_id, job_revision_id, run_ids_json, decision_ids_json, verdict, generated_at)
             VALUES ('report-mismatch', 'user-a', ?, ?, '[]', '[]', 'passed', ?)`,
          )
          .run(firstCase.id, second.revision.id, '2026-07-31T01:02:03.000Z'),
      /revision.*case/i,
    );
  });

  it('creates an immutable report from only the exact case revision, runs and decisions', () => {
    const created = createJob();
    const inspectionCase = startCase(created.job.id);
    const run = store.startRun({
      userId: 'user-a',
      caseId: inspectionCase.id,
      purpose: 'post_change',
      idempotencyKey: 'request-report',
    });
    store.completeRun({
      userId: 'user-a',
      runId: run.id,
      verdict: 'passed',
      sourceSnapshot: {
        connectorRef: 'prometheus-default',
        sourceKind: 'replay',
        observedAt: '2026-07-31T01:02:00.000Z',
        window: {
          from: '2026-07-31T00:52:00.000Z',
          to: '2026-07-31T01:02:00.000Z',
        },
      },
      checkResults: [],
    });
    const accepted = store.acceptLatestPassedRun({
      userId: 'user-a',
      caseId: inspectionCase.id,
      runId: run.id,
      actorId: 'user-a',
      note: 'Reviewed the persisted evidence.',
    });
    const decision = accepted.decision;
    assert.throws(
      () => db.prepare('UPDATE inspection_decisions SET note = ? WHERE id = ?').run('rewritten', decision.id),
      /immutable/i,
    );
    const report = accepted.report;

    assert.equal(report.jobRevisionId, created.revision.id);
    assert.deepEqual(report.runIds, [run.id]);
    assert.deepEqual(report.decisionIds, [decision.id]);
    assert.deepEqual(store.getReport('user-a', report.id), report);
    assert.deepEqual(store.getReportForCase('user-a', inspectionCase.id), report);
    assert.equal(store.getReportForCase('user-b', inspectionCase.id), null);
    assert.equal(store.getReport('user-b', report.id), null);
    assert.throws(
      () => db.prepare('UPDATE inspection_reports SET verdict = ? WHERE id = ?').run('risk', report.id),
      /immutable/i,
    );
  });
});
