import { link, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FashionDesignState, FashionImageAsset, RichFileBlock, TechnicalFlatArtifact } from '@cat-cafe/shared';
import sharp from 'sharp';
import { publishGeneratedImage } from '../cats/services/agents/providers/generated-image-publication.js';
import type { IMessageStore } from '../cats/services/stores/ports/MessageStore.js';
import type { FashionDesignService } from './FashionDesignService.js';
import { FLAT_RENDERER_VERSION, renderTechnicalFlat } from './fashion-flat-renderer.js';
import { FashionError, fashionHash } from './fashion-invariants.js';

export class FashionTechnicalFlatService {
  constructor(
    private readonly options: {
      service: FashionDesignService;
      uploadDir: string;
      authorize: (userId: string, designId: string) => Promise<FashionDesignState>;
      messageStore: Pick<IMessageStore, 'appendIdempotent'>;
    },
  ) {}

  async generate(userId: string, designId: string, confirmedSnapshotId: string): Promise<TechnicalFlatArtifact> {
    let state = await this.options.authorize(userId, designId);
    const snapshot = state.snapshots[confirmedSnapshotId];
    if (!snapshot) throw new FashionError('snapshot_not_found', 404);
    const id = `flat-${fashionHash({ confirmedSnapshotId, snapshotHash: snapshot.snapshotHash, renderer: FLAT_RENDERER_VERSION })}`;
    let artifact = state.technicalFlats?.[id];
    if (!artifact) {
      const svg = Buffer.from(renderTechnicalFlat(snapshot));
      const png = await sharp(svg, { limitInputPixels: 10_000_000 }).png().toBuffer();
      // Private staging is on the same filesystem for atomic SVG linking. No uploaded SVG is accepted.
      const staging = join(this.options.uploadDir, '.fashion-render');
      await mkdir(staging, { recursive: true });
      const temporary = await mkdtemp(join(staging, 'flat-'));
      await writeFile(join(temporary, 'drawing.svg'), svg);
      await writeFile(join(temporary, 'drawing.png'), png);
      await this.options.authorize(userId, designId);
      const image = await publishGeneratedImage({
        sourcePath: join(temporary, 'drawing.png'),
        mimeType: 'image/png',
        publicationKey: id,
        provider: 'skill',
        toolName: 'fashion_snapshot_svg',
        uploadDir: this.options.uploadDir,
        title: '技术款式线稿',
        alt: `冻结快照 ${snapshot.id} · ${snapshot.snapshotHash}`,
      });
      const svgName = `${id}.svg`;
      try {
        await link(join(temporary, 'drawing.svg'), join(this.options.uploadDir, svgName));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if (!(await readFile(join(this.options.uploadDir, svgName))).equals(svg))
          throw new FashionError('flat_asset_conflict');
      }
      // Temporary source paths differ between contenders; retain only stable publication provenance.
      const { originalPath: _originalPath, ...stableProvenance } = image.provenance;
      const provenance = {
        ...stableProvenance,
        confirmedSnapshotId: snapshot.id,
        snapshotHash: snapshot.snapshotHash,
        rendererVersion: FLAT_RENDERER_VERSION,
      };
      const svgAsset: FashionImageAsset = {
        id: `${id}-svg`,
        kind: 'technical-flat',
        mimeType: 'image/svg+xml',
        urlPath: `/uploads/${svgName}`,
      };
      const pngAsset: FashionImageAsset = {
        id: `${id}-png`,
        kind: 'technical-flat',
        mimeType: 'image/png',
        urlPath: image.urlPath,
      };
      const file: RichFileBlock = {
        id: `${id}-svg`,
        kind: 'file',
        v: 1,
        url: svgAsset.urlPath,
        fileName: `technical-flat-${snapshot.view}-${snapshot.id}.svg`,
        mimeType: 'image/svg+xml',
        fileSize: svg.length,
      };
      artifact = {
        id,
        designId,
        confirmedSnapshotId,
        snapshotHash: snapshot.snapshotHash,
        svgAssetId: svgAsset.id,
        pngAssetId: pngAsset.id,
        includedPartIds: snapshot.parts.map((p) => p.partId),
        rendererVersion: FLAT_RENDERER_VERSION,
        createdAt: Date.now(),
        publication: {
          blocks: [
            Object.assign(file, {
              provenance: {
                ...provenance,
                publishedPath: svgAsset.urlPath,
              },
            }),
            Object.assign(image.richBlock, { provenance }),
          ],
        },
      };
      await this.options.authorize(userId, designId);
      artifact = await this.options.service.recordTechnicalFlat(userId, designId, artifact, [svgAsset, pngAsset]);
    }
    state = await this.options.authorize(userId, designId);
    await this.options.messageStore.appendIdempotent({
      userId,
      threadId: state.design.threadId,
      catId: null,
      content: `已从确认快照生成「${state.design.title}」技术款式线稿。快照 ${artifact.confirmedSnapshotId} · ${artifact.snapshotHash}`,
      mentions: [],
      timestamp: artifact.createdAt,
      idempotencyKey: `fashion-flat:${artifact.id}`,
      extra: { rich: { v: 1, blocks: artifact.publication.blocks } },
    });
    return artifact;
  }
}
