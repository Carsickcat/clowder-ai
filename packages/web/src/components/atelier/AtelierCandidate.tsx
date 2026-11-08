import type { EditProposal, GarmentComponentSnapshot, PreviewValidation } from '@cat-cafe/shared';
import { displayError } from './atelier-model';
export function AtelierCandidate({
  proposal,
  validation,
  parts,
  busy,
  now,
  onDecision,
  onRetry,
}: {
  proposal: EditProposal;
  validation?: PreviewValidation;
  parts: GarmentComponentSnapshot[];
  busy: boolean;
  now: number;
  onDecision: (decision: 'accept' | 'reject') => void;
  onRetry: () => void;
}) {
  const expired = proposal.status === 'generating' && proposal.workerLease && proposal.workerLease.expiresAt <= now;
  return (
    <section className="atelier-candidate" aria-label="候选决策">
      <strong>
        {
          {
            queued: '预览排队中',
            generating: '正在生成预览',
            ready: '候选预览已就绪',
            failed: '预览生成失败',
            accepted: '已采用这个候选',
            rejected: '已放弃这个候选',
          }[proposal.status]
        }
      </strong>
      {['queued', 'generating'].includes(proposal.status) && (
        <p role="status">已用时 {Math.max(0, Math.floor((now - proposal.createdAt) / 1000))} 秒 · 刷新后仍可继续查看</p>
      )}
      {expired && <p role="status">上次生成已中断，可重新领取任务。</p>}
      {validation?.adoptionBlocked && (
        <p role="alert" className="atelier-warning">
          锁定部位有变化：
          {validation.protectedDriftPartIds.map((id) => parts.find((p) => p.partId === id)?.label ?? id).join('、')}
          。此候选不能采用。
        </p>
      )}
      {proposal.status === 'failed' && <p>{displayError(proposal.failure ?? 'preview_generation_failed')}</p>}
      <div className="atelier-actions">
        {proposal.status === 'ready' && (
          <>
            <button
              type="button"
              className="atelier-primary"
              disabled={busy || validation?.adoptionBlocked || !validation}
              onClick={() => onDecision('accept')}
            >
              采用此候选
            </button>
            <button type="button" disabled={busy} onClick={() => onDecision('reject')}>
              放弃候选
            </button>
          </>
        )}
        {(proposal.status === 'failed' || proposal.status === 'queued' || expired) && (
          <button type="button" disabled={busy} onClick={onRetry}>
            重试预览
          </button>
        )}
      </div>
    </section>
  );
}
