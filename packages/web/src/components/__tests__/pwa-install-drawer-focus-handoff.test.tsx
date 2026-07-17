import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/memory',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('../ThreadSidebar', () => ({ ThreadSidebar: () => <div data-testid="thread-sidebar" /> }));

import { MobileGlobalNavDrawer } from '../MobileGlobalNavDrawer';
import { PwaInstallPrompt } from '../PwaInstallPrompt';
import { PwaInstallExperienceProvider } from '../pwa/PwaInstallExperienceProvider';

function HandoffHarness() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <PwaInstallExperienceProvider>
      <button type="button" data-testid="persistent-menu-trigger" onClick={() => setDrawerOpen(true)}>
        menu
      </button>
      {drawerOpen && <MobileGlobalNavDrawer open onClose={() => setDrawerOpen(false)} />}
      <PwaInstallPrompt />
    </PwaInstallExperienceProvider>
  );
}

describe('PWA install drawer focus handoff', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalFetch: typeof globalThis.fetch;
  let originalMatchMedia: typeof window.matchMedia | undefined;
  let originalServiceWorker: ServiceWorkerContainer | undefined;
  let originalSecureContext: boolean | undefined;
  let originalUserAgent: string;

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
    originalFetch = globalThis.fetch;
    originalMatchMedia = window.matchMedia;
    originalServiceWorker = navigator.serviceWorker;
    originalSecureContext = window.isSecureContext;
    originalUserAgent = navigator.userAgent;
  });

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
    });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: {},
        getRegistration: vi.fn(async () => ({ active: {} })),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ name: 'Clowder AI', start_url: '/' }), {
          status: 200,
          headers: { 'content-type': 'application/manifest+json' },
        }),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
    if (originalMatchMedia) window.matchMedia = originalMatchMedia;
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: originalServiceWorker });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: originalSecureContext });
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: originalUserAgent });
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
  });

  it('returns focus to the persistent menu trigger after opening the guide from the drawer', async () => {
    await act(async () => {
      root.render(<HandoffHarness />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const persistentTrigger = container.querySelector('[data-testid="persistent-menu-trigger"]') as HTMLButtonElement;
    persistentTrigger.focus();
    act(() => persistentTrigger.click());

    const installEntry = container.querySelector('[data-testid="mobile-pwa-install-entry"]') as HTMLButtonElement;
    installEntry.focus();
    await act(async () => {
      installEntry.click();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="pwa-install-sheet"]')).not.toBeNull();

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('[data-testid="pwa-install-sheet"]')).toBeNull();
    expect(document.activeElement).toBe(persistentTrigger);
  });
});
