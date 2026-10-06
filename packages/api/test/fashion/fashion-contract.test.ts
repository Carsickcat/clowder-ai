import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as contract from '../../../shared/src/fashion/index.js';

describe('F317 garment input contract', () => {
  it('defines exactly the eight agreed editing domains', () => {
    assert.deepEqual(contract?.GARMENT_DOMAIN_IDS, [
      'silhouette',
      'collar',
      'sleeve',
      'body-panel',
      'closure',
      'pocket',
      'hem',
      'fabric',
    ]);
  });

  it('rejects a ninth domain and missing domains', () => {
    assert.ok(contract, 'F317 public runtime schema must exist');
    const domains = Object.fromEntries(contract.GARMENT_DOMAIN_IDS.map((id) => [id, { domainId: id, components: [] }]));
    assert.equal(contract.GarmentDomainsSchema.safeParse(domains).success, true);
    assert.equal(contract.GarmentDomainsSchema.safeParse({ ...domains, back: { components: [] } }).success, false);
    const { pocket: _pocket, ...missing } = domains;
    assert.equal(contract.GarmentDomainsSchema.safeParse(missing).success, false);
  });

  it('rejects invalid coordinates, duplicate part identities and a cross-domain instance type', () => {
    assert.ok(contract, 'F317 public runtime schema must exist');
    const part = {
      partId: 'pocket-left',
      domainId: 'pocket',
      instanceType: 'pocket',
      label: 'Left pocket',
      attributes: {},
      geometryByView: {
        front: {
          polygon: [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
        },
      },
      visibilityByView: { front: 'visible' },
      evidence: [{ origin: 'photo', view: 'front', assetId: 'photo-1' }],
    };
    assert.equal(contract.GarmentComponentInputSchema.safeParse(part).success, true);
    assert.equal(contract.GarmentComponentInputSchema.safeParse({ ...part, instanceType: 'hood' }).success, false);
    assert.equal(
      contract.GarmentComponentInputSchema.safeParse({
        ...part,
        geometryByView: {
          front: {
            polygon: [
              [0, 0],
              [2, 0],
              [0, 1],
            ],
          },
        },
      }).success,
      false,
    );
    const domains = Object.fromEntries(
      contract.GARMENT_DOMAIN_IDS.map((id) => [
        id,
        {
          domainId: id,
          components: id === 'pocket' ? [part, part] : [],
        },
      ]),
    );
    assert.equal(contract.GarmentDomainsSchema.safeParse(domains).success, false);
  });
});
