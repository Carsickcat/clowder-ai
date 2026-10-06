import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GARMENT_DOMAIN_IDS } from '../../../shared/src/fashion/index.js';
import * as serviceModule from '../../src/domains/fashion/FashionDesignService.js';
import * as storeModule from '../../src/domains/fashion/FashionDesignStore.js';
import { garment } from './fixtures.js';

async function setup(confirmed = true) {
  assert.ok(serviceModule, 'FashionDesignService must implement the version lifecycle');
  assert.ok(storeModule, 'FashionDesignStore must persist the lifecycle');
  const store = new storeModule.MemoryFashionDesignStore();
  const service = new serviceModule.FashionDesignService(store);
  const design = await service.create({
    userId: 'owner',
    threadId: 'thread-1',
    title: 'Jacket',
    sourceAssetIdsByView: { front: 'source-front' },
  });
  const draft = await service.analyze('owner', design.id, garment());
  let version = draft;
  if (confirmed)
    version = await service.confirm('owner', design.id, {
      baseVersionId: draft.id,
      parts: GARMENT_DOMAIN_IDS.map((partId) => ({
        partId,
        partHash: draft.domains[partId].components[0].partHash,
        evidenceOrigin: 'photo' as const,
      })),
    });
  return { store, service, design, version, draft };
}

async function preview(h: Awaited<ReturnType<typeof setup>>, drift: string[] = []) {
  const proposal = await h.service.propose('owner', h.design.id, {
    baseVersionId: h.version.id,
    targetDomainId: 'sleeve',
    targetPartIds: ['sleeve'],
    instruction: 'Long sleeves',
    idempotencyKey: 'edit-one',
  });
  const changed = structuredClone(garment().sleeve.components);
  changed[0].attributes.style = 'long';
  await h.service.completePreview('owner', h.design.id, proposal.id, proposal.operationId, {
    components: changed,
    previewAssetId: 'preview-1',
    affectedPartIds: ['sleeve', ...drift],
    protectedDriftPartIds: drift,
  });
  return proposal;
}

describe('F317 immutable garment lifecycle', () => {
  it('cannot relabel an adopted generated part as original photographic evidence', async () => {
    const h = await setup();
    const proposal = await preview(h);
    const adopted = await h.service.decide('owner', h.design.id, proposal.id, h.version.id, 'accept');
    await assert.rejects(
      h.service.confirm('owner', h.design.id, {
        baseVersionId: adopted.id,
        parts: [{ partId: 'sleeve', partHash: adopted.domains.sleeve.components[0].partHash, evidenceOrigin: 'photo' }],
      }),
      { code: 'new_photo_required' },
    );
  });

  it('analysis never auto-confirms and reads are isolated from caller mutation', async () => {
    const h = await setup(false);
    const state = await h.service.get('owner', h.design.id);
    assert.equal(state.design.activeVersionId, null);
    assert.equal(Object.keys(state.confirmations).length, 0);
    state.versions[h.draft.id].domains.sleeve.components[0].attributes.style = 'tampered';
    assert.equal(
      (await h.service.get('owner', h.design.id)).versions[h.draft.id].domains.sleeve.components[0].attributes.style,
      'original',
    );
    await assert.rejects(h.service.get('intruder', h.design.id), { code: 'not_found' });
  });

  it('confirmation creates a new adopted version and binds each record to its version and hash', async () => {
    const h = await setup();
    const state = await h.service.get('owner', h.design.id);
    assert.equal(state.design.activeVersionId, h.version.id);
    assert.deepEqual(state.versions[h.draft.id], h.draft);
    for (const part of Object.values(h.version.domains).flatMap((d) => d.components)) {
      const record = state.confirmations[part.confirmationId!];
      assert.equal(record.versionId, h.version.id);
      assert.equal(record.partHash, part.partHash);
      assert.equal(record.partId, part.partId);
    }
  });

  it('preview remains a candidate; adoption only confirms changed target parts', async () => {
    const h = await setup();
    const proposal = await preview(h);
    const before = await h.service.get('owner', h.design.id);
    assert.equal(before.design.activeVersionId, h.version.id);
    assert.equal(proposal.protectedComponentIds.length, 7);
    const adopted = await h.service.decide('owner', h.design.id, proposal.id, h.version.id, 'accept');
    assert.notEqual(adopted.id, before.proposals[proposal.id].candidateVersionId);
    assert.notEqual(
      adopted.domains.sleeve.components[0].confirmationId,
      h.version.domains.sleeve.components[0].confirmationId,
    );
    assert.deepEqual(adopted.domains.pocket, h.version.domains.pocket);
    const state = await h.service.get('owner', h.design.id);
    assert.deepEqual(state.versions[h.version.id], h.version);
    assert.equal(state.versions[before.proposals[proposal.id].candidateVersionId!].status, 'candidate');
  });

  it('blocks protected drift on the server including affected protected parts', async () => {
    const h = await setup();
    const proposal = await preview(h, ['pocket']);
    await assert.rejects(h.service.decide('owner', h.design.id, proposal.id, h.version.id, 'accept'), {
      code: 'protected_drift',
    });
    assert.equal((await h.service.get('owner', h.design.id)).design.activeVersionId, h.version.id);
  });

  it('allows only one winner for concurrent decisions on the same base', async () => {
    const h = await setup();
    const proposal = await preview(h);
    const results = await Promise.allSettled([
      h.service.decide('owner', h.design.id, proposal.id, h.version.id, 'accept'),
      h.service.restore('owner', h.design.id, h.version.id, h.version.id),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const rejected = results.find((r) => r.status === 'rejected');
    assert.equal(rejected?.status === 'rejected' && rejected.reason.code, 'stale_version');
  });

  it('deduplicates retry and rejects idempotency keys reused for different intent', async () => {
    const h = await setup();
    const input = {
      baseVersionId: h.version.id,
      targetDomainId: 'sleeve' as const,
      targetPartIds: ['sleeve'],
      instruction: 'Long sleeves',
      idempotencyKey: 'retry-key',
    };
    const [a, b] = await Promise.all([
      h.service.propose('owner', h.design.id, input),
      h.service.propose('owner', h.design.id, input),
    ]);
    assert.equal(a.id, b.id);
    await assert.rejects(h.service.propose('owner', h.design.id, { ...input, instruction: 'Short sleeves' }), {
      code: 'idempotency_conflict',
    });
    await h.service.failPreview('owner', h.design.id, a.id, a.operationId, 'provider unavailable');
    const retry = await h.service.retry('owner', h.design.id, a.id, h.version.id);
    assert.equal(retry.id, a.id);
    assert.notEqual(retry.operationId, a.operationId);
    assert.equal(retry.idempotencyKey, a.idempotencyKey);
    await h.service.completePreview('owner', h.design.id, a.id, a.operationId, {
      components: garment().sleeve.components,
      previewAssetId: 'late',
      affectedPartIds: [],
      protectedDriftPartIds: [],
    });
    assert.equal((await h.service.get('owner', h.design.id)).proposals[a.id].status, 'queued');
  });

  it('late completion cannot replace the active version and stale adoption fails', async () => {
    const h = await setup();
    const p = await h.service.propose('owner', h.design.id, {
      baseVersionId: h.version.id,
      targetDomainId: 'sleeve',
      targetPartIds: ['sleeve'],
      instruction: 'long',
      idempotencyKey: 'late-key',
    });
    const restored = await h.service.restore('owner', h.design.id, h.version.id, h.version.id);
    await h.service.completePreview('owner', h.design.id, p.id, p.operationId, {
      components: garment().sleeve.components,
      previewAssetId: 'late',
      affectedPartIds: [],
      protectedDriftPartIds: [],
    });
    assert.equal((await h.service.get('owner', h.design.id)).design.activeVersionId, restored.id);
    await assert.rejects(h.service.decide('owner', h.design.id, p.id, h.version.id, 'accept'), {
      code: 'stale_version',
    });
  });

  it('freezes a snapshot that survives adoption and restore unchanged', async () => {
    const h = await setup();
    const snapshot = await h.service.freeze('owner', h.design.id, h.version.id, 'front');
    const proposal = await preview(h);
    const adopted = await h.service.decide('owner', h.design.id, proposal.id, h.version.id, 'accept');
    const restored = await h.service.restore('owner', h.design.id, adopted.id, h.version.id);
    assert.notEqual(restored.id, h.version.id);
    assert.equal(restored.restoredFromVersionId, h.version.id);
    const state = await h.service.get('owner', h.design.id);
    assert.deepEqual(state.snapshots[snapshot.id], snapshot);
    assert.deepEqual(state.versions[adopted.id], adopted);
    assert.equal(snapshot.parts.length, 8);
    await assert.rejects(h.service.freeze('owner', h.design.id, restored.id, 'back'), {
      code: 'missing_view_evidence',
    });
  });

  it('refuses an unconfirmed snapshot and never upgrades visibility from user statements', async () => {
    const h = await setup(false);
    await assert.rejects(h.service.freeze('owner', h.design.id, h.draft.id, 'front'), { code: 'unconfirmed_parts' });
    const version = await h.service.confirm('owner', h.design.id, {
      baseVersionId: h.draft.id,
      parts: [
        {
          partId: 'fabric',
          partHash: h.draft.domains.fabric.components[0].partHash,
          evidenceOrigin: 'user-specified',
          userStatement: 'Designer specifies wool; not identified from the photo',
        },
      ],
    });
    assert.equal(version.domains.fabric.components[0].visibilityByView.back, 'not-visible');
    const state = await h.service.get('owner', h.design.id);
    assert.equal(
      state.confirmations[version.domains.fabric.components[0].confirmationId!].evidenceOrigin,
      'user-specified',
    );
  });
});
