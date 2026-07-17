import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

const { RedisMessageStore } = await import('../dist/domains/cats/services/stores/redis/RedisMessageStore.js');

function buildRedisDouble({ messageId, message }) {
  return {
    options: {},
    get: mock.fn(async () => messageId),
    hgetall: mock.fn(async () => message),
    eval: mock.fn(async () => 1),
  };
}

describe('RedisMessageStore idempotency index lookup', () => {
  it('resolves the indexed durable message without mutating the index', async () => {
    const redis = buildRedisDouble({
      messageId: 'msg-durable',
      message: {
        id: 'msg-durable',
        threadId: 'thread-A',
        userId: 'user-A',
        catId: '',
        content: 'durable content',
        contentBlocks: '',
        toolEvents: '',
        metadata: '',
        extra: '',
        mentions: '[]',
        timestamp: '123',
      },
    });
    const store = new RedisMessageStore(redis);

    const message = await store.getByIdempotencyKey('user-A', 'thread-A', 'idem-A');

    assert.equal(message?.id, 'msg-durable');
    assert.equal(message?.content, 'durable content');
    assert.equal(redis.eval.mock.calls.length, 0);
  });

  it('removes a stale index only through compare-and-delete', async () => {
    const redis = buildRedisDouble({ messageId: 'msg-missing', message: {} });
    const store = new RedisMessageStore(redis);

    const message = await store.getByIdempotencyKey('user-A', 'thread-A', 'idem-A');

    assert.equal(message, null);
    assert.equal(redis.eval.mock.calls.length, 1);
    const [, keyCount, indexKey, expectedMessageId] = redis.eval.mock.calls[0].arguments;
    assert.equal(keyCount, 1);
    assert.match(indexKey, /user-A.*thread-A.*idem-A/);
    assert.equal(expectedMessageId, 'msg-missing');
  });
});
