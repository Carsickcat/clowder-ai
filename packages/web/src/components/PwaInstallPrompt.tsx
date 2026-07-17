'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIsDesktop } from '@/hooks/useIsDesktop';

type InstallPlatform = 'ios' | 'android' | 'other';

interface DeferredInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function detectInstallPlatform(userAgent: string): InstallPlatform {
  const normalized = userAgent.toLowerCase();
  if (/(iphone|ipad|ipod)/.test(normalized)) return 'ios';
  if (/android/.test(normalized)) return 'android';
  return 'other';
}

function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneByMedia =
    typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)').matches : false;
  const standaloneByNavigator = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneByMedia || standaloneByNavigator;
}

function getManualSteps(platform: InstallPlatform): string[] {
  if (platform === 'ios') {
    return [
      '在当前浏览器里点“分享”。',
      '选择“添加到主屏幕”。',
      '回到桌面后，从 Clowder AI 图标进入。',
    ];
  }

  return [
    '在浏览器菜单里找“安装应用”或“添加到主屏幕”。',
    '确认后把 Clowder AI 固定到手机桌面。',
    '如果当前是内嵌 WebView，看不到安装项就改用系统浏览器打开一次。',
  ];
}

export function PwaInstallPrompt({ hasMobileNav = false }: { hasMobileNav?: boolean }) {
  const isDesktop = useIsDesktop();
  const [platform, setPlatform] = useState<InstallPlatform>('other');
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const syncEnvironment = useCallback(() => {
    if (typeof window === 'undefined') return;
    setPlatform(detectInstallPlatform(window.navigator.userAgent));
    setIsStandalone(isStandaloneDisplayMode());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    syncEnvironment();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPromptEvent);
      setDismissed(false);
    };

    const handleInstalled = () => {
      setDeferredPrompt(null);
      setSheetOpen(false);
      setDismissed(true);
      setIsStandalone(true);
    };

    const mediaQuery =
      typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null;
    const handleDisplayModeChange = () => setIsStandalone(isStandaloneDisplayMode());

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    mediaQuery?.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      mediaQuery?.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, [syncEnvironment]);

  const manualSteps = useMemo(() => getManualSteps(platform), [platform]);

  const handlePrimary = useCallback(async () => {
    if (!deferredPrompt) {
      setSheetOpen(true);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
        setSheetOpen(false);
        setDismissed(true);
        return;
      }
    } catch {
      // Fall back to manual guidance below.
    }

    setSheetOpen(true);
  }, [deferredPrompt]);

  const shouldRender = !isDesktop && !isStandalone && !dismissed;
  if (!shouldRender) return null;

  const primaryLabel = deferredPrompt ? '立即安装' : platform === 'ios' ? '添加到主屏幕' : '查看安装方法';
  const offsetClass = hasMobileNav
    ? 'bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)]'
    : 'bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]';

  return (
    <>
      <div
        className={`fixed inset-x-3 ${offsetClass} z-[46] lg:hidden`}
        data-testid="pwa-install-banner"
      >
        <div className="rounded-2xl border border-[var(--console-border-soft)] bg-[var(--console-card-bg)] px-4 py-3 shadow-xl backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--console-hover-bg)] text-base">
              📱
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-cafe-black">把 Clowder AI 装到手机桌面</p>
              <p className="mt-1 text-xs leading-5 text-cafe-secondary">
                通过 Tailscale 全屏打开，功能和当前网页保持一致。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-cafe-muted transition-colors hover:bg-[var(--console-hover-bg)] hover:text-cafe-secondary"
              aria-label="关闭安装提示"
            >
              ×
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handlePrimary()}
              className="console-button-primary text-xs"
              data-testid="pwa-install-primary"
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="rounded-xl px-3 py-2 text-xs text-cafe-secondary transition-colors hover:bg-[var(--console-hover-bg)] hover:text-cafe-black"
            >
              安装说明
            </button>
          </div>
        </div>
      </div>

      {sheetOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end bg-[var(--console-overlay-medium)] px-3 pb-[env(safe-area-inset-bottom)] lg:hidden"
          onClick={() => setSheetOpen(false)}
        >
          <section
            className="w-full rounded-t-[28px] border border-[var(--console-border-soft)] bg-[var(--console-card-bg)] px-4 pb-5 pt-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            aria-label="PWA 安装说明"
            data-testid="pwa-install-sheet"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[var(--console-border-soft)]" />
            <h2 className="text-base font-semibold text-cafe-black">像 app 一样打开 Clowder AI</h2>
            <p className="mt-2 text-sm leading-6 text-cafe-secondary">
              安装后会以 PWA 的独立窗口运行，顶部浏览器栏会消失，更适合手机通过 Tailscale 长时间使用。
            </p>

            <div className="mt-4 rounded-2xl bg-[var(--console-card-soft-bg)] p-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-cafe-muted">安装步骤</p>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-cafe-secondary">
                {manualSteps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--console-hover-bg)] text-micro font-semibold text-cafe-black">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <p className="mt-4 text-xs leading-5 text-cafe-muted">
              如果你当前是从别的 App 内嵌页面打开，安装项可能不会出现。那种情况先用系统浏览器打开一次当前
              Tailscale 地址，再添加到主屏幕。
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="rounded-xl px-3 py-2 text-sm text-cafe-secondary transition-colors hover:bg-[var(--console-hover-bg)] hover:text-cafe-black"
              >
                稍后
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deferredPrompt) {
                    void handlePrimary();
                    return;
                  }
                  setSheetOpen(false);
                }}
                className="console-button-primary text-sm"
              >
                {deferredPrompt ? '立即安装' : '知道了'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
