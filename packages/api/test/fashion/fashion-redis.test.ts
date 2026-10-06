import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import { Redis } from 'ioredis';
import { GARMENT_DOMAIN_IDS } from '../../../shared/src/fashion/index.js';
import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { RedisFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import { garment } from './fixtures.js';

// Explicit opt-in, owned process and temporary RDB directory. Never attach to an existing server.
async function startRedis(directory: string) {
  const child = spawn(
    process.env.FASHION_REDIS_SERVER ?? 'redis-server',
    ['--bind', '127.0.0.1', '--port', '6398', '--save', '', '--appendonly', 'no', '--dbfilename', 'fashion.rdb'],
    { cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  await new Promise<void>((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Owned Redis did not start: ${log}`));
    }, 10000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Owned Redis exited ${code}: ${log}`));
    });
    child.stderr.on('data', (data) => {
      log += data.toString();
    });
    child.stdout.on('data', (data) => {
      log += data.toString();
      if (log.includes('Ready to accept connections')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  const redis = new Redis('redis://127.0.0.1:6398/15', {
    keyPrefix: 'f317-test:',
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
  await redis.ping();
  return {
    redis,
    async stop() {
      const exited = once(child, 'exit');
      // Only this test-created server can reach this point (readiness comes from its own stdout).
      try {
        await redis.shutdown('NOSAVE');
      } catch {
        /* Redis closes the socket during shutdown. */
      }
      redis.disconnect();
      await exited;
    },
  };
}

it(
  'Redis keeps non-expiring history across restart and allows one CAS winner',
  {
    skip: process.env.FASHION_REDIS_TEST !== '1',
    timeout: 30000,
  },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'f317-redis-'));
    t.diagnostic(`Isolated Redis data retained at ${directory}`);
    let server = await startRedis(directory);
    try {
      let store = new RedisFashionDesignStore(server.redis);
      let service = new FashionDesignService(store);
      const design = await service.create({
        userId: 'owner',
        threadId: 'thread-1',
        title: 'Jacket',
        sourceAssetIdsByView: { front: 'source-front' },
      });
      const draft = await service.analyze('owner', design.id, garment());
      const version = await service.confirm('owner', design.id, {
        baseVersionId: draft.id,
        parts: GARMENT_DOMAIN_IDS.map((partId) => ({
          partId,
          partHash: draft.domains[partId].components[0].partHash,
          evidenceOrigin: 'photo' as const,
        })),
      });
      const snapshot = await service.freeze('owner', design.id, version.id, 'front');
      const results = await Promise.allSettled([
        service.restore('owner', design.id, version.id, version.id),
        service.restore('owner', design.id, version.id, version.id),
      ]);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      const loser = results.find((r) => r.status === 'rejected');
      assert.equal(loser?.status === 'rejected' && loser.reason.code, 'stale_version');
      const before = await service.get('owner', design.id);
      const keys = await server.redis.keys('f317-test:*');
      assert.equal(keys.length, 2);
      for (const key of keys) assert.equal(await server.redis.ttl(key.slice('f317-test:'.length)), -1);
      assert.equal((await service.list('owner', 'thread-1')).length, 1);
      assert.deepEqual(await service.list('other-user', 'thread-1'), []);
      const tampered = structuredClone(before);
      tampered.design.revision++;
      tampered.versions[version.id].domains.sleeve.components[0].attributes.style = 'tampered';
      await assert.rejects(store.compareAndSwap(before, tampered), { code: 'immutable_record' });
      await server.redis.save();
      await server.stop();
      server = await startRedis(directory);
      store = new RedisFashionDesignStore(server.redis);
      service = new FashionDesignService(store);
      assert.deepEqual(await service.get('owner', design.id), before);
      assert.deepEqual((await service.get('owner', design.id)).snapshots[snapshot.id], snapshot);
      assert.equal((await service.list('owner', 'thread-1')).length, 1);
      await assert.rejects(service.get('other-user', design.id), { code: 'not_found' });
    } finally {
      await server.stop();
    }
  },
);
