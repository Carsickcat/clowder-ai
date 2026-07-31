import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
import Database from 'better-sqlite3';
import Fastify from 'fastify';

import { applyMigrations } from '../../dist/domains/memory/schema.js';
import { ReplayObservabilitySource } from '../../dist/domains/observability/adapters/ReplayObservabilitySource.js';
import { InspectionService } from '../../dist/domains/observability/InspectionService.js';
import { SqliteInspectionStore } from '../../dist/domains/observability/SqliteInspectionStore.js';
import { inspectionsRoutes } from '../../dist/routes/inspections.js';

const USER_HEADER = { 'x-cat-cafe-user': 'acceptance-user' };
const COLLECTED_AT = '2026-07-31T08:00:00.000Z';

describe('connected inspection restart acceptance', () => {
  let acceptanceDir;

  afterEach(() => {
    if (acceptanceDir) rmSync(acceptanceDir, { recursive: true, force: true });
  });

  async function createApp(databasePath) {
    const db = new Database(databasePath);
    applyMigrations(db);
    const source = new ReplayObservabilitySource({
      collectedAt: COLLECTED_AT,
      observations: {
        latency: {
          observedAt: '2026-07-31T07:59:30.000Z',
          value: 184,
        },
      },
      sourceId: 'replay-acceptance',
    });
    const service = new InspectionService({
      now: () => new Date(COLLECTED_AT),
      sources: [
        {
          id: source.sourceId,
          kind: 'replay',
          label: 'Acceptance replay',
          scope: 'acceptance',
          source,
        },
      ],
      store: new SqliteInspectionStore(db),
    });
    const app = Fastify();
    await app.register(inspectionsRoutes, { service });
    return { app, db };
  }

  test('reopens a saved job, reuses it for disjoint cases, and reopens immutable evidence', async () => {
    acceptanceDir = mkdtempSync(join(tmpdir(), 'nova-inspection-'));
    const databasePath = join(acceptanceDir, 'inspection.sqlite');
    let runtime = await createApp(databasePath);

    const createdJobResponse = await runtime.app.inject({
      method: 'POST',
      url: '/api/observability/inspection-jobs',
      headers: USER_HEADER,
      payload: {
        name: 'Restart-safe payments inspection',
        service: 'payments-router',
        environment: 'acceptance',
        connectorRef: 'replay-acceptance',
        checks: [
          {
            id: 'latency',
            name: 'p95 latency',
            query: 'safe_metric',
            operator: 'lte',
            threshold: 250,
            unit: 'ms',
            maxAgeMs: 120_000,
          },
        ],
      },
    });
    assert.equal(createdJobResponse.statusCode, 201);
    const createdJob = createdJobResponse.json();
    await runtime.app.close();
    runtime.db.close();

    runtime = await createApp(databasePath);
    const reopenedJobs = await runtime.app.inject({
      method: 'GET',
      url: '/api/observability/inspection-jobs',
      headers: USER_HEADER,
    });
    assert.equal(reopenedJobs.statusCode, 200);
    assert.equal(reopenedJobs.json()[0].id, createdJob.job.id);

    const caseResponses = await Promise.all(
      ['CHG-42', 'CHG-43'].map((changeId) =>
        runtime.app.inject({
          method: 'POST',
          url: '/api/observability/inspection-cases',
          headers: USER_HEADER,
          payload: {
            jobId: createdJob.job.id,
            changeId,
            version: changeId === 'CHG-42' ? 'v3.18.0' : 'v3.18.1',
          },
        }),
      ),
    );
    const cases = caseResponses.map((response) => {
      assert.equal(response.statusCode, 201);
      return response.json();
    });
    assert.notEqual(cases[0].id, cases[1].id);
    assert.equal(cases[0].jobRevisionId, cases[1].jobRevisionId);

    const runResponses = [];
    for (const [index, inspectionCase] of cases.entries()) {
      runResponses.push(
        await runtime.app.inject({
          method: 'POST',
          url: `/api/observability/inspection-cases/${inspectionCase.id}/runs`,
          headers: {
            ...USER_HEADER,
            'idempotency-key': `acceptance-run-${index}`,
          },
          payload: { purpose: 'post_change' },
        }),
      );
    }
    const runs = runResponses.map((response) => {
      assert.equal(response.statusCode, 201);
      const run = response.json();
      assert.equal(run.verdict, 'passed');
      assert.equal(run.checkResults[0].value, 184);
      return run;
    });
    assert.notEqual(runs[0].id, runs[1].id);
    assert.notEqual(runs[0].checkResults[0].id, runs[1].checkResults[0].id);

    const accepted = await runtime.app.inject({
      method: 'POST',
      url: `/api/observability/inspection-cases/${cases[0].id}/decisions`,
      headers: USER_HEADER,
      payload: {
        runId: runs[0].id,
        kind: 'accept',
        note: 'Acceptance evidence reviewed.',
      },
    });
    assert.equal(accepted.statusCode, 201);
    const reportId = accepted.json().report.id;
    await runtime.app.close();
    runtime.db.close();

    runtime = await createApp(databasePath);
    const reopenedCase = await runtime.app.inject({
      method: 'GET',
      url: `/api/observability/inspection-cases/${cases[0].id}`,
      headers: USER_HEADER,
    });
    assert.equal(reopenedCase.statusCode, 200);
    assert.equal(reopenedCase.json().report.id, reportId);
    assert.equal(reopenedCase.json().runs[0].sourceSnapshot.connectorRef, 'replay-acceptance');
    assert.match(reopenedCase.json().runs[0].checkResults[0].queryDigest, /^sha256:/);

    await runtime.app.close();
    runtime.db.close();
  });
});
