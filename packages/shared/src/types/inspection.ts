/**
 * NOVA connected inspection control-plane contracts.
 *
 * These are persisted domain snapshots. Browser command schemas intentionally
 * live at the API boundary so callers cannot author evidence or verdicts.
 */

export type InspectionVerdict = 'passed' | 'risk' | 'unknown';
export type InspectionRunStatus = 'running' | 'completed' | 'failed';
export type InspectionCaseStatus = 'ready' | 'running' | 'blocked' | 'completed';
export type InspectionRunPurpose = 'admission' | 'canary' | 'verification' | 'post_change';
export type InspectionDecisionKind = 'approve' | 'pause' | 'resume' | 'accept';
export type InspectionCheckStatus = 'passed' | 'risk' | 'unknown';
export type InspectionCheckOperator = 'lte' | 'gte' | 'relative_lte' | 'relative_gte';
export type InspectionCandidatePriority = 'required' | 'recommended' | 'optional';
export type InspectionCandidateReadiness = 'ready' | 'needs_mapping';
export type InspectionCoverageStatus = 'complete' | 'omission';
export type InspectionDecisionReadiness = 'ready' | 'review_required' | 'blocked';
export type InspectionABComparability = 'valid' | 'partial' | 'unavailable';

export interface InspectionChangeContext {
  readonly intent: string;
  readonly service: string;
  readonly environment: string;
  readonly connectorRef: string;
  readonly changeId: string;
  readonly version: string;
}

export interface InspectionEvidenceRef {
  readonly kind: 'change_context' | 'topology' | 'rule' | 'run' | 'check_result';
  readonly ref: string;
  readonly label: string;
}

export interface InspectionTopologyDependency {
  readonly ref: string;
  readonly kind: 'service' | 'baas' | 'infrastructure';
  readonly direction: 'upstream' | 'downstream';
  readonly criticality: 'critical' | 'important' | 'supporting';
  readonly signalMapped: boolean;
}

export interface InspectionTopologySnapshot {
  readonly catalogVersion: string;
  readonly rootService: string;
  readonly capturedAt: string;
  readonly dependencies: readonly InspectionTopologyDependency[];
}

export interface InspectionCheckDefinition {
  readonly id: string;
  readonly name: string;
  readonly query: string;
  readonly unit: string;
  readonly operator: InspectionCheckOperator;
  readonly threshold: number;
  readonly maxAgeMs: number;
}

export interface InspectionCandidate {
  readonly id: string;
  readonly name: string;
  readonly priority: InspectionCandidatePriority;
  readonly readiness: InspectionCandidateReadiness;
  readonly stages: readonly InspectionRunPurpose[];
  readonly check: InspectionCheckDefinition;
  readonly reason: string;
  readonly evidenceRefs: readonly InspectionEvidenceRef[];
}

export interface InspectionCoverageOmission {
  readonly id: string;
  readonly code: 'COVERAGE_OMISSION';
  readonly dependencyRef: string;
  readonly reason: string;
  readonly risk: string;
  readonly evidenceRefs: readonly InspectionEvidenceRef[];
}

export interface InspectionCandidateSet {
  readonly id: string;
  readonly userId: string;
  readonly changeContext: InspectionChangeContext;
  readonly topologySnapshot: InspectionTopologySnapshot;
  readonly candidates: readonly InspectionCandidate[];
  readonly coverageOmissions: readonly InspectionCoverageOmission[];
  readonly generatedAt: string;
}

export interface InspectionWaiver {
  readonly candidateId: string;
  readonly reason: string;
}

export interface InspectionRevisionOrigin {
  readonly candidateSetId: string;
  readonly selectedCandidateIds: readonly string[];
  readonly waivers: readonly InspectionWaiver[];
}

export interface InspectionObservationWindow {
  readonly from: string;
  readonly to: string;
}

export interface InspectionSourceSnapshot {
  readonly connectorRef: string;
  readonly sourceKind: 'prometheus' | 'replay';
  readonly scope: string;
  readonly snapshotHash: string;
  readonly observedAt: string;
  readonly window: InspectionObservationWindow;
}

export interface InspectionCheckResult {
  readonly id: string;
  readonly runId: string;
  readonly checkId: string;
  readonly status: InspectionCheckStatus;
  readonly value: number | null;
  readonly baselineValue: number | null;
  readonly observedAt: string | null;
  readonly queryDigest: string;
  readonly reason: string | null;
}

export interface InspectionJob {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly service: string;
  readonly environment: string;
  readonly connectorRef: string;
  readonly currentRevision: number;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InspectionJobRevision {
  readonly id: string;
  readonly jobId: string;
  readonly revision: number;
  readonly checks: readonly InspectionCheckDefinition[];
  readonly origin: InspectionRevisionOrigin | null;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface InspectionEvidenceQuality {
  readonly status: 'complete' | 'degraded' | 'unavailable';
  readonly observedChecks: number;
  readonly totalChecks: number;
  readonly missingChecks: number;
}

export interface InspectionStageReport {
  readonly runId: string;
  readonly purpose: InspectionRunPurpose;
  readonly runStatus: InspectionRunStatus;
  readonly machineVerdict: InspectionVerdict;
  readonly generatedAt: string;
  readonly evidenceQuality: InspectionEvidenceQuality;
  readonly resultCounts: Readonly<Record<InspectionCheckStatus, number>>;
  readonly sourceSnapshot: InspectionSourceSnapshot | null;
}

export interface InspectionABCheckComparison {
  readonly checkId: string;
  readonly comparable: boolean;
  readonly baselineValue: number | null;
  readonly currentValue: number | null;
  readonly absoluteDelta: number | null;
  readonly relativeDeltaPercent: number | null;
  readonly reason:
    | 'missing_baseline_result'
    | 'missing_current_result'
    | 'query_digest_mismatch'
    | 'source_mismatch'
    | 'run_order_mismatch'
    | 'unusable_evidence'
    | null;
  readonly evidenceRefs: readonly InspectionEvidenceRef[];
}

export interface InspectionABReport {
  readonly baselineRunId: string | null;
  readonly currentRunId: string | null;
  readonly comparability: InspectionABComparability;
  readonly reason:
    | 'missing_baseline_run'
    | 'missing_current_run'
    | 'missing_both_runs'
    | 'baseline_not_before_current'
    | null;
  readonly checks: readonly InspectionABCheckComparison[];
  readonly generatedAt: string;
}

export interface InspectionAssessmentItem {
  readonly code: string;
  readonly statement: string;
  readonly evidenceRefs: readonly InspectionEvidenceRef[];
}

export interface InspectionAssessment {
  readonly runId: string;
  readonly generatedAt: string;
  readonly machineVerdict: InspectionVerdict;
  readonly coverageStatus: InspectionCoverageStatus;
  readonly decisionReadiness: InspectionDecisionReadiness;
  readonly facts: readonly InspectionAssessmentItem[];
  readonly hypotheses: readonly InspectionAssessmentItem[];
  readonly unknowns: readonly InspectionAssessmentItem[];
  readonly recommendations: readonly InspectionAssessmentItem[];
}

export interface InspectionCase {
  readonly id: string;
  readonly userId: string;
  readonly jobId: string;
  readonly jobRevisionId: string;
  readonly changeId: string;
  readonly version: string;
  readonly status: InspectionCaseStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InspectionRun {
  readonly id: string;
  readonly caseId: string;
  readonly purpose: InspectionRunPurpose;
  readonly status: InspectionRunStatus;
  readonly verdict: InspectionVerdict;
  readonly sourceSnapshot: InspectionSourceSnapshot | null;
  readonly checkResults: readonly InspectionCheckResult[];
  readonly errorSummary: string | null;
  readonly startedAt: string;
  readonly finishedAt: string | null;
}

export interface InspectionDecisionRecord {
  readonly id: string;
  readonly caseId: string;
  readonly runId: string | null;
  readonly kind: InspectionDecisionKind;
  readonly actorId: string;
  readonly note: string;
  readonly createdAt: string;
}

export type InspectionReportDimensionId = 'coverage' | 'integrity' | 'comparability' | 'freshness' | 'risk_closure';

export interface InspectionReportDimension {
  readonly id: InspectionReportDimensionId;
  readonly label: string;
  readonly score: number;
  readonly weight: number;
  readonly explanation: string;
  readonly evidenceRefs: readonly string[];
}

export interface InspectionReportDeduction {
  readonly id: string;
  readonly points: number;
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
}

export interface InspectionReportInterpretationItem {
  readonly statement: string;
  readonly evidenceRefs: readonly string[];
}

export interface InspectionReportAssessmentBasis {
  readonly candidateSetId: string | null;
  readonly coverageOmissionIds: readonly string[];
  readonly comparability: InspectionABComparability;
  readonly runIds: readonly string[];
  readonly decisionIds: readonly string[];
  readonly sourceSnapshotHashes: readonly string[];
}

export interface InspectionReportIntelligence {
  readonly assessmentBasis: InspectionReportAssessmentBasis;
  readonly score: {
    readonly overall: number;
    readonly grade: 'A' | 'B' | 'C';
    readonly modelVersion: 'nova-report-score-v2';
    readonly dimensions: readonly InspectionReportDimension[];
    readonly deductions: readonly InspectionReportDeduction[];
  };
  readonly interpretation: {
    readonly executiveSummary: string;
    readonly keyEvidence: readonly InspectionReportInterpretationItem[];
    readonly residualRisks: readonly InspectionReportInterpretationItem[];
    readonly recommendation: string;
    readonly confidence: number;
    readonly citations: readonly string[];
    readonly clawExplanation: string;
  };
}

export interface InspectionReportSnapshot {
  readonly id: string;
  readonly caseId: string;
  readonly jobRevisionId: string;
  readonly runIds: readonly string[];
  readonly decisionIds: readonly string[];
  readonly verdict: InspectionVerdict;
  /** Null only for reports sealed before the v2 intelligence migration. */
  readonly intelligence: InspectionReportIntelligence | null;
  readonly generatedAt: string;
}
