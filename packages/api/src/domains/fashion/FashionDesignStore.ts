import type { FashionDesignState } from '@cat-cafe/shared';
import type { RedisClient } from '@cat-cafe/shared/utils';
import { canonicalJson, FashionError } from './fashion-invariants.js';

export interface FashionDesignStore {
  create(state: FashionDesignState): Promise<boolean>;
  read(userId: string, designId: string): Promise<FashionDesignState | null>;
  compareAndSwap(before: FashionDesignState, after: FashionDesignState): Promise<boolean>;
  list(userId: string, threadId: string): Promise<FashionDesignState[]>;
}
function assertAppendOnly(before: FashionDesignState, after: FashionDesignState) {
  if (
    before.design.id !== after.design.id ||
    before.design.userId !== after.design.userId ||
    before.design.threadId !== after.design.threadId ||
    after.design.revision !== before.design.revision + 1
  ) {
    throw new FashionError('invalid_store_transition');
  }
  for (const group of ['versions', 'confirmations', 'snapshots', 'validations'] as const) {
    for (const [id, value] of Object.entries(before[group])) {
      if (!Object.hasOwn(after[group], id) || canonicalJson(value) !== canonicalJson(after[group][id])) {
        throw new FashionError('immutable_record');
      }
    }
  }
  if (canonicalJson(after.events.slice(0, before.events.length)) !== canonicalJson(before.events))
    throw new FashionError('immutable_audit');
  const active = after.design.activeVersionId;
  if (active && after.versions[active]?.status !== 'adopted') throw new FashionError('invalid_active_version');
}
const key = (userId: string, designId: string) =>
  `fashion:{${encodeURIComponent(userId)}}:design:${encodeURIComponent(designId)}`;
const index = (userId: string, threadId: string) =>
  `fashion:{${encodeURIComponent(userId)}}:thread:${encodeURIComponent(threadId)}`;

export class MemoryFashionDesignStore implements FashionDesignStore {
  private readonly records = new Map<string, FashionDesignState>();
  async create(state: FashionDesignState) {
    const id = key(state.design.userId, state.design.id);
    if (this.records.has(id)) return false;
    this.records.set(id, structuredClone(state));
    return true;
  }
  async read(userId: string, designId: string) {
    return structuredClone(this.records.get(key(userId, designId)) ?? null);
  }
  async compareAndSwap(before: FashionDesignState, after: FashionDesignState) {
    assertAppendOnly(before, after);
    const id = key(before.design.userId, before.design.id);
    const current = this.records.get(id);
    if (!current || canonicalJson(current) !== canonicalJson(before)) return false;
    this.records.set(id, structuredClone(after));
    return true;
  }
  async list(userId: string, threadId: string) {
    return structuredClone(
      [...this.records.values()].filter((s) => s.design.userId === userId && s.design.threadId === threadId),
    );
  }
}

const CREATE = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
local t = redis.call('TYPE', KEYS[2]).ok
if t ~= 'none' and t ~= 'set' then return redis.error_reply('invalid fashion index type') end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('SADD', KEYS[2], ARGV[2])
return 1
`;
const CAS = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1
`;
/** One atomic document write includes the active pointer, history, confirmations and jobs.
 * No expiry, deletion or cleanup API. Inject the existing Redis client; never infer a URL.
 */
export class RedisFashionDesignStore implements FashionDesignStore {
  constructor(private readonly redis: RedisClient) {}
  async create(state: FashionDesignState) {
    return (
      (await this.redis.eval(
        CREATE,
        2,
        key(state.design.userId, state.design.id),
        index(state.design.userId, state.design.threadId),
        canonicalJson(state),
        state.design.id,
      )) === 1
    );
  }
  async read(userId: string, designId: string): Promise<FashionDesignState | null> {
    const raw = await this.redis.get(key(userId, designId));
    return raw ? (JSON.parse(raw) as FashionDesignState) : null;
  }
  async compareAndSwap(before: FashionDesignState, after: FashionDesignState) {
    assertAppendOnly(before, after);
    return (
      (await this.redis.eval(
        CAS,
        1,
        key(before.design.userId, before.design.id),
        canonicalJson(before),
        canonicalJson(after),
      )) === 1
    );
  }
  async list(userId: string, threadId: string) {
    const ids = await this.redis.smembers(index(userId, threadId));
    const states = await Promise.all(ids.map((id) => this.read(userId, id)));
    return states.filter((s): s is FashionDesignState => s !== null && s.design.threadId === threadId);
  }
}
