import assert from 'node:assert/strict';
import { it } from 'node:test';
import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { MemoryFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import { FashionPreviewWorker } from '../../src/domains/fashion/FashionPreviewWorker.js';
import { garment } from './fixtures.js';

async function setup() {
  const store = new MemoryFashionDesignStore();
  const service = new FashionDesignService(store);
  const design = await service.create({
    userId: 'owner',
    threadId: 'thread-1',
    title: 'Jacket',
    sourceAssetIdsByView: { front: 'source-front' },
  });
  const draft = await service.analyze('owner', design.id, garment());
  const version = await service.confirm('owner', design.id, {
    baseVersionId: draft.id,
    parts: Object.values(draft.domains).flatMap((d) =>
      d.components.map((p) => ({ partId: p.partId, partHash: p.partHash, evidenceOrigin: 'photo' as const })),
    ),
  });
  const proposal = await service.propose('owner', design.id, {
    baseVersionId: version.id,
    targetDomainId: 'sleeve',
    targetPartIds: ['sleeve'],
    instruction: 'Long sleeves',
    idempotencyKey: 'once',
  });
  return { store, service, design, version, proposal };
}
const result = () => ({
  components: garment().sleeve.components,
  previewAssetId: 'published-image',
  affectedPartIds: [],
  protectedDriftPartIds: [],
});

it('two preview workers claim one operation only once', async () => {
  const h = await setup();
  const entered = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<ReturnType<typeof result>>();
  let calls = 0;
  const provider = {
    generate: async () => {
      calls++;
      entered.resolve();
      return finish.promise;
    },
  };
  const a = new FashionPreviewWorker(h.service, provider);
  const b = new FashionPreviewWorker(h.service, provider);
  const running = a.run('owner', h.design.id, h.proposal.id, h.proposal.operationId);
  await entered.promise;
  await b.run('owner', h.design.id, h.proposal.id, h.proposal.operationId);
  assert.equal(calls, 1);
  finish.resolve(result());
  await running;
  const state = await h.service.get('owner', h.design.id);
  assert.equal(state.proposals[h.proposal.id].status, 'ready');
  assert.equal(state.design.activeVersionId, h.version.id);
});
it('provider failure is persisted without leaking its error; retry gets a fresh operation', async () => {
  const h = await setup();
  const errors: unknown[] = [];
  const worker = new FashionPreviewWorker(
    h.service,
    {
      generate: async () => {
        throw new Error('private provider credential');
      },
    },
    { onError: (error: unknown) => errors.push(error) },
  );
  await worker.run('owner', h.design.id, h.proposal.id, h.proposal.operationId);
  const failed = (await h.service.get('owner', h.design.id)).proposals[h.proposal.id];
  assert.equal(failed.status, 'failed');
  assert.equal(failed.failure, 'preview_generation_failed');
  assert.equal(errors.length, 1);
  const retry = await h.service.retry('owner', h.design.id, h.proposal.id, h.version.id);
  assert.notEqual(retry.operationId, h.proposal.operationId);
});
it('expired worker lease permits retry and fences out the old completion', async () => {
  const h = await setup();
  const entered = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<ReturnType<typeof result>>();
  const worker = new FashionPreviewWorker(h.service, {
    generate: async () => {
      entered.resolve();
      return finish.promise;
    },
  });
  const running = worker.run('owner', h.design.id, h.proposal.id, h.proposal.operationId);
  await entered.promise;
  const before = await h.service.get('owner', h.design.id);
  const after = structuredClone(before);
  after.design.revision++;
  after.proposals[h.proposal.id].workerLease!.expiresAt = 0;
  assert.equal(await h.store.compareAndSwap(before, after), true);
  const retry = await h.service.retry('owner', h.design.id, h.proposal.id, h.version.id);
  finish.resolve(result());
  await running;
  const state = await h.service.get('owner', h.design.id);
  assert.equal(state.proposals[h.proposal.id].operationId, retry.operationId);
  assert.equal(state.proposals[h.proposal.id].status, 'queued');
  assert.equal(Object.keys(state.validations).length, 0);
});
it('a hung provider times out and leaves a retryable persisted failure', async () => {
  const h = await setup();
  const worker = new FashionPreviewWorker(
    h.service,
    { generate: async () => new Promise<never>(() => {}) },
    { timeoutMs: 25 },
  );
  await worker.run('owner', h.design.id, h.proposal.id, h.proposal.operationId);
  const failed = (await h.service.get('owner', h.design.id)).proposals[h.proposal.id];
  assert.equal(failed.status, 'failed');
  assert.equal(failed.failure, 'preview_timeout');
});
it('fashion persistence rejects oversized aggregate writes atomically', async () => {
  const h = await setup();
  const before = await h.service.get('owner', h.design.id);
  const after = structuredClone(before);
  after.design.revision++;
  after.design.title = 'x'.repeat(16 * 1024 * 1024);
  await assert.rejects(h.store.compareAndSwap(before, after), { code: 'design_capacity_exceeded', statusCode: 413 });
  assert.deepEqual(await h.service.get('owner', h.design.id), before);
});
