import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { projectInspectionABReport } from '../../dist/domains/observability/InspectionAssessment.js';

const QUERY_DIGEST = `sha256:${'a'.repeat(64)}`;

function createRun({ id, purpose, value, queryDigest = QUERY_DIGEST, verdict = 'passed' }) {
  return {
    id,
    caseId: 'case-1',
    purpose,
    status: 'completed',
    verdict,
    sourceSnapshot: {
      connectorRef: 'replay-acceptance',
      sourceKind: 'replay',
      observedAt: '2026-08-02T01:00:00.000Z',
      window: {
        from: '2026-08-02T00:55:00.000Z',
        to: '2026-08-02T01:00:00.000Z',
      },
    },
    checkResults: [
      {
        id: `result-${id}`,
        runId: id,
        checkId: 'latency',
        status: verdict,
        value,
        baselineValue: null,
        observedAt: '2026-08-02T01:00:00.000Z',
        queryDigest,
        reason: null,
      },
    ],
    errorSummary: null,
    startedAt: '2026-08-02T00:59:00.000Z',
    finishedAt: '2026-08-02T01:00:00.000Z',
  };
}

describe('NOVA A/B report projection', () => {
  test('compares the admission baseline with the latest post-change run', () => {
    const report = projectInspectionABReport([
      createRun({ id: 'run-before', purpose: 'admission', value: 200 }),
      createRun({ id: 'run-after', purpose: 'post_change', value: 220 }),
    ]);

    assert.equal(report.comparability, 'valid');
    assert.equal(report.baselineRunId, 'run-before');
    assert.equal(report.currentRunId, 'run-after');
    assert.deepEqual(report.checks[0], {
      checkId: 'latency',
      comparable: true,
      baselineValue: 200,
      currentValue: 220,
      absoluteDelta: 20,
      relativeDeltaPercent: 10,
      reason: null,
      evidenceRefs: [
        { kind: 'check_result', ref: 'run:run-before/check:latency', label: 'latency baseline result' },
        { kind: 'check_result', ref: 'run:run-after/check:latency', label: 'latency current result' },
      ],
    });
  });

  test('fails comparability closed when the query digest changes', () => {
    const report = projectInspectionABReport([
      createRun({ id: 'run-before', purpose: 'admission', value: 200 }),
      createRun({ id: 'run-after', purpose: 'post_change', value: 180, queryDigest: `sha256:${'b'.repeat(64)}` }),
    ]);

    assert.equal(report.comparability, 'unavailable');
    assert.equal(report.checks[0].comparable, false);
    assert.equal(report.checks[0].reason, 'query_digest_mismatch');
    assert.equal(report.checks[0].absoluteDelta, null);
  });
});
