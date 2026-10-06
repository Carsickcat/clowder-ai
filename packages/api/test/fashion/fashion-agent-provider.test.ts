import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { it } from 'node:test';
import sharp from 'sharp';
import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { MemoryFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import { FashionPreviewWorker } from '../../src/domains/fashion/FashionPreviewWorker.js';
import { agentFixture } from './agent-fixture.js';
import { garment } from './fixtures.js';

for (const mode of ['invalid-json', 'aborted', 'outside-path'] as const) {
  it(`model adapter fails closed for ${mode}`, async () => {
    const fixture = await agentFixture(mode === 'invalid-json' ? mode : 'valid');
    const service = new FashionDesignService(new MemoryFashionDesignStore());
    const design = await service.create({
      userId: 'owner',
      threadId: 'thread-1',
      title: 'Jacket',
      sourceAssetIdsByView: { front: 'source-front' },
      assets: {
        'source-front': {
          id: 'source-front',
          urlPath: mode === 'outside-path' ? '/uploads/../secret.png' : '/uploads/source.png',
          mimeType: 'image/png',
          kind: 'source',
        },
      },
    });
    const controller = new AbortController();
    if (mode === 'aborted') controller.abort();
    await assert.rejects(
      fixture.provider.analyze({ design, signal: controller.signal }),
      mode === 'invalid-json'
        ? /fashion_model_invalid_json/
        : mode === 'outside-path'
          ? /invalid_image_path/
          : /aborted/,
    );
    assert.deepEqual((await service.get('owner', design.id)).versions, {});
    if (mode !== 'invalid-json') assert.equal(fixture.calls.length, 0);
  });
}

it('configured agent analysis parses the eight domains from owned staged images', async () => {
  const { provider } = await agentFixture();
  const service = new FashionDesignService(new MemoryFashionDesignStore());
  const design = await service.create({
    userId: 'owner',
    threadId: 'thread-1',
    title: 'Jacket',
    sourceAssetIdsByView: { front: 'source-front' },
    assets: {
      'source-front': { id: 'source-front', urlPath: '/uploads/source.png', mimeType: 'image/png', kind: 'source' },
    },
  });
  const domains = await provider.analyze({ design, signal: new AbortController().signal });
  assert.equal(Object.keys(domains).length, 8);
  const draft = await service.analyze('owner', design.id, domains);
  assert.equal(draft.status, 'draft');
});

it('real adapter composites generated pixels only inside the chosen mask and persists preview ownership', async () => {
  const { provider, uploadDir } = await agentFixture();
  const service = new FashionDesignService(new MemoryFashionDesignStore());
  const design = await service.create({
    userId: 'owner',
    threadId: 'thread-1',
    title: 'Jacket',
    sourceAssetIdsByView: { front: 'source-front' },
    assets: {
      'source-front': { id: 'source-front', urlPath: '/uploads/source.png', mimeType: 'image/png', kind: 'source' },
    },
  });
  const draft = await service.analyze('owner', design.id, garment());
  const base = await service.confirm('owner', design.id, {
    baseVersionId: draft.id,
    parts: Object.values(draft.domains).flatMap((d) =>
      d.components.map((p) => ({ partId: p.partId, partHash: p.partHash, evidenceOrigin: 'photo' as const })),
    ),
  });
  const proposal = await service.propose('owner', design.id, {
    baseVersionId: base.id,
    targetDomainId: 'pocket',
    targetPartIds: ['pocket'],
    instruction: 'Blue pocket',
    idempotencyKey: 'once',
  });
  let published = 0;
  const worker = new FashionPreviewWorker(service, provider, {
    onReady: async () => {
      published++;
    },
  });
  await worker.run('owner', design.id, proposal.id, proposal.operationId);
  const state = await service.get('owner', design.id);
  assert.equal(state.proposals[proposal.id].status, 'ready', JSON.stringify(state.proposals[proposal.id]));
  const candidate = state.versions[state.proposals[proposal.id].candidateVersionId!];
  const asset = state.design.assets![candidate.previewAssetId!];
  assert.equal(asset.kind, 'preview');
  assert.equal(
    state.validations[proposal.id].adoptionBlocked,
    false,
    'visual drift must describe the composed result, not discarded pixels from the raw generation',
  );
  const pixels = await sharp(await readFile(join(uploadDir, asset.urlPath.slice('/uploads/'.length))))
    .removeAlpha()
    .raw()
    .toBuffer();
  assert.deepEqual([...pixels.subarray(0, 3)], [255, 0, 0]);
  assert.deepEqual([...pixels.subarray((12 * 32 + 16) * 3, (12 * 32 + 16) * 3 + 3)], [0, 0, 255]);
  assert.equal(published, 1);
  await worker.run('owner', design.id, proposal.id, proposal.operationId);
  assert.equal(published, 2, 'ready work replays idempotent publication to recover post-CAS process loss');
});
