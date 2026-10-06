import assert from 'node:assert/strict';
import { it } from 'node:test';
import Fastify from 'fastify';
import { MessageStore } from '../../src/domains/cats/services/stores/ports/MessageStore.js';
import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { MemoryFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import { createFashionPipeline } from '../../src/domains/fashion/fashion-pipeline.js';
import { fashionDesignRoutes } from '../../src/routes/fashion-designs.js';
import { agentFixture } from './agent-fixture.js';
import { garment } from './fixtures.js';

for (const mode of ['publication-failure', 'ownership-change', 'text-image'] as const) {
  it(`preview ${mode} cannot publish a stale or duplicate artifact`, async (t) => {
    const fixture = await agentFixture(mode === 'text-image' ? mode : 'valid');
    const service = new FashionDesignService(new MemoryFashionDesignStore());
    const messages = new MessageStore();
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
    let appends = 0;
    let ownershipChecks = 0;
    const pipeline = createFashionPipeline({
      service,
      uploadDir: fixture.uploadDir,
      resolveAgent: fixture.resolveAgent,
      threadStore: {
        get: () => ({ createdBy: mode === 'ownership-change' && ++ownershipChecks > 1 ? 'changed' : 'owner' }),
      },
      messageStore: {
        appendIdempotent: (input) => {
          if (++appends === 1 && mode === 'publication-failure') throw new Error('storage temporarily unavailable');
          return messages.appendIdempotent(input);
        },
      },
    });
    await pipeline.previewWorker.run('owner', design.id, proposal.id, proposal.operationId);
    const state = await service.get('owner', design.id);
    assert.equal(state.proposals[proposal.id].status, mode === 'publication-failure' ? 'ready' : 'failed');
    const key = `fashion-preview:${design.id}:${proposal.id}`;
    assert.equal(messages.getByIdempotencyKey('owner', 'thread-1', key), null);
    if (mode === 'publication-failure') {
      const app = Fastify();
      await app.register(fashionDesignRoutes, {
        service,
        uploadDir: fixture.uploadDir,
        threadStore: { get: () => ({ createdBy: 'owner' }) },
        ...pipeline,
      });
      t.after(() => app.close());
      const poll = await app.inject({
        method: 'GET',
        url: `/api/fashion-designs/${design.id}/edit-proposals/${proposal.id}`,
        headers: { 'x-cat-cafe-user': 'owner' },
      });
      assert.equal(poll.statusCode, 200);
      await pipeline.previewWorker.whenIdle();
      const message = messages.getByIdempotencyKey('owner', 'thread-1', key);
      assert.ok(message);
      await pipeline.previewWorker.run('owner', design.id, proposal.id, proposal.operationId);
      assert.equal(messages.getByIdempotencyKey('owner', 'thread-1', key)?.id, message.id);
      assert.equal(fixture.calls.length, 2, 'publication recovery never calls generation or visual validation again');
    } else {
      assert.equal(appends, 0);
      assert.equal(Object.keys(state.versions).length, 2);
    }
  });
}
