import { getThreadIdFromPathname } from './ThreadSidebar/thread-navigation';

export type GlobalNavigationItem = {
  id: 'home' | 'memory' | 'mission' | 'signals' | 'settings';
  path: string;
  label: string;
  drawerLabel: string;
  match: (pathname: string) => boolean;
};

export const GLOBAL_NAVIGATION_ITEMS: readonly GlobalNavigationItem[] = [
  {
    id: 'home',
    path: '/',
    label: '对话',
    drawerLabel: 'Threads',
    match: (pathname) => pathname === '/' || pathname.startsWith('/thread/'),
  },
  {
    id: 'memory',
    path: '/memory',
    label: '记忆',
    drawerLabel: 'Memory',
    match: (pathname) => pathname.startsWith('/memory'),
  },
  {
    id: 'mission',
    path: '/mission-hub',
    label: 'Mission Hub',
    drawerLabel: 'Mission',
    match: (pathname) => pathname.startsWith('/mission'),
  },
  {
    id: 'signals',
    path: '/signals',
    label: '信号',
    drawerLabel: 'Signals',
    match: (pathname) => pathname.startsWith('/signals'),
  },
  {
    id: 'settings',
    path: '/settings',
    label: '设置',
    drawerLabel: 'Settings',
    match: (pathname) => pathname.startsWith('/settings'),
  },
] as const;

function readFromParam(search: string): string | null {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('from');
}

function appendReferrer(path: string, referrer: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}from=${encodeURIComponent(referrer)}`;
}

export function resolveGlobalNavTarget(path: string, pathname: string, search: string): string {
  const fromParam = readFromParam(search);
  if (path === '/') return fromParam ? `/thread/${encodeURIComponent(fromParam)}` : '/';

  const threadId = getThreadIdFromPathname(pathname);
  const referrer = threadId !== 'default' ? threadId : fromParam;
  return referrer ? appendReferrer(path, referrer) : path;
}
