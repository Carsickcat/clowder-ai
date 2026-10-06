import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { it } from 'node:test';
import Fastify from 'fastify';
import sharp from 'sharp';
import { aggregateThreadArtifacts } from '../../src/domains/cats/services/agents/routing/thread-artifacts-aggregator.js';
import { MessageStore } from '../../src/domains/cats/services/stores/ports/MessageStore.js';
import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { MemoryFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import { createFashionPipeline } from '../../src/domains/fashion/fashion-pipeline.js';
import { fashionDesignRoutes } from '../../src/routes/fashion-designs.js';
import { flatFixture } from './flat-fixture.js';

async function setup() {
  const store = new MemoryFashionDesignStore();
  const fixture = await flatFixture(new FashionDesignService(store));
  const uploadDir = await mkdtemp(join(tmpdir(), 'f317-flat-test-'));
  const messages = new MessageStore();
  let owner = 'owner';
  let failPublication = false;
  const threadStore = { get: () => ({ createdBy: owner }) };
  const pipeline = createFashionPipeline({
    service: fixture.service,
    uploadDir,
    threadStore,
    resolveAgent: () => {
      throw new Error('SVG must never invoke a model');
    },
    messageStore: {
      appendIdempotent: (input) => {
        if (failPublication) throw new Error('Publication offline');
        return messages.appendIdempotent(input);
      },
    },
  });
  const app = Fastify();
  await app.register(fashionDesignRoutes, { service: fixture.service, uploadDir, threadStore, ...pipeline });
  const url = `/api/fashion-designs/${fixture.design.id}/technical-flats`;
  const headers = { 'x-cat-cafe-user': 'owner' };
  const payload = { confirmedSnapshotId: fixture.snapshot.id };
  return {
    ...fixture,
    store,
    app,
    url,
    headers,
    payload,
    uploadDir,
    messages,
    changeOwner: () => {
      owner = 'other';
    },
    offline: (value: boolean) => {
      failPublication = value;
    },
  };
}

it('HTTP only accepts an owned snapshot, publishes SVG + same-SVG PNG and deduplicates concurrent retries', async (t) => {
  const h = await setup();
  t.after(() => h.app.close());
  const send = (payload = h.payload, headers = h.headers) =>
    h.app.inject({ method: 'POST', url: h.url, headers, payload });
  const result = await send();
  assert.equal(result.statusCode, 201, result.body);
  const artifact = result.json().artifact;
  const state = await h.service.get('owner', h.design.id);
  assert.deepEqual(state.technicalFlats![artifact.id], artifact);
  const svgAsset = state.design.assets![artifact.svgAssetId];
  const pngAsset = state.design.assets![artifact.pngAssetId];
  const svg = await readFile(join(h.uploadDir, basename(svgAsset.urlPath)));
  const png = await readFile(join(h.uploadDir, basename(pngAsset.urlPath)));
  assert.match(svg.toString(), new RegExp(h.snapshot.snapshotHash));
  assert.deepEqual(await sharp(png).raw().toBuffer(), await sharp(svg).raw().toBuffer());
  const repeats = await Promise.all([send(), send()]);
  for (const repeat of repeats) assert.deepEqual(repeat.json().artifact, artifact);
  assert.equal(Object.keys((await h.service.get('owner', h.design.id)).technicalFlats!).length, 1);
  const message = await h.messages.getByIdempotencyKey('owner', 'thread-1', `fashion-flat:${artifact.id}`);
  assert.ok(message);
  const artifacts = aggregateThreadArtifacts({ messages: [message], fileLedger: [], prTasks: [] });
  assert.deepEqual(new Set(artifacts.map((a) => a.url)), new Set([svgAsset.urlPath, pngAsset.urlPath]));
  const loaded = await h.app.inject({ method: 'GET', url: `${h.url}/${artifact.id}`, headers: h.headers });
  assert.deepEqual(loaded.json().artifact, artifact);
  for (const extra of [{ prompt: 'draw' }, { image: '/uploads/foo.png' }, { baseVersionId: h.version.id }]) {
    assert.equal((await send({ ...h.payload, ...extra })).statusCode, 400);
  }
  assert.equal((await send({ confirmedSnapshotId: h.version.id })).statusCode, 404);
  assert.equal((await send(h.payload, { 'x-cat-cafe-user': 'other' })).statusCode, 404);
  assert.equal((await send(h.payload, {} as typeof h.headers)).statusCode, 401);
  h.changeOwner();
  assert.equal((await send()).statusCode, 404);
  assert.equal(
    (await h.app.inject({ method: 'GET', url: `${h.url}/${artifact.id}`, headers: h.headers })).statusCode,
    404,
  );
});

it('publication loss leaves an immutable durable flat and an idempotent retry repairs its F232 message', async (t) => {
  const h = await setup();
  t.after(() => h.app.close());
  h.offline(true);
  const input = { method: 'POST' as const, url: h.url, headers: h.headers, payload: h.payload };
  const failed = await h.app.inject(input);
  assert.equal(failed.statusCode, 500);
  const before = await h.service.get('owner', h.design.id);
  assert.equal(Object.keys(before.technicalFlats!).length, 1);
  h.offline(false);
  const retry = await h.app.inject(input);
  assert.equal(retry.statusCode, 201, retry.body);
  assert.deepEqual((await h.service.get('owner', h.design.id)).technicalFlats, before.technicalFlats);
  assert.ok(await h.messages.getByIdempotencyKey('owner', 'thread-1', `fashion-flat:${retry.json().artifact.id}`));
});

it('concurrent first renders persist one receipt, and persisted SVG references cannot be rewritten', async (t) => {
  const h = await setup();
  t.after(() => h.app.close());
  const input = { method: 'POST' as const, url: h.url, headers: h.headers, payload: h.payload };
  const results = await Promise.all([h.app.inject(input), h.app.inject(input)]);
  for (const result of results) assert.equal(result.statusCode, 201, result.body);
  assert.deepEqual(results[0].json(), results[1].json());
  const before = await h.service.get('owner', h.design.id);
  const artifact = results[0].json().artifact;
  for (const target of ['artifact', 'asset']) {
    const after = structuredClone(before);
    after.design.revision++;
    if (target === 'artifact') after.technicalFlats![artifact.id].snapshotHash = 'changed';
    else after.design.assets![artifact.svgAssetId].urlPath = '/uploads/other.svg';
    await assert.rejects(h.store.compareAndSwap(before, after), { code: 'immutable_record' });
  }
});
