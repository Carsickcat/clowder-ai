import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaInstallPrompt } from '../PwaInstallPrompt';

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  });
}

function mockMatchMedia({ desktop = false, standalone = false }: { desktop?: boolean; standalone?: boolean } = {}) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches:
      (query.includes('min-width: 768px') && desktop) ||
      (query.includes('display-mode: standalone') && standalone),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('PwaInstallPrompt', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalMatchMedia: typeof window.matchMedia | undefined;
  let originalUserAgent: string;

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    originalMatchMedia = window.matchMedia;
    originalUserAgent = window.navigator.userAgent;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockMatchMedia();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    }
    setUserAgent(originalUserAgent);
    delete (window.navigator as Navigator & { standalone?: boolean }).standalone;
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('shows manual add-to-home-screen guidance on iOS mobile browsers', async () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    );

    act(() => {
      root.render(React.createElement(PwaInstallPrompt, { hasMobileNav: true }));
    });

    const banner = container.querySelector('[data-testid="pwa-install-banner"]');
    expect(banner).toBeTruthy();
    expect(banner?.textContent).toContain('装到手机桌面');

    const primaryButton = container.querySelector('[data-testid="pwa-install-primary"]') as HTMLButtonElement;
    expect(primaryButton.textContent).toContain('添加到主屏幕');

    act(() => {
      primaryButton.click();
    });
    await flush();

    const sheet = container.querySelector('[data-testid="pwa-install-sheet"]');
    expect(sheet).toBeTruthy();
    expect(sheet?.textContent).toContain('分享');
    expect(sheet?.textContent).toContain('添加到主屏幕');
  });

  it('invokes the browser install prompt when beforeinstallprompt is available', async () => {
    setUserAgent(
      'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    );

    const prompt = vi.fn().mockResolvedValue(undefined);

    act(() => {
      root.render(React.createElement(PwaInstallPrompt, { hasMobileNav: true }));
    });

    const installEvent = new Event('beforeinstallprompt');
    Object.defineProperty(installEvent, 'prompt', { value: prompt });
    Object.defineProperty(installEvent, 'userChoice', {
      value: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    act(() => {
      window.dispatchEvent(installEvent);
    });
    await flush();

    const primaryButton = container.querySelector('[data-testid="pwa-install-primary"]') as HTMLButtonElement;
    expect(primaryButton.textContent).toContain('立即安装');

    act(() => {
      primaryButton.click();
    });
    await flush();

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="pwa-install-banner"]')).toBeNull();
  });

  it('stays hidden on desktop browsers', () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    );
    mockMatchMedia({ desktop: true });

    act(() => {
      root.render(React.createElement(PwaInstallPrompt, { hasMobileNav: true }));
    });

    expect(container.querySelector('[data-testid="pwa-install-banner"]')).toBeNull();
  });

  it('stays hidden when already running in standalone mode', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    );
    mockMatchMedia({ standalone: true });

    act(() => {
      root.render(React.createElement(PwaInstallPrompt, { hasMobileNav: true }));
    });

    expect(container.querySelector('[data-testid="pwa-install-banner"]')).toBeNull();
  });
});
