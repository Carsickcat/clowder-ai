import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import Fastify from 'fastify';
import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { MemoryFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import { fashionDesignRoutes } from '../../src/routes/fashion-designs.js';
import { garment } from './fixtures.js';

it('analysis consumes owned images and persists a draft once, without client-supplied structure', async (t) => {
  const service = new FashionDesignService(new MemoryFashionDesignStore());
  const design = await service.create({
    userId: 'owner',
    threadId: 'thread-1',
    title: 'Jacket',
    sourceAssetIdsByView: { front: 'source-front' },
  });
  let calls = 0;
  const app = Fastify();
  await app.register(fashionDesignRoutes, {
    service,
    uploadDir: await mkdtemp(join(tmpdir(), 'f317-analysis-')),
    threadStore: { get: () => ({ createdBy: 'owner' }) },
    analyzer: {
      analyze: async (input) => {
        calls++;
        assert.equal(input.design.id, design.id);
        return garment();
      },
    },
  });
  t.after(() => app.close());
  const request = {
    method: 'POST' as const,
    url: `/api/fashion-designs/${design.id}/analysis`,
    headers: { 'x-cat-cafe-user': 'owner' },
    payload: {},
  };
  const foreign = await app.inject({ ...request, headers: { 'x-cat-cafe-user': 'intruder' } });
  assert.equal(foreign.statusCode, 404);
  assert.equal(calls, 0);
  const spoofed = await app.inject({ ...request, payload: { domains: garment() } });
  assert.equal(spoofed.statusCode, 400);
  const first = await app.inject(request);
  assert.equal(first.statusCode, 201, first.body);
  assert.equal(first.json().version.status, 'draft');
  const again = await app.inject(request);
  assert.equal(again.statusCode, 200, again.body);
  assert.equal(again.json().version.id, first.json().version.id);
  assert.equal(calls, 1);
  assert.equal((await service.get('owner', design.id)).design.activeVersionId, null);
});

it('analysis rechecks thread ownership after model execution and leaves no draft on failure', async (t) => {
  const service = new FashionDesignService(new MemoryFashionDesignStore());
  const design = await service.create({
    userId: 'owner',
    threadId: 'thread-1',
    title: 'Jacket',
    sourceAssetIdsByView: { front: 'source-front' },
  });
  const thread = { createdBy: 'owner' };
  const app = Fastify();
  await app.register(fashionDesignRoutes, {
    service,
    uploadDir: await mkdtemp(join(tmpdir(), 'f317-analysis-owner-')),
    threadStore: { get: () => thread },
    analyzer: {
      analyze: async () => {
        thread.createdBy = 'different-owner';
        return garment();
      },
    },
  });
  t.after(() => app.close());
  const response = await app.inject({
    method: 'POST',
    url: `/api/fashion-designs/${design.id}/analysis`,
    headers: { 'x-cat-cafe-user': 'owner' },
    payload: {},
  });
  assert.equal(response.statusCode, 404);
  assert.equal(thread.createdBy, 'different-owner');
  assert.deepEqual((await service.get('owner', design.id)).versions, {});
});
