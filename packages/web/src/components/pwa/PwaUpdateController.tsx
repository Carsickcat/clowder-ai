'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PWA_BEFORE_RELOAD_EVENT, PWA_RECOVERY_EVENT } from '@/lib/pwa-lifecycle';

export type ServiceWorkerUpdateState = 'unsupported' | 'current' | 'update-ready' | 'reloading' | 'error';

interface PwaUpdateControllerProps {
  reloadPage?: () => void;
}

type RegistrationWatch = {
  registration: ServiceWorkerRegistration;
  onUpdateFound: EventListener;
};

type InstallingWatch = {
  worker: ServiceWorker;
  onStateChange: EventListener;
};

function defaultReloadPage() {
  window.location.reload();
}

export function PwaUpdateController({ reloadPage = defaultReloadPage }: PwaUpdateControllerProps) {
  const [state, setState] = useState<ServiceWorkerUpdateState>('unsupported');
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const registrationWatchRef = useRef<RegistrationWatch | null>(null);
  const installingWatchRef = useRef<InstallingWatch | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const updateReadyRef = useRef(false);
  const activationRequestedRef = useRef(false);
  const reloadStartedRef = useRef(false);

  const surfaceWaitingWorker = useCallback((registration: ServiceWorkerRegistration) => {
    const waitingWorker = registration.waiting;
    if (!waitingWorker || !navigator.serviceWorker?.controller || activationRequestedRef.current) return;
    waitingWorkerRef.current = waitingWorker;
    updateReadyRef.current = true;
    setBlockedMessage(null);
    setState('update-ready');
  }, []);

  const clearInstallingWatch = useCallback(() => {
    const watch = installingWatchRef.current;
    if (watch) watch.worker.removeEventListener('statechange', watch.onStateChange);
    installingWatchRef.current = null;
  }, []);

  const watchRegistration = useCallback(
    (registration: ServiceWorkerRegistration) => {
      if (registrationWatchRef.current?.registration === registration) {
        surfaceWaitingWorker(registration);
        return;
      }

      const previous = registrationWatchRef.current;
      if (previous) previous.registration.removeEventListener('updatefound', previous.onUpdateFound);
      clearInstallingWatch();

      const onUpdateFound = () => {
        surfaceWaitingWorker(registration);
        const installing = registration.installing;
        if (!installing || installingWatchRef.current?.worker === installing) return;
        clearInstallingWatch();
        const onStateChange = () => {
          if (installing.state === 'installed') surfaceWaitingWorker(registration);
        };
        installing.addEventListener('statechange', onStateChange);
        installingWatchRef.current = { worker: installing, onStateChange };
      };

      registrationRef.current = registration;
      registration.addEventListener('updatefound', onUpdateFound);
      registrationWatchRef.current = { registration, onUpdateFound };
      surfaceWaitingWorker(registration);
    },
    [clearInstallingWatch, surfaceWaitingWorker],
  );

  const checkForUpdate = useCallback(async () => {
    const serviceWorker = navigator.serviceWorker;
    if (!serviceWorker || navigator.onLine === false || updateReadyRef.current) return;

    try {
      const registration = registrationRef.current ?? (await serviceWorker.getRegistration());
      if (!registration) return;
      watchRegistration(registration);
      await registration.update();
      surfaceWaitingWorker(registration);
    } catch {
      if (!activationRequestedRef.current) setState('error');
    }
  }, [surfaceWaitingWorker, watchRegistration]);

  useEffect(() => {
    const serviceWorker = navigator.serviceWorker;
    let active = true;

    const recover = () => {
      if (navigator.onLine === false) return;
      window.dispatchEvent(new Event(PWA_RECOVERY_EVENT));
      void checkForUpdate();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') recover();
    };

    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (!serviceWorker) {
      setState('unsupported');
      return () => {
        active = false;
        window.removeEventListener('online', recover);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    setState('current');
    const handleControllerChange = () => {
      if (!activationRequestedRef.current || reloadStartedRef.current) return;
      reloadStartedRef.current = true;
      reloadPage();
    };
    const rememberRegistration = async () => {
      try {
        const registration = await serviceWorker.getRegistration();
        if (active && registration) watchRegistration(registration);
      } catch {
        if (active) setState('error');
      }
    };

    serviceWorker.addEventListener('controllerchange', handleControllerChange);
    void rememberRegistration();

    return () => {
      active = false;
      serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      window.removeEventListener('online', recover);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      const watch = registrationWatchRef.current;
      if (watch) watch.registration.removeEventListener('updatefound', watch.onUpdateFound);
      registrationWatchRef.current = null;
      clearInstallingWatch();
    };
  }, [checkForUpdate, clearInstallingWatch, reloadPage, watchRegistration]);

  const applyUpdate = () => {
    if (state !== 'update-ready' || activationRequestedRef.current) return;

    const beforeReload = new Event(PWA_BEFORE_RELOAD_EVENT, { cancelable: true });
    const canReload = window.dispatchEvent(beforeReload);
    if (!canReload || beforeReload.defaultPrevented) {
      setBlockedMessage('仍有未保存的内容；处理后再更新，不会强制重新载入。');
      return;
    }

    const waitingWorker = waitingWorkerRef.current ?? registrationRef.current?.waiting;
    if (!waitingWorker) {
      updateReadyRef.current = false;
      setState('error');
      return;
    }

    activationRequestedRef.current = true;
    setBlockedMessage(null);
    setState('reloading');
    try {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      activationRequestedRef.current = false;
      setState('error');
    }
  };

  const retry = () => {
    updateReadyRef.current = false;
    activationRequestedRef.current = false;
    waitingWorkerRef.current = null;
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
            {state === 'error' ? '更新检查失败' : state === 'reloading' ? '正在应用更新…' : '新版本已就绪'}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-cafe-muted">
            {blockedMessage ??
              (state === 'error'
                ? '当前页面仍可继续使用；恢复连接后可以重试。'
                : state === 'reloading'
                  ? '新版本接管后会重新载入一次。'
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
