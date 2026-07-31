import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ReplayObservabilitySource } from '../../dist/domains/observability/adapters/ReplayObservabilitySource.js';
import { evaluateInspection } from '../../dist/domains/observability/InspectionEvaluator.js';
import { createQueryDigest } from '../../dist/domains/observability/ports/ObservabilitySource.js';

const NOW = new Date('2026-07-31T08:00:00.000Z');

function observation(
  checkId,
  value,
  {
    baselineValue = null,
    observedAt = '2026-07-31T07:59:30.000Z',
    partial = false,
    queryDigest = createQueryDigest(`metric_${checkId}`),
    status = 'ok',
  } = {},
) {
  return {
    baselineValue,
    checkId,
    observedAt,
    partial,
    queryDigest,
    status,
    value,
  };
}

function snapshot(observations) {
  return {
    collectedAt: NOW.toISOString(),
    observations,
    sourceId: 'replay-acceptance',
    window: '5m',
  };
}

function check(id, { maxAgeMs = 60_000, operator = 'lte', query = `metric_${id}`, threshold = 200 } = {}) {
  return { id, maxAgeMs, operator, query, threshold };
}

describe('InspectionEvaluator', () => {
  test('treats inclusive threshold boundaries as passed and breaches as risk', () => {
    const checks = [
      check('latency-at-boundary'),
      check('availability-at-boundary', {
        operator: 'gte',
        threshold: 99.95,
      }),
      check('error-breach', { threshold: 0.5 }),
    ];

    const evaluation = evaluateInspection(
      checks,
      snapshot([
        observation('latency-at-boundary', 200),
        observation('availability-at-boundary', 99.95),
        observation('error-breach', 0.51),
      ]),
      { now: NOW },
    );

    assert.equal(evaluation.verdict, 'risk');
    assert.deepEqual(
      evaluation.checkResults.map(({ checkId, status }) => ({
        checkId,
        status,
      })),
      [
        { checkId: 'latency-at-boundary', status: 'passed' },
        { checkId: 'availability-at-boundary', status: 'passed' },
        { checkId: 'error-breach', status: 'risk' },
      ],
    );
  });

  test('evaluates relative thresholds only when a finite non-zero baseline exists', () => {
    const checks = [
      check('relative-at-boundary', {
        operator: 'relative_lte',
        threshold: 10,
      }),
      check('relative-breach', {
        operator: 'relative_lte',
        threshold: 10,
      }),
      check('relative-without-baseline', {
        operator: 'relative_lte',
        threshold: 10,
      }),
    ];

    const evaluation = evaluateInspection(
      checks,
      snapshot([
        observation('relative-at-boundary', 110, { baselineValue: 100 }),
        observation('relative-breach', 111, { baselineValue: 100 }),
        observation('relative-without-baseline', 100),
      ]),
      { now: NOW },
    );

    assert.equal(evaluation.verdict, 'unknown');
    assert.deepEqual(
      evaluation.checkResults.map(({ checkId, status }) => ({
        checkId,
        status,
      })),
      [
        { checkId: 'relative-at-boundary', status: 'passed' },
        { checkId: 'relative-breach', status: 'risk' },
        { checkId: 'relative-without-baseline', status: 'unknown' },
      ],
    );
  });

  test('returns unknown when any observation is missing, stale, partial, or non-finite', () => {
    const checks = [check('missing'), check('stale'), check('partial'), check('nan'), check('known-risk')];

    const evaluation = evaluateInspection(
      checks,
      snapshot([
        observation('stale', 100, {
          observedAt: '2026-07-31T07:00:00.000Z',
        }),
        observation('partial', 100, { partial: true }),
        observation('nan', Number.NaN),
        observation('known-risk', 300),
      ]),
      { now: NOW },
    );

    assert.equal(
      evaluation.verdict,
      'unknown',
      'uncertainty must dominate a known risk instead of producing a complete verdict',
    );
    assert.deepEqual(Object.fromEntries(evaluation.checkResults.map((result) => [result.checkId, result.status])), {
      missing: 'unknown',
      stale: 'unknown',
      partial: 'unknown',
      nan: 'unknown',
      'known-risk': 'risk',
    });
  });

  test('returns unknown for malformed or future observation timestamps', () => {
    const checks = [check('malformed'), check('future')];
    const evaluation = evaluateInspection(
      checks,
      snapshot([
        observation('malformed', 100, { observedAt: 'not-a-date' }),
        observation('future', 100, {
          observedAt: '2026-07-31T08:00:01.000Z',
        }),
      ]),
      { now: NOW },
    );

    assert.equal(evaluation.verdict, 'unknown');
    assert.ok(evaluation.checkResults.every((result) => result.status === 'unknown'));
  });

  test('returns unknown for unsupported operators or mismatched query provenance', () => {
    const checks = [check('unsupported-operator', { operator: 'eq' }), check('mismatched-query')];
    const evaluation = evaluateInspection(
      checks,
      snapshot([
        observation('unsupported-operator', 200),
        observation('mismatched-query', 100, {
          queryDigest: createQueryDigest('different_query'),
        }),
      ]),
      { now: NOW },
    );

    assert.equal(evaluation.verdict, 'unknown');
    assert.deepEqual(
      evaluation.checkResults.map(({ checkId, status }) => ({
        checkId,
        status,
      })),
      [
        { checkId: 'unsupported-operator', status: 'unknown' },
        { checkId: 'mismatched-query', status: 'unknown' },
      ],
    );
  });

  test('ReplayObservabilitySource only projects its configured acceptance bundle', async () => {
    const source = new ReplayObservabilitySource({
      collectedAt: NOW.toISOString(),
      observations: {
        latency: {
          observedAt: '2026-07-31T07:59:30.000Z',
          value: 180,
        },
      },
      sourceId: 'replay-acceptance',
    });

    const result = await source.collect({
      checks: [{ id: 'latency', query: 'safe_metric' }],
      path: '../../production-secrets.json',
      window: '5m',
    });

    assert.equal(result.sourceId, 'replay-acceptance');
    assert.equal(result.observations.length, 1);
    assert.equal(result.observations[0].value, 180);
    assert.match(result.observations[0].queryDigest, /^sha256:[a-f0-9]{64}$/);
    assert.doesNotMatch(JSON.stringify(result), /production-secrets/);
  });
});
