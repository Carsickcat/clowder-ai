'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect, useState } from 'react';
import { ChatContainer } from '@/components/ChatContainer';
import { CHAT_THREAD_ROUTE_EVENT, getThreadIdFromPathname } from '@/components/ThreadSidebar/thread-navigation';
import { resolveThreadRouteWithLastVisitedMemory, writeLastVisitedThreadId } from './last-visited-thread';
import { resolveLayoutThreadId } from './layout-thread-id';

function getThreadRouteSnapshot(): string {
  if (typeof window === 'undefined') return 'default';
  return getThreadIdFromPathname(window.location.pathname);
}

/**
 * Shared layout for "/" and "/thread/[threadId]".
 *
 * By placing ChatContainer here instead of in each page, it stays mounted
 * across thread switches — no unmount/remount flicker, no scroll-position
 * loss, and socket/state survives navigation.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pathnameThreadId = getThreadIdFromPathname(pathname ?? '');
  // Parent layouts can briefly see the default route during hard refresh; the
  // address bar is the authority before chat history effects are allowed to run.
  const immediateBrowserThreadId = typeof window !== 'undefined' ? getThreadRouteSnapshot() : null;
  const [browserThreadId, setBrowserThreadId] = useState<string | null>(null);
  useLayoutEffect(() => {
    const syncBrowserRoute = (shouldRestoreLastVisitedThread: boolean) => {
      const routeThreadId = getThreadRouteSnapshot();
      if (routeThreadId !== 'default') {
        writeLastVisitedThreadId(routeThreadId, window.localStorage);
      }
      setBrowserThreadId(
        resolveThreadRouteWithLastVisitedMemory(routeThreadId, window.localStorage, shouldRestoreLastVisitedThread),
      );
    };
    const syncNavigatedBrowserRoute = () => syncBrowserRoute(false);

    syncBrowserRoute(true);
    window.addEventListener('popstate', syncNavigatedBrowserRoute);
    window.addEventListener(CHAT_THREAD_ROUTE_EVENT, syncNavigatedBrowserRoute);
    return () => {
      window.removeEventListener('popstate', syncNavigatedBrowserRoute);
      window.removeEventListener(CHAT_THREAD_ROUTE_EVENT, syncNavigatedBrowserRoute);
    };
  }, []);
  const threadId = resolveLayoutThreadId(pathnameThreadId, browserThreadId, immediateBrowserThreadId);

  return (
    <>
      {/* CallbackAuthSnapshotMount moved to AppShell — it needs to be available
          on all routes (settings, memory, etc.), not just chat. */}
      <ChatContainer threadId={threadId} />
      {children}
    </>
  );
}
