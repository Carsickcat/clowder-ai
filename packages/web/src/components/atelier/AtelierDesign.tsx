'use client';
import {
  type ConfirmedSnapshot,
  type FashionImageAsset,
  GARMENT_DOMAIN_IDS,
  GARMENT_VIEWS,
  type GarmentDomainId,
  type GarmentView,
} from '@cat-cafe/shared';
import { useEffect, useState } from 'react';
import { AtelierBlueprint } from './AtelierBlueprint';
import { AtelierCandidate } from './AtelierCandidate';
import { AtelierCanvas } from './AtelierCanvas';
import { AtelierHistory } from './AtelierHistory';
import { AtelierPartEditor } from './AtelierPartEditor';
import { allParts, confirmationFor, currentVersion, DOMAIN_LABELS, displayError, VIEW_LABELS } from './atelier-model';
import { useAtelierDesign } from './useAtelierDesign';
export function AtelierDesign({ id }: { id: string }) {
  const { state, error, busy, post, refresh, clearError } = useAtelierDesign(id);
  const [domain, setDomain] = useState<GarmentDomainId>('silhouette');
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState<GarmentView>('front');
  const [mode, setMode] = useState<'photo' | 'flat'>('photo');
  const [instruction, setInstruction] = useState('');
  const [reference, setReference] = useState('');
  const [proposalId, setProposalId] = useState('');
  const [snapshotId, setSnapshotId] = useState('');
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!state)
    return (
      <div className="atelier-empty" role={error ? 'alert' : 'status'}>
        {error ? displayError(error.code) : '正在读取款式…'}
      </div>
    );
  const version = currentVersion(state);
  const parts = allParts(version);
  const part = parts.find((p) => p.partId === selected[0]);
  const proposal =
    state.proposals[proposalId] ?? Object.values(state.proposals).sort((a, b) => b.createdAt - a.createdAt)[0];
  const validation = proposal && state.validations[proposal.id];
  const candidate = proposal?.candidateVersionId ? state.versions[proposal.candidateVersionId] : undefined;
  const snapshot =
    state.snapshots[snapshotId] ??
    Object.values(state.snapshots)
      .filter((s) => s.view === view)
      .sort((a, b) => b.frozenAt - a.frozenAt)[0];
  const artifact = Object.values(state.technicalFlats ?? {}).find((a) => a.confirmedSnapshotId === snapshot?.id);
  const baseVersionId = version?.id;
  const render = (confirmedSnapshotId: string) => post('technical-flats', { confirmedSnapshotId });
  const freeze = async () => {
    if (!baseVersionId) return;
    const result = await post<{ snapshot: ConfirmedSnapshot }>('confirmed-snapshots', { baseVersionId, view });
    if (result) {
      setSnapshotId(result.snapshot.id);
      setMode('flat');
      await render(result.snapshot.id);
    }
  };
  const selectPart = (partId: string) => {
    const p = parts.find((p) => p.partId === partId);
    if (p) {
      setDomain(p.domainId);
      setSelected([partId]);
    }
  };
  const analysis = state.analysis;
  const generating = analysis?.status === 'generating' && analysis.expiresAt > Date.now();
  const generate = async () => {
    const result = await post<{ proposalId: string }>('edit-proposals', {
      baseVersionId,
      targetDomainId: domain,
      targetPartIds: selected,
      ...(instruction.trim() ? { instruction } : {}),
      ...(reference ? { referenceAssetId: reference } : {}),
      idempotencyKey: crypto.randomUUID(),
    });
    if (result) {
      setProposalId(result.proposalId);
      setMode('photo');
      setView('front');
    }
  };
  return (
    <>
      {error && (
        <div className="atelier-error" role="alert">
          <span>
            {displayError(error.code)}{' '}
            {error.partIds.map((id) => parts.find((p) => p.partId === id)?.label ?? id).join('、')}
          </span>
          {error.status === 409 && (
            <div className="atelier-actions">
              <button
                type="button"
                onClick={() => {
                  void refresh().then(clearError);
                }}
              >
                读取新版，保留输入
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('photo');
                  clearError();
                }}
              >
                返回对比
              </button>
              <button
                type="button"
                onClick={() => {
                  setInstruction('');
                  setReference('');
                  clearError();
                }}
              >
                放弃本次输入
              </button>
            </div>
          )}
        </div>
      )}
      {!version ? (
        <div className="atelier-empty">
          <h2>{state.design.title}</h2>
          <p>
            {generating
              ? `正在识别设计点 · 已用时 ${Math.max(0, Math.floor((elapsed - analysis.createdAt) / 1000))} 秒`
              : '照片已保存，开始拆解这件衣服的设计点。'}
          </p>
          {analysis?.failure && <p role="alert">{displayError(analysis.failure)}</p>}
          <button
            type="button"
            className="atelier-primary"
            disabled={busy || generating}
            onClick={() => void post('analysis?async=true', {})}
          >
            {generating ? '分析中，可安全刷新页面' : analysis ? '重新分析' : '分析设计点'}
          </button>
        </div>
      ) : (
        <>
          <div className="atelier-toolbar">
            <div className="atelier-tabs" role="tablist" aria-label="工作模式">
              {(['photo', 'flat'] as const).map((m) => (
                <button type="button" key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
                  {m === 'photo' ? '胚样' : '图纸'}
                </button>
              ))}
            </div>
            <div className="atelier-tabs" role="tablist" aria-label="视角">
              {GARMENT_VIEWS.map((v) => (
                <button
                  type="button"
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => {
                    setView(v);
                    setSnapshotId('');
                  }}
                >
                  {VIEW_LABELS[v]}
                  {!state.design.sourceAssetIdsByView[v] ? ' · 缺照片' : ''}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy || !state.design.sourceAssetIdsByView[view]}
              onClick={() => void freeze()}
            >
              冻结并生成款式线稿
            </button>
          </div>
          <div className="atelier-body">
            <aside className="atelier-domains" aria-label="设计点清单">
              <h2>
                设计点{' '}
                <small>
                  {parts.filter((p) => confirmationFor(state, p)).length}/{parts.length} 已确认
                </small>
              </h2>
              <div className="atelier-domain-list">
                {GARMENT_DOMAIN_IDS.map((d) => (
                  <section key={d}>
                    <button
                      type="button"
                      className={domain === d ? 'active' : ''}
                      onClick={() => {
                        setDomain(d);
                        setSelected([]);
                      }}
                    >
                      {DOMAIN_LABELS[d]}
                      <small>{version.domains[d].components.length}</small>
                    </button>
                    {domain === d &&
                      version.domains[d].components.map((p) => (
                        <label key={p.partId} className="atelier-instance">
                          <input
                            type="checkbox"
                            checked={selected.includes(p.partId)}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked ? [...selected, p.partId] : selected.filter((id) => id !== p.partId),
                              )
                            }
                          />
                          <span>
                            {p.label}
                            <small>
                              {confirmationFor(state, p) ? '已确认' : '待确认'} ·{' '}
                              {p.visibilityByView[view] === 'visible' ? '可见' : '可见性待核对'}
                            </small>
                          </span>
                        </label>
                      ))}
                  </section>
                ))}
              </div>
              {part && (
                <AtelierPartEditor
                  key={`${part.partId}:${view}`}
                  part={part}
                  state={state}
                  view={view}
                  busy={busy}
                  onConfirm={(item) => void post('confirmations', { baseVersionId, parts: [item] })}
                />
              )}
            </aside>
            <div className="atelier-center">
              {mode === 'flat' ? (
                <AtelierBlueprint
                  state={state}
                  snapshot={snapshot}
                  onSnapshot={setSnapshotId}
                  artifact={artifact}
                  busy={busy || !state.design.sourceAssetIdsByView[view]}
                  onFreeze={() => void freeze()}
                  onRender={() => {
                    if (snapshot) void render(snapshot.id);
                  }}
                />
              ) : (
                <>
                  <AtelierCanvas
                    state={state}
                    version={version}
                    candidate={proposal?.status === 'ready' ? candidate : undefined}
                    view={view}
                    selected={selected}
                    onSelect={selectPart}
                  />
                  {proposal && (
                    <AtelierCandidate
                      proposal={proposal}
                      validation={validation}
                      parts={parts}
                      busy={busy}
                      now={elapsed}
                      onDecision={(decision) =>
                        void post(`edit-proposals/${proposal.id}/decision`, {
                          baseVersionId: proposal.baseVersionId,
                          decision,
                        })
                      }
                      onRetry={() => void post(`edit-proposals/${proposal.id}/retry`, { baseVersionId })}
                    />
                  )}
                  <section className="atelier-composer">
                    <label>
                      只改选中的设计点{' '}
                      <strong>
                        {selected.map((id) => parts.find((p) => p.partId === id)?.label).join('、') ||
                          '请先选择具体部位'}
                      </strong>
                      <textarea
                        value={instruction}
                        maxLength={4000}
                        placeholder="例如：把左侧贴袋改成带袋盖的方形口袋，保留其他结构"
                        onChange={(e) => setInstruction(e.target.value)}
                      />
                    </label>
                    <div className="atelier-actions">
                      <label className="atelier-button">
                        {reference ? '已附参考图 · 更换' : '添加参考图'}
                        <input
                          aria-label="改款参考图"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          disabled={busy}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const form = new FormData();
                            form.set('reference', file);
                            const r = await post<{ asset: FashionImageAsset }>('reference-images', form);
                            if (r) setReference(r.asset.id);
                          }}
                        />
                      </label>
                      {reference && (
                        <button type="button" onClick={() => setReference('')}>
                          移除参考图
                        </button>
                      )}
                      <button
                        type="button"
                        className="atelier-primary"
                        disabled={busy || !selected.length || (!instruction.trim() && !reference) || view !== 'front'}
                        onClick={() => void generate()}
                      >
                        生成局部预览
                      </button>
                    </div>
                    <p className="atelier-muted">
                      V1 局部预览使用正面照片。未选择的所有部位都受保护；生成完成不会自动采用。
                    </p>
                  </section>
                </>
              )}
            </div>
            <AtelierHistory
              state={state}
              proposalId={proposal?.id ?? ''}
              busy={busy}
              onProposal={(id) => {
                setProposalId(id);
                setMode('photo');
              }}
              onRestore={(sourceVersionId) => void post('restore', { baseVersionId, sourceVersionId })}
            />
          </div>
        </>
      )}
    </>
  );
}
