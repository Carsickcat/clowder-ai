import type {
  InspectionABCheckComparison,
  InspectionABReport,
  InspectionAssessment,
  InspectionAssessmentItem,
  InspectionCandidateSet,
  InspectionJobRevision,
  InspectionRevisionOrigin,
  InspectionRun,
  InspectionStageReport,
} from '@cat-cafe/shared';

function runRef(run: InspectionRun) {
  return {
    kind: 'run' as const,
    ref: `run:${run.id}`,
    label: `${run.purpose} ${run.status} run`,
  };
}

function resultRef(run: InspectionRun, checkId: string) {
  return {
    kind: 'check_result' as const,
    ref: `run:${run.id}/check:${checkId}`,
    label: `${checkId} check result`,
  };
}

function comparisonEvidenceRefs(
  baselineRun: InspectionRun | null,
  currentRun: InspectionRun | null,
  checkId: string,
  hasBaseline: boolean,
  hasCurrent: boolean,
) {
  return [
    ...(hasBaseline && baselineRun
      ? [
          {
            kind: 'check_result' as const,
            ref: `run:${baselineRun.id}/check:${checkId}`,
            label: `${checkId} baseline result`,
          },
        ]
      : []),
    ...(hasCurrent && currentRun
      ? [
          {
            kind: 'check_result' as const,
            ref: `run:${currentRun.id}/check:${checkId}`,
            label: `${checkId} current result`,
          },
        ]
      : []),
  ];
}

function compareCheckResults(
  baselineRun: InspectionRun | null,
  currentRun: InspectionRun | null,
  checkId: string,
): InspectionABCheckComparison {
  const baseline = baselineRun?.checkResults.find((result) => result.checkId === checkId);
  const current = currentRun?.checkResults.find((result) => result.checkId === checkId);
  const evidenceRefs = comparisonEvidenceRefs(baselineRun, currentRun, checkId, Boolean(baseline), Boolean(current));
  const base = {
    checkId,
    baselineValue: baseline?.value ?? null,
    currentValue: current?.value ?? null,
    evidenceRefs,
  };
  const unavailable = (reason: Exclude<InspectionABCheckComparison['reason'], null>): InspectionABCheckComparison => ({
    ...base,
    comparable: false,
    absoluteDelta: null,
    relativeDeltaPercent: null,
    reason,
  });
  if (!baseline) return unavailable('missing_baseline_result');
  if (!current) return unavailable('missing_current_result');
  if (!baselineRun || !currentRun)
    return unavailable(!baselineRun ? 'missing_baseline_result' : 'missing_current_result');
  if (baselineRun.sourceSnapshot?.connectorRef !== currentRun.sourceSnapshot?.connectorRef) {
    return unavailable('source_mismatch');
  }
  if (baseline.queryDigest !== current.queryDigest) return unavailable('query_digest_mismatch');
  if (
    baseline.status === 'unknown' ||
    current.status === 'unknown' ||
    baseline.value === null ||
    current.value === null ||
    !Number.isFinite(baseline.value) ||
    !Number.isFinite(current.value)
  ) {
    return unavailable('unusable_evidence');
  }
  const absoluteDelta = current.value - baseline.value;
  return {
    ...base,
    comparable: true,
    absoluteDelta,
    relativeDeltaPercent: baseline.value === 0 ? null : (absoluteDelta / Math.abs(baseline.value)) * 100,
    reason: null,
  };
}

type MissingABRunReason = Exclude<InspectionABReport['reason'], null>;

function missingABRunReason(
  baselineRun: InspectionRun | null,
  currentRun: InspectionRun | null,
): MissingABRunReason | null {
  if (!baselineRun && !currentRun) return 'missing_both_runs';
  if (!baselineRun) return 'missing_baseline_run';
  if (!currentRun) return 'missing_current_run';
  return null;
}

function unavailableABReport(
  runs: readonly InspectionRun[],
  baselineRun: InspectionRun | null,
  currentRun: InspectionRun | null,
  reason: MissingABRunReason,
  checks: readonly InspectionABCheckComparison[],
): InspectionABReport {
  const latestAvailableRun = currentRun ?? baselineRun ?? runs.at(-1);
  return {
    baselineRunId: baselineRun?.id ?? null,
    currentRunId: currentRun?.id ?? null,
    comparability: 'unavailable',
    reason,
    checks,
    generatedAt: latestAvailableRun?.finishedAt ?? latestAvailableRun?.startedAt ?? new Date(0).toISOString(),
  };
}

function classifyABComparability(
  baselineRun: InspectionRun,
  currentRun: InspectionRun,
  checks: readonly InspectionABCheckComparison[],
): InspectionABReport['comparability'] {
  const comparableCount = checks.filter((check) => check.comparable).length;
  const validRuns =
    baselineRun.caseId === currentRun.caseId &&
    baselineRun.status === 'completed' &&
    currentRun.status === 'completed' &&
    Boolean(baselineRun.sourceSnapshot) &&
    Boolean(currentRun.sourceSnapshot);
  if (validRuns && comparableCount === checks.length && checks.length > 0) return 'valid';
  if (validRuns && comparableCount > 0) return 'partial';
  return 'unavailable';
}

function baselinePrecedesCurrent(baselineRun: InspectionRun, currentRun: InspectionRun): boolean {
  const baselineFinishedAt = Date.parse(baselineRun.finishedAt ?? baselineRun.startedAt);
  const currentStartedAt = Date.parse(currentRun.startedAt);
  return (
    Number.isFinite(baselineFinishedAt) && Number.isFinite(currentStartedAt) && baselineFinishedAt <= currentStartedAt
  );
}

function runOrderMismatchReport(
  baselineRun: InspectionRun,
  currentRun: InspectionRun,
  checks: readonly InspectionABCheckComparison[],
): InspectionABReport {
  return {
    baselineRunId: baselineRun.id,
    currentRunId: currentRun.id,
    comparability: 'unavailable',
    reason: 'baseline_not_before_current',
    checks: checks.map((check) => ({
      ...check,
      comparable: false,
      absoluteDelta: null,
      relativeDeltaPercent: null,
      reason: 'run_order_mismatch',
    })),
    generatedAt: currentRun.finishedAt ?? currentRun.startedAt,
  };
}

export function projectInspectionABReport(runs: readonly InspectionRun[]): InspectionABReport | null {
  if (runs.length === 0) return null;
  const baselineRun = runs.find((run) => run.purpose === 'admission') ?? null;
  const currentRun = [...runs].reverse().find((run) => run.purpose === 'post_change') ?? null;

  const checkIds = [
    ...new Set(
      [...(baselineRun?.checkResults ?? []), ...(currentRun?.checkResults ?? [])].map((result) => result.checkId),
    ),
  ];
  const checks = checkIds.map((checkId) => compareCheckResults(baselineRun, currentRun, checkId));
  const missingReason = missingABRunReason(baselineRun, currentRun);
  if (missingReason) return unavailableABReport(runs, baselineRun, currentRun, missingReason, checks);
  if (!baselineRun || !currentRun) return null;
  if (!baselinePrecedesCurrent(baselineRun, currentRun)) {
    return runOrderMismatchReport(baselineRun, currentRun, checks);
  }
  return {
    baselineRunId: baselineRun.id,
    currentRunId: currentRun.id,
    comparability: classifyABComparability(baselineRun, currentRun, checks),
    reason: null,
    checks,
    generatedAt: currentRun.finishedAt ?? currentRun.startedAt,
  };
}

export function projectInspectionStageReport(
  run: InspectionRun,
  revision: InspectionJobRevision,
): InspectionStageReport {
  const resultCounts = { passed: 0, risk: 0, unknown: 0 };
  for (const result of run.checkResults) resultCounts[result.status] += 1;
  const missingChecks = Math.max(0, revision.checks.length - run.checkResults.length) + resultCounts.unknown;
  const evidenceStatus =
    run.status === 'failed' || !run.sourceSnapshot ? 'unavailable' : missingChecks > 0 ? 'degraded' : 'complete';
  return {
    runId: run.id,
    purpose: run.purpose,
    runStatus: run.status,
    machineVerdict: run.verdict,
    generatedAt: run.finishedAt ?? run.startedAt,
    evidenceQuality: {
      status: evidenceStatus,
      observedChecks: run.checkResults.length - resultCounts.unknown,
      totalChecks: revision.checks.length,
      missingChecks,
    },
    resultCounts,
    sourceSnapshot: run.sourceSnapshot,
  };
}

function factsForRun(run: InspectionRun): InspectionAssessmentItem[] {
  return run.checkResults
    .filter((result) => result.status !== 'unknown')
    .map((result) => ({
      code: result.status === 'passed' ? 'CHECK_PASSED' : 'CHECK_RISK',
      statement:
        result.status === 'passed'
          ? `${result.checkId} stayed within its configured rule at ${result.value}.`
          : `${result.checkId} breached its configured rule at ${result.value}.`,
      evidenceRefs: [runRef(run), resultRef(run, result.checkId)],
    }));
}

function hypothesesForRun(run: InspectionRun): InspectionAssessmentItem[] {
  return run.checkResults
    .filter((result) => result.status === 'risk')
    .map((result) => ({
      code: 'THRESHOLD_BREACH_HYPOTHESIS',
      statement: `${result.checkId} may reflect change-related contention; correlate it with the affected dependency before attribution.`,
      evidenceRefs: [resultRef(run, result.checkId)],
    }));
}

function unknownsForRun(
  run: InspectionRun,
  candidateSet: InspectionCandidateSet | null,
  abReport: InspectionABReport | null,
  origin: InspectionRevisionOrigin | null,
): InspectionAssessmentItem[] {
  const unknowns: InspectionAssessmentItem[] = run.checkResults
    .filter((result) => result.status === 'unknown')
    .map((result) => ({
      code: 'EVIDENCE_UNKNOWN',
      statement: `${result.checkId} cannot be evaluated: ${result.reason ?? 'evidence is incomplete'}.`,
      evidenceRefs: [runRef(run), resultRef(run, result.checkId)],
    }));
  if (run.status === 'failed') {
    unknowns.push({
      code: 'SOURCE_UNAVAILABLE',
      statement: run.errorSummary ?? 'The observability source did not produce usable evidence.',
      evidenceRefs: [runRef(run)],
    });
  }
  if (run.purpose === 'post_change' && abReport?.comparability !== 'valid') {
    unknowns.push({
      code: 'AB_NOT_COMPARABLE',
      statement: `The post-change result cannot be accepted as a complete A/B comparison: ${abReport?.comparability ?? 'baseline_missing'}.`,
      evidenceRefs: abReport?.checks.flatMap((check) => check.evidenceRefs) ?? [runRef(run)],
    });
  }
  return [
    ...unknowns,
    ...(candidateSet?.coverageOmissions.map((omission) => ({
      code: omission.code,
      statement: `${omission.dependencyRef} remains outside machine-evaluated coverage: ${omission.reason}`,
      evidenceRefs: omission.evidenceRefs,
    })) ?? []),
    ...(origin?.waivers.map((waiver) => ({
      code: 'REQUIRED_CANDIDATE_WAIVED',
      statement: `Required candidate ${waiver.candidateId} was waived: ${waiver.reason}`,
      evidenceRefs:
        candidateSet?.candidates.find((candidate) => candidate.id === waiver.candidateId)?.evidenceRefs ?? [],
    })) ?? []),
  ];
}

function recommendationFor(
  run: InspectionRun,
  candidateSet: InspectionCandidateSet | null,
  coverageStatus: InspectionAssessment['coverageStatus'],
  abReport: InspectionABReport | null,
  origin: InspectionRevisionOrigin | null,
): InspectionAssessmentItem {
  if (run.verdict === 'risk') {
    return {
      code: 'HOLD_AND_VERIFY',
      statement: 'Hold stage progression and verify the breached checks against dependency telemetry.',
      evidenceRefs: [runRef(run)],
    };
  }
  if (run.verdict === 'unknown' || run.status === 'failed') {
    return {
      code: 'RESTORE_EVIDENCE',
      statement: 'Restore complete, fresh evidence and execute a new Run before making a change decision.',
      evidenceRefs: [runRef(run)],
    };
  }
  if (run.purpose === 'post_change' && abReport?.comparability !== 'valid') {
    return {
      code: 'RESTORE_AB_COMPARABILITY',
      statement: 'Restore a matching admission baseline and query contract before accepting the post-change result.',
      evidenceRefs: abReport?.checks.flatMap((check) => check.evidenceRefs) ?? [runRef(run)],
    };
  }
  if (coverageStatus === 'omission') {
    const waiverEvidenceRefs =
      origin?.waivers.flatMap(
        (waiver) =>
          candidateSet?.candidates.find((candidate) => candidate.id === waiver.candidateId)?.evidenceRefs ?? [],
      ) ?? [];
    return {
      code: 'REVIEW_COVERAGE_OMISSION',
      statement: 'Confirm the uncovered dependency as an explicit unclosed risk before accepting the in-scope pass.',
      evidenceRefs: [
        ...(candidateSet?.coverageOmissions.flatMap((omission) => omission.evidenceRefs) ?? []),
        ...waiverEvidenceRefs,
      ],
    };
  }
  return {
    code: 'READY_FOR_HUMAN_DECISION',
    statement: 'Evidence is complete and in-scope checks passed; the human operator may record the stage decision.',
    evidenceRefs: [runRef(run)],
  };
}

export function projectInspectionAssessment(
  run: InspectionRun,
  candidateSet: InspectionCandidateSet | null,
  abReport: InspectionABReport | null = null,
  origin: InspectionRevisionOrigin | null = null,
): InspectionAssessment {
  const coverageStatus =
    (candidateSet?.coverageOmissions.length ?? 0) > 0 || (origin?.waivers.length ?? 0) > 0 ? 'omission' : 'complete';
  const comparisonBlocked = run.purpose === 'post_change' && abReport?.comparability !== 'valid';
  const decisionReadiness =
    run.status !== 'completed' || run.verdict !== 'passed' || comparisonBlocked
      ? 'blocked'
      : coverageStatus === 'omission'
        ? 'review_required'
        : 'ready';

  return {
    runId: run.id,
    generatedAt: run.finishedAt ?? run.startedAt,
    machineVerdict: run.verdict,
    coverageStatus,
    decisionReadiness,
    facts: factsForRun(run),
    hypotheses: hypothesesForRun(run),
    unknowns: unknownsForRun(run, candidateSet, abReport, origin),
    recommendations: [recommendationFor(run, candidateSet, coverageStatus, abReport, origin)],
  };
}
