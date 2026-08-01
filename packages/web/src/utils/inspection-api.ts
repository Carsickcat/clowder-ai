import type {
  InspectionABReport,
  InspectionAssessment,
  InspectionCandidateSet,
  InspectionCase,
  InspectionCheckDefinition,
  InspectionDecisionKind,
  InspectionDecisionRecord,
  InspectionJob,
  InspectionJobRevision,
  InspectionReportSnapshot,
  InspectionRun,
  InspectionRunPurpose,
  InspectionStageReport,
  InspectionWaiver,
} from '@cat-cafe/shared';
import { apiFetch } from './api-client';

export interface InspectionSourceMetadata {
  readonly id: string;
  readonly kind: 'prometheus' | 'replay';
  readonly label: string;
  readonly scope: string;
}

export interface InspectionWorkspace {
  readonly case: InspectionCase;
  readonly job: InspectionJob;
  readonly revision: InspectionJobRevision;
  readonly runs: readonly InspectionRun[];
  readonly stageReports: readonly InspectionStageReport[];
  readonly abReport: InspectionABReport | null;
  readonly assessment: InspectionAssessment | null;
  readonly candidateSet: InspectionCandidateSet | null;
  readonly report: InspectionReportSnapshot | null;
}

export interface GenerateInspectionCandidateSetInput {
  readonly intent: string;
  readonly service: string;
  readonly environment: string;
  readonly connectorRef: string;
  readonly changeId: string;
  readonly version: string;
}

export interface MaterializeInspectionCandidateSetInput {
  readonly name: string;
  readonly selectedCandidateIds: readonly string[];
  readonly waivers: readonly InspectionWaiver[];
}

export interface CreateInspectionJobInput {
  readonly name: string;
  readonly service: string;
  readonly environment: string;
  readonly connectorRef: string;
  readonly checks: readonly InspectionCheckDefinition[];
}

export interface CreateInspectionCaseInput {
  readonly jobId: string;
  readonly changeId: string;
  readonly version: string;
}

export interface ReviseInspectionJobInput {
  readonly expectedRevision: number;
  readonly checks: readonly InspectionCheckDefinition[];
}

interface DecisionResult {
  readonly decision: InspectionDecisionRecord;
  readonly report: InspectionReportSnapshot | null;
}

export class InspectionApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'InspectionApiError';
  }
}

export function isInspectionAvailabilityError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof InspectionApiError && error.status >= 500);
}

async function responseJson<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;

  let message = `Inspection API request failed (${response.status})`;
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === 'string' && payload.error.trim()) message = payload.error;
  } catch {
    // Preserve the bounded fallback; response bodies are not echoed.
  }
  throw new InspectionApiError(message, response.status);
}

function jsonRequest(body: unknown, headers?: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

export async function listInspectionSources(): Promise<readonly InspectionSourceMetadata[]> {
  return responseJson(await apiFetch('/api/observability/sources'));
}

export async function listInspectionJobs(): Promise<readonly InspectionJob[]> {
  return responseJson(await apiFetch('/api/observability/inspection-jobs'));
}

export async function listInspectionCandidateSets(): Promise<readonly InspectionCandidateSet[]> {
  return responseJson(await apiFetch('/api/observability/inspection-candidate-sets'));
}

export async function fetchInspectionCandidateSet(candidateSetId: string): Promise<InspectionCandidateSet> {
  return responseJson(
    await apiFetch(`/api/observability/inspection-candidate-sets/${encodeURIComponent(candidateSetId)}`),
  );
}

export async function generateInspectionCandidateSet(
  input: GenerateInspectionCandidateSetInput,
): Promise<InspectionCandidateSet> {
  return responseJson(await apiFetch('/api/observability/inspection-candidate-sets', jsonRequest(input)));
}

export async function materializeInspectionCandidateSet(
  candidateSetId: string,
  input: MaterializeInspectionCandidateSetInput,
): Promise<{ job: InspectionJob; revision: InspectionJobRevision }> {
  return responseJson(
    await apiFetch(
      `/api/observability/inspection-candidate-sets/${encodeURIComponent(candidateSetId)}/materialize`,
      jsonRequest(input),
    ),
  );
}

export async function fetchInspectionJob(
  jobId: string,
): Promise<{ job: InspectionJob; revision: InspectionJobRevision }> {
  return responseJson(await apiFetch(`/api/observability/inspection-jobs/${encodeURIComponent(jobId)}`));
}

export async function createInspectionJob(
  input: CreateInspectionJobInput,
): Promise<{ job: InspectionJob; revision: InspectionJobRevision }> {
  return responseJson(await apiFetch('/api/observability/inspection-jobs', jsonRequest(input)));
}

export async function reviseInspectionJob(
  jobId: string,
  input: ReviseInspectionJobInput,
): Promise<{ job: InspectionJob; revision: InspectionJobRevision }> {
  return responseJson(
    await apiFetch(`/api/observability/inspection-jobs/${encodeURIComponent(jobId)}/revisions`, jsonRequest(input)),
  );
}

export async function listInspectionCases(jobId?: string): Promise<readonly InspectionCase[]> {
  const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';
  return responseJson(await apiFetch(`/api/observability/inspection-cases${query}`));
}

export async function createInspectionCase(input: CreateInspectionCaseInput): Promise<InspectionCase> {
  return responseJson(await apiFetch('/api/observability/inspection-cases', jsonRequest(input)));
}

export async function fetchInspectionCase(caseId: string): Promise<InspectionWorkspace> {
  return responseJson(await apiFetch(`/api/observability/inspection-cases/${encodeURIComponent(caseId)}`));
}

export async function startInspectionRun(
  caseId: string,
  purpose: InspectionRunPurpose,
  idempotencyKey: string,
): Promise<InspectionRun> {
  return responseJson(
    await apiFetch(
      `/api/observability/inspection-cases/${encodeURIComponent(caseId)}/runs`,
      jsonRequest({ purpose }, { 'Idempotency-Key': idempotencyKey }),
    ),
  );
}

export async function recordInspectionDecision(
  caseId: string,
  input: { runId?: string; kind: InspectionDecisionKind; note: string },
): Promise<DecisionResult> {
  return responseJson(
    await apiFetch(`/api/observability/inspection-cases/${encodeURIComponent(caseId)}/decisions`, jsonRequest(input)),
  );
}
