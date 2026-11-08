import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { it } from 'node:test';
import Fastify from 'fastify';
import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { MemoryFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import { fashionDesignRoutes } from '../../src/routes/fashion-designs.js';
import { garment } from './fixtures.js';

it('async analysis is durable, deduplicated across route instances, and fences an expired attempt', async (t) => {
  const service = new FashionDesignService(new MemoryFashionDesignStore());
  const design = await service.create({
    userId: 'owner',
    threadId: 't',
    title: 'Jacket',
    sourceAssetIdsByView: { front: 'source-front' },
  });
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let calls = 0;
  const safety = setTimeout(() => finish(), 2000);
  t.after(() => {
    clearTimeout(safety);
    finish();
  });
  const options = {
    service,
    uploadDir: tmpdir(),
    threadStore: { get: () => ({ createdBy: 'owner' }) },
    analyzer: {
      analyze: async () => {
        calls++;
        await pending;
        return garment();
      },
    },
  };
  const apps = [Fastify(), Fastify()];
  for (const app of apps) {
    await app.register(fashionDesignRoutes, options);
    t.after(() => app.close());
  }
  const input = {
    method: 'POST' as const,
    url: `/api/fashion-designs/${design.id}/analysis?async=true`,
    headers: { 'x-cat-cafe-user': 'owner' },
    payload: {},
  };
  const results = await Promise.all(apps.map((app) => app.inject(input)));
  results.forEach((result) => assert.equal(result.statusCode, 202, result.body));
  assert.equal(results[0].json().operationId, results[1].json().operationId);
  assert.equal(calls, 1);
  assert.equal((await service.get('owner', design.id)).analysis?.status, 'generating');
  finish();
  for (let i = 0; i < 100 && !(await service.get('owner', design.id)).analysis?.versionId; i++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal((await service.get('owner', design.id)).analysis?.status, 'ready');
  assert.equal((await apps[0].inject(input)).statusCode, 200);
  const other = await service.create({
    userId: 'owner',
    threadId: 't',
    title: 'Jacket2',
    sourceAssetIdsByView: { front: 'source-front' },
  });
  const old = await service.claimAnalysis('owner', other.id, 1);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const fresh = await service.claimAnalysis('owner', other.id, 5000);
  assert.notEqual(old!.operationId, fresh!.operationId);
  await assert.rejects(service.analyze('owner', other.id, garment(), old!.operationId), { code: 'stale_analysis' });
  await service.analyze('owner', other.id, garment(), fresh!.operationId);
});

it('analysis rechecks ownership after claiming before invoking the provider', async (t) => {
  const service = new FashionDesignService(new MemoryFashionDesignStore());
  const design = await service.create({
    userId: 'owner',
    threadId: 't',
    title: 'Jacket',
    sourceAssetIdsByView: { front: 'source-front' },
  });
  let checks = 0;
  let calls = 0;
  const app = Fastify();
  t.after(() => app.close());
  await app.register(fashionDesignRoutes, {
    service,
    uploadDir: tmpdir(),
    threadStore: { get: () => ({ createdBy: ++checks === 1 ? 'owner' : 'new-owner' }) },
    analyzer: {
      analyze: async () => {
        calls++;
        return garment();
      },
    },
  });
  const response = await app.inject({
    method: 'POST',
    url: `/api/fashion-designs/${design.id}/analysis`,
    headers: { 'x-cat-cafe-user': 'owner' },
    payload: {},
  });
  assert.equal(response.statusCode, 404);
  assert.equal(calls, 0);
  assert.equal((await service.get('owner', design.id)).analysis?.status, 'failed');
});

it('failed analysis persists a safe error and retries with a fresh operation', async (t) => {
  const service = new FashionDesignService(new MemoryFashionDesignStore());
  const design = await service.create({
    userId: 'owner',
    threadId: 't',
    title: 'Jacket',
    sourceAssetIdsByView: { front: 'source-front' },
  });
  let calls = 0;
  const app = Fastify();
  t.after(() => app.close());
  await app.register(fashionDesignRoutes, {
    service,
    uploadDir: tmpdir(),
    threadStore: { get: () => ({ createdBy: 'owner' }) },
    analyzer: {
      analyze: async () => {
        if (++calls === 1) throw Error('secret provider internals');
        return garment();
      },
    },
  });
  const input = {
    method: 'POST' as const,
    url: `/api/fashion-designs/${design.id}/analysis`,
    headers: { 'x-cat-cafe-user': 'owner' },
    payload: {},
  };
  assert.equal((await app.inject(input)).statusCode, 500);
  const first = (await service.get('owner', design.id)).analysis;
  assert.equal(first?.failure, 'analysis_failed');
  assert.equal((await app.inject(input)).statusCode, 201);
  const next = (await service.get('owner', design.id)).analysis;
  assert.notEqual(next?.operationId, first?.operationId);
  assert.equal(next?.status, 'ready');
});
