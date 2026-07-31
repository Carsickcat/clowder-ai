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

export interface InspectionCheckDefinition {
  readonly id: string;
  readonly name: string;
  readonly query: string;
  readonly unit: string;
  readonly operator: InspectionCheckOperator;
  readonly threshold: number;
  readonly maxAgeMs: number;
}

export interface InspectionObservationWindow {
  readonly from: string;
  readonly to: string;
}

export interface InspectionSourceSnapshot {
  readonly connectorRef: string;
  readonly sourceKind: 'prometheus' | 'replay';
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
  readonly createdBy: string;
  readonly createdAt: string;
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

export interface InspectionReportSnapshot {
  readonly id: string;
  readonly caseId: string;
  readonly jobRevisionId: string;
  readonly runIds: readonly string[];
  readonly decisionIds: readonly string[];
  readonly verdict: InspectionVerdict;
  readonly generatedAt: string;
}
