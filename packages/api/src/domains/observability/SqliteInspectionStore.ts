import { randomUUID } from 'node:crypto';
import type {
  InspectionCase,
  InspectionCheckDefinition,
  InspectionCheckResult,
  InspectionDecisionKind,
  InspectionDecisionRecord,
  InspectionJob,
  InspectionJobRevision,
  InspectionReportSnapshot,
  InspectionRun,
  InspectionRunPurpose,
  InspectionSourceSnapshot,
  InspectionVerdict,
} from '@cat-cafe/shared';
import type Database from 'better-sqlite3';

export class InspectionNotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'InspectionNotFoundError';
  }
}

export class InspectionRevisionConflictError extends Error {
  constructor() {
    super('Inspection job revision conflict');
    this.name = 'InspectionRevisionConflictError';
  }
}

export class InspectionIdempotencyConflictError extends Error {
  constructor() {
    super('Inspection run idempotency key was already used for a different purpose');
    this.name = 'InspectionIdempotencyConflictError';
  }
}

export class InspectionActiveRunConflictError extends InspectionIdempotencyConflictError {
  constructor() {
    super();
    this.message = 'Inspection case already has an active inspection run';
    this.name = 'InspectionActiveRunConflictError';
  }
}

export class InspectionAcceptanceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InspectionAcceptanceConflictError';
  }
}

export class InspectionImmutableRecordError extends Error {
  constructor(resource: string) {
    super(`${resource} is immutable`);
    this.name = 'InspectionImmutableRecordError';
  }
}

export interface SqliteInspectionStoreOptions {
  readonly now?: () => string;
  readonly idFactory?: (kind: string) => string;
}

export interface CreateInspectionJobInput {
  readonly userId: string;
  readonly name: string;
  readonly service: string;
  readonly environment: string;
  readonly connectorRef: string;
  readonly checks: readonly InspectionCheckDefinition[];
  readonly createdBy: string;
}

export interface ReviseInspectionJobInput {
  readonly userId: string;
  readonly jobId: string;
  readonly expectedRevision: number;
  readonly checks: readonly InspectionCheckDefinition[];
  readonly createdBy: string;
}

export interface StartInspectionCaseInput {
  readonly userId: string;
  readonly jobId: string;
  readonly changeId: string;
  readonly version: string;
}

export interface StartInspectionRunInput {
  readonly userId: string;
  readonly caseId: string;
  readonly purpose: InspectionRunPurpose;
  readonly idempotencyKey: string;
}

export interface CompleteInspectionRunInput {
  readonly userId: string;
  readonly runId: string;
  readonly verdict: InspectionVerdict;
  readonly sourceSnapshot: InspectionSourceSnapshot;
  readonly checkResults: readonly Omit<InspectionCheckResult, 'id' | 'runId'>[];
}

export interface RecordInspectionDecisionInput {
  readonly userId: string;
  readonly caseId: string;
  readonly runId: string | null;
  readonly kind: InspectionDecisionKind;
  readonly actorId: string;
  readonly note: string;
}

interface JobRow {
  id: string;
  user_id: string;
  name: string;
  service: string;
  environment: string;
  connector_ref: string;
  current_revision: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RevisionRow {
  id: string;
  job_id: string;
  revision: number;
  checks_json: string;
  created_by: string;
  created_at: string;
}

interface CaseRow {
  id: string;
  user_id: string;
  job_id: string;
  job_revision_id: string;
  change_id: string;
  version: string;
  status: InspectionCase['status'];
  created_at: string;
  updated_at: string;
}

interface RunRow {
  id: string;
  case_id: string;
  purpose: InspectionRunPurpose;
  status: InspectionRun['status'];
  verdict: InspectionVerdict;
  source_snapshot_json: string | null;
  error_summary: string | null;
  started_at: string;
  finished_at: string | null;
}

interface CheckResultRow {
  id: string;
  run_id: string;
  check_id: string;
  status: InspectionCheckResult['status'];
  value: number | null;
  baseline_value: number | null;
  observed_at: string | null;
  query_digest: string;
  reason: string | null;
}

interface DecisionRow {
  id: string;
  case_id: string;
  run_id: string | null;
  kind: InspectionDecisionKind;
  actor_id: string;
  note: string;
  created_at: string;
}

interface ReportRow {
  id: string;
  case_id: string;
  job_revision_id: string;
  run_ids_json: string;
  decision_ids_json: string;
  verdict: InspectionVerdict;
  generated_at: string;
}

function toJob(row: JobRow): InspectionJob {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    service: row.service,
    environment: row.environment,
    connectorRef: row.connector_ref,
    currentRevision: row.current_revision,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRevision(row: RevisionRow): InspectionJobRevision {
  return {
    id: row.id,
    jobId: row.job_id,
    revision: row.revision,
    checks: JSON.parse(row.checks_json) as InspectionCheckDefinition[],
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function toCase(row: CaseRow): InspectionCase {
  return {
    id: row.id,
    userId: row.user_id,
    jobId: row.job_id,
    jobRevisionId: row.job_revision_id,
    changeId: row.change_id,
    version: row.version,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCheckResult(row: CheckResultRow): InspectionCheckResult {
  return {
    id: row.id,
    runId: row.run_id,
    checkId: row.check_id,
    status: row.status,
    value: row.value,
    baselineValue: row.baseline_value,
    observedAt: row.observed_at,
    queryDigest: row.query_digest,
    reason: row.reason,
  };
}

function toDecision(row: DecisionRow): InspectionDecisionRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    runId: row.run_id,
    kind: row.kind,
    actorId: row.actor_id,
    note: row.note,
    createdAt: row.created_at,
  };
}

function toReport(row: ReportRow): InspectionReportSnapshot {
  return {
    id: row.id,
    caseId: row.case_id,
    jobRevisionId: row.job_revision_id,
    runIds: JSON.parse(row.run_ids_json) as string[],
    decisionIds: JSON.parse(row.decision_ids_json) as string[],
    verdict: row.verdict,
    generatedAt: row.generated_at,
  };
}

export class SqliteInspectionStore {
  private readonly now: () => string;
  private readonly idFactory: (kind: string) => string;

  constructor(
    private readonly db: Database.Database,
    options: SqliteInspectionStoreOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.idFactory = options.idFactory ?? ((kind) => `${kind}-${randomUUID()}`);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.recoverInterruptedRuns();
  }

  createJob(input: CreateInspectionJobInput): {
    job: InspectionJob;
    revision: InspectionJobRevision;
  } {
    const create = this.db.transaction(() => {
      const now = this.now();
      const jobId = this.idFactory('job');
      const revisionId = this.idFactory('revision');
      this.db
        .prepare(
          `INSERT INTO inspection_jobs
           (id, user_id, name, service, environment, connector_ref, current_revision, archived_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`,
        )
        .run(jobId, input.userId, input.name, input.service, input.environment, input.connectorRef, now, now);
      this.db
        .prepare(
          `INSERT INTO inspection_job_revisions
           (id, job_id, revision, checks_json, created_by, created_at)
           VALUES (?, ?, 1, ?, ?, ?)`,
        )
        .run(revisionId, jobId, JSON.stringify(input.checks), input.createdBy, now);
      return {
        job: this.requireJob(input.userId, jobId),
        revision: this.requireJobRevision(input.userId, revisionId),
      };
    });
    return create();
  }

  getJob(userId: string, jobId: string): InspectionJob | null {
    const row = this.db.prepare('SELECT * FROM inspection_jobs WHERE id = ? AND user_id = ?').get(jobId, userId) as
      | JobRow
      | undefined;
    return row ? toJob(row) : null;
  }

  listJobs(userId: string): InspectionJob[] {
    const rows = this.db
      .prepare('SELECT * FROM inspection_jobs WHERE user_id = ? ORDER BY updated_at DESC, id DESC')
      .all(userId) as JobRow[];
    return rows.map(toJob);
  }

  getJobRevision(userId: string, revisionId: string): InspectionJobRevision | null {
    const row = this.db
      .prepare(
        `SELECT r.*
         FROM inspection_job_revisions r
         JOIN inspection_jobs j ON j.id = r.job_id
         WHERE r.id = ? AND j.user_id = ?`,
      )
      .get(revisionId, userId) as RevisionRow | undefined;
    return row ? toRevision(row) : null;
  }

  getCurrentJobRevision(userId: string, jobId: string): InspectionJobRevision | null {
    const row = this.db
      .prepare(
        `SELECT r.*
         FROM inspection_job_revisions r
         JOIN inspection_jobs j ON j.id = r.job_id
         WHERE j.id = ? AND j.user_id = ? AND r.revision = j.current_revision`,
      )
      .get(jobId, userId) as RevisionRow | undefined;
    return row ? toRevision(row) : null;
  }

  listJobRevisions(userId: string, jobId: string): InspectionJobRevision[] {
    const rows = this.db
      .prepare(
        `SELECT r.*
         FROM inspection_job_revisions r
         JOIN inspection_jobs j ON j.id = r.job_id
         WHERE r.job_id = ? AND j.user_id = ?
         ORDER BY r.revision`,
      )
      .all(jobId, userId) as RevisionRow[];
    return rows.map(toRevision);
  }

  reviseJob(input: ReviseInspectionJobInput): {
    job: InspectionJob;
    revision: InspectionJobRevision;
  } {
    const revise = this.db.transaction(() => {
      const job = this.getJob(input.userId, input.jobId);
      if (!job || job.archivedAt) throw new InspectionNotFoundError('Inspection job');
      if (job.currentRevision !== input.expectedRevision) {
        throw new InspectionRevisionConflictError();
      }

      const now = this.now();
      const nextRevision = input.expectedRevision + 1;
      const revisionId = this.idFactory('revision');
      this.db
        .prepare(
          `INSERT INTO inspection_job_revisions
           (id, job_id, revision, checks_json, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(revisionId, input.jobId, nextRevision, JSON.stringify(input.checks), input.createdBy, now);
      const updated = this.db
        .prepare(
          `UPDATE inspection_jobs
           SET current_revision = ?, updated_at = ?
           WHERE id = ? AND user_id = ? AND current_revision = ? AND archived_at IS NULL`,
        )
        .run(nextRevision, now, input.jobId, input.userId, input.expectedRevision);
      if (updated.changes !== 1) throw new InspectionRevisionConflictError();

      return {
        job: this.requireJob(input.userId, input.jobId),
        revision: this.requireJobRevision(input.userId, revisionId),
      };
    });
    return revise();
  }

  archiveJob(userId: string, jobId: string): InspectionJob {
    const now = this.now();
    const result = this.db
      .prepare(
        `UPDATE inspection_jobs
         SET archived_at = COALESCE(archived_at, ?), updated_at = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(now, now, jobId, userId);
    if (result.changes !== 1) throw new InspectionNotFoundError('Inspection job');
    return this.requireJob(userId, jobId);
  }

  startCase(input: StartInspectionCaseInput): InspectionCase {
    const start = this.db.transaction(() => {
      const row = this.db
        .prepare(
          `SELECT j.*, r.id AS revision_id
           FROM inspection_jobs j
           JOIN inspection_job_revisions r
             ON r.job_id = j.id AND r.revision = j.current_revision
           WHERE j.id = ? AND j.user_id = ? AND j.archived_at IS NULL`,
        )
        .get(input.jobId, input.userId) as (JobRow & { revision_id: string }) | undefined;
      if (!row) throw new InspectionNotFoundError('Inspection job');

      const id = this.idFactory('case');
      const now = this.now();
      this.db
        .prepare(
          `INSERT INTO inspection_cases
           (id, user_id, job_id, job_revision_id, change_id, version, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'ready', ?, ?)`,
        )
        .run(id, input.userId, input.jobId, row.revision_id, input.changeId, input.version, now, now);
      return this.requireCase(input.userId, id);
    });
    return start();
  }

  getCase(userId: string, caseId: string): InspectionCase | null {
    const row = this.db.prepare('SELECT * FROM inspection_cases WHERE id = ? AND user_id = ?').get(caseId, userId) as
      | CaseRow
      | undefined;
    return row ? toCase(row) : null;
  }

  listCases(userId: string, jobId?: string): InspectionCase[] {
    const rows = jobId
      ? (this.db
          .prepare(
            `SELECT * FROM inspection_cases
             WHERE user_id = ? AND job_id = ?
             ORDER BY updated_at DESC, rowid DESC`,
          )
          .all(userId, jobId) as CaseRow[])
      : (this.db
          .prepare(
            `SELECT * FROM inspection_cases
             WHERE user_id = ?
             ORDER BY updated_at DESC, rowid DESC`,
          )
          .all(userId) as CaseRow[]);
    return rows.map(toCase);
  }

  startRun(input: StartInspectionRunInput): InspectionRun {
    const start = this.db.transaction(() => {
      const existing = this.findRunByIdempotencyKey(input.userId, input.caseId, input.idempotencyKey);
      if (existing) return this.requireMatchingIdempotentRun(existing, input.purpose);

      this.assertCaseCanStartRun(input.userId, input.caseId);

      const id = this.idFactory('run');
      const now = this.now();
      const winner = this.insertRunningRun(input, id, now);
      if (winner) return winner;

      this.db
        .prepare("UPDATE inspection_cases SET status = 'running', updated_at = ? WHERE id = ? AND user_id = ?")
        .run(now, input.caseId, input.userId);
      return this.requireRun(input.userId, id);
    });
    return start.immediate();
  }

  private findRunByIdempotencyKey(userId: string, caseId: string, idempotencyKey: string): RunRow | undefined {
    return this.db
      .prepare(
        `SELECT * FROM inspection_runs
         WHERE user_id = ? AND case_id = ? AND idempotency_key = ?`,
      )
      .get(userId, caseId, idempotencyKey) as RunRow | undefined;
  }

  private requireMatchingIdempotentRun(row: RunRow, purpose: InspectionRunPurpose): InspectionRun {
    if (row.purpose !== purpose) throw new InspectionIdempotencyConflictError();
    return this.toRun(row);
  }

  private assertCaseCanStartRun(userId: string, caseId: string): void {
    const inspectionCase = this.getCase(userId, caseId);
    if (!inspectionCase) throw new InspectionNotFoundError('Inspection case');
    if (inspectionCase.status === 'completed') {
      throw new InspectionImmutableRecordError('Completed inspection case');
    }
    const active = this.db
      .prepare(
        `SELECT id FROM inspection_runs
         WHERE user_id = ? AND case_id = ? AND status = 'running'
         LIMIT 1`,
      )
      .get(userId, caseId) as { id: string } | undefined;
    if (active) throw new InspectionActiveRunConflictError();
  }

  private insertRunningRun(input: StartInspectionRunInput, id: string, startedAt: string): InspectionRun | null {
    const inserted = this.db
      .prepare(
        `INSERT INTO inspection_runs
         (id, user_id, case_id, purpose, status, verdict, source_snapshot_json, error_summary,
          idempotency_key, started_at, finished_at)
         VALUES (?, ?, ?, ?, 'running', 'unknown', NULL, NULL, ?, ?, NULL)
         ON CONFLICT(user_id, case_id, idempotency_key) DO NOTHING`,
      )
      .run(id, input.userId, input.caseId, input.purpose, input.idempotencyKey, startedAt);
    if (inserted.changes === 1) return null;

    const winner = this.findRunByIdempotencyKey(input.userId, input.caseId, input.idempotencyKey);
    if (!winner) throw new InspectionIdempotencyConflictError();
    return this.requireMatchingIdempotentRun(winner, input.purpose);
  }

  getRun(userId: string, runId: string): InspectionRun | null {
    const row = this.db.prepare('SELECT * FROM inspection_runs WHERE id = ? AND user_id = ?').get(runId, userId) as
      | RunRow
      | undefined;
    return row ? this.toRun(row) : null;
  }

  listRuns(userId: string, caseId: string): InspectionRun[] {
    if (!this.getCase(userId, caseId)) return [];
    const rows = this.db
      .prepare('SELECT * FROM inspection_runs WHERE user_id = ? AND case_id = ? ORDER BY rowid')
      .all(userId, caseId) as RunRow[];
    return rows.map((row) => this.toRun(row));
  }

  completeRun(input: CompleteInspectionRunInput): {
    run: InspectionRun;
    results: InspectionCheckResult[];
  } {
    const complete = this.db.transaction(() => {
      const current = this.getRun(input.userId, input.runId);
      if (!current) throw new InspectionNotFoundError('Inspection run');
      if (current.status !== 'running') throw new InspectionImmutableRecordError('Terminal inspection run');

      for (const result of input.checkResults) {
        this.db
          .prepare(
            `INSERT INTO inspection_check_results
             (id, run_id, check_id, status, value, baseline_value, observed_at, query_digest, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            this.idFactory('result'),
            input.runId,
            result.checkId,
            result.status,
            result.value,
            result.baselineValue,
            result.observedAt,
            result.queryDigest,
            result.reason,
          );
      }

      const finishedAt = this.now();
      this.db
        .prepare(
          `UPDATE inspection_runs
           SET status = 'completed', verdict = ?, source_snapshot_json = ?, finished_at = ?
           WHERE id = ? AND user_id = ? AND status = 'running'`,
        )
        .run(input.verdict, JSON.stringify(input.sourceSnapshot), finishedAt, input.runId, input.userId);

      const nextCaseStatus =
        input.verdict === 'unknown' ? 'blocked' : current.purpose === 'post_change' ? 'completed' : 'running';
      this.db
        .prepare('UPDATE inspection_cases SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .run(nextCaseStatus, finishedAt, current.caseId, input.userId);

      const run = this.requireRun(input.userId, input.runId);
      return { run, results: [...run.checkResults] };
    });
    return complete();
  }

  failRun(userId: string, runId: string, errorSummary: string): InspectionRun {
    const fail = this.db.transaction(() => {
      const current = this.getRun(userId, runId);
      if (!current) throw new InspectionNotFoundError('Inspection run');
      if (current.status !== 'running') throw new InspectionImmutableRecordError('Terminal inspection run');
      const finishedAt = this.now();
      this.db
        .prepare(
          `UPDATE inspection_runs
           SET status = 'failed', verdict = 'unknown', error_summary = ?, finished_at = ?
           WHERE id = ? AND user_id = ? AND status = 'running'`,
        )
        .run(errorSummary, finishedAt, runId, userId);
      this.db
        .prepare("UPDATE inspection_cases SET status = 'blocked', updated_at = ? WHERE id = ? AND user_id = ?")
        .run(finishedAt, current.caseId, userId);
      return this.requireRun(userId, runId);
    });
    return fail();
  }

  recordDecision(input: RecordInspectionDecisionInput): InspectionDecisionRecord {
    if (input.kind === 'accept') {
      throw new InspectionAcceptanceConflictError('Accept must atomically seal an inspection report');
    }
    if (!this.getCase(input.userId, input.caseId)) {
      throw new InspectionNotFoundError('Inspection case');
    }
    if (input.runId) {
      const run = this.getRun(input.userId, input.runId);
      if (!run || run.caseId !== input.caseId) {
        throw new InspectionNotFoundError('Inspection run');
      }
    }
    const id = this.idFactory('decision');
    const createdAt = this.now();
    this.db
      .prepare(
        `INSERT INTO inspection_decisions
         (id, user_id, case_id, run_id, kind, actor_id, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.userId, input.caseId, input.runId, input.kind, input.actorId, input.note, createdAt);
    return this.requireDecision(input.userId, id);
  }

  acceptLatestPassedRun(input: {
    readonly userId: string;
    readonly caseId: string;
    readonly runId: string;
    readonly actorId: string;
    readonly note: string;
  }): { decision: InspectionDecisionRecord; report: InspectionReportSnapshot } {
    const accept = this.db.transaction(() => {
      const inspectionCase = this.getCase(input.userId, input.caseId);
      if (!inspectionCase) throw new InspectionNotFoundError('Inspection case');
      if (this.getReportForCase(input.userId, input.caseId)) {
        throw new InspectionAcceptanceConflictError('Inspection report already exists');
      }

      const latestRun = this.db
        .prepare(
          `SELECT * FROM inspection_runs
           WHERE user_id = ? AND case_id = ?
           ORDER BY rowid DESC LIMIT 1`,
        )
        .get(input.userId, input.caseId) as RunRow | undefined;
      if (
        !latestRun ||
        latestRun.id !== input.runId ||
        latestRun.status !== 'completed' ||
        latestRun.verdict !== 'passed'
      ) {
        throw new InspectionAcceptanceConflictError(
          'Accept requires the latest completed passed inspection run from this case',
        );
      }

      const activeRun = this.db
        .prepare(
          `SELECT 1 FROM inspection_runs
           WHERE user_id = ? AND case_id = ? AND status = 'running'
           LIMIT 1`,
        )
        .get(input.userId, input.caseId);
      if (activeRun) {
        throw new InspectionAcceptanceConflictError('Accept cannot seal a case with an active inspection run');
      }

      const decisionId = this.idFactory('decision');
      const generatedAt = this.now();
      this.db
        .prepare(
          `INSERT INTO inspection_decisions
           (id, user_id, case_id, run_id, kind, actor_id, note, created_at)
           VALUES (?, ?, ?, ?, 'accept', ?, ?, ?)`,
        )
        .run(decisionId, input.userId, input.caseId, input.runId, input.actorId, input.note, generatedAt);

      const runIds = (
        this.db
          .prepare(
            `SELECT id FROM inspection_runs
             WHERE user_id = ? AND case_id = ? AND status IN ('completed', 'failed')
             ORDER BY rowid`,
          )
          .all(input.userId, input.caseId) as { id: string }[]
      ).map((row) => row.id);
      const decisionIds = (
        this.db
          .prepare(
            `SELECT id FROM inspection_decisions
             WHERE user_id = ? AND case_id = ?
             ORDER BY rowid`,
          )
          .all(input.userId, input.caseId) as { id: string }[]
      ).map((row) => row.id);

      const id = this.idFactory('report');
      this.db
        .prepare(
          `INSERT INTO inspection_reports
           (id, user_id, case_id, job_revision_id, run_ids_json, decision_ids_json, verdict, generated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.userId,
          input.caseId,
          inspectionCase.jobRevisionId,
          JSON.stringify(runIds),
          JSON.stringify(decisionIds),
          latestRun.verdict,
          generatedAt,
        );
      this.db
        .prepare(
          `UPDATE inspection_cases
           SET status = 'completed', updated_at = ?
           WHERE id = ? AND user_id = ?`,
        )
        .run(generatedAt, input.caseId, input.userId);
      return {
        decision: this.requireDecision(input.userId, decisionId),
        report: this.requireReport(input.userId, id),
      };
    });
    return accept.immediate();
  }

  getReport(userId: string, reportId: string): InspectionReportSnapshot | null {
    const row = this.db
      .prepare('SELECT * FROM inspection_reports WHERE id = ? AND user_id = ?')
      .get(reportId, userId) as ReportRow | undefined;
    return row ? toReport(row) : null;
  }

  getReportForCase(userId: string, caseId: string): InspectionReportSnapshot | null {
    const row = this.db
      .prepare('SELECT * FROM inspection_reports WHERE case_id = ? AND user_id = ?')
      .get(caseId, userId) as ReportRow | undefined;
    return row ? toReport(row) : null;
  }

  private getCheckResults(runId: string): InspectionCheckResult[] {
    const rows = this.db
      .prepare('SELECT * FROM inspection_check_results WHERE run_id = ? ORDER BY rowid')
      .all(runId) as CheckResultRow[];
    return rows.map(toCheckResult);
  }

  private recoverInterruptedRuns(): void {
    const recover = this.db.transaction(() => {
      const interrupted = this.db
        .prepare("SELECT id, user_id, case_id FROM inspection_runs WHERE status = 'running'")
        .all() as { id: string; user_id: string; case_id: string }[];
      if (interrupted.length === 0) return;

      const recoveredAt = this.now();
      const errorSummary = 'Inspection run interrupted by service restart';
      this.db
        .prepare(
          `UPDATE inspection_runs
           SET status = 'failed', verdict = 'unknown', error_summary = ?, finished_at = ?
           WHERE status = 'running'`,
        )
        .run(errorSummary, recoveredAt);
      const blockCase = this.db.prepare(
        `UPDATE inspection_cases
         SET status = 'blocked', updated_at = ?
         WHERE id = ? AND user_id = ? AND status <> 'completed'`,
      );
      for (const row of interrupted) {
        blockCase.run(recoveredAt, row.case_id, row.user_id);
      }
    });
    recover.immediate();
  }

  private toRun(row: RunRow): InspectionRun {
    return {
      id: row.id,
      caseId: row.case_id,
      purpose: row.purpose,
      status: row.status,
      verdict: row.verdict,
      sourceSnapshot: row.source_snapshot_json
        ? (JSON.parse(row.source_snapshot_json) as InspectionSourceSnapshot)
        : null,
      checkResults: this.getCheckResults(row.id),
      errorSummary: row.error_summary,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    };
  }

  private requireJob(userId: string, jobId: string): InspectionJob {
    const job = this.getJob(userId, jobId);
    if (!job) throw new InspectionNotFoundError('Inspection job');
    return job;
  }

  private requireJobRevision(userId: string, revisionId: string): InspectionJobRevision {
    const revision = this.getJobRevision(userId, revisionId);
    if (!revision) throw new InspectionNotFoundError('Inspection job revision');
    return revision;
  }

  private requireCase(userId: string, caseId: string): InspectionCase {
    const inspectionCase = this.getCase(userId, caseId);
    if (!inspectionCase) throw new InspectionNotFoundError('Inspection case');
    return inspectionCase;
  }

  private requireRun(userId: string, runId: string): InspectionRun {
    const run = this.getRun(userId, runId);
    if (!run) throw new InspectionNotFoundError('Inspection run');
    return run;
  }

  private requireDecision(userId: string, decisionId: string): InspectionDecisionRecord {
    const row = this.db
      .prepare('SELECT * FROM inspection_decisions WHERE id = ? AND user_id = ?')
      .get(decisionId, userId) as DecisionRow | undefined;
    if (!row) throw new InspectionNotFoundError('Inspection decision');
    return toDecision(row);
  }

  private requireReport(userId: string, reportId: string): InspectionReportSnapshot {
    const report = this.getReport(userId, reportId);
    if (!report) throw new InspectionNotFoundError('Inspection report');
    return report;
  }
}
