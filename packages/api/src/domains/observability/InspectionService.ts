import type {
  InspectionCase,
  InspectionCheckDefinition,
  InspectionDecisionKind,
  InspectionDecisionRecord,
  InspectionJob,
  InspectionJobRevision,
  InspectionReportSnapshot,
  InspectionRun,
  InspectionRunPurpose,
  InspectionSourceSnapshot,
} from '@cat-cafe/shared';
import { evaluateInspection } from './InspectionEvaluator.js';
import type { ObservabilitySource } from './ports/ObservabilitySource.js';
import { ObservabilitySourceError } from './ports/ObservabilitySource.js';
import { InspectionNotFoundError, type SqliteInspectionStore } from './SqliteInspectionStore.js';

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

export class InspectionDecisionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InspectionDecisionConflictError';
  }
}

export interface RegisteredInspectionSource {
  readonly id: string;
  readonly kind: InspectionSourceSnapshot['sourceKind'];
  readonly label: string;
  readonly scope: string;
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

  createJob(
    userId: string,
    input: CreateInspectionJobCommand,
  ): { job: InspectionJob; revision: InspectionJobRevision } {
    const source = this.requireSource(input.connectorRef);
    if (input.environment !== source.scope) {
      throw new InspectionSourceScopeMismatchError(input.connectorRef, source.scope);
    }
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
    return {
      case: inspectionCase,
      job,
      revision,
      runs: this.store.listRuns(userId, caseId),
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
      const run = this.store.getRun(userId, input.runId);
      const latestRun = this.store.listRuns(userId, caseId).at(-1);
      if (
        !run ||
        run.caseId !== caseId ||
        run.id !== latestRun?.id ||
        run.status !== 'completed' ||
        run.verdict !== 'passed'
      ) {
        throw new InspectionDecisionConflictError(
          'Accept requires the latest completed passed inspection run from this case',
        );
      }
      if (this.store.getReportForCase(userId, caseId)) {
        throw new InspectionDecisionConflictError('Inspection report already exists');
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
    const report =
      input.kind === 'accept' && input.runId
        ? this.store.createReport({
            userId,
            caseId,
            verdict: this.store.getRun(userId, input.runId)?.verdict ?? 'unknown',
          })
        : null;
    return { decision, report };
  }

  private requireSource(connectorRef: string): RegisteredInspectionSource {
    const source = this.sources.get(connectorRef);
    if (!source) throw new InspectionSourceUnavailableError(connectorRef);
    return source;
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
