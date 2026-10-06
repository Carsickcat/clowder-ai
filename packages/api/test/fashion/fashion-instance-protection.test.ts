import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FashionDesignService } from '../../src/domains/fashion/FashionDesignService.js';
import { MemoryFashionDesignStore } from '../../src/domains/fashion/FashionDesignStore.js';
import { garment } from './fixtures.js';

async function setup(domainId: 'pocket' | 'body-panel' = 'pocket', selectBoth = false) {
  const store = new MemoryFashionDesignStore();
  const service = new FashionDesignService(store);
  const design = await service.create({
    userId: 'owner',
    threadId: 'instances',
    title: 'Two-instance jacket',
    sourceAssetIdsByView: { front: 'source-front' },
  });
  const input = garment();
  const left = input[domainId].components[0];
  const right = { ...structuredClone(left), partId: `${domainId}-right`, label: 'Right instance' };
  input[domainId].components.push(right);
  const draft = await service.analyze('owner', design.id, input);
  const version = await service.confirm('owner', design.id, {
    baseVersionId: draft.id,
    parts: Object.values(draft.domains).flatMap((domain) =>
      domain.components.map((part) => ({
        partId: part.partId,
        partHash: part.partHash,
        evidenceOrigin: 'photo' as const,
      })),
    ),
  });
  const proposal = await service.propose('owner', design.id, {
    baseVersionId: version.id,
    targetDomainId: domainId,
    targetPartIds: selectBoth ? [left.partId, right.partId] : [left.partId],
    instruction: 'Change the selected instances only',
    idempotencyKey: 'selected-instances',
  });
  return { service, design, version, proposal, components: input[domainId].components, rightId: right.partId };
}

async function complete(h: Awaited<ReturnType<typeof setup>>, affectedPartIds: string[] = []) {
  await h.service.completePreview('owner', h.design.id, h.proposal.id, h.proposal.operationId, {
    components: h.components,
    previewAssetId: 'candidate-image',
    affectedPartIds,
    protectedDriftPartIds: [],
  });
}

describe('F317 explicit instance protection', () => {
  it('protects the unselected sibling as well as every other domain', async () => {
    const h = await setup();
    const expected = Object.values(h.version.domains)
      .flatMap((domain) => domain.components.map((part) => part.partId))
      .filter((id) => id !== 'pocket');
    assert.deepEqual(h.proposal.protectedComponentIds.sort(), expected.sort());
  });

  for (const domainId of ['pocket', 'body-panel'] as const) {
    for (const change of ['modify', 'delete', 'add'] as const) {
      it(`${domainId}: rejects an unselected ${change} even when the provider reports no drift or affected parts`, async () => {
        const h = await setup(domainId);
        const unselectedId = change === 'add' ? `${domainId}-extra` : h.rightId;
        if (change === 'modify') h.components[1].attributes.style = 'changed-unselected-instance';
        if (change === 'delete') h.components.splice(1, 1);
        if (change === 'add') h.components.push({ ...structuredClone(h.components[1]), partId: unselectedId });
        await complete(h);
        const before = await h.service.get('owner', h.design.id);
        await assert.rejects(h.service.decide('owner', h.design.id, h.proposal.id, h.version.id, 'accept'), {
          code: 'protected_drift',
          statusCode: 409,
          partIds: [unselectedId],
        });
        const validation = before.validations[h.proposal.id];
        assert.deepEqual(validation.affectedPartIds, [unselectedId]);
        assert.deepEqual(validation.protectedDriftPartIds, [unselectedId]);
        assert.equal(validation.adoptionBlocked, true);
        assert.deepEqual(await h.service.get('owner', h.design.id), before, 'rejection must not commit any state');
        const discarded = await h.service.decide('owner', h.design.id, h.proposal.id, h.version.id, 'reject');
        assert.equal(discarded.status, 'discarded');
        assert.equal((await h.service.get('owner', h.design.id)).design.activeVersionId, h.version.id);
      });
    }
  }

  it('adopts a selected left pocket change while preserving the right pocket and its confirmation', async () => {
    const h = await setup();
    h.components[0].attributes.style = 'selected-change';
    await complete(h);
    const adopted = await h.service.decide('owner', h.design.id, h.proposal.id, h.version.id, 'accept');
    assert.equal(adopted.domains.pocket.components[0].attributes.style, 'selected-change');
    assert.notEqual(
      adopted.domains.pocket.components[0].confirmationId,
      h.version.domains.pocket.components[0].confirmationId,
    );
    assert.deepEqual(adopted.domains.pocket.components[1], h.version.domains.pocket.components[1]);
    const snapshot = await h.service.freeze('owner', h.design.id, adopted.id, 'front');
    assert.equal(snapshot.parts.length, 9);
  });

  it('allows both pockets to change when both instances were explicitly selected', async () => {
    const h = await setup('pocket', true);
    for (const component of h.components) component.attributes.style = 'both-selected';
    await complete(h);
    const adopted = await h.service.decide('owner', h.design.id, h.proposal.id, h.version.id, 'accept');
    for (const [index, part] of adopted.domains.pocket.components.entries()) {
      assert.equal(part.attributes.style, 'both-selected');
      assert.notEqual(part.confirmationId, h.version.domains.pocket.components[index].confirmationId);
    }
  });

  it('also blocks provider-reported visual changes to an unselected sibling with unchanged structure', async () => {
    const h = await setup();
    await complete(h, [h.rightId]);
    await assert.rejects(h.service.decide('owner', h.design.id, h.proposal.id, h.version.id, 'accept'), {
      code: 'protected_drift',
      statusCode: 409,
      partIds: [h.rightId],
    });
  });

  it('rechecks a stored candidate at adoption even if an older validation receipt missed the sibling drift', async () => {
    const h = await setup();
    h.components[1].attributes.style = 'changed-unselected-instance';
    await complete(h);
    // Emulate a persisted ready candidate produced by the pre-fix implementation.
    const persisted = await h.service.get('owner', h.design.id);
    persisted.validations[h.proposal.id] = {
      proposalId: h.proposal.id,
      affectedPartIds: [],
      protectedDriftPartIds: [],
      adoptionBlocked: false,
    };
    const recoveredStore = new MemoryFashionDesignStore();
    await recoveredStore.create(persisted);
    const recovered = new FashionDesignService(recoveredStore);
    await assert.rejects(recovered.decide('owner', h.design.id, h.proposal.id, h.version.id, 'accept'), {
      code: 'protected_drift',
      statusCode: 409,
      partIds: [h.rightId],
    });
    assert.deepEqual(await recovered.get('owner', h.design.id), persisted);
  });
});
