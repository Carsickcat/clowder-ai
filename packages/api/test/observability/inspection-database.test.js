import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, test } from 'node:test';

import { openInspectionDatabase } from '../../dist/domains/observability/InspectionDatabase.js';
import { SqliteInspectionStore } from '../../dist/domains/observability/SqliteInspectionStore.js';

describe('NOVA dedicated inspection database', () => {
  const temporaryRoots = [];

  afterEach(async () => {
    for (const root of temporaryRoots.splice(0)) {
      await rm(root, { force: true, recursive: true });
    }
  });

  test('installs only the inspection schema in an isolated TTL-0 database', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'nova-inspection-db-'));
    temporaryRoots.push(dataRoot);

    const opened = openInspectionDatabase({ dataRoot });
    try {
      assert.equal(opened.path, join(dataRoot, 'nova-inspection', 'inspection.sqlite'));

      const tables = opened.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all()
        .map((row) => row.name);
      assert.deepEqual(tables, [
        'inspection_candidate_sets',
        'inspection_cases',
        'inspection_check_results',
        'inspection_decisions',
        'inspection_job_revisions',
        'inspection_jobs',
        'inspection_reports',
        'inspection_runs',
        'inspection_schema_version',
      ]);
      assert.equal(tables.includes('evidence_docs'), false);
      assert.equal(tables.includes('task_run_ledger'), false);

      for (const table of tables.filter(
        (name) => name.startsWith('inspection_') && name !== 'inspection_schema_version',
      )) {
        const columns = opened.db
          .prepare(`PRAGMA table_info(${table})`)
          .all()
          .map((row) => row.name);
        assert.equal(columns.includes('expires_at'), false, `${table} must not have expires_at`);
        assert.equal(columns.includes('ttl'), false, `${table} must not have ttl`);
      }
    } finally {
      opened.close();
    }
  });

  test('reopens durable inspection state without a memory or scheduler database', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'nova-inspection-reopen-'));
    temporaryRoots.push(dataRoot);

    const first = openInspectionDatabase({ dataRoot });
    const firstStore = new SqliteInspectionStore(first.db, {
      idFactory: (kind) => `${kind}-persisted`,
      now: () => '2026-08-04T00:00:00.000Z',
    });
    const created = firstStore.createJob({
      userId: 'operator-a',
      name: 'Payments acceptance',
      service: 'payments-router',
      environment: 'acceptance',
      connectorRef: 'replay-acceptance',
      checks: [
        {
          id: 'availability',
          name: 'Availability',
          query: 'safe_availability_metric',
          unit: 'ratio',
          operator: 'gte',
          threshold: 0.995,
          maxAgeMs: 120_000,
        },
      ],
      createdBy: 'operator-a',
    });
    first.close();

    const reopened = openInspectionDatabase({ dataRoot });
    try {
      const reopenedStore = new SqliteInspectionStore(reopened.db);
      assert.deepEqual(reopenedStore.getJob('operator-a', created.job.id), created.job);
      assert.deepEqual(reopenedStore.getJobRevision('operator-a', created.revision.id), created.revision);
    } finally {
      reopened.close();
    }
  });
});
