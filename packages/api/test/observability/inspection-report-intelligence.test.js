import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createInspectionReportIntelligence } from '../../dist/domains/observability/InspectionReportIntelligence.js';

const SOURCE = {
  connectorRef: 'replay-acceptance',
  sourceKind: 'replay',
  scope: 'acceptance',
  snapshotHash: 'sha256:fixture-snapshot',
  fixtureCapturedAt: '2026-08-03T23:00:00.000Z',
  observedAt: '2026-08-04T00:09:00.000Z',
  window: {
    from: '2026-08-04T00:04:00.000Z',
    to: '2026-08-04T00:09:00.000Z',
  },
};

function run(id, purpose, verdict, startedAt, finishedAt) {
  return {
    id,
    caseId: 'case-1',
    purpose,
    status: 'completed',
    verdict,
    sourceSnapshot: {
      ...SOURCE,
      observedAt: finishedAt,
      window: { from: startedAt, to: finishedAt },
    },
    checkResults: [
      {
        id: `${id}-availability`,
        runId: id,
        checkId: 'availability',
        status: verdict,
        value: verdict === 'risk' ? 0.97 : 0.999,
        baselineValue: 0.998,
        observedAt: finishedAt,
        queryDigest: 'sha256:availability',
        reason: verdict === 'risk' ? 'below threshold' : null,
      },
    ],
    errorSummary: null,
    startedAt,
    finishedAt,
  };
}

describe('NOVA immutable report intelligence', () => {
  test('reconstructs five weighted dimensions and resolvable citations from persisted evidence', () => {
    const runs = [
      run('run-admission', 'admission', 'passed', '2026-08-04T00:00:00.000Z', '2026-08-04T00:01:00.000Z'),
      run('run-canary', 'canary', 'risk', '2026-08-04T00:02:00.000Z', '2026-08-04T00:03:00.000Z'),
      run('run-verification', 'verification', 'passed', '2026-08-04T00:05:00.000Z', '2026-08-04T00:06:00.000Z'),
      run('run-post-change', 'post_change', 'passed', '2026-08-04T00:08:00.000Z', '2026-08-04T00:09:00.000Z'),
    ];
    const decisions = [
      {
        id: 'decision-pause',
        caseId: 'case-1',
        runId: 'run-canary',
        kind: 'pause',
        actorId: 'operator-a',
        note: 'Investigate canary risk',
        createdAt: '2026-08-04T00:03:30.000Z',
      },
      {
        id: 'decision-resume',
        caseId: 'case-1',
        runId: 'run-verification',
        kind: 'resume',
        actorId: 'operator-a',
        note: 'Verification passed',
        createdAt: '2026-08-04T00:06:30.000Z',
      },
      {
        id: 'decision-accept',
        caseId: 'case-1',
        runId: 'run-post-change',
        kind: 'accept',
        actorId: 'operator-a',
        note: 'Accept local evidence',
        createdAt: '2026-08-04T00:10:00.000Z',
      },
    ];
    const input = {
      runs,
      decisions,
      candidateSet: {
        id: 'candidate-set-1',
        userId: 'operator-a',
        changeContext: {
          intent: 'Inspect payments-router v3.18.0',
          service: 'payments-router',
          environment: 'acceptance',
          connectorRef: 'replay-acceptance',
          changeId: 'CHG-42',
          version: 'v3.18.0',
        },
        topologySnapshot: {
          catalogVersion: 'catalog-v1',
          rootService: 'payments-router',
          capturedAt: '2026-08-04T00:00:00.000Z',
          dependencies: [],
        },
        candidates: [{ id: 'availability' }],
        coverageOmissions: [],
        generatedAt: '2026-08-04T00:00:00.000Z',
      },
      abReport: {
        baselineRunId: 'run-admission',
        currentRunId: 'run-post-change',
        comparability: 'valid',
        reason: null,
        checks: [],
        generatedAt: '2026-08-04T00:09:00.000Z',
      },
      generatedAt: '2026-08-04T02:00:00.000Z',
    };

    const intelligence = createInspectionReportIntelligence(input);
    assert.equal(intelligence.score.modelVersion, 'nova-report-score-v2');
    assert.deepEqual(
      intelligence.score.dimensions.map((dimension) => dimension.id),
      ['coverage', 'integrity', 'comparability', 'freshness', 'risk_closure'],
    );
    assert.equal(
      intelligence.score.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0),
      100,
    );
    assert.equal(intelligence.score.dimensions.find((dimension) => dimension.id === 'freshness')?.score, 90);
    assert.equal(intelligence.score.overall, 96);
    assert.equal(
      intelligence.score.deductions.reduce((sum, deduction) => sum + deduction.points, 0),
      4,
    );

    const evidenceIds = new Set([...runs.map((item) => item.id), ...decisions.map((item) => item.id)]);
    for (const dimension of intelligence.score.dimensions) {
      assert.ok(dimension.evidenceRefs.length > 0);
      assert.ok(dimension.evidenceRefs.every((ref) => evidenceIds.has(ref)));
    }
    for (const deduction of intelligence.score.deductions) {
      assert.ok(deduction.evidenceRefs.length > 0);
      assert.ok(deduction.evidenceRefs.every((ref) => evidenceIds.has(ref)));
    }
    assert.ok(intelligence.interpretation.citations.every((ref) => evidenceIds.has(ref)));
    assert.deepEqual(intelligence.assessmentBasis, {
      candidateSetId: 'candidate-set-1',
      coverageOmissionIds: [],
      comparability: 'valid',
      runIds: runs.map((item) => item.id),
      decisionIds: decisions.map((item) => item.id),
      sourceSnapshotHashes: ['sha256:fixture-snapshot'],
    });

    assert.deepEqual(createInspectionReportIntelligence(JSON.parse(JSON.stringify(input))), intelligence);
  });
});
