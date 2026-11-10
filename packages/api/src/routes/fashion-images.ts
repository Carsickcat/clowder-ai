import { randomUUID } from 'node:crypto';
import { type FashionImageAsset, GARMENT_VIEWS } from '@cat-cafe/shared';
import type { FastifyRequest } from 'fastify';
import sharp from 'sharp';
import { FashionError } from '../domains/fashion/fashion-invariants.js';
import { MAX_IMAGE_FILE_SIZE, saveImageBufferToUploadDir } from '../utils/image-storage.js';

export interface FashionImageUpload {
  field: string;
  buffer: Buffer;
  mimeType: string;
}

const modelImageLimits = { limitInputPixels: 25_000_000, failOn: 'warning' as const };
const expectedSharpFormats: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Fashion analysis always decodes its source images with Sharp. Validate that
 * contract before persisting an upload so a signature-shaped corrupt file is a
 * recoverable 400, never an asynchronous analysis 500.
 */
async function assertDecodableFashionImage(buffer: Buffer, mimeType: string): Promise<void> {
  try {
    const metadata = await sharp(buffer, modelImageLimits).metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      (metadata.pages && metadata.pages !== 1) ||
      metadata.format !== expectedSharpFormats[mimeType]
    )
      throw new Error('unsupported fashion image');
    // Sharp metadata is lazily read: a PNG can expose dimensions yet fail once
    // libspng reaches its image data. Force the same decode/normalization the
    // model staging path uses before accepting the upload.
    await sharp(buffer, modelImageLimits).rotate().png().toBuffer();
  } catch {
    throw new FashionError('invalid_image_content', 400);
  }
}

function matchesSignature(buffer: Buffer, mime: string) {
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/jpeg') return buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (mime === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (mime === 'image/webp')
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}
export async function readFashionImages(request: FastifyRequest, kind: 'source' | 'reference') {
  if (!request.isMultipart()) throw new FashionError('multipart_required', 400);
  const fields: Record<string, string> = {};
  const images: FashionImageUpload[] = [];
  const names = new Set<string>();
  for await (const part of request.parts({
    limits: { files: kind === 'source' ? 4 : 1, fields: 2, parts: 6, fileSize: MAX_IMAGE_FILE_SIZE, fieldSize: 512 },
  })) {
    if (names.has(part.fieldname)) throw new FashionError('duplicate_upload_field', 400);
    names.add(part.fieldname);
    if (part.type === 'field') {
      if (
        kind !== 'source' ||
        !['threadId', 'title'].includes(part.fieldname) ||
        typeof part.value !== 'string' ||
        part.valueTruncated
      )
        throw new FashionError('invalid_upload_field', 400);
      fields[part.fieldname] = part.value;
    } else {
      if (
        !(kind === 'source'
          ? GARMENT_VIEWS.includes(part.fieldname as (typeof GARMENT_VIEWS)[number])
          : part.fieldname === 'reference')
      )
        throw new FashionError('invalid_image_view', 400);
      const buffer = await part.toBuffer();
      if (part.file.truncated || buffer.byteLength > MAX_IMAGE_FILE_SIZE)
        throw new FashionError('image_too_large', 413);
      if (!matchesSignature(buffer, part.mimetype)) throw new FashionError('invalid_image_signature', 400);
      await assertDecodableFashionImage(buffer, part.mimetype);
      images.push({ field: part.fieldname, buffer, mimeType: part.mimetype });
    }
  }
  if (!images.length) throw new FashionError('source_image_required', 400);
  return { fields, images };
}
export async function saveFashionImage(
  image: FashionImageUpload,
  uploadDir: string,
  kind: FashionImageAsset['kind'],
): Promise<FashionImageAsset> {
  const id = randomUUID();
  const saved = await saveImageBufferToUploadDir({
    buffer: image.buffer,
    mimeType: image.mimeType,
    uploadDir,
    filenameStem: `fashion-${id}`,
    onExists: 'error',
  });
  return { id, urlPath: saved.urlPath, mimeType: image.mimeType, kind };
}
