import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { MemoryFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import { garment } from './fixtures.js';

export async function flatFixture(service = new FashionDesignService(new MemoryFashionDesignStore())) {
  const design = await service.create({
    userId: 'owner',
    threadId: 'thread-1',
    title: 'Jacket',
    sourceAssetIdsByView: { front: 'source-front' },
  });
  const domains = garment();
  const pocket = domains.pocket.components[0];
  pocket.label = 'Pocket <script>alert("x")</script>';
  pocket.visibilityByView.front = 'not-visible';
  const draft = await service.analyze('owner', design.id, domains);
  const version = await service.confirm('owner', design.id, {
    baseVersionId: draft.id,
    parts: Object.values(draft.domains).flatMap((d) =>
      d.components.map((p) => ({
        partId: p.partId,
        partHash: p.partHash,
        ...(p.partId === 'pocket'
          ? { evidenceOrigin: 'user-specified' as const, userStatement: 'Add my pocket' }
          : { evidenceOrigin: 'photo' as const }),
      })),
    ),
  });
  const snapshot = await service.freeze('owner', design.id, version.id, 'front');
  return { service, design, version, snapshot };
}
