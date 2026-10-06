import assert from 'node:assert/strict';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it, type TestContext } from 'node:test';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { MemoryFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import { sessionAuthPlugin, sessionRoute } from '../../src/infrastructure/session-auth.js';
import { fashionDesignRoutes } from '../../src/routes/fashion-designs.js';
import { garment } from './fixtures.js';

const headers = { 'x-cat-cafe-user': 'owner' };
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
  'base64',
);
function form(image = png, threadId = 'thread-1') {
  const boundary = 'fashion-test-boundary';
  return {
    headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="threadId"\r\n\r\n${threadId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nJacket\r\n--${boundary}\r\nContent-Disposition: form-data; name="front"; filename="jacket.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      image,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}
async function setup(t: TestContext) {
  const app = Fastify();
  await app.register(cookie);
  await app.register(sessionAuthPlugin);
  await app.register(sessionRoute, { ownerUserId: 'owner' });
  const service = new FashionDesignService(new MemoryFashionDesignStore());
  const uploadDir = await mkdtemp(join(tmpdir(), 'f317-http-'));
  const thread = { id: 'thread-1', createdBy: 'owner' };
  await app.register(fashionDesignRoutes, {
    service,
    uploadDir,
    threadStore: { get: async (id: string) => (id === thread.id ? thread : null) },
  });
  t.after(() => app.close());
  return { app, service, uploadDir, thread };
}
async function seed(service: FashionDesignService) {
  const design = await service.create({
    userId: 'owner',
    threadId: 'thread-1',
    title: 'Jacket',
    sourceAssetIdsByView: { front: 'source-front' },
  });
  const draft = await service.analyze('owner', design.id, garment());
  return { design, draft };
}

it('fashion HTTP rejects anonymous and browser header spoofing', async (t) => {
  const { app } = await setup(t);
  for (const h of [{}, { ...headers, origin: 'http://localhost:3000' }]) {
    const response = await app.inject({ method: 'GET', url: '/api/fashion-designs?threadId=thread-1', headers: h });
    assert.equal(response.statusCode, 401);
  }
});
it('fashion HTTP refuses remote unpaired identity headers', async (t) => {
  const { app } = await setup(t);
  const response = await app.inject({
    method: 'GET',
    url: '/api/fashion-designs?threadId=thread-1',
    headers,
    remoteAddress: '192.0.2.3',
  });
  assert.equal(response.statusCode, 401);
});
it('local browser session authorizes the owner and takes precedence over spoofed headers', async (t) => {
  const { app } = await setup(t);
  const session = await app.inject({ method: 'GET', url: '/api/session' });
  const authCookie = session.cookies.map((entry) => `${entry.name}=${entry.value}`).join('; ');
  const response = await app.inject({
    method: 'GET',
    url: '/api/fashion-designs?threadId=thread-1',
    headers: { cookie: authCookie, origin: 'http://localhost:3000', 'x-cat-cafe-user': 'intruder' },
  });
  assert.equal(response.statusCode, 200, response.body);
});
it('uploads a validated image into a persistent owner-scoped design', async (t) => {
  const { app, service, uploadDir } = await setup(t);
  const response = await app.inject({ method: 'POST', url: '/api/fashion-designs', ...form() });
  assert.equal(response.statusCode, 201, response.body);
  const design = response.json().design;
  const assetId = design.sourceAssetIdsByView.front;
  assert.ok(assetId);
  assert.match(design.assets[assetId].urlPath, /^\/uploads\//);
  assert.equal(design.assets[assetId].kind, 'source');
  assert.equal((await readdir(uploadDir)).length, 1);
  assert.deepEqual((await service.get('owner', design.id)).design, design);
  const read = await app.inject({ method: 'GET', url: `/api/fashion-designs/${design.id}`, headers });
  assert.equal(read.statusCode, 200);
  const other = await app.inject({
    method: 'GET',
    url: `/api/fashion-designs/${design.id}`,
    headers: { 'x-cat-cafe-user': 'intruder' },
  });
  assert.equal(other.statusCode, 404);
});
it('rejects MIME spoofing and unowned-thread uploads before saving files', async (t) => {
  const { app, uploadDir } = await setup(t);
  const spoofed = await app.inject({ method: 'POST', url: '/api/fashion-designs', ...form(Buffer.from('not a PNG')) });
  assert.equal(spoofed.statusCode, 400);
  const unowned = await app.inject({ method: 'POST', url: '/api/fashion-designs', ...form(png, 'other-thread') });
  assert.equal(unowned.statusCode, 404);
  assert.deepEqual(await readdir(uploadDir), []);
});
it('rechecks thread ownership for existing designs and rejects client-owned identity fields', async (t) => {
  const h = await setup(t);
  const { design, draft } = await seed(h.service);
  const invalid = await h.app.inject({
    method: 'POST',
    url: `/api/fashion-designs/${design.id}/confirmations`,
    headers,
    payload: { userId: 'intruder', baseVersionId: draft.id, parts: [] },
  });
  assert.equal(invalid.statusCode, 400);
  h.thread.createdBy = 'other-owner';
  const read = await h.app.inject({ method: 'GET', url: `/api/fashion-designs/${design.id}`, headers });
  assert.equal(read.statusCode, 404);
});
it('reference image upload records ownership inside the design', async (t) => {
  const { app, service } = await setup(t);
  const { design } = await seed(service);
  const boundary = 'fashion-reference-test';
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="reference"; filename="ref.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await app.inject({
    method: 'POST',
    url: `/api/fashion-designs/${design.id}/reference-images`,
    headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload,
  });
  assert.equal(response.statusCode, 201, response.body);
  const asset = response.json().asset;
  assert.equal(asset.kind, 'reference');
  assert.deepEqual((await service.get('owner', design.id)).design.assets?.[asset.id], asset);
});
it('exposes explicit confirmation, snapshot and stale-base errors through HTTP', async (t) => {
  const { app, service } = await setup(t);
  const { design, draft } = await seed(service);
  const parts = Object.values(draft.domains).flatMap((d) =>
    d.components.map((p) => ({ partId: p.partId, partHash: p.partHash, evidenceOrigin: 'photo' })),
  );
  const confirmed = await app.inject({
    method: 'POST',
    url: `/api/fashion-designs/${design.id}/confirmations`,
    headers,
    payload: { baseVersionId: draft.id, parts },
  });
  assert.equal(confirmed.statusCode, 200, confirmed.body);
  const version = confirmed.json().version;
  const frozen = await app.inject({
    method: 'POST',
    url: `/api/fashion-designs/${design.id}/confirmed-snapshots`,
    headers,
    payload: { baseVersionId: version.id, view: 'front' },
  });
  assert.equal(frozen.statusCode, 201, frozen.body);
  assert.equal(frozen.json().snapshot.parts.length, 8);
  const stale = await app.inject({
    method: 'POST',
    url: `/api/fashion-designs/${design.id}/restore`,
    headers,
    payload: { baseVersionId: draft.id, sourceVersionId: version.id },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().error, 'stale_version');
});
it('does not accept paid generation work when no provider worker is available', async (t) => {
  const { app, service } = await setup(t);
  const { design } = await seed(service);
  const before = await service.get('owner', design.id);
  const result = await app.inject({
    method: 'POST',
    url: `/api/fashion-designs/${design.id}/edit-proposals`,
    headers,
    payload: {
      baseVersionId: 'base',
      targetDomainId: 'sleeve',
      targetPartIds: ['sleeve'],
      instruction: 'Long',
      idempotencyKey: 'once',
    },
  });
  assert.equal(result.statusCode, 503);
  assert.equal(result.json().error, 'preview_provider_unavailable');
  assert.deepEqual(await service.get('owner', design.id), before);
});
