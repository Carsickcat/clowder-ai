'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PWA_BEFORE_RELOAD_EVENT, PWA_RECOVERY_EVENT } from '@/lib/pwa-lifecycle';

export type ServiceWorkerUpdateState = 'unsupported' | 'current' | 'update-ready' | 'reloading' | 'error';

interface PwaUpdateControllerProps {
  reloadPage?: () => void;
}

function defaultReloadPage() {
  window.location.reload();
}

export function PwaUpdateController({ reloadPage = defaultReloadPage }: PwaUpdateControllerProps) {
  const [state, setState] = useState<ServiceWorkerUpdateState>('unsupported');
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const hadControllerRef = useRef(false);
  const updateReadyRef = useRef(false);
  const reloadStartedRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    const serviceWorker = navigator.serviceWorker;
    if (!serviceWorker || navigator.onLine === false || updateReadyRef.current) return;

    try {
      const registration = registrationRef.current ?? (await serviceWorker.getRegistration());
      registrationRef.current = registration ?? null;
      await registration?.update();
    } catch {
      if (!reloadStartedRef.current) setState('error');
    }
  }, []);

  useEffect(() => {
    const serviceWorker = navigator.serviceWorker;
    if (!serviceWorker) {
      setState('unsupported');
      return;
    }

    let active = true;
    hadControllerRef.current = Boolean(serviceWorker.controller);
    setState('current');

    const rememberRegistration = async () => {
      try {
        const registration = await serviceWorker.getRegistration();
        if (active) registrationRef.current = registration ?? null;
      } catch {
        if (active) setState('error');
      }
    };
    const handleControllerChange = () => {
      if (!hadControllerRef.current) {
        hadControllerRef.current = Boolean(serviceWorker.controller);
        return;
      }
      if (!reloadStartedRef.current) {
        updateReadyRef.current = true;
        setBlockedMessage(null);
        setState('update-ready');
      }
    };
    const recover = () => {
      if (navigator.onLine === false) return;
      window.dispatchEvent(new Event(PWA_RECOVERY_EVENT));
      void checkForUpdate();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') recover();
    };

    serviceWorker.addEventListener('controllerchange', handleControllerChange);
    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void rememberRegistration();

    return () => {
      active = false;
      serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      window.removeEventListener('online', recover);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkForUpdate]);

  const applyUpdate = () => {
    if (state !== 'update-ready' || reloadStartedRef.current) return;

    const beforeReload = new Event(PWA_BEFORE_RELOAD_EVENT, { cancelable: true });
    const canReload = window.dispatchEvent(beforeReload);
    if (!canReload || beforeReload.defaultPrevented) {
      setBlockedMessage('仍有未保存的内容；处理后再更新，不会强制重新载入。');
      return;
    }

    reloadStartedRef.current = true;
    setBlockedMessage(null);
    setState('reloading');
    reloadPage();
  };

  const retry = () => {
    updateReadyRef.current = false;
    setBlockedMessage(null);
    setState('current');
    void checkForUpdate();
  };

  if (state === 'unsupported' || state === 'current') return null;

  return (
    <div
      className="safe-area-inline fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[48] flex justify-center px-3"
      role="status"
      aria-live="polite"
      data-testid="pwa-update-status"
    >
      <div className="flex w-full max-w-lg items-center gap-3 rounded-2xl border border-cafe bg-cafe-surface px-4 py-3 text-sm text-cafe shadow-xl">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {state === 'error' ? '更新检查失败' : state === 'reloading' ? '正在重新载入…' : '新版本已就绪'}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-cafe-muted">
            {blockedMessage ??
              (state === 'error'
                ? '当前页面仍可继续使用；恢复连接后可以重试。'
                : state === 'reloading'
                  ? '草稿与当前 thread 已保留。'
                  : '确认后会保留当前 thread 与已持久化草稿。')}
          </p>
        </div>
        {state === 'update-ready' && (
          <button type="button" onClick={applyUpdate} className="console-button-primary min-h-11 shrink-0 text-xs">
            更新并重新载入
          </button>
        )}
        {state === 'error' && (
          <button type="button" onClick={retry} className="console-button-primary min-h-11 shrink-0 text-xs">
            重试
          </button>
        )}
      </div>
    </div>
  );
}
