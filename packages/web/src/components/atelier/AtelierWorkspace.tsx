'use client';
import type { FashionDesign } from '@cat-cafe/shared';
import { useEffect, useState } from 'react';
import { AtelierDesign } from './AtelierDesign';
import { AtelierUpload } from './AtelierUpload';
import { AtelierError, atelierRequest } from './atelier-api';
import { displayError } from './atelier-model';
import './atelier.css';
export function AtelierWorkspace({
  initialThreadId,
  initialDesignId,
}: {
  initialThreadId: string;
  initialDesignId: string;
}) {
  const [threadId, setThreadId] = useState(initialThreadId);
  const [designId, setDesignId] = useState(initialDesignId);
  const [threads, setThreads] = useState<Array<{ id: string; title?: string }>>([]);
  const [designs, setDesigns] = useState<FashionDesign[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    void atelierRequest<{ threads: Array<{ id: string; title?: string }> }>('threads')
      .then((result) => {
        if (live) {
          setThreads(result.threads);
          if (!initialThreadId) setThreadId(result.threads[0]?.id ?? '');
        }
      })
      .catch((e) => {
        if (live) setError(displayError(e instanceof AtelierError ? e.code : 'connection_failed'));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [initialThreadId]);
  useEffect(() => {
    let live = true;
    setDesigns([]);
    if (!threadId) return;
    void atelierRequest<{ designs: FashionDesign[] }>(`fashion-designs?threadId=${encodeURIComponent(threadId)}`)
      .then((r) => {
        if (live) setDesigns(r.designs);
      })
      .catch((e) => {
        if (live) setError(displayError(e instanceof AtelierError ? e.code : 'connection_failed'));
      });
    return () => {
      live = false;
    };
  }, [threadId, designId]);
  const choose = (id: string) => {
    setDesignId(id);
    setError('');
    window.history.replaceState(
      null,
      '',
      `/atelier?from=${encodeURIComponent(threadId)}${id ? `&design=${encodeURIComponent(id)}` : ''}`,
    );
  };
  return (
    <main className="atelier" aria-label="缝纫间工作台">
      <header className="atelier-header">
        <div>
          <span className="atelier-kicker">ATELIER</span>
          <h1>缝纫间</h1>
        </div>
        <div className="atelier-selectors">
          <label>
            设计对话
            <select
              aria-label="设计对话"
              value={threadId}
              onChange={(e) => {
                setThreadId(e.target.value);
                setDesignId('');
                setError('');
              }}
            >
              <option value="">选择对话</option>
              {threads.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title || t.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            款式
            <select aria-label="款式" value={designId} onChange={(e) => choose(e.target.value)}>
              <option value="">新建款式</option>
              {designs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => choose('')}>
            ＋ 新建款式
          </button>
        </div>
      </header>
      {error && (
        <div role="alert" className="atelier-error">
          {error}
        </div>
      )}
      {loading ? (
        <p role="status" className="atelier-empty">
          正在读取你的设计对话…
        </p>
      ) : designId ? (
        <AtelierDesign key={designId} id={designId} />
      ) : threadId ? (
        <AtelierUpload threadId={threadId} onCreated={choose} />
      ) : (
        <div className="atelier-empty">
          <h2>先为你的款式留一段对话</h2>
          <p>款式、预览和图纸都会保存在这个对话里。</p>
          <a href="/">回到对话并新建</a>
        </div>
      )}
    </main>
  );
}
