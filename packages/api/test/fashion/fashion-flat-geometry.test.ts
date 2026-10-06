import assert from 'node:assert/strict';
import { it } from 'node:test';
import { GarmentComponentInputSchema } from '../../../shared/src/fashion/index.js';
import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { MemoryFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import { hashPart } from '../../src/domains/fashion/fashion-invariants.js';
import { garment } from './fixtures.js';

export const pocketLines = {
  paths: [
    {
      role: 'contour',
      commands: [['M', 0.2, 0.3], ['L', 0.4, 0.3], ['Q', 0.4, 0.5, 0.3, 0.5], ['L', 0.2, 0.3], ['Z']],
    },
  ],
};

it('structural drawing coordinates are validated separately from photo selection geometry and hashed', () => {
  const original = garment().pocket.components[0];
  const part = GarmentComponentInputSchema.parse({ ...original, flatGeometryByView: { front: pocketLines } });
  assert.notEqual(hashPart(original), hashPart(part));
  const changed = structuredClone(part);
  changed.flatGeometryByView!.front!.paths[0].commands[1] = ['L', 0.5, 0.3];
  assert.notEqual(hashPart(part), hashPart(changed));
  for (const paths of [
    [{ role: 'contour', commands: [] }],
    [
      {
        role: 'contour',
        commands: [
          ['M', 0.2, 0.2],
          ['L', 0.2, 0.2],
        ],
      },
    ],
    [{ role: 'contour', commands: [['L', 0.1, 0.2], ['Z']] }],
    [
      {
        role: 'contour',
        commands: [
          ['M', 0.1, 0.2],
          ['L', 2, 0.4],
        ],
      },
    ],
    [{ role: 'contour', commands: [['M', 0.1, 0.2], ['Z'], ['L', 0.3, 0.4]] }],
    [
      {
        role: 'contour',
        d: '<script/>',
        commands: [
          ['M', 0.1, 0.2],
          ['L', 0.3, 0.4],
        ],
      },
    ],
  ])
    assert.equal(
      GarmentComponentInputSchema.safeParse({ ...original, flatGeometryByView: { front: { paths } } }).success,
      false,
    );
});

it('legacy photo polygons cannot silently become formal line drawings', async () => {
  const service = new FashionDesignService(new MemoryFashionDesignStore());
  const design = await service.create({
    userId: 'owner',
    threadId: 'thread-1',
    title: 'Jacket',
    sourceAssetIdsByView: { front: 'source-front' },
  });
  const domains = garment();
  for (const domain of Object.values(domains)) for (const part of domain.components) delete part.flatGeometryByView;
  const draft = await service.analyze('owner', design.id, domains);
  const version = await service.confirm('owner', design.id, {
    baseVersionId: draft.id,
    parts: Object.values(draft.domains).flatMap((d) =>
      d.components.map((p) => ({ partId: p.partId, partHash: p.partHash, evidenceOrigin: 'photo' as const })),
    ),
  });
  await assert.rejects(service.freeze('owner', design.id, version.id, 'front'), { code: 'flat_geometry_required' });
  assert.deepEqual((await service.get('owner', design.id)).snapshots, {});
});
