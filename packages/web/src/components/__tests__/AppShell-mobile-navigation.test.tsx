import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSidebarStore } from '@/stores/sidebarStore';

const navigation = vi.hoisted(() => ({ pathname: '/memory', desktop: false }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/hooks/useIsDesktop', () => ({ useIsDesktop: () => navigation.desktop }));
vi.mock('../ActivityBar', () => ({
  ActivityBar: ({ className }: { className?: string }) => <nav data-testid="activity-bar" className={className} />,
}));
vi.mock('../MobileGlobalNavDrawer', () => ({
  MobileGlobalNavDrawer: ({ open }: { open: boolean }) =>
    open ? <aside data-testid="mobile-global-nav-drawer" /> : null,
}));
vi.mock('../ThreadSidebar', () => ({ ThreadSidebar: () => <aside data-testid="desktop-thread-sidebar" /> }));
vi.mock('../PwaInstallPrompt', () => ({ PwaInstallPrompt: () => null }));
vi.mock('../pwa/PwaUpdateController', () => ({
  PwaUpdateController: () => <div data-testid="pwa-update-controller" />,
}));
vi.mock('../concierge/ConciergeHost', () => ({ ConciergeHost: () => null }));
vi.mock('../workspace/FloatingPresentationSurfaceHost', () => ({ FloatingPresentationSurfaceHost: () => null }));
vi.mock('../workspace/ResizeHandle', () => ({ ResizeHandle: () => null }));
vi.mock('@/stores/callbackAuthStore', () => ({ CallbackAuthSnapshotMount: () => null }));

import { AppShell } from '../AppShell';

describe('AppShell mobile global navigation ownership', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    navigation.pathname = '/memory';
    navigation.desktop = false;
    useSidebarStore.setState({ isOpen: false });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('provides the canonical menu trigger on mobile global routes', () => {
    act(() => root.render(<AppShell>content</AppShell>));

    expect(document.documentElement.classList.contains('app-shell-scroll-lock')).toBe(true);
    expect(document.body.classList.contains('app-shell-scroll-lock')).toBe(true);
    expect(container.querySelector('[data-testid="pwa-update-controller"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mobile-global-page-header"]')).not.toBeNull();
    const viewport = container.querySelector('[data-testid="global-page-viewport"]');
    expect(viewport?.classList.contains('overflow-hidden')).toBe(true);
    expect(viewport?.classList.contains('overflow-y-auto')).toBe(false);
    const trigger = container.querySelector('[data-testid="mobile-global-nav-trigger"]') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    expect(trigger.classList.contains('fixed')).toBe(false);
    act(() => trigger.click());
    expect(container.querySelector('[data-testid="mobile-global-nav-drawer"]')).not.toBeNull();
  });

  it('keeps the mobile global-route opener mounted while its drawer owns focus', () => {
    act(() => root.render(<AppShell>content</AppShell>));
    const trigger = container.querySelector('[data-testid="mobile-global-nav-trigger"]') as HTMLButtonElement;

    trigger.focus();
    act(() => trigger.click());

    expect(container.querySelector('[data-testid="mobile-global-nav-trigger"]')).toBe(trigger);
    expect(trigger.tabIndex).toBe(-1);
    expect(trigger.getAttribute('aria-hidden')).toBe('true');

    act(() => useSidebarStore.getState().close());
    expect(trigger.tabIndex).toBe(0);
    expect(trigger.getAttribute('aria-hidden')).toBeNull();
  });

  it('lets the chat header open the same AppShell-owned drawer without a duplicate trigger', () => {
    navigation.pathname = '/thread/thread-1';
    act(() => root.render(<AppShell>chat</AppShell>));
    expect(container.querySelector('[data-testid="mobile-global-nav-trigger"]')).toBeNull();

    act(() => useSidebarStore.getState().open());
    expect(container.querySelector('[data-testid="mobile-global-nav-drawer"]')).not.toBeNull();
  });

  it('keeps the rail and desktop thread sidebar exclusive to the wide shell', () => {
    navigation.pathname = '/thread/thread-1';
    navigation.desktop = true;
    useSidebarStore.setState({ isOpen: true });
    act(() => root.render(<AppShell>chat</AppShell>));

    expect(container.querySelector('[data-testid="mobile-global-nav-drawer"]')).toBeNull();
    expect(container.querySelector('[data-testid="desktop-thread-sidebar"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="activity-bar"]')?.classList.contains('lg:flex')).toBe(true);
  });

  it('does not mount PWA lifecycle controls on chromeless presentation routes', () => {
    navigation.pathname = '/story/story-1';
    act(() => root.render(<AppShell>story</AppShell>));

    expect(container.querySelector('[data-testid="pwa-update-controller"]')).toBeNull();
    expect(document.documentElement.classList.contains('app-shell-scroll-lock')).toBe(false);
    expect(document.body.classList.contains('app-shell-scroll-lock')).toBe(false);
  });
});
