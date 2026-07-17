import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { WIDE_SHELL_QUERY } from '@/lib/responsive-breakpoints';
import { PwaInstallPrompt } from '../PwaInstallPrompt';
import { PwaInstallExperienceProvider, usePwaInstallExperience } from '../pwa/PwaInstallExperienceProvider';

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
}

function mockMatchMedia({ desktop = false, standalone = false }: { desktop?: boolean; standalone?: boolean } = {}) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: (query === WIDE_SHELL_QUERY && desktop) || (query.includes('display-mode: standalone') && standalone),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function Harness({ hasMobileNav = true }: { hasMobileNav?: boolean }) {
  const experience = usePwaInstallExperience();
  return (
    <>
      <button type="button" data-testid="open-install-guide" onClick={experience.openGuide}>
        install
      </button>
      <PwaInstallPrompt hasMobileNav={hasMobileNav} />
    </>
  );
}

describe('PwaInstallPrompt', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalMatchMedia: typeof window.matchMedia | undefined;
  let originalUserAgent: string;
  let originalServiceWorker: ServiceWorkerContainer | undefined;
  let originalSecureContext: boolean | undefined;
  let originalFetch: typeof globalThis.fetch;

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    originalMatchMedia = window.matchMedia;
    originalUserAgent = window.navigator.userAgent;
    originalServiceWorker = navigator.serviceWorker;
    originalSecureContext = window.isSecureContext;
    originalFetch = globalThis.fetch;
  });

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockMatchMedia();
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
    localStorage.clear();
    if (originalMatchMedia) window.matchMedia = originalMatchMedia;
    setUserAgent(originalUserAgent);
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: originalServiceWorker });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: originalSecureContext });
    globalThis.fetch = originalFetch;
    delete (window.navigator as Navigator & { standalone?: boolean }).standalone;
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  async function renderHarness({ hasMobileNav = false }: { hasMobileNav?: boolean } = {}) {
    await act(async () => {
      root.render(
        <PwaInstallExperienceProvider>
          <Harness hasMobileNav={hasMobileNav} />
        </PwaInstallExperienceProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('shows manual add-to-home-screen guidance on eligible iOS Safari', async () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
    );
    await renderHarness();

    expect(container.querySelector('[data-testid="pwa-install-banner"]')).not.toBeNull();
    const primaryButton = container.querySelector('[data-testid="pwa-install-primary"]') as HTMLButtonElement;
    expect(primaryButton.textContent).toContain('添加到主屏幕');

    act(() => primaryButton.click());
    await flush();
    expect(container.querySelector('[data-testid="pwa-install-sheet"]')?.textContent).toContain('分享');
  });

  it('keeps the contextual banner below a mobile work surface', async () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
    );
    await renderHarness();

    expect(container.querySelector('[data-testid="pwa-install-banner"]')?.className).toContain('z-[29]');
  });

  it('hides the contextual banner from chat chrome while keeping the install guide available', async () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
    );
    await renderHarness({ hasMobileNav: true });

    expect(container.querySelector('[data-testid="pwa-install-banner"]')).toBeNull();
    act(() => (container.querySelector('[data-testid="open-install-guide"]') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="pwa-install-sheet"]')).not.toBeNull();
  });

  it('reports an unavailable manifest instead of offering manual iOS installation', async () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
    );
    globalThis.fetch = vi.fn(
      async () =>
        new Response('<html>proxy fallback</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    );
    await renderHarness();

    expect(container.querySelector('[data-testid="pwa-install-banner"]')).toBeNull();
    act(() => (container.querySelector('[data-testid="open-install-guide"]') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="pwa-install-diagnostics"]')?.textContent).toContain(
      '应用清单：不可用',
    );
  });

  it('invokes the browser install prompt when Android emits beforeinstallprompt', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/127.0.0.0 Mobile Safari/537.36');
    const prompt = vi.fn().mockResolvedValue(undefined);
    await renderHarness();

    const installEvent = new Event('beforeinstallprompt');
    Object.defineProperty(installEvent, 'prompt', { value: prompt });
    Object.defineProperty(installEvent, 'userChoice', {
      value: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });
    act(() => window.dispatchEvent(installEvent));
    await flush();

    const primaryButton = container.querySelector('[data-testid="pwa-install-primary"]') as HTMLButtonElement;
    expect(primaryButton.textContent).toContain('立即安装');
    act(() => primaryButton.click());
    await flush();

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="pwa-install-banner"]')).toBeNull();
  });

  it('consumes a dismissed browser install prompt before showing manual guidance', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/127.0.0.0 Mobile Safari/537.36');
    const prompt = vi.fn().mockResolvedValue(undefined);
    await renderHarness();

    const installEvent = new Event('beforeinstallprompt');
    Object.defineProperty(installEvent, 'prompt', { value: prompt });
    Object.defineProperty(installEvent, 'userChoice', {
      value: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    });
    act(() => window.dispatchEvent(installEvent));
    await flush();

    act(() => (container.querySelector('[data-testid="pwa-install-primary"]') as HTMLButtonElement).click());
    await flush();

    expect(prompt).toHaveBeenCalledTimes(1);
    const sheet = container.querySelector('[data-testid="pwa-install-sheet"]') as HTMLElement;
    expect(sheet).toBeTruthy();
    expect([...sheet.querySelectorAll('button')].some((button) => button.textContent === '立即安装')).toBe(false);
  });

  it('consumes a browser install prompt that throws before showing manual guidance', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/127.0.0.0 Mobile Safari/537.36');
    const prompt = vi.fn().mockRejectedValue(new Error('prompt unavailable'));
    await renderHarness();

    const installEvent = new Event('beforeinstallprompt');
    Object.defineProperty(installEvent, 'prompt', { value: prompt });
    Object.defineProperty(installEvent, 'userChoice', {
      value: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    });
    act(() => window.dispatchEvent(installEvent));
    await flush();

    act(() => (container.querySelector('[data-testid="pwa-install-primary"]') as HTMLButtonElement).click());
    await flush();

    expect(prompt).toHaveBeenCalledTimes(1);
    const sheet = container.querySelector('[data-testid="pwa-install-sheet"]') as HTMLElement;
    expect(sheet).toBeTruthy();
    expect([...sheet.querySelectorAll('button')].some((button) => button.textContent === '立即安装')).toBe(false);
  });

  it('keeps the contextual banner hidden for desktop and standalone modes', async () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
    );
    mockMatchMedia({ desktop: true });
    await renderHarness();
    expect(container.querySelector('[data-testid="pwa-install-banner"]')).toBeNull();

    act(() => root.unmount());
    root = createRoot(container);
    mockMatchMedia({ standalone: true });
    await renderHarness();
    expect(container.querySelector('[data-testid="pwa-install-banner"]')).toBeNull();
  });

  it('opens precise diagnostics from the persistent entry when secure context and SW are missing', async () => {
    setUserAgent(
      'Mozilla/5.0 (Linux; Android 15; Pixel Build/AP3A; wv) AppleWebKit/537.36 Version/4.0 Chrome/127 Mobile Safari/537.36',
    );
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined });
    await renderHarness();

    expect(container.querySelector('[data-testid="pwa-install-banner"]')).toBeNull();
    act(() => (container.querySelector('[data-testid="open-install-guide"]') as HTMLButtonElement).click());

    const diagnostics = container.querySelector('[data-testid="pwa-install-diagnostics"]');
    expect(diagnostics?.textContent).toContain('需要 HTTPS');
    expect(diagnostics?.textContent).toContain('Service Worker 未就绪');
    expect(diagnostics?.textContent).toContain('请改用系统浏览器');
  });

  it('treats install guidance as a focus-contained dialog and restores its opener', async () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
    );
    await renderHarness();

    const installEvent = new Event('beforeinstallprompt');
    Object.defineProperty(installEvent, 'prompt', { value: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(installEvent, 'userChoice', {
      value: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    });
    act(() => window.dispatchEvent(installEvent));
    await flush();

    const opener = container.querySelector('[data-testid="open-install-guide"]') as HTMLButtonElement;
    opener.focus();
    act(() => opener.click());

    const sheet = container.querySelector('[data-testid="pwa-install-sheet"]') as HTMLElement;
    const closeButton = [...sheet.querySelectorAll('button')].find(
      (button) => button.textContent === '稍后',
    ) as HTMLButtonElement;
    const installButton = [...sheet.querySelectorAll('button')].find(
      (button) => button.textContent === '立即安装',
    ) as HTMLButtonElement;
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(closeButton);

    installButton.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => installButton.dispatchEvent(tab));
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton);

    const shiftTab = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => closeButton.dispatchEvent(shiftTab));
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(installButton);

    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('[data-testid="pwa-install-sheet"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('remembers banner dismissal across provider remounts', async () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
    );
    await renderHarness();
    act(() => (container.querySelector('[aria-label="关闭安装提示"]') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="pwa-install-banner"]')).toBeNull();

    act(() => root.unmount());
    root = createRoot(container);
    await renderHarness();
    expect(container.querySelector('[data-testid="pwa-install-banner"]')).toBeNull();
  });
});
