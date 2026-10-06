import assert from 'node:assert/strict';
import { it } from 'node:test';
import sharp from 'sharp';
import { compositeFashionEdit } from '../../src/domains/fashion/fashion-model-images.js';

it('empty mask and incompatible aspect ratio are rejected instead of publishing an unchanged/cropped preview', async () => {
  const base = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
  const wide = await sharp({ create: { width: 32, height: 16, channels: 3, background: 'blue' } })
    .png()
    .toBuffer();
  await assert.rejects(compositeFashionEdit(base, base, []), /empty_edit_mask/);
  await assert.rejects(
    compositeFashionEdit(base, wide, [
      {
        polygon: [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
      },
    ]),
    /preview_aspect_ratio_mismatch/,
  );
});
