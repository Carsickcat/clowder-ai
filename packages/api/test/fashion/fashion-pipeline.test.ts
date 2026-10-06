import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { GarmentVersion } from '@cat-cafe/shared';
import Fastify from 'fastify';
import { aggregateThreadArtifacts } from '../../src/domains/cats/services/agents/routing/thread-artifacts-aggregator.js';
import { MessageStore } from '../../src/domains/cats/services/stores/ports/MessageStore.js';
import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { MemoryFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import { createFashionPipeline } from '../../src/domains/fashion/fashion-pipeline.js';
import { fashionDesignRoutes } from '../../src/routes/fashion-designs.js';
import { agentFixture } from './agent-fixture.js';

it('API upload → agent analysis → confirmation → async masked preview → F232 publication', async (t) => {
  const fixture = await agentFixture();
  const service = new FashionDesignService(new MemoryFashionDesignStore());
  const messages = new MessageStore();
  const threadStore = { get: () => ({ createdBy: 'owner' }) };
  const pipeline = createFashionPipeline({
    service,
    uploadDir: fixture.uploadDir,
    threadStore,
    messageStore: messages,
    resolveAgent: fixture.resolveAgent,
  });
  const app = Fastify();
  await app.register(fashionDesignRoutes, { service, uploadDir: fixture.uploadDir, threadStore, ...pipeline });
  t.after(async () => {
    await pipeline.previewWorker.whenIdle();
    await app.close();
  });
  const headers = { 'x-cat-cafe-user': 'owner' };
  const boundary = 'f317-pipeline';
  const upload = await app.inject({
    method: 'POST',
    url: '/api/fashion-designs',
    headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="threadId"\r\n\r\nthread-1\r\n--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nJacket\r\n--${boundary}\r\nContent-Disposition: form-data; name="front"; filename="jacket.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      fixture.red,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  assert.equal(upload.statusCode, 201, upload.body);
  const id = upload.json().design.id;
  const url = `/api/fashion-designs/${id}`;
  const analysis = await app.inject({ method: 'POST', url: `${url}/analysis`, headers, payload: {} });
  assert.equal(analysis.statusCode, 201, analysis.body);
  const draft = analysis.json<{ version: GarmentVersion }>().version;
  const confirmation = await app.inject({
    method: 'POST',
    url: `${url}/confirmations`,
    headers,
    payload: {
      baseVersionId: draft.id,
      parts: Object.values(draft.domains).flatMap((d) =>
        d.components.map((p) => ({ partId: p.partId, partHash: p.partHash, evidenceOrigin: 'photo' })),
      ),
    },
  });
  assert.equal(confirmation.statusCode, 200, confirmation.body);
  const baseId = confirmation.json().version.id;
  const edit = await app.inject({
    method: 'POST',
    url: `${url}/edit-proposals`,
    headers,
    payload: {
      baseVersionId: baseId,
      targetDomainId: 'pocket',
      targetPartIds: ['pocket'],
      instruction: 'Blue pocket',
      idempotencyKey: 'preview-once',
    },
  });
  assert.equal(edit.statusCode, 202, edit.body);
  await pipeline.previewWorker.whenIdle();
  const proposalId = edit.json().proposalId;
  const poll = await app.inject({ method: 'GET', url: `${url}/edit-proposals/${proposalId}`, headers });
  assert.equal(poll.json().status, 'ready', poll.body);
  const state = await service.get('owner', id);
  const assetId = state.versions[poll.json().candidateVersionId].previewAssetId!;
  const asset = state.design.assets![assetId];
  const key = `fashion-preview:${id}:${proposalId}`;
  const published = await messages.getByIdempotencyKey('owner', 'thread-1', key);
  assert.ok(published);
  const artifacts = aggregateThreadArtifacts({ messages: [published], prTasks: [], fileLedger: [] });
  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].url, asset.urlPath);
  await pipeline.previewWorker.run('owner', id, proposalId, edit.json().operationId);
  assert.equal((await messages.getByIdempotencyKey('owner', 'thread-1', key))!.id, published.id);
  const accept = await app.inject({
    method: 'POST',
    url: `${url}/edit-proposals/${proposalId}/decision`,
    headers,
    payload: { baseVersionId: baseId, decision: 'accept' },
  });
  assert.equal(accept.statusCode, 200, accept.body);
  assert.equal(accept.json().version.previewAssetId, assetId);
  assert.equal(fixture.calls.length, 3);
});
