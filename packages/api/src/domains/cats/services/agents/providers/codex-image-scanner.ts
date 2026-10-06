import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, join } from 'node:path';
import { createModuleLogger } from '../../../../../infrastructure/logger.js';
import { ALLOWED_IMAGE_MIMES, type SupportedImageMime } from '../../../../../utils/image-storage.js';
import { type PublishedGeneratedImage, publishGeneratedImage } from './generated-image-publication.js';

const log = createModuleLogger('codex-image-scanner');

const EXT_TO_MIME: Record<string, SupportedImageMime> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/** Match the native process's effective environment, including Windows and account isolation. */
export function resolveCodexImageHome(
  env: Record<string, string | null | undefined>,
  platform: NodeJS.Platform = process.platform,
  osHome = homedir(),
) {
  if (env.CODEX_HOME) return env.CODEX_HOME;
  const home = platform === 'win32' ? env.USERPROFILE || env.HOME : env.HOME;
  return join(home || osHome, '.codex');
}

export interface CodexImageScanOptions {
  codexSessionId: string;
  uploadDir?: string;
  codexHome?: string;
}

export async function scanAndPublishCodexImages(options: CodexImageScanOptions): Promise<PublishedGeneratedImage[]> {
  const codexHome = options.codexHome ?? resolveCodexImageHome(process.env);
  const sessionDir = join(codexHome, 'generated_images', options.codexSessionId);

  let entries: string[];
  try {
    entries = await readdir(sessionDir);
  } catch {
    return [];
  }

  const imageFiles = entries.filter((name) => {
    const ext = extname(name).toLowerCase();
    return ext in EXT_TO_MIME;
  });

  if (imageFiles.length === 0) return [];

  const results: PublishedGeneratedImage[] = [];
  for (const filename of imageFiles) {
    const ext = extname(filename).toLowerCase();
    const mime = EXT_TO_MIME[ext];
    if (!mime || !ALLOWED_IMAGE_MIMES.has(mime)) continue;

    try {
      const published = await publishGeneratedImage({
        sourcePath: join(sessionDir, filename),
        mimeType: mime,
        publicationKey: `codex-${options.codexSessionId}-${filename}`,
        provider: 'codex',
        toolName: 'image_gen',
        uploadDir: options.uploadDir,
        title: 'codex:image_gen',
        alt: 'generated image',
      });
      if (published.isNew) results.push(published);
    } catch (err) {
      log.warn({ filename, sessionDir, err }, 'Failed to publish codex generated image');
    }
  }

  return results;
}
