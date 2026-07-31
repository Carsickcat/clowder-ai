import type { InspectionCheckDefinition, InspectionCheckStatus, InspectionVerdict } from '@cat-cafe/shared';

import type { ObservabilityObservation, ObservabilitySnapshot } from './ports/ObservabilitySource.js';
import { createQueryDigest } from './ports/ObservabilitySource.js';

export interface EvaluatedInspectionCheck {
  readonly baselineValue: number | null;
  readonly checkId: string;
  readonly observedAt: string | null;
  readonly operator: InspectionCheckDefinition['operator'];
  readonly queryDigest: string;
  readonly reason: string | null;
  readonly status: InspectionCheckStatus;
  readonly threshold: number;
  readonly value: number | null;
}

export interface InspectionEvaluation {
  readonly checkResults: readonly EvaluatedInspectionCheck[];
  readonly verdict: InspectionVerdict;
}

export interface InspectionEvaluationOptions {
  readonly now: Date;
}

function unknownResult(
  check: InspectionCheckDefinition,
  observation: ObservabilityObservation | undefined,
  reason: string,
): EvaluatedInspectionCheck {
  return {
    baselineValue: observation?.baselineValue ?? null,
    checkId: check.id,
    observedAt: observation?.observedAt ?? null,
    operator: check.operator,
    queryDigest: observation?.queryDigest ?? '',
    reason,
    status: 'unknown',
    threshold: check.threshold,
    value: observation?.value ?? null,
  };
}

function thresholdValue(check: InspectionCheckDefinition, observation: ObservabilityObservation): number | null {
  if (check.operator === 'lte' || check.operator === 'gte') {
    return observation.value;
  }

  const baseline = observation.baselineValue;
  if (baseline === null || !Number.isFinite(baseline) || baseline === 0 || observation.value === null) {
    return null;
  }

  return ((observation.value - baseline) / Math.abs(baseline)) * 100;
}

function thresholdPassed(operator: InspectionCheckDefinition['operator'], value: number, threshold: number): boolean {
  switch (operator) {
    case 'lte':
    case 'relative_lte':
      return value <= threshold;
    case 'gte':
    case 'relative_gte':
      return value >= threshold;
  }
}

function observationUncertainty(
  check: InspectionCheckDefinition,
  observation: ObservabilityObservation,
  nowMs: number,
): string | null {
  if (!['lte', 'gte', 'relative_lte', 'relative_gte'].includes(check.operator as string)) {
    return 'unsupported_operator';
  }
  if (observation.queryDigest !== createQueryDigest(check.query)) {
    return 'query_digest_mismatch';
  }
  if (observation.status !== 'ok') {
    return `source_${observation.status}`;
  }
  if (observation.partial) {
    return 'partial_observation';
  }
  if (
    observation.value === null ||
    !Number.isFinite(observation.value) ||
    !Number.isFinite(check.threshold) ||
    !Number.isFinite(check.maxAgeMs) ||
    check.maxAgeMs < 0
  ) {
    return 'non_finite_value';
  }

  const observedAtMs = Date.parse(observation.observedAt ?? '');
  if (!Number.isFinite(observedAtMs)) return 'invalid_observed_at';
  if (observedAtMs > nowMs) return 'future_observation';
  if (nowMs - observedAtMs > check.maxAgeMs) return 'stale_observation';
  return null;
}

function evaluateCheck(
  check: InspectionCheckDefinition,
  observations: readonly ObservabilityObservation[],
  nowMs: number,
): EvaluatedInspectionCheck {
  const matches = observations.filter((observation) => observation.checkId === check.id);
  if (matches.length !== 1) {
    return unknownResult(check, matches[0], matches.length === 0 ? 'missing_observation' : 'ambiguous_observation');
  }

  const observation = matches[0];
  const uncertainty = observationUncertainty(check, observation, nowMs);
  if (uncertainty) return unknownResult(check, observation, uncertainty);

  const comparedValue = thresholdValue(check, observation);
  if (comparedValue === null || !Number.isFinite(comparedValue)) {
    return unknownResult(check, observation, 'missing_baseline');
  }

  const passed = thresholdPassed(check.operator, comparedValue, check.threshold);
  return {
    baselineValue: observation.baselineValue,
    checkId: check.id,
    observedAt: observation.observedAt,
    operator: check.operator,
    queryDigest: observation.queryDigest,
    reason: passed ? null : 'threshold_breached',
    status: passed ? 'passed' : 'risk',
    threshold: check.threshold,
    value: observation.value,
  };
}

export function evaluateInspection(
  checks: readonly InspectionCheckDefinition[],
  snapshot: ObservabilitySnapshot,
  options: InspectionEvaluationOptions,
): InspectionEvaluation {
  const nowMs = options.now.getTime();
  if (!Number.isFinite(nowMs)) {
    throw new TypeError('A valid evaluation time is required');
  }

  const checkResults = checks.map((check) => evaluateCheck(check, snapshot.observations, nowMs));
  const verdict: InspectionVerdict = checkResults.some((result) => result.status === 'unknown')
    ? 'unknown'
    : checkResults.some((result) => result.status === 'risk')
      ? 'risk'
      : checks.length > 0
        ? 'passed'
        : 'unknown';

  return { checkResults, verdict };
}
