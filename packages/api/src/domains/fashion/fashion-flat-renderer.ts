import { type ConfirmedSnapshot, FlatGeometrySchema } from '@cat-cafe/shared';
import { canonicalJson, FashionError, fashionHash } from './fashion-invariants.js';

export const FLAT_RENDERER_VERSION = '1';
const escapeXml = (value: string) =>
  value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
const coordinate = (value: number) => String(Math.round(value * 1_000_000) / 1000);

/** Pure projection of an immutable snapshot. No image, prompt, model or current-version lookup. */
export function renderTechnicalFlat(snapshot: ConfirmedSnapshot): string {
  const { id, snapshotHash, frozenAt, ...payload } = snapshot;
  if (fashionHash(payload) !== snapshotHash) throw new FashionError('snapshot_hash_mismatch');
  if (
    !snapshot.parts.length ||
    snapshot.parts.length > 256 ||
    new Set(snapshot.parts.map((p) => p.partId)).size !== snapshot.parts.length
  )
    throw new FashionError('invalid_flat_snapshot', 400);
  const specified = snapshot.parts.filter((p) => p.evidenceOrigin === 'user-specified');
  const height = 1160 + specified.length * 22;
  let commands = 0;
  const groups = snapshot.parts
    .map((part) => {
      if (!part.flatGeometry || (part.domainId !== 'fabric' && !part.flatGeometry.paths.length))
        throw new FashionError('flat_geometry_required', 409, [part.partId]);
      const geometry = FlatGeometrySchema.parse(part.flatGeometry);
      const paths = geometry.paths
        .map((path) => {
          commands += path.commands.length;
          if (commands > 32768) throw new FashionError('flat_capacity_exceeded', 413);
          const d = path.commands.map(([op, ...points]) => [op, ...points.map(coordinate)].join(' ')).join(' ');
          const width = path.role === 'contour' ? 2 : 1;
          return `<path data-role="${path.role}" d="${d}" stroke-width="${width}"${path.role === 'seam' ? ' stroke-dasharray="5 3"' : ''}/>`;
        })
        .join('');
      return `<g data-component-id="${escapeXml(part.partId)}" data-part-hash="${escapeXml(part.partHash)}" data-source-version-id="${escapeXml(part.sourceVersionId)}" data-confirmation-id="${escapeXml(part.confirmationId)}" data-evidence-origin="${part.evidenceOrigin}"><title>${escapeXml(part.label ?? part.partId)} · ${part.evidenceOrigin === 'user-specified' ? '用户指定（照片不可见）' : '照片证据'}</title>${paths}</g>`;
    })
    .join('\n');
  const metadata = { rendererVersion: FLAT_RENDERER_VERSION, snapshotId: id, snapshotHash, frozenAt, ...payload };
  const viewNames = { front: '正面', back: '背面', 'left-side': '左侧', 'right-side': '右侧' };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}" data-snapshot-id="${escapeXml(id)}" data-snapshot-hash="${snapshotHash}" data-renderer-version="${FLAT_RENDERER_VERSION}">
<title>技术款式线稿 · ${viewNames[snapshot.view]}</title>
<metadata>${escapeXml(canonicalJson(metadata))}</metadata>
<rect width="1000" height="${height}" fill="white"/>
<g fill="black" font-family="sans-serif"><text x="24" y="32" font-size="20">技术款式线稿 · ${viewNames[snapshot.view]}</text><text x="24" y="54" font-size="12">快照 ${escapeXml(id)} · ${snapshotHash.slice(0, 16)}</text></g>
<g transform="translate(24 80) scale(0.952)" fill="none" stroke="black" stroke-linejoin="round" stroke-linecap="round">${groups}</g>
<g fill="black" font-family="sans-serif" font-size="13"><text x="24" y="1080">来源：冻结确认快照 · 非生产纸样 · 未显示部位：${snapshot.omittedUnknownPartIds.length}</text>
${specified.map((part, i) => `<text x="24" y="${1110 + i * 22}">${escapeXml(part.partId)} — 用户指定（照片不可见）</text>`).join('\n')}
</g></svg>`;
}
