import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import Fastify from 'fastify';
import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { MemoryFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import { FashionPreviewWorker } from '../../src/domains/fashion/FashionPreviewWorker.js';
import { fashionDesignRoutes } from '../../src/routes/fashion-designs.js';
import { garment } from './fixtures.js';

it('HTTP preview is asynchronous, idempotent, pollable and blocks sibling drift at adoption', async (t) => {
  const service = new FashionDesignService(new MemoryFashionDesignStore());
  const design = await service.create({
    userId: 'owner',
    threadId: 'thread-1',
    title: 'Jacket',
    sourceAssetIdsByView: { front: 'source-front' },
  });
  const domains = garment();
  domains.pocket.components.push({ ...structuredClone(domains.pocket.components[0]), partId: 'pocket-right' });
  const draft = await service.analyze('owner', design.id, domains);
  const version = await service.confirm('owner', design.id, {
    baseVersionId: draft.id,
    parts: Object.values(draft.domains).flatMap((d) =>
      d.components.map((p) => ({ partId: p.partId, partHash: p.partHash, evidenceOrigin: 'photo' as const })),
    ),
  });
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let calls = 0;
  const worker = new FashionPreviewWorker(service, {
    generate: async () => {
      calls++;
      entered.resolve();
      await release.promise;
      const components = structuredClone(domains.pocket.components);
      components[1].attributes.style = 'unselected-right-changed';
      return { components, previewAssetId: 'published-preview', affectedPartIds: [], protectedDriftPartIds: [] };
    },
  });
  const app = Fastify();
  const uploadDir = await mkdtemp(join(tmpdir(), 'f317-preview-http-'));
  await app.register(fashionDesignRoutes, {
    service,
    uploadDir,
    threadStore: { get: async () => ({ createdBy: 'owner' }) },
    previewWorker: worker,
  });
  t.after(async () => {
    release.resolve();
    await worker.whenIdle();
    await app.close();
  });
  const headers = { 'x-cat-cafe-user': 'owner' };
  const base = `/api/fashion-designs/${design.id}`;
  const payload = {
    baseVersionId: version.id,
    targetDomainId: 'pocket',
    targetPartIds: ['pocket'],
    instruction: 'Change only the left pocket',
    idempotencyKey: 'http-once',
  };
  const first = await app.inject({ method: 'POST', url: `${base}/edit-proposals`, headers, payload });
  assert.equal(first.statusCode, 202, first.body);
  await entered.promise;
  const again = await app.inject({ method: 'POST', url: `${base}/edit-proposals`, headers, payload });
  assert.equal(again.statusCode, 202);
  assert.equal(again.json().operationId, first.json().operationId);
  assert.equal(calls, 1);
  const url = `${base}/edit-proposals/${first.json().proposalId}`;
  const generating = await app.inject({ method: 'GET', url, headers });
  assert.equal(generating.json().status, 'generating');
  const foreign = await app.inject({ method: 'GET', url, headers: { 'x-cat-cafe-user': 'intruder' } });
  assert.equal(foreign.statusCode, 404);
  release.resolve();
  await worker.whenIdle();
  const ready = await app.inject({ method: 'GET', url, headers });
  assert.equal(ready.json().status, 'ready');
  assert.deepEqual(ready.json().validation.protectedDriftPartIds, ['pocket-right']);
  const adopt = await app.inject({
    method: 'POST',
    url: `${url}/decision`,
    headers,
    payload: { baseVersionId: version.id, decision: 'accept' },
  });
  assert.equal(adopt.statusCode, 409);
  assert.equal(adopt.json().error, 'protected_drift');
  assert.equal((await service.get('owner', design.id)).design.activeVersionId, version.id);
  const missingReference = await app.inject({
    method: 'POST',
    url: `${base}/edit-proposals`,
    headers,
    payload: { ...payload, idempotencyKey: 'foreign-reference', referenceAssetId: 'other-users-upload' },
  });
  assert.equal(missingReference.statusCode, 404);
  assert.equal(calls, 1);
});
