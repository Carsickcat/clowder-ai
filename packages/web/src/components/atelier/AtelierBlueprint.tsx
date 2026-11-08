'use client';
import type { ConfirmedSnapshot, FashionDesignState, TechnicalFlatArtifact } from '@cat-cafe/shared';
import { useState } from 'react';
export function AtelierBlueprint({
  state,
  snapshot,
  artifact,
  busy,
  onRender,
  onFreeze,
  onSnapshot,
}: {
  state: FashionDesignState;
  snapshot?: ConfirmedSnapshot;
  artifact?: TechnicalFlatArtifact;
  busy: boolean;
  onRender: () => void;
  onFreeze: () => void;
  onSnapshot: (id: string) => void;
}) {
  const [selected, setSelected] = useState('');
  const [zoom, setZoom] = useState(1);
  if (!snapshot)
    return (
      <div className="atelier-no-photo">
        <h3>从确认开始，生成线稿</h3>
        <p>逐项核对设计点后，冻结一份独立快照。后续改款不会改写已经生成的图纸。</p>
        <button type="button" className="atelier-primary" disabled={busy} onClick={onFreeze}>
          冻结并生成款式线稿
        </button>
      </div>
    );
  const part = snapshot.parts.find((p) => p.partId === selected);
  return (
    <section className="atelier-blueprint">
      <label className="atelier-snapshot-picker">
        技术款式线稿 · 历史快照
        <select aria-label="历史图纸快照" value={snapshot.id} onChange={(e) => onSnapshot(e.target.value)}>
          {Object.values(state.snapshots)
            .filter((s) => s.view === snapshot.view)
            .sort((a, b) => b.frozenAt - a.frozenAt)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.frozenAt).toLocaleString()} · {s.snapshotHash.slice(0, 8)}
              </option>
            ))}
        </select>
      </label>
      <div className="atelier-canvas-bar">
        <span title={snapshot.snapshotHash}>
          快照 {snapshot.id.slice(0, 8)} · #{snapshot.snapshotHash.slice(0, 8)}
        </span>
        <button type="button" onClick={() => setZoom(zoom === 1 ? 2 : 1)}>
          {zoom === 1 ? '放大图纸' : '适应画布'}
        </button>
      </div>
      {snapshot.versionId !== state.design.activeVersionId && (
        <div className="atelier-warning">
          此图纸冻结后，胚样已有新版本。
          <button type="button" disabled={busy} onClick={onFreeze}>
            冻结新快照
          </button>
        </div>
      )}
      <div className="atelier-drawing-scroll">
        <svg style={{ width: `${zoom * 100}%` }} viewBox="0 0 1000 1000" aria-label="可追溯款式线稿">
          <title>点击结构线查看确认依据</title>
          {snapshot.parts.map((p) => (
            <g
              key={p.partId}
              data-part-id={p.partId}
              role="button"
              tabIndex={0}
              aria-label={`溯源 ${p.label ?? p.partId}`}
              onClick={() => setSelected(p.partId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSelected(p.partId);
              }}
              stroke={selected === p.partId ? 'var(--cafe-accent)' : 'currentColor'}
              fill="none"
              strokeWidth="2"
              pointerEvents="bounding-box"
            >
              <title>{`${p.partId} · ${p.partHash.slice(0, 8)} · ${p.sourceVersionId} · ${p.evidenceOrigin}`}</title>
              {p.flatGeometry?.paths.map((path, i) => (
                <path
                  key={i}
                  d={path.commands.map(([c, ...v]) => `${c} ${v.map((n) => n * 1000).join(' ')}`).join(' ')}
                  strokeDasharray={path.role === 'seam' ? '6 4' : undefined}
                />
              ))}
            </g>
          ))}
        </svg>
      </div>
      {part && (
        <dl className="atelier-provenance">
          <div>
            <dt>部位</dt>
            <dd>
              {part.label ?? part.partId} · {part.partId}
            </dd>
          </div>
          <div>
            <dt>结构哈希</dt>
            <dd>{part.partHash}</dd>
          </div>
          <div>
            <dt>确认版本</dt>
            <dd>{part.sourceVersionId}</dd>
          </div>
          <div>
            <dt>依据</dt>
            <dd>{part.evidenceOrigin === 'photo' ? '照片核对' : '用户指定（照片不可见或设计师改款）'}</dd>
          </div>
        </dl>
      )}
      <p className="atelier-muted">
        {snapshot.parts.length} 个确认部位 · {snapshot.omittedUnknownPartIds.length}{' '}
        个未知部位未绘制。结构参考图，不含生产尺寸或纸样。
      </p>
      <div className="atelier-actions">
        {artifact ? (
          <>
            {(['svgAssetId', 'pngAssetId'] as const).map((key) => (
              <a key={key} className="atelier-button" download href={state.design.assets?.[artifact[key]]?.urlPath}>
                下载 {key === 'svgAssetId' ? 'SVG' : 'PNG'}
              </a>
            ))}
          </>
        ) : (
          <button type="button" disabled={busy} onClick={onRender}>
            生成导出文件
          </button>
        )}
      </div>
    </section>
  );
}
