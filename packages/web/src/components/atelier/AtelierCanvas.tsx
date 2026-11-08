'use client';
import type { FashionDesignState, GarmentVersion, GarmentView } from '@cat-cafe/shared';
import { useState } from 'react';
import { allParts, imageFor, VIEW_LABELS } from './atelier-model';
export function AtelierCanvas({
  state,
  version,
  candidate,
  view,
  selected,
  onSelect,
}: {
  state: FashionDesignState;
  version?: GarmentVersion;
  candidate?: GarmentVersion;
  view: GarmentView;
  selected: string[];
  onSelect: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(1);
  const [split, setSplit] = useState(50);
  const source = imageFor(state, version, view);
  const preview = candidate && imageFor(state, candidate, view);
  if (!source)
    return (
      <div className="atelier-no-photo">
        <h3>还没有{VIEW_LABELS[view]}照片</h3>
        <p>这个视角保持未知，不会根据正面推测。新建含此视角照片的设计后可继续分析。</p>
      </div>
    );
  return (
    <section className="atelier-canvas" aria-label="服装画布">
      <div className="atelier-canvas-bar">
        <span>
          {preview ? '当前采用 / 候选对比' : '当前胚样'} · {VIEW_LABELS[view]}
        </span>
        <div>
          <button type="button" aria-label="缩小照片" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>
            −
          </button>
          <button type="button" onClick={() => setZoom(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" aria-label="放大照片" onClick={() => setZoom(Math.min(3, zoom + 0.25))}>
            ＋
          </button>
        </div>
      </div>
      <div className="atelier-photo-scroll">
        <div className="atelier-photo" style={{ width: `min(${zoom * 100}%, ${zoom * 52 * aspect}vh)` }}>
          {/* Source and overlay share the image's actual box: object-fit letterboxing never shifts hotspots. */}
          <img
            src={source}
            alt={`当前款式${VIEW_LABELS[view]}`}
            draggable={false}
            onLoad={(e) => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
          />
          {preview && (
            <img
              className="atelier-overlay"
              src={preview}
              alt="生成候选（尚未采用）"
              style={{ clipPath: `inset(0 0 0 ${split}%)` }}
            />
          )}
          <svg className="atelier-hotspots" viewBox="0 0 1 1" preserveAspectRatio="none">
            <title>可选择的设计点</title>
            {allParts(version)
              .filter((p) => p.geometryByView[view])
              .sort((a, b) => {
                const area = (points: number[][]) =>
                  Math.abs(
                    points.reduce((sum, p, i) => {
                      const next = points[(i + 1) % points.length];
                      return sum + p[0] * next[1] - next[0] * p[1];
                    }, 0),
                  );
                return area(b.geometryByView[view]!.polygon) - area(a.geometryByView[view]!.polygon);
              })
              .map((p) => (
                <polygon
                  key={p.partId}
                  points={p.geometryByView[view]!.polygon.map((v) => v.join(',')).join(' ')}
                  className={selected.includes(p.partId) ? 'selected' : ''}
                  role="button"
                  tabIndex={0}
                  aria-label={`选择${p.label}`}
                  onClick={() => onSelect(p.partId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(p.partId);
                    }
                  }}
                >
                  <title>{p.label}</title>
                </polygon>
              ))}
          </svg>
        </div>
      </div>
      {preview && (
        <>
          <label className="atelier-compare">
            拖动比较
            <input
              aria-label="候选对比位置"
              type="range"
              min="0"
              max="100"
              value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
            />
          </label>
          <div className="atelier-mobile-compare">
            <img src={preview} alt="候选图（上下对比）" />
          </div>
        </>
      )}
      <p className="atelier-muted">点击热点或左侧清单选择具体部位。放大后可滚动画布查看细节。</p>
    </section>
  );
}
