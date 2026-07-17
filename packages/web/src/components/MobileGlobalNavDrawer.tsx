'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { GLOBAL_NAVIGATION_ITEMS, resolveGlobalNavTarget } from './global-navigation';
import { usePwaInstallExperience } from './pwa/PwaInstallExperienceProvider';
import { ThreadSidebar } from './ThreadSidebar';

interface MobileGlobalNavDrawerProps {
  open: boolean;
  onClose: () => void;
}

const GLOBAL_MODULE_IDS = new Set(['memory', 'mission', 'signals']);

export function MobileGlobalNavDrawer({ open, onClose }: MobileGlobalNavDrawerProps) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const searchParams = useSearchParams();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { facts: pwaFacts, openGuide: openInstallGuide } = usePwaInstallExperience();

  useEffect(() => {
    if (!open) return;
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  const navigate = (path: string) => {
    const target = resolveGlobalNavTarget(path, pathname, searchParams?.toString() ?? '');
    onClose();
    router.push(target);
  };

  const globalModules = GLOBAL_NAVIGATION_ITEMS.filter((item) => GLOBAL_MODULE_IDS.has(item.id));
  const settings = GLOBAL_NAVIGATION_ITEMS.find((item) => item.id === 'settings');
  const showInstallGuide = () => {
    onClose();
    openInstallGuide();
  };

  return (
    <div
      className="mobile-visual-viewport fixed inset-x-0 z-[60] lg:hidden"
      data-testid="mobile-global-nav-drawer"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[var(--console-overlay-backdrop)] backdrop-blur-sm"
        aria-label="关闭全局导航"
        onClick={onClose}
        data-testid="mobile-global-nav-backdrop"
      />
      <aside
        className="safe-area-left relative flex h-full w-[min(88vw,360px)] flex-col border-r border-cafe bg-cafe-surface pt-[env(safe-area-inset-top)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="全局导航"
      >
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-cafe px-4">
          <div>
            <p className="text-sm font-semibold text-cafe">Clowder AI</p>
            <p className="text-micro text-cafe-muted">全局导航</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xl text-cafe-secondary hover:bg-cafe-surface-sunken"
            aria-label="关闭全局导航"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="mobile-drawer-threads">
          <h2 id="mobile-drawer-threads" className="px-4 pb-1 pt-3 text-micro font-semibold uppercase tracking-wide text-cafe-muted">
            Threads
          </h2>
          <div className="min-h-0 flex-1 overflow-hidden">
            <ThreadSidebar onClose={onClose} className="w-full" />
          </div>
        </section>

        <nav className="shrink-0 border-t border-cafe p-2" aria-label="全局模块">
          <p className="px-2 pb-1 text-micro font-semibold uppercase tracking-wide text-cafe-muted">全局模块</p>
          <div className="grid grid-cols-3 gap-1">
            {globalModules.map((item) => {
              const active = item.match(pathname);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`min-h-11 rounded-lg px-2 text-xs transition-colors ${
                    active
                      ? 'bg-[var(--console-rail-active)] text-cafe'
                      : 'text-cafe-secondary hover:bg-cafe-surface-sunken'
                  }`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => navigate(item.path)}
                >
                  {item.drawerLabel}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-cafe p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            data-testid="mobile-pwa-install-entry"
            className="flex min-h-11 w-full items-center rounded-lg px-3 text-sm text-cafe-secondary transition-colors hover:bg-cafe-surface-sunken"
            onClick={showInstallGuide}
          >
            {pwaFacts.isStandalone ? '应用与更新诊断' : '安装 Clowder AI'}
          </button>
          {settings && (
            <button
              type="button"
              className={`flex min-h-11 w-full items-center rounded-lg px-3 text-sm transition-colors ${
                settings.match(pathname)
                  ? 'bg-[var(--console-rail-active)] text-cafe'
                  : 'text-cafe-secondary hover:bg-cafe-surface-sunken'
              }`}
              aria-current={settings.match(pathname) ? 'page' : undefined}
              onClick={() => navigate(settings.path)}
            >
              {settings.drawerLabel}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
