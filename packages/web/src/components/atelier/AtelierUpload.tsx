'use client';
import { type FashionDesign, GARMENT_VIEWS } from '@cat-cafe/shared';
import { useState } from 'react';
import { AtelierError, atelierRequest } from './atelier-api';
import { displayError, VIEW_LABELS } from './atelier-model';
export function AtelierUpload({ threadId, onCreated }: { threadId: string; onCreated: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className="atelier-upload"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = new FormData(e.currentTarget);
        form.set('threadId', threadId);
        for (const view of GARMENT_VIEWS) if (!(form.get(view) as File)?.size) form.delete(view);
        setBusy(true);
        setError('');
        try {
          const { design } = await atelierRequest<{ design: FashionDesign }>('fashion-designs', form);
          onCreated(design.id);
        } catch (e) {
          setError(displayError(e instanceof AtelierError ? e.code : 'connection_failed'));
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="atelier-kicker">ATELIER / 从一张衣服照片开始</span>
      <h2>把灵感，变成可确认的设计。</h2>
      <p>上传服装照片，拆解设计点，逐点改款。你确认的结构将成为款式线稿的依据。</p>
      <label>
        款式名称
        <input name="title" required maxLength={200} placeholder="例如：秋日短款夹克" />
      </label>
      <div className="atelier-upload-grid">
        {GARMENT_VIEWS.map((view) => (
          <label key={view}>
            {VIEW_LABELS[view]}
            {view === 'front' ? ' · 必填' : ' · 可选'}
            <input
              aria-label={`${VIEW_LABELS[view]}照片`}
              name={view}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              required={view === 'front'}
            />
          </label>
        ))}
      </div>
      <p className="atelier-muted">看不见的部位会保留为待确认。未上传背面照片时，不生成正式背面线稿。</p>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="atelier-primary" disabled={!threadId || busy}>
        {busy ? '正在保存照片…' : '上传并创建设计'}
      </button>
    </form>
  );
}
