/**
 * InvocationRecord Store
 * 调用状态机：将"消息写入"与"猫调用执行"解耦。
 *
 * ADR-008 D1: InvocationRecord 轻量状态机
 * ADR-008 D2: IdempotencyKey 消息去重
 *
 * 有界 Map 实现，只淘汰已有 durable message owner 的记录。
 * 尚未落盘的 claim 必须保留，因此 MAX_RECORDS 是安全优先的软上限。
 */

import { randomUUID } from 'node:crypto';
import type { CatId } from '@cat-cafe/shared';
import { isValidTransition } from './invocation-state-machine.js';

/** InvocationRecord lifecycle statuses */
export type InvocationStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

/**
 * A single invocation record tracking the lifecycle of a cat invocation.
 */
export interface InvocationRecord {
  id: string;
  /** Stable QueueEntry API owner when this invocation is queued. */
  queueEntryId?: string;
  threadId: string;
  userId: string;
  /** Associated user message ID (null = message not yet written, needs compensation) */
  userMessageId: string | null;
  targetCats: CatId[];
  intent: 'execute' | 'ideate';
  status: InvocationStatus;
  /** Idempotency key (client-provided or server-generated, always present) */
  idempotencyKey: string;
  /** Error message when status is 'failed' */
  error?: string;
  /** F8: Per-cat token usage collected on invocation completion */
  usageByCat?: Record<string, import('../../types.js').TokenUsage>;
  /** F128: Epoch ms when usageByCat was first recorded. Stable for daily bucketing
   *  (unlike updatedAt which any subsequent update can shift). */
  usageRecordedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** Input for creating an InvocationRecord (id + timestamps auto-generated) */
export interface CreateInvocationInput {
  threadId: string;
  userId: string;
  targetCats: CatId[];
  intent: 'execute' | 'ideate';
  idempotencyKey: string;
  /** Preassigned QueueEntry API owner for requests known to queue at claim time. */
  queueEntryId?: string;
}

/** Result of atomic create-or-deduplicate */
export interface CreateResult {
  outcome: 'created' | 'duplicate';
  invocationId: string;
}

/** Fields that can be updated on an InvocationRecord */
export interface UpdateInvocationInput {
  status?: InvocationStatus;
  userMessageId?: string | null;
  error?: string;
  /** Link an immediate claim to its QueueEntry when the tracker gate degrades to queue. */
  queueEntryId?: string;
  /** CAS guard: update only if current status matches. Returns null on mismatch. */
  expectedStatus?: InvocationStatus;
  /** CAS guard: update only if usageByCat is missing or an empty object. Returns null on mismatch. */
  expectedUsageByCatAbsent?: boolean;
  /** F8: Per-cat token usage (key = catId) */
  usageByCat?: Record<string, import('../../types.js').TokenUsage>;
  /** Issue #845 backfill: override the usageRecordedAt timestamp (epoch ms).
   *  Live writers should NEVER set this — let the store stamp Date.now() so day bucketing
   *  stays honest. Only the backfill script sets it, anchoring to existing
   *  usageRecordedAt, a duration-derived message completion time, or legacy
   *  updatedAt fallback. Never `invocation.createdAt` (would mis-bucket
   *  cross-midnight runs onto the start day instead of the finish day). */
  usageRecordedAt?: number;
}

/**
 * Common interface for invocation record stores (in-memory and Redis).
 * Methods that may hit Redis are async; in-memory returns immediately.
 */
export interface IInvocationRecordStore {
  /** Atomic create-or-deduplicate: returns existing record if idempotency key matches */
  create(input: CreateInvocationInput): CreateResult | Promise<CreateResult>;
  /** Get a record by its ID */
  get(id: string): InvocationRecord | null | Promise<InvocationRecord | null>;
  /** Update fields on a record */
  update(id: string, input: UpdateInvocationInput): InvocationRecord | null | Promise<InvocationRecord | null>;
  /** Look up an invocation by its idempotency key */
  getByIdempotencyKey(
    threadId: string,
    userId: string,
    key: string,
  ): InvocationRecord | null | Promise<InvocationRecord | null>;

  /** F128: Scan all invocation records (optional — only Redis impl provides this) */
  scanAll?(): Promise<InvocationRecord[]>;

  /**
   * F194 Phase B: Enumerate currently running invocation records scoped to (threadId, userId).
   *
   * Required by `getThreadLiveInvocations` so canonical liveness read can detect zombie records
   * even after their drafts have been TTL-reaped — the helper enumerates from records ∪ drafts.
   * In-memory: filter the records map. Redis: SMEMBERS index Set + pipeline HGETALL on hit ids
   * + defensive filter (Set is maintained inside ATOMIC_UPDATE_LUA on status transitions —
   * crash-safe, no post-Lua best-effort window).
   */
  listRunningByThread(threadId: string, userId: string): InvocationRecord[] | Promise<InvocationRecord[]>;
}

/** Max records in memory store */
const MAX_RECORDS = 500;

/**
 * In-memory bounded InvocationRecord store.
 * Node.js single-threaded → synchronous Map operations are atomically equivalent.
 */
export class InvocationRecordStore implements IInvocationRecordStore {
  private records = new Map<string, InvocationRecord>();
  /** Persistent process-local claim index: compositeKey -> invocationId. */
  private idempotencyIndex = new Map<string, string>();
  private readonly maxRecords: number;

  constructor(options?: { maxRecords?: number }) {
    this.maxRecords = options?.maxRecords ?? MAX_RECORDS;
  }

  private compositeKey(threadId: string, userId: string, key: string): string {
    return `${threadId}:${userId}:${key}`;
  }

  /**
   * Trim only records that can be recovered through the durable message index.
   * If every over-capacity record still lacks a message owner, retain them all:
   * dropping one would reopen the same client UUID for a second dispatch.
   */
  private trimSafelyRecoverableRecords(): void {
    while (this.records.size > this.maxRecords) {
      let evicted = false;
      for (const [id, record] of this.records) {
        if (record.userMessageId === null) continue;

        this.records.delete(id);
        const composite = this.compositeKey(record.threadId, record.userId, record.idempotencyKey);
        if (this.idempotencyIndex.get(composite) === id) {
          this.idempotencyIndex.delete(composite);
        }
        evicted = true;
        break;
      }
      if (!evicted) return;
    }
  }

  private hasRecordedUsage(record: InvocationRecord): boolean {
    return record.usageByCat !== undefined && Object.keys(record.usageByCat).length > 0;
  }

  private applyUsageUpdate(record: InvocationRecord, input: UpdateInvocationInput): void {
    if (input.usageByCat === undefined) return;

    record.usageByCat = input.usageByCat;
    // F128: stamp usageRecordedAt only on first write (stable for daily bucketing).
    // Issue #845 backfill: explicit input.usageRecordedAt overrides — anchored to the
    // stable historical completion signal chosen by the planner.
    if (input.usageRecordedAt != null) {
      record.usageRecordedAt = input.usageRecordedAt;
    } else if (record.usageRecordedAt == null) {
      record.usageRecordedAt = Date.now();
    }
  }

  create(input: CreateInvocationInput): CreateResult {
    const now = Date.now();
    const composite = this.compositeKey(input.threadId, input.userId, input.idempotencyKey);

    const existingId = this.idempotencyIndex.get(composite);
    if (existingId && this.records.has(existingId)) {
      return { outcome: 'duplicate', invocationId: existingId };
    }
    if (existingId) {
      this.idempotencyIndex.delete(composite);
    }

    const id = randomUUID();
    const record: InvocationRecord = {
      id,
      ...(input.queueEntryId ? { queueEntryId: input.queueEntryId } : {}),
      threadId: input.threadId,
      userId: input.userId,
      userMessageId: null,
      targetCats: [...input.targetCats],
      intent: input.intent,
      status: 'queued',
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };

    this.records.set(id, record);
    this.idempotencyIndex.set(composite, id);
    this.trimSafelyRecoverableRecords();

    return { outcome: 'created', invocationId: id };
  }

  get(id: string): InvocationRecord | null {
    return this.records.get(id) ?? null;
  }

  update(id: string, input: UpdateInvocationInput): InvocationRecord | null {
    const record = this.records.get(id);
    if (!record) return null;

    // State machine guard: reject illegal transitions (F25)
    if (input.status !== undefined && !isValidTransition(record.status, input.status)) {
      return null;
    }

    // CAS guard: reject if current status doesn't match expected
    if (input.expectedStatus !== undefined && record.status !== input.expectedStatus) {
      return null;
    }
    if (input.expectedUsageByCatAbsent === true && this.hasRecordedUsage(record)) {
      return null;
    }

    if (input.status !== undefined) record.status = input.status;
    if (input.userMessageId !== undefined) record.userMessageId = input.userMessageId;
    if (input.error !== undefined) record.error = input.error;
    record.queueEntryId = input.queueEntryId ?? record.queueEntryId;
    this.applyUsageUpdate(record, input);
    record.updatedAt = Date.now();
    this.trimSafelyRecoverableRecords();

    return record;
  }

  getByIdempotencyKey(threadId: string, userId: string, key: string): InvocationRecord | null {
    const composite = this.compositeKey(threadId, userId, key);
    const invocationId = this.idempotencyIndex.get(composite);
    if (!invocationId) return null;
    const record = this.records.get(invocationId) ?? null;
    if (!record) this.idempotencyIndex.delete(composite);
    return record;
  }

  listRunningByThread(threadId: string, userId: string): InvocationRecord[] {
    const out: InvocationRecord[] = [];
    for (const r of this.records.values()) {
      if (r.status === 'running' && r.threadId === threadId && r.userId === userId) out.push(r);
    }
    return out;
  }

  /** Current record count (for testing) */
  get size(): number {
    return this.records.size;
  }
}
