import assert from 'node:assert/strict';
import { it } from 'node:test';
import { canonicalJson, fashionHash } from '../../src/domains/fashion/fashion-invariants.js';

it('hashes absent optional object properties like the persisted JSON representation', () => {
  assert.equal(
    fashionHash({ instruction: 'long sleeves', referenceAssetId: undefined }),
    fashionHash({ instruction: 'long sleeves' }),
  );
  assert.equal(canonicalJson({ z: 1, a: { omitted: undefined, b: 2 } }), '{"a":{"b":2},"z":1}');
  assert.throws(() => canonicalJson([undefined]), { code: 'non_json_value' });
  assert.throws(() => canonicalJson(Number.NaN), { code: 'non_json_value' });
});
