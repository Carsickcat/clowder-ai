export const LAST_VISITED_THREAD_STORAGE_KEY = 'cat-cafe:last-visited-thread';

type ThreadStorage = Pick<Storage, 'getItem' | 'setItem'>;

function isRememberableThreadId(threadId: string | null): threadId is string {
  return threadId !== null && threadId !== 'default' && /^[A-Za-z0-9_-]+$/.test(threadId);
}

export function readLastVisitedThreadId(storage: Pick<Storage, 'getItem'> | null | undefined): string | null {
  if (!storage) return null;
  try {
    const threadId = storage.getItem(LAST_VISITED_THREAD_STORAGE_KEY);
    return isRememberableThreadId(threadId) ? threadId : null;
  } catch {
    return null;
  }
}

export function writeLastVisitedThreadId(threadId: string, storage: ThreadStorage | null | undefined): void {
  if (!storage || !isRememberableThreadId(threadId)) return;
  try {
    storage.setItem(LAST_VISITED_THREAD_STORAGE_KEY, threadId);
  } catch {
    // Storage can be unavailable in private browsing; navigation must still work.
  }
}

export function resolveStartupThreadId(
  routeThreadId: string,
  storage: Pick<Storage, 'getItem'> | null | undefined,
): string {
  if (routeThreadId !== 'default') return routeThreadId;
  return readLastVisitedThreadId(storage) ?? routeThreadId;
}

export function resolveThreadRouteWithLastVisitedMemory(
  routeThreadId: string,
  storage: Pick<Storage, 'getItem'> | null | undefined,
  isInitialRoute: boolean,
): string {
  return isInitialRoute ? resolveStartupThreadId(routeThreadId, storage) : routeThreadId;
}
