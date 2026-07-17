import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

class ClaimRedisDouble {
  nowSeconds = 0;
  claims = new Map();

  async eval(script, _numKeys, idempotencyKey, _recordKey, invocationId) {
    const existing = this.claims.get(idempotencyKey);
    if (existing && (existing.expiresAt === null || existing.expiresAt > this.nowSeconds)) {
      return ['duplicate', existing.invocationId];
    }

    const ttlMatch = script.match(/redis\.call\('SET', KEYS\[1\], ARGV\[1\], 'EX', (\d+)\)/);
    const expiresAt = ttlMatch ? this.nowSeconds + Number(ttlMatch[1]) : null;
    this.claims.set(idempotencyKey, { invocationId, expiresAt });
    return ['created', invocationId];
  }

  advance(seconds) {
    this.nowSeconds += seconds;
  }
}

describe('RedisInvocationRecordStore persistent idempotency ownership', () => {
  it('does not release the dispatch claim after the legacy 300-second window', async () => {
    const { RedisInvocationRecordStore } = await import(
      '../dist/domains/cats/services/stores/redis/RedisInvocationRecordStore.js'
    );
    const redis = new ClaimRedisDouble();
    const store = new RedisInvocationRecordStore(redis);
    const input = {
      threadId: 'thread-retained',
      userId: 'user-retained',
      targetCats: ['opus'],
      intent: 'execute',
      idempotencyKey: 'redis-retained-key',
    };

    const first = await store.create(input);
    redis.advance(301);
    const replay = await store.create(input);

    assert.equal(first.outcome, 'created');
    assert.equal(replay.outcome, 'duplicate');
    assert.equal(replay.invocationId, first.invocationId);
  });
});
