import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTION_STATUSES,
  assertCheckContract,
  EVIDENCE_VERDICTS,
  reconcileChange,
  validReportContract,
} from '../lib/domain.mjs';
import { scenarios } from '../lib/scenarios.mjs';

test('every committed check is executable, explainable, and source-grounded', () => {
  for (const scenario of scenarios) {
    const sourceIds = new Set(scenario.contextSources.map((source) => source.id));
    for (const check of scenario.committedChecks) {
      assert.equal(assertCheckContract(check, sourceIds), true);
    }
  }
});

test('a formal check rejects missing decision fields and invented sources', () => {
  const check = structuredClone(scenarios[0].committedChecks[0]);
  delete check.failureAction;
  assert.throws(() => assertCheckContract(check, new Set(['intent'])), /failureAction/);

  assert.throws(
    () => assertCheckContract({ ...scenarios[0].committedChecks[0], sourceRefs: ['invented'] }, new Set(['intent'])),
    /Unknown sourceRef/,
  );
});

test('observed superset separates the declared blocking scope from external coverage gaps', () => {
  const scenario = scenarios.find((item) => item.id === 'change-ticket-risk');
  const result = reconcileChange(scenario.declaredChange, scenario.observedChange);

  assert.equal(result.status, 'Observed-Superset');
  assert.deepEqual(result.addedEntities, ['invoice-worker', 'settlement-db']);
  assert.deepEqual(result.resolvedEntities, ['invoice-worker', 'payment-api', 'settlement-db']);
  assert.deepEqual(result.blockingEntities, ['payment-api']);
  assert.deepEqual(result.coverageGapEntities, ['invoice-worker', 'settlement-db']);
});

test('scenario evidence and action use orthogonal vocabularies', () => {
  assert.deepEqual(EVIDENCE_VERDICTS, ['Verified', 'Violated', 'Inconclusive', 'NotEvaluated']);
  assert.deepEqual(ACTION_STATUSES, ['Proceed', 'Proceed-with-conditions', 'Pause', 'Rollback']);

  for (const scenario of scenarios) {
    assert.ok(EVIDENCE_VERDICTS.includes(scenario.report.evidenceVerdict));
    assert.ok(ACTION_STATUSES.includes(scenario.report.action));
    assert.notEqual(scenario.report.evidenceVerdict, scenario.report.action);
  }
});

test('scenario fixtures are deeply immutable', () => {
  assert.ok(Object.isFrozen(scenarios));
  assert.ok(Object.isFrozen(scenarios[0]));
  assert.ok(Object.isFrozen(scenarios[0].committedChecks));
  assert.ok(Object.isFrozen(scenarios[0].report));
});

test('every scenario declares the four impact dimensions required by SRE review', () => {
  for (const scenario of scenarios) {
    assert.deepEqual(Object.keys(scenario.impactDimensions), [
      'businessJourney',
      'goldenMetrics',
      'traceDependencies',
      'middleware',
    ]);
    for (const dimension of Object.values(scenario.impactDimensions)) {
      assert.ok(dimension.length > 0);
    }
  }
});

test('every v2 report is a structured, uniquely anchored evidence contract', () => {
  for (const scenario of scenarios) {
    assert.equal(validReportContract(scenario.report), true);
    assert.ok(scenario.report.checkResults.length >= scenario.committedChecks.length);

    const measurementIds = scenario.report.checkResults.flatMap((result) =>
      result.measurements.map((measurement) => measurement.id),
    );
    assert.equal(new Set(measurementIds).size, measurementIds.length);

    for (const section of Object.values(scenario.report.interpretation)) {
      assert.ok(section.text.trim());
      if (section.text !== '证据不足') {
        assert.ok(section.evidenceIds.length > 0);
        assert.ok(section.evidenceIds.every((id) => measurementIds.includes(id)));
      }
    }
  }
});

test('report validation rejects ungrounded interpretation but keeps legacy snapshots readable', () => {
  const report = structuredClone(scenarios[0].report);
  report.interpretation.whatHappened.evidenceIds = ['invented-evidence'];
  assert.equal(validReportContract(report), false);

  const legacy = structuredClone(scenarios[0].report);
  delete legacy.checkResults;
  delete legacy.interpretation;
  assert.equal(validReportContract(legacy), true);
});
