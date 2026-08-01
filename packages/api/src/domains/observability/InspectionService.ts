import type {
  InspectionABReport,
  InspectionAssessment,
  InspectionCandidateSet,
  InspectionCase,
  InspectionChangeContext,
  InspectionCheckDefinition,
  InspectionDecisionKind,
  InspectionDecisionRecord,
  InspectionJob,
  InspectionJobRevision,
  InspectionReportSnapshot,
  InspectionRun,
  InspectionRunPurpose,
  InspectionSourceSnapshot,
  InspectionStageReport,
  InspectionWaiver,
} from '@cat-cafe/shared';
import {
  projectInspectionABReport,
  projectInspectionAssessment,
  projectInspectionStageReport,
} from './InspectionAssessment.js';
import { generateInspectionCandidateDraft } from './InspectionCandidateGenerator.js';
import { evaluateInspection } from './InspectionEvaluator.js';
import type { ObservabilitySource } from './ports/ObservabilitySource.js';
import { ObservabilitySourceError } from './ports/ObservabilitySource.js';
import {
  InspectionAcceptanceConflictError,
  InspectionNotFoundError,
  type SqliteInspectionStore,
} from './SqliteInspectionStore.js';

const COLLECTION_WINDOW = '5m';
const COLLECTION_WINDOW_MS = 5 * 60 * 1_000;

export class InspectionSourceUnavailableError extends Error {
  constructor(connectorRef: string) {
    super(`Inspection source "${connectorRef}" is not registered`);
    this.name = 'InspectionSourceUnavailableError';
  }
}

export class InspectionSourceScopeMismatchError extends Error {
  constructor(connectorRef: string, scope: string) {
    super(`Inspection source "${connectorRef}" only supports the "${scope}" environment scope`);
    this.name = 'InspectionSourceScopeMismatchError';
  }
}

export class InspectionSourceCapabilityMismatchError extends InspectionSourceScopeMismatchError {
  constructor(connectorRef: string) {
    super(connectorRef, 'baseline-capable');
    this.message = `Inspection source "${connectorRef}" does not support relative checks`;
    this.name = 'InspectionSourceCapabilityMismatchError';
  }
}

export class InspectionDecisionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InspectionDecisionConflictError';
  }
}

export class InspectionSelectionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InspectionSelectionConflictError';
  }
}

export interface RegisteredInspectionSource {
  readonly id: string;
  readonly kind: InspectionSourceSnapshot['sourceKind'];
  readonly label: string;
  readonly scope: string;
  readonly supportsRelativeChecks?: boolean;
  readonly source: ObservabilitySource;
}

export interface InspectionServiceOptions {
  readonly store: SqliteInspectionStore;
  readonly sources: readonly RegisteredInspectionSource[];
  readonly now?: () => Date;
}

export interface CreateInspectionJobCommand {
  readonly name: string;
  readonly service: string;
  readonly environment: string;
  readonly connectorRef: string;
  readonly checks: readonly InspectionCheckDefinition[];
}

export interface ReviseInspectionJobCommand {
  readonly expectedRevision: number;
  readonly checks: readonly InspectionCheckDefinition[];
}

export interface CreateInspectionCaseCommand {
  readonly jobId: string;
  readonly changeId: string;
  readonly version: string;
}

export interface MaterializeInspectionCandidateSetCommand {
  readonly name: string;
  readonly selectedCandidateIds: readonly string[];
  readonly waivers: readonly InspectionWaiver[];
}

export interface StartInspectionRunCommand {
  readonly purpose: InspectionRunPurpose;
}

export interface RecordInspectionDecisionCommand {
  readonly runId?: string;
  readonly kind: InspectionDecisionKind;
  readonly note: string;
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

export interface RecordedInspectionDecision {
  readonly decision: InspectionDecisionRecord;
  readonly report: InspectionReportSnapshot | null;
}

export class InspectionService {
  private readonly store: SqliteInspectionStore;
  private readonly sources = new Map<string, RegisteredInspectionSource>();
  private readonly now: () => Date;
  private readonly inFlightRuns = new Map<string, Promise<InspectionRun>>();

  constructor(options: InspectionServiceOptions) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    for (const registration of options.sources) {
      if (registration.id !== registration.source.sourceId) {
        throw new TypeError('Inspection source registration id must match sourceId');
      }
      if (this.sources.has(registration.id)) {
        throw new TypeError(`Duplicate inspection source registration: ${registration.id}`);
      }
      this.sources.set(registration.id, registration);
    }
  }

  listSources(): readonly { id: string; kind: InspectionSourceSnapshot['sourceKind']; label: string; scope: string }[] {
    return [...this.sources.values()].map(({ id, kind, label, scope }) => ({ id, kind, label, scope }));
  }

  listJobs(userId: string): InspectionJob[] {
    return this.store.listJobs(userId);
  }

  listCandidateSets(userId: string): InspectionCandidateSet[] {
    return this.store.listCandidateSets(userId);
  }

  getCandidateSet(userId: string, candidateSetId: string): InspectionCandidateSet | null {
    return this.store.getCandidateSet(userId, candidateSetId);
  }

  generateCandidateSet(userId: string, input: InspectionChangeContext): InspectionCandidateSet {
    const source = this.requireSource(input.connectorRef);
    if (input.environment !== source.scope) {
      throw new InspectionSourceScopeMismatchError(input.connectorRef, source.scope);
    }
    const draft = generateInspectionCandidateDraft(input, { now: this.now });
    return this.store.createCandidateSet({ userId, ...draft });
  }

  materializeCandidateSet(
    userId: string,
    candidateSetId: string,
    input: MaterializeInspectionCandidateSetCommand,
  ): { job: InspectionJob; revision: InspectionJobRevision } {
    const candidateSet = this.store.getCandidateSet(userId, candidateSetId);
    if (!candidateSet) throw new InspectionNotFoundError('Inspection candidate set');
    const source = this.requireSource(candidateSet.changeContext.connectorRef);
    if (candidateSet.changeContext.environment !== source.scope) {
      throw new InspectionSourceScopeMismatchError(source.id, source.scope);
    }

    const selectedIds = [...new Set(input.selectedCandidateIds)];
    if (selectedIds.length === 0 || selectedIds.length !== input.selectedCandidateIds.length) {
      throw new InspectionSelectionConflictError('Candidate selection must be non-empty and unique');
    }
    const candidatesById = new Map(candidateSet.candidates.map((candidate) => [candidate.id, candidate]));
    const selected = selectedIds.map((candidateId) => {
      const candidate = candidatesById.get(candidateId);
      if (!candidate || candidate.readiness !== 'ready') {
        throw new InspectionSelectionConflictError(`Candidate "${candidateId}" is not executable`);
      }
      return candidate;
    });
    const waiverByCandidate = new Map(input.waivers.map((waiver) => [waiver.candidateId, waiver.reason.trim()]));
    for (const candidate of candidateSet.candidates) {
      if (candidate.priority !== 'required' || selectedIds.includes(candidate.id)) continue;
      const reason = waiverByCandidate.get(candidate.id);
      if (!reason) {
        throw new InspectionSelectionConflictError(`Required candidate "${candidate.id}" needs a waiver reason`);
      }
    }
    const relevantWaivers = candidateSet.candidates
      .filter((candidate) => candidate.priority === 'required' && !selectedIds.includes(candidate.id))
      .map((candidate) => ({ candidateId: candidate.id, reason: waiverByCandidate.get(candidate.id) as string }));
    const checks = selected.map((candidate) => candidate.check);
    this.assertChecksSupported(source, checks);
    return this.store.createJob({
      userId,
      name: input.name,
      service: candidateSet.changeContext.service,
      environment: candidateSet.changeContext.environment,
      connectorRef: candidateSet.changeContext.connectorRef,
      checks,
      createdBy: userId,
      origin: {
        candidateSetId,
        selectedCandidateIds: selectedIds,
        waivers: relevantWaivers,
      },
    });
  }

  getJobDetail(userId: string, jobId: string): { job: InspectionJob; revision: InspectionJobRevision } | null {
    const job = this.store.getJob(userId, jobId);
    if (!job) return null;
    const revision = this.store.getCurrentJobRevision(userId, jobId);
    return revision ? { job, revision } : null;
  }

  createJob(
    userId: string,
    input: CreateInspectionJobCommand,
  ): { job: InspectionJob; revision: InspectionJobRevision } {
    const source = this.requireSource(input.connectorRef);
    if (input.environment !== source.scope) {
      throw new InspectionSourceScopeMismatchError(input.connectorRef, source.scope);
    }
    this.assertChecksSupported(source, input.checks);
    return this.store.createJob({
      ...input,
      userId,
      createdBy: userId,
    });
  }

  reviseJob(
    userId: string,
    jobId: string,
    input: ReviseInspectionJobCommand,
  ): { job: InspectionJob; revision: InspectionJobRevision } {
    const job = this.store.getJob(userId, jobId);
    if (!job) throw new InspectionNotFoundError('Inspection job');
    const source = this.requireSource(job.connectorRef);
    if (job.environment !== source.scope) {
      throw new InspectionSourceScopeMismatchError(job.connectorRef, source.scope);
    }
    this.assertChecksSupported(source, input.checks);
    return this.store.reviseJob({
      ...input,
      userId,
      jobId,
      createdBy: userId,
    });
  }

  createCase(userId: string, input: CreateInspectionCaseCommand): InspectionCase {
    return this.store.startCase({ ...input, userId });
  }

  getCase(userId: string, caseId: string): InspectionWorkspace | null {
    const inspectionCase = this.store.getCase(userId, caseId);
    if (!inspectionCase) return null;
    const job = this.store.getJob(userId, inspectionCase.jobId);
    const revision = this.store.getJobRevision(userId, inspectionCase.jobRevisionId);
    if (!job || !revision) {
      throw new InspectionNotFoundError('Inspection workspace');
    }
    const runs = this.store.listRuns(userId, caseId);
    const candidateSet = revision.origin?.candidateSetId
      ? this.store.getCandidateSet(userId, revision.origin.candidateSetId)
      : null;
    const latestRun = runs.at(-1) ?? null;
    const abReport = projectInspectionABReport(runs);
    return {
      case: inspectionCase,
      job,
      revision,
      runs,
      stageReports: runs.map((run) => projectInspectionStageReport(run, revision)),
      abReport,
      assessment: latestRun ? projectInspectionAssessment(latestRun, candidateSet, abReport, revision.origin) : null,
      candidateSet,
      report: this.store.getReportForCase(userId, caseId),
    };
  }

  listCases(userId: string, jobId?: string): InspectionCase[] {
    return this.store.listCases(userId, jobId);
  }

  async startRun(
    userId: string,
    caseId: string,
    idempotencyKey: string,
    input: StartInspectionRunCommand,
  ): Promise<InspectionRun | null> {
    const workspace = this.getCase(userId, caseId);
    if (!workspace) return null;
    const registration = this.requireSource(workspace.job.connectorRef);
    if (workspace.job.environment !== registration.scope) {
      throw new InspectionSourceScopeMismatchError(workspace.job.connectorRef, registration.scope);
    }
    const run = this.store.startRun({
      userId,
      caseId,
      purpose: input.purpose,
      idempotencyKey,
    });
    if (run.status !== 'running') return run;

    const existingExecution = this.inFlightRuns.get(run.id);
    if (existingExecution) return existingExecution;

    const execution = this.executeRun(userId, run, workspace.revision, registration);
    this.inFlightRuns.set(run.id, execution);
    try {
      return await execution;
    } finally {
      this.inFlightRuns.delete(run.id);
    }
  }

  recordDecision(
    userId: string,
    caseId: string,
    input: RecordInspectionDecisionCommand,
  ): RecordedInspectionDecision | null {
    if (!this.store.getCase(userId, caseId)) return null;
    if (input.kind === 'accept') {
      if (!input.runId) {
        throw new InspectionDecisionConflictError('Accept requires a terminal inspection run');
      }
      try {
        const accepted = this.store.acceptLatestPassedRun({
          userId,
          caseId,
          runId: input.runId,
          actorId: userId,
          note: input.note,
        });
        return accepted;
      } catch (error) {
        if (error instanceof InspectionAcceptanceConflictError) {
          throw new InspectionDecisionConflictError(error.message);
        }
        throw error;
      }
    }

    const decision = this.store.recordDecision({
      userId,
      caseId,
      runId: input.runId ?? null,
      kind: input.kind,
      actorId: userId,
      note: input.note,
    });
    return { decision, report: null };
  }

  private requireSource(connectorRef: string): RegisteredInspectionSource {
    const source = this.sources.get(connectorRef);
    if (!source) throw new InspectionSourceUnavailableError(connectorRef);
    return source;
  }

  private assertChecksSupported(
    source: RegisteredInspectionSource,
    checks: readonly InspectionCheckDefinition[],
  ): void {
    const hasRelativeCheck = checks.some(
      (check) => check.operator === 'relative_lte' || check.operator === 'relative_gte',
    );
    if (hasRelativeCheck && source.supportsRelativeChecks !== true) {
      throw new InspectionSourceCapabilityMismatchError(source.id);
    }
  }

  private async executeRun(
    userId: string,
    run: InspectionRun,
    revision: InspectionJobRevision,
    registration: RegisteredInspectionSource,
  ): Promise<InspectionRun> {
    try {
      const snapshot = await registration.source.collect({
        checks: revision.checks.map(({ id, query }) => ({ id, query })),
        window: COLLECTION_WINDOW,
      });
      if (
        snapshot.sourceId !== registration.id ||
        snapshot.window !== COLLECTION_WINDOW ||
        !Number.isFinite(Date.parse(snapshot.collectedAt))
      ) {
        throw new ObservabilitySourceError('malformed_response', 'Observability source returned invalid metadata');
      }
      const evaluation = evaluateInspection(revision.checks, snapshot, { now: this.now() });
      const observedAtMs = Date.parse(snapshot.collectedAt);
      const sourceSnapshot: InspectionSourceSnapshot = {
        connectorRef: registration.id,
        sourceKind: registration.kind,
        observedAt: snapshot.collectedAt,
        window: {
          from: new Date(observedAtMs - COLLECTION_WINDOW_MS).toISOString(),
          to: snapshot.collectedAt,
        },
      };
      return this.store.completeRun({
        userId,
        runId: run.id,
        verdict: evaluation.verdict,
        sourceSnapshot,
        checkResults: evaluation.checkResults.map((result) => ({
          baselineValue: result.baselineValue,
          checkId: result.checkId,
          observedAt: result.observedAt,
          queryDigest: result.queryDigest,
          reason: result.reason,
          status: result.status,
          value: result.value,
        })),
      }).run;
    } catch (error) {
      const code = error instanceof ObservabilitySourceError ? ` (${error.code})` : '';
      return this.store.failRun(userId, run.id, `Observability source failed${code}`);
    }
  }
}
