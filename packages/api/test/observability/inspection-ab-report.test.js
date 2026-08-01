import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  projectInspectionABReport,
  projectInspectionAssessment,
} from '../../dist/domains/observability/InspectionAssessment.js';

const QUERY_DIGEST = `sha256:${'a'.repeat(64)}`;

function createRun({
  id,
  purpose,
  value,
  queryDigest = QUERY_DIGEST,
  sourceKind = 'replay',
  verdict = 'passed',
  startedAt = purpose === 'admission' ? '2026-08-02T00:56:00.000Z' : '2026-08-02T00:59:00.000Z',
  finishedAt = purpose === 'admission' ? '2026-08-02T00:57:00.000Z' : '2026-08-02T01:00:00.000Z',
}) {
  return {
    id,
    caseId: 'case-1',
    purpose,
    status: 'completed',
    verdict,
    sourceSnapshot: {
      connectorRef: 'replay-acceptance',
      sourceKind,
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
    startedAt,
    finishedAt,
  };
}

describe('NOVA A/B report projection', () => {
  test('compares the admission baseline with the latest post-change run', () => {
    const report = projectInspectionABReport([
      createRun({ id: 'run-before', purpose: 'admission', value: 200 }),
      createRun({ id: 'run-after', purpose: 'post_change', value: 220 }),
    ]);

    assert.equal(report.comparability, 'valid');
    assert.equal(report.reason, null);
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

  test('fails comparability closed when the persisted source kind changes', () => {
    const report = projectInspectionABReport([
      createRun({ id: 'run-before', purpose: 'admission', value: 200, sourceKind: 'replay' }),
      createRun({ id: 'run-after', purpose: 'post_change', value: 180, sourceKind: 'prometheus' }),
    ]);

    assert.equal(report.comparability, 'unavailable');
    assert.equal(report.checks[0].comparable, false);
    assert.equal(report.checks[0].reason, 'source_mismatch');
    assert.equal(report.checks[0].absoluteDelta, null);
  });

  test('fails comparability closed when the admission baseline finished after the post-change run began', () => {
    const report = projectInspectionABReport([
      createRun({
        id: 'run-before-too-late',
        purpose: 'admission',
        value: 200,
        startedAt: '2026-08-02T01:01:00.000Z',
        finishedAt: '2026-08-02T01:02:00.000Z',
      }),
      createRun({ id: 'run-after', purpose: 'post_change', value: 180 }),
    ]);

    assert.equal(report.comparability, 'unavailable');
    assert.equal(report.reason, 'baseline_not_before_current');
    assert.equal(report.checks[0].comparable, false);
    assert.equal(report.checks[0].reason, 'run_order_mismatch');
  });

  test('projects an explicit unavailable report when the admission baseline is missing', () => {
    const currentRun = createRun({ id: 'run-after', purpose: 'post_change', value: 180 });
    const report = projectInspectionABReport([currentRun]);

    assert.equal(report.comparability, 'unavailable');
    assert.equal(report.reason, 'missing_baseline_run');
    assert.equal(report.baselineRunId, null);
    assert.equal(report.currentRunId, currentRun.id);
    assert.equal(report.checks[0].reason, 'missing_baseline_result');
  });

  test('counts a waived required candidate as an explicit coverage omission', () => {
    const run = createRun({ id: 'run-admission', purpose: 'admission', value: 180 });
    const candidateSet = {
      coverageOmissions: [],
      candidates: [
        {
          id: 'availability',
          evidenceRefs: [{ kind: 'rule', ref: 'rule:availability', label: 'availability rule' }],
        },
      ],
    };
    const assessment = projectInspectionAssessment(run, candidateSet, null, {
      candidateSetId: 'candidates-1',
      selectedCandidateIds: ['latency'],
      waivers: [{ candidateId: 'availability', reason: 'External synthetic gate.' }],
    });

    assert.equal(assessment.coverageStatus, 'omission');
    assert.equal(assessment.decisionReadiness, 'review_required');
    assert.equal(
      assessment.unknowns.some((item) => item.code === 'REQUIRED_CANDIDATE_WAIVED'),
      true,
    );
  });
});
