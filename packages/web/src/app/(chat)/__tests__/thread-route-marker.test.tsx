import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  LAST_VISITED_THREAD_STORAGE_KEY,
  readLastVisitedThreadId,
  resolveStartupThreadId,
  resolveThreadRouteWithLastVisitedMemory,
  writeLastVisitedThreadId,
} from '../last-visited-thread';
import { resolveLayoutThreadId } from '../layout-thread-id';
import Home from '../page';
import ThreadPage from '../thread/[threadId]/page';

describe('chat route markers', () => {
  it('restores a stored non-default thread only when the startup route is the root', () => {
    const storage = new Map<string, string>([[LAST_VISITED_THREAD_STORAGE_KEY, 'thread-resume']]);
    const reader = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    expect(readLastVisitedThreadId(reader)).toBe('thread-resume');
    expect(resolveStartupThreadId('default', reader)).toBe('thread-resume');
    expect(resolveStartupThreadId('thread-shared-link', reader)).toBe('thread-shared-link');
  });

  it('uses remembered history only for the initial root route, not later root navigation', () => {
    const reader = {
      getItem: () => 'thread-resume',
      setItem: () => undefined,
    };

    expect(resolveThreadRouteWithLastVisitedMemory('default', reader, true)).toBe('thread-resume');
    expect(resolveThreadRouteWithLastVisitedMemory('default', reader, false)).toBe('default');
  });

  it('ignores malformed remembered thread ids rather than navigating to an arbitrary path', () => {
    const reader = {
      getItem: () => '../settings',
      setItem: () => undefined,
    };

    expect(readLastVisitedThreadId(reader)).toBeNull();
  });

  it('stores an explicit thread visit but never overwrites it with the root route', () => {
    const storage = new Map<string, string>();
    const writer = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    writeLastVisitedThreadId('thread-resume', writer);
    writeLastVisitedThreadId('default', writer);

    expect(storage.get(LAST_VISITED_THREAD_STORAGE_KEY)).toBe('thread-resume');
  });

  it('renders a stable marker for the default thread route', () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain('data-thread-route="default"');
  });

  it('renders the active thread id into the page tree', () => {
    const html = renderToStaticMarkup(<ThreadPage params={{ threadId: 'thread-123' }} />);
    expect(html).toContain('data-thread-route="thread-123"');
  });

  it('uses pathname for first render, then trusts the browser route store after hydration', () => {
    expect(resolveLayoutThreadId('thread-refresh', null)).toBe('thread-refresh');
    expect(resolveLayoutThreadId('default', null, 'thread-refresh')).toBe('thread-refresh');
    expect(resolveLayoutThreadId('thread-stale', 'default')).toBe('default');
    expect(resolveLayoutThreadId('thread-stale', 'thread-current')).toBe('thread-current');
  });
});
