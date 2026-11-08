'use client';
import {
  type FashionDesignState,
  type GarmentComponentInput,
  GarmentComponentInputSchema,
  type GarmentComponentSnapshot,
  type GarmentView,
} from '@cat-cafe/shared';
import { useState } from 'react';
import { canConfirmPhoto, confirmationFor } from './atelier-model';

type Confirm = {
  partId: string;
  partHash: string;
  evidenceOrigin: 'photo' | 'user-specified';
  userStatement?: string;
  replacement?: GarmentComponentInput;
};

function editableInput(part: GarmentComponentSnapshot): GarmentComponentInput {
  return structuredClone({
    partId: part.partId,
    domainId: part.domainId,
    instanceType: part.instanceType,
    label: part.label,
    attributes: part.attributes,
    geometryByView: part.geometryByView,
    flatGeometryByView: part.flatGeometryByView,
    visibilityByView: part.visibilityByView,
    evidence: part.evidence,
  });
}

export function AtelierPartEditor({
  part,
  state,
  view,
  busy,
  onConfirm,
}: {
  part: GarmentComponentSnapshot;
  state: FashionDesignState;
  view: GarmentView;
  busy: boolean;
  onConfirm: (item: Confirm) => void;
}) {
  const [origin, setOrigin] = useState<'photo' | 'user-specified'>(canConfirmPhoto(part) ? 'photo' : 'user-specified');
  const [statement, setStatement] = useState('');
  const [draftHash, setDraftHash] = useState(part.partHash);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<GarmentComponentInput>(() => editableInput(part));
  const [geometryMode, setGeometryMode] = useState<'photo' | 'flat'>('flat');
  const [points, setPoints] = useState<Array<[number, number]>>([]);
  const [problem, setProblem] = useState('');
  const record = confirmationFor(state, part);
  const saveGeometry = () => {
    if (points.length < 3) {
      setProblem('请至少标记三个点。');
      return;
    }
    if (geometryMode === 'photo')
      setDraft({ ...draft, geometryByView: { ...draft.geometryByView, [view]: { polygon: points } } });
    else
      setDraft({
        ...draft,
        flatGeometryByView: {
          ...draft.flatGeometryByView,
          [view]: {
            paths: [
              {
                role: 'contour',
                commands: [
                  ['M', ...points[0]],
                  ...points.slice(1).map(([x, y]) => ['L', x, y] as ['L', number, number]),
                  ['Z'],
                ],
              },
            ],
          },
        },
      });
    setPoints([]);
    setProblem('');
  };
  const sourceId = state.design.sourceAssetIdsByView[view];
  const source = sourceId && state.design.assets?.[sourceId]?.urlPath;
  return (
    <section className="atelier-part" aria-label="设计点确认">
      {draftHash !== part.partHash && (
        <div className="atelier-warning">
          此设计点已经更新。
          <button
            type="button"
            onClick={() => {
              setDraft(editableInput(part));
              setDraftHash(part.partHash);
              setEditing(false);
              setPoints([]);
              setOrigin(canConfirmPhoto(part) ? 'photo' : 'user-specified');
            }}
          >
            载入当前设计点
          </button>
        </div>
      )}
      <h3>{part.label}</h3>
      <p className="atelier-muted">
        {part.visibilityByView[view] === 'visible'
          ? '照片可见'
          : part.visibilityByView[view] === 'partial'
            ? '部分可见'
            : '照片不可见'}{' '}
        · {record ? '已确认' : '待确认'}
      </p>
      {record?.evidenceOrigin === 'user-specified' && (
        <p className="atelier-warning">用户指定（照片不可见或设计师改款）</p>
      )}
      <dl>
        {Object.entries(part.attributes).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={() => setEditing(!editing)} aria-expanded={editing}>
        {editing ? '收起校正' : '校正描述与结构线'}
      </button>
      {editing && (
        <div className="atelier-correction">
          <label>
            部位名称
            <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </label>
          {Object.entries(draft.attributes).map(([key, value]) => (
            <label key={key}>
              {key}
              <input
                value={typeof value === 'string' ? value : JSON.stringify(value)}
                onChange={(e) => setDraft({ ...draft, attributes: { ...draft.attributes, [key]: e.target.value } })}
              />
            </label>
          ))}
          <label>
            校正画布
            <select
              value={geometryMode}
              onChange={(e) => {
                setGeometryMode(e.target.value as 'photo' | 'flat');
                setPoints([]);
              }}
            >
              <option value="flat">独立款式结构线</option>
              <option value="photo">照片热点 / 修改选区</option>
            </select>
          </label>
          <p className="atelier-muted">
            按顺序点选顶点，保存时闭合轮廓。结构线使用独立方形画板，照片选区只决定改款范围。重画会替换此部位当前视角的线条。
          </p>
          <svg
            viewBox="0 0 100 100"
            className="atelier-geometry"
            role="img"
            aria-label="结构校正画板"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setPoints([
                ...points,
                [
                  Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
                  Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
                ],
              ]);
            }}
          >
            <title>点击添加顶点；也可用下方坐标输入</title>
            {geometryMode === 'photo' && source && (
              <image href={source} width="100" height="100" preserveAspectRatio="none" />
            )}
            {geometryMode === 'flat' &&
              draft.flatGeometryByView?.[view]?.paths.map((p, i) => (
                <path
                  key={`path-${i}`}
                  d={p.commands.map(([c, ...v]) => `${c} ${v.map((n) => n * 100).join(' ')}`).join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth=".5"
                />
              ))}
            <polyline
              points={points.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}
              fill="none"
              stroke="var(--cafe-accent)"
            />
            {points.map(([x, y], i) => (
              <circle key={`point-${i}`} cx={x * 100} cy={y * 100} r="1" fill="var(--cafe-accent)" />
            ))}
          </svg>
          <div className="atelier-point-list">
            {points.map(([x, y], i) => (
              <div key={`point-${i}`}>
                <span>点 {i + 1}</span>
                {([x, y] as number[]).map((n, axis) => (
                  <input
                    key={axis}
                    type="number"
                    aria-label={`点${i + 1}${axis === 0 ? 'X' : 'Y'}`}
                    min="0"
                    max="1"
                    step=".01"
                    value={n}
                    onChange={(e) =>
                      setPoints(
                        points.map((p, j) =>
                          j === i
                            ? (p.map((v, k) => (k === axis ? Number(e.target.value) : v)) as [number, number])
                            : p,
                        ),
                      )
                    }
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="atelier-actions">
            <button type="button" onClick={() => setPoints([...points, [0.5, 0.5]])}>
              添加顶点
            </button>
            <button type="button" onClick={() => setPoints(points.slice(0, -1))}>
              撤销顶点
            </button>
            <button type="button" disabled={!points.length} onClick={saveGeometry}>
              保存此轮廓
            </button>
          </div>
        </div>
      )}
      <label>
        确认依据
        <select value={origin} onChange={(e) => setOrigin(e.target.value as 'photo' | 'user-specified')}>
          <option value="photo" disabled={!canConfirmPhoto(part)}>
            我已核对照片
          </option>
          <option value="user-specified">我指定这个设计</option>
        </select>
      </label>
      {origin === 'user-specified' && (
        <label>
          设计说明
          <textarea
            value={statement}
            maxLength={4000}
            placeholder="明确描述照片没有提供的结构，或你希望采用的改款"
            onChange={(e) => setStatement(e.target.value)}
          />
        </label>
      )}
      {problem && <p role="alert">{problem}</p>}
      <button
        type="button"
        className="atelier-primary"
        disabled={
          busy || draftHash !== part.partHash || (origin === 'user-specified' && !statement.trim()) || points.length > 0
        }
        onClick={() => {
          const parsed = GarmentComponentInputSchema.safeParse(draft);
          if (!parsed.success) {
            setProblem('校正内容无效，请检查坐标必须在 0–1 之间、轮廓不能重合。');
            return;
          }
          onConfirm({
            partId: part.partId,
            partHash: draftHash,
            evidenceOrigin: origin,
            ...(origin === 'user-specified' ? { userStatement: statement } : {}),
            ...(editing ? { replacement: parsed.data } : {}),
          });
        }}
      >
        {record ? '重新确认此设计点' : '确认此设计点'}
      </button>
    </section>
  );
}
