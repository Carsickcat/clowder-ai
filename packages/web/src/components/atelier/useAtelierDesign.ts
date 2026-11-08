'use client';
import type { FashionDesignState } from '@cat-cafe/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AtelierError, atelierRequest } from './atelier-api';
export function useAtelierDesign(id: string) {
  const [state, setState] = useState<FashionDesignState | null>(null);
  const [error, setError] = useState<AtelierError | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const acting = useRef(false);
  const scope = useRef(id);
  scope.current = id;
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    const result = await atelierRequest<FashionDesignState>(`fashion-designs/${id}`);
    if (scope.current === id && request === generation.current) setState(result);
    return result;
  }, [id]);
  useEffect(() => {
    setState(null);
    setError(null);
    if (!id) return;
    let live = true;
    const generationRef = generation;
    const poll = async () => {
      try {
        const result = await refresh();
        for (const proposal of Object.values(result.proposals))
          if (proposal.status === 'ready') {
            // The proposal read also repairs the durable publication outbox.
            await atelierRequest(`fashion-designs/${id}/edit-proposals/${proposal.id}`);
          }
      } catch (e) {
        if (live) {
          setError(e instanceof AtelierError ? e : new AtelierError('connection_failed', 0));
          if (e instanceof AtelierError && [401, 404].includes(e.status)) setState(null);
        }
      }
      if (live) timer = setTimeout(poll, 2000);
    };
    let timer: ReturnType<typeof setTimeout>;
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
      generationRef.current += 1;
    };
  }, [id, refresh]);
  const act = useCallback(
    async <T>(action: () => Promise<T>): Promise<T | undefined> => {
      if (acting.current) return;
      acting.current = true;
      setBusy(true);
      setError(null);
      try {
        const result = await action();
        await refresh();
        return result;
      } catch (e) {
        if (scope.current === id) setError(e instanceof AtelierError ? e : new AtelierError('connection_failed', 0));
      } finally {
        acting.current = false;
        if (scope.current === id) setBusy(false);
      }
    },
    [id, refresh],
  );
  const post = <T>(endpoint: string, body: unknown) =>
    act(() => atelierRequest<T>(`fashion-designs/${id}/${endpoint}`, body));
  return { state, error, busy, post, act, refresh, clearError: () => setError(null) };
}
