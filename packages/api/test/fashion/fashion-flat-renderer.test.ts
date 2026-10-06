import assert from 'node:assert/strict';
import { it } from 'node:test';
import { load } from 'cheerio';
import sharp from 'sharp';
import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { MemoryFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import * as renderer from '../../src/domains/fashion/fashion-flat-renderer.js';
import { fashionHash } from '../../src/domains/fashion/fashion-invariants.js';
import { garment } from './fixtures.js';
import { flatFixture } from './flat-fixture.js';

it('SVG has one traceable group per frozen part, escaped metadata and permanent specified-source legend', async () => {
  const { snapshot } = await flatFixture();
  const svg = renderer.renderTechnicalFlat(snapshot);
  const $ = load(svg, { xml: true });
  assert.equal($('g[data-component-id]').length, snapshot.parts.length);
  for (const part of snapshot.parts) {
    const group = $(`g[data-component-id="${part.partId}"]`);
    assert.equal(group.attr('data-part-hash'), part.partHash);
    assert.equal(group.attr('data-source-version-id'), part.sourceVersionId);
    assert.equal(group.attr('data-evidence-origin'), part.evidenceOrigin);
    assert.equal(group.find('path').length, part.flatGeometry!.paths.length);
  }
  assert.equal($('script,image,foreignObject,use').length, 0);
  assert.match($('text').text(), /用户指定（照片不可见）/);
  assert.match($('title').text(), /Pocket <script>/);
  assert.equal(JSON.parse($('metadata').text()).snapshotHash, snapshot.snapshotHash);
  assert.equal($('[data-component-id="fabric"] path').length, 0);
  assert.ok($('path').first().attr('d')!.startsWith('M 200 200 L 800 200'));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  assert.equal((await sharp(png).metadata()).width, 1000);
});

it('later corrections and restored versions cannot change old drawing bytes', async () => {
  const { service, design, version, snapshot } = await flatFixture();
  const before = renderer.renderTechnicalFlat(snapshot);
  const {
    partHash,
    confirmationId: _confirmationId,
    ...replacement
  } = structuredClone(version.domains.sleeve.components[0]);
  replacement.flatGeometryByView!.front!.paths[0].commands[1] = ['L', 0.95, 0.4];
  const corrected = await service.confirm('owner', design.id, {
    baseVersionId: version.id,
    parts: [{ partId: replacement.partId, partHash, evidenceOrigin: 'photo', replacement }],
  });
  const newSnapshot = await service.freeze('owner', design.id, corrected.id, 'front');
  assert.notEqual(newSnapshot.snapshotHash, snapshot.snapshotHash);
  assert.notEqual(renderer.renderTechnicalFlat(newSnapshot), before);
  await service.restore('owner', design.id, corrected.id, version.id);
  const state = await service.get('owner', design.id);
  assert.equal(renderer.renderTechnicalFlat(state.snapshots[snapshot.id]), before);
  const corrupted = structuredClone(snapshot);
  corrupted.parts[0].flatGeometry!.paths = [];
  assert.throws(() => renderer.renderTechnicalFlat(corrupted), { code: 'snapshot_hash_mismatch' });
  const legacy = structuredClone(snapshot);
  for (const part of legacy.parts) delete part.flatGeometry;
  const { id: _id, snapshotHash: _hash, frozenAt: _date, ...payload } = legacy;
  legacy.snapshotHash = fashionHash(payload);
  assert.throws(() => renderer.renderTechnicalFlat(legacy), { code: 'flat_geometry_required' });
});

it('unknown unconfirmed parts are omitted, never drawn as placeholder paths', async () => {
  const service = new FashionDesignService(new MemoryFashionDesignStore());
  const design = await service.create({
    userId: 'owner',
    threadId: 'thread-1',
    title: 'Jacket',
    sourceAssetIdsByView: { front: 'source-front' },
  });
  const domains = garment();
  const hidden = structuredClone(domains.pocket.components[0]);
  hidden.partId = 'hidden-pocket';
  hidden.visibilityByView.front = 'not-visible';
  delete hidden.flatGeometryByView;
  domains.pocket.components.push(hidden);
  const draft = await service.analyze('owner', design.id, domains);
  const version = await service.confirm('owner', design.id, {
    baseVersionId: draft.id,
    parts: Object.values(draft.domains).flatMap((d) =>
      d.components
        .filter((p) => p.partId !== hidden.partId)
        .map((p) => ({ partId: p.partId, partHash: p.partHash, evidenceOrigin: 'photo' as const })),
    ),
  });
  const snapshot = await service.freeze('owner', design.id, version.id, 'front');
  const $ = load(renderer.renderTechnicalFlat(snapshot), { xml: true });
  assert.deepEqual(snapshot.omittedUnknownPartIds, ['hidden-pocket']);
  assert.equal($('[data-component-id="hidden-pocket"]').length, 0);
  assert.equal($('[data-component-id]').length, 8);
});
