'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useLayoutEffect } from 'react';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useVisualViewportCssVars } from '@/hooks/useVisualViewportCssVars';
import { CallbackAuthSnapshotMount } from '@/stores/callbackAuthStore';
import { initSidebarWidth, useSidebarStore } from '@/stores/sidebarStore';
import { ActivityBar } from './ActivityBar';
import { ConciergeHost } from './concierge/ConciergeHost';
import { MobileGlobalNavDrawer } from './MobileGlobalNavDrawer';
import { PwaInstallPrompt } from './PwaInstallPrompt';
import { PwaInstallExperienceProvider } from './pwa/PwaInstallExperienceProvider';
import { PwaTransientWorkGuard } from './pwa/PwaTransientWorkGuard';
import { PwaUpdateController } from './pwa/PwaUpdateController';
import { ThreadSidebar } from './ThreadSidebar';
import { FloatingPresentationSurfaceHost } from './workspace/FloatingPresentationSurfaceHost';
import { ResizeHandle } from './workspace/ResizeHandle';

const CHROMELESS_ROUTES = ['/story', '/story-export', '/pixel-brawl', '/showcase'];

const SIDEBAR_HIDDEN_ROUTES = ['/settings', '/marketplace', '/signals', '/memory', '/mission'];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <Suspense fallback={children}>
      <AppShellContent>{children}</AppShellContent>
    </Suspense>
  );
}

function AppShellContent({ children }: AppShellProps) {
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const isExport = searchParams.get('export') === 'true';
  const { isOpen, width, close, toggle, handleResize, resetWidth } = useSidebarStore();
  const isDesktop = useIsDesktop();
  useVisualViewportCssVars();

  useLayoutEffect(() => {
    initSidebarWidth();
  }, []);

  useLayoutEffect(() => {
    if (!isDesktop) close();
  }, [close, isDesktop]);

  if (isExport || CHROMELESS_ROUTES.some((r) => pathname.startsWith(r))) {
    return <>{children}</>;
  }

  const showSidebar = isOpen && isDesktop && !SIDEBAR_HIDDEN_ROUTES.some((r) => pathname.startsWith(r));
  const isChatRoute = pathname === '/' || pathname.startsWith('/thread/');

  return (
    <PwaInstallExperienceProvider>
      <div className="console-shell app-viewport safe-area-inline flex overflow-hidden overscroll-none">
        {!isChatRoute && (
          <button
            type="button"
            onClick={toggle}
            className={`fixed left-[calc(env(safe-area-inset-left)+0.75rem)] top-[calc(env(safe-area-inset-top)+0.75rem)] z-[42] flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-cafe bg-cafe-surface text-xl text-cafe-secondary shadow-lg lg:hidden ${
              isOpen ? 'pointer-events-none' : ''
            }`}
            aria-label="打开全局导航"
            aria-expanded={isOpen}
            aria-hidden={isOpen || undefined}
            tabIndex={isOpen ? -1 : 0}
            data-testid="mobile-global-nav-trigger"
          >
            ☰
          </button>
        )}
        {isOpen && !isDesktop && <MobileGlobalNavDrawer open onClose={close} />}
        <Suspense fallback={<div className="hidden w-12 flex-shrink-0 lg:block" aria-hidden="true" />}>
          <ActivityBar className="hidden lg:flex" />
        </Suspense>
        {/* Callback-auth snapshot provider: mounted at AppShell level (not chat
          layout) so the zustand store is populated on ALL routes — settings,
          memory, mission, etc. The observability panel and per-cat status dots
          read from this store; keeping it chat-only meant the panel showed "..."
          when navigating to settings without visiting chat first. Returns null;
          30s poll re-render is confined to this leaf. */}
        <CallbackAuthSnapshotMount />
        {showSidebar && (
          <div className="flex items-stretch flex-shrink-0">
            <div style={{ width }} className="flex-shrink-0">
              <ThreadSidebar onClose={close} className="w-full" />
            </div>
            <ResizeHandle
              direction="horizontal"
              label="左侧对话栏"
              onResize={handleResize}
              onCollapse={close}
              onDoubleClick={resetWidth}
              showLine={false}
            />
          </div>
        )}
        <div className={`min-w-0 flex-1 ${isChatRoute ? 'min-h-0 overflow-hidden' : 'overflow-y-auto'}`}>
          {children}
        </div>
        <PwaInstallPrompt hasMobileNav={isChatRoute} />
        <PwaTransientWorkGuard />
        <PwaUpdateController />
        {/* F226: presentation surface floating window — mounted at AppShell root (outside route
          children) so the float survives both workspace mode-tab switches AND full-page route
          changes (/memory, /settings, /mission-hub). KD-1. */}
        <FloatingPresentationSurfaceHost />
        {/* F229: concierge ball + panel — root-level mount for INV-6 route survival.
          z-30 (ball) < z-[35] (presentation surface). */}
        <ConciergeHost />
        {/* F246 Phase C: Approval Hub moved to workspace panel tab — drawer removed */}
      </div>
    </PwaInstallExperienceProvider>
  );
}
