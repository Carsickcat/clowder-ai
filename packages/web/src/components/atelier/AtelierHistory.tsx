'use client';
import type { FashionDesignState } from '@cat-cafe/shared';
import { useState } from 'react';
export function AtelierHistory({
  state,
  proposalId,
  busy,
  onProposal,
  onRestore,
}: {
  state: FashionDesignState;
  proposalId: string;
  busy: boolean;
  onProposal: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  const versions = Object.values(state.versions)
    .filter((v) => v.status === 'adopted')
    .sort((a, b) => b.createdAt - a.createdAt);
  return (
    <aside className="atelier-history" aria-label="版本记录">
      <h2>版本记录</h2>
      <p className="atelier-muted">生成成功后，仍需你选择采用。</p>
      {Object.values(state.proposals)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((p, i) => (
          <button
            type="button"
            key={p.id}
            className={`atelier-version ${proposalId === p.id ? 'active' : ''}`}
            onClick={() => onProposal(p.id)}
          >
            <span>
              候选 {Object.keys(state.proposals).length - i} ·{' '}
              {
                {
                  queued: '排队中',
                  generating: '生成中',
                  ready: '待选择',
                  failed: '失败',
                  accepted: '已采用',
                  rejected: '已放弃',
                }[p.status]
              }
            </span>
            <small>{p.instruction ?? '参考图改款'}</small>
            {state.validations[p.id]?.adoptionBlocked && <strong>锁定部位有漂移</strong>}
          </button>
        ))}
      <h3>采用历史</h3>
      {(all ? versions : versions.slice(0, 5)).map((v, i) => (
        <div className="atelier-version" key={v.id}>
          <span>
            {v.id === state.design.activeVersionId ? '当前采用' : `历史版本 ${versions.length - i}`} ·{' '}
            {v.id.slice(0, 6)}
          </span>
          <small>{new Date(v.createdAt).toLocaleString()}</small>
          {v.id !== state.design.activeVersionId && (
            <button type="button" disabled={busy} onClick={() => onRestore(v.id)}>
              恢复此版本
            </button>
          )}
        </div>
      ))}
      {versions.length > 5 && (
        <button type="button" onClick={() => setAll(!all)}>
          {all ? '收起历史' : `查看全部 ${versions.length} 版`}
        </button>
      )}
      <p className="atelier-muted">恢复会建立新版本；旧图纸和版本始终保留。</p>
    </aside>
  );
}
