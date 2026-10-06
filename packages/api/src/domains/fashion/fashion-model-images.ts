import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import type { GeometryEvidence } from '@cat-cafe/shared';
import sharp from 'sharp';
import { FashionError } from './fashion-invariants.js';

const limits = { limitInputPixels: 25_000_000, failOn: 'warning' as const };
/** Only locally published, bounded images inside this invocation's storage root. */
export async function readFashionModelImage(uploadDir: string, url: string): Promise<Buffer> {
  if (!/^\/uploads\/[a-zA-Z0-9_.-]+$/.test(url)) throw new FashionError('invalid_image_path', 400);
  const root = await realpath(uploadDir);
  const path = await realpath(join(root, url.slice('/uploads/'.length)));
  const rel = relative(root, path);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new FashionError('invalid_image_path', 400);
  const info = await stat(path);
  if (!info.isFile() || info.size > 10 * 1024 * 1024) throw new FashionError('invalid_image_size', 400);
  const bytes = await readFile(path);
  const meta = await sharp(bytes, limits).metadata();
  if (!meta.width || !meta.height || (meta.pages && meta.pages !== 1)) throw new FashionError('unsupported_image', 400);
  return sharp(bytes, limits).rotate().png().toBuffer();
}

export async function compositeFashionEdit(base: Buffer, generated: Buffer, regions: GeometryEvidence[]) {
  const original = await sharp(base, limits).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = original.info;
  const dimensions = await sharp(generated, limits).metadata();
  if (
    !dimensions.width ||
    !dimensions.height ||
    Math.abs(dimensions.width / dimensions.height / (width / height) - 1) > 0.02
  )
    throw new FashionError('preview_aspect_ratio_mismatch', 422);
  const polygons = regions
    .map(
      ({ polygon }) =>
        `<polygon points="${polygon.map(([x, y]) => `${x * width},${y * height}`).join(' ')}" fill="white"/>`,
    )
    .join('');
  const mask = await sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${polygons}</svg>`),
  )
    .ensureAlpha()
    .raw()
    .toBuffer();
  if (!mask.some((value, index) => index % 4 === 3 && value > 0)) throw new FashionError('empty_edit_mask', 422);
  const edited = await sharp(generated, limits).resize(width, height).ensureAlpha().raw().toBuffer();
  // Explicit pixel copy guarantees every pixel with zero mask coverage stays byte-identical.
  for (let offset = 0; offset < original.data.length; offset += 4) {
    const alpha = mask[offset + 3] / 255;
    if (alpha === 0) continue;
    for (let channel = 0; channel < 4; channel++)
      original.data[offset + channel] = Math.round(
        original.data[offset + channel] * (1 - alpha) + edited[offset + channel] * alpha,
      );
  }
  return sharp(original.data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}
