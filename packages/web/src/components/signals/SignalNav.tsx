import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';

export type SignalNavItem = 'chat' | 'signals' | 'sources';

interface SignalNavProps {
  readonly active: SignalNavItem;
  readonly initialReferrerThread?: string | null;
}

interface ItemConfig {
  readonly id: SignalNavItem;
  readonly href: string;
  readonly label: string;
}

/**
 * Reads `?from=` URL param to determine the referrer thread.
 * Falls back to store's currentThreadId (last active thread).
 * Same pattern as MissionControlPage referrer-based back button.
 */
function useReferrerThread(initialReferrerThread: string | null): string | null {
  const storeThreadId = useChatStore((s) => s.currentThreadId);
  const [fromParam, setFromParam] = useState<string | null>(initialReferrerThread);
  useEffect(() => {
    const nextFromParam = new URLSearchParams(window.location.search).get('from');
    if (nextFromParam) setFromParam(nextFromParam);
  }, [initialReferrerThread]);
  return useMemo(() => {
    if (fromParam) return fromParam;
    return storeThreadId && storeThreadId !== 'default' ? storeThreadId : null;
  }, [fromParam, storeThreadId]);
}

export function SignalNav({ active, initialReferrerThread = null }: SignalNavProps) {
  const referrerThread = useReferrerThread(initialReferrerThread);
  const fromSuffix = referrerThread ? `?from=${encodeURIComponent(referrerThread)}` : '';

  const items: readonly ItemConfig[] = useMemo(
    () => [
      { id: 'signals' as const, href: `/signals${fromSuffix}`, label: '信号' },
      { id: 'sources' as const, href: `/signals/sources${fromSuffix}`, label: '信号源' },
    ],
    [fromSuffix],
  );

  return (
    <nav
      aria-label="Signal navigation"
      className="flex max-w-full shrink-0 overflow-x-auto overflow-y-hidden overscroll-x-contain whitespace-nowrap console-divider-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex shrink-0 items-center whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition-colors sm:px-5 ${
              isActive
                ? 'border-b-2 border-[var(--console-button-emphasis)] text-[var(--console-button-emphasis)]'
                : 'text-cafe-muted hover:text-cafe-secondary'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
