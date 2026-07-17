import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PWA_BANNER_DISMISSAL_MS, PWA_DISMISSAL_STORAGE_KEY } from '@/lib/pwa-installability';
import {
  PwaInstallExperienceProvider,
  usePwaInstallExperience,
} from '../pwa/PwaInstallExperienceProvider';

function Harness() {
  const experience = usePwaInstallExperience();
  return (
    <div>
      <span data-testid="platform">{experience.facts.platform}</span>
      <span data-testid="eligible">{String(experience.installability.bannerEligible)}</span>
      <span data-testid="dismissed">{String(experience.isBannerDismissed)}</span>
      <span data-testid="guide-open">{String(experience.guideOpen)}</span>
      <button type="button" onClick={experience.dismissBanner}>
        dismiss
      </button>
      <button type="button" onClick={experience.openGuide}>
        guide
      </button>
    </div>
  );
}

describe('PwaInstallExperienceProvider', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalUserAgent: string;
  let originalServiceWorker: ServiceWorkerContainer | undefined;
  let originalMatchMedia: typeof window.matchMedia | undefined;
  let originalSecureContext: boolean | undefined;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    originalUserAgent = navigator.userAgent;
    originalServiceWorker = navigator.serviceWorker;
    originalMatchMedia = window.matchMedia;
    originalSecureContext = window.isSecureContext;
    localStorage.clear();
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
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: originalUserAgent });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: originalServiceWorker });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: originalSecureContext });
    if (originalMatchMedia) window.matchMedia = originalMatchMedia;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('persists a 30-day dismissal without reopening when installability later changes', async () => {
    const now = Date.now();
    await act(async () => {
      root.render(
        <PwaInstallExperienceProvider>
          <Harness />
        </PwaInstallExperienceProvider>,
      );
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="platform"]')?.textContent).toBe('ios');
    expect(container.querySelector('[data-testid="eligible"]')?.textContent).toBe('true');

    act(() => (container.querySelector('button') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="dismissed"]')?.textContent).toBe('true');
    const deadline = Number(localStorage.getItem(PWA_DISMISSAL_STORAGE_KEY));
    expect(deadline).toBeGreaterThanOrEqual(now + PWA_BANNER_DISMISSAL_MS);

    act(() => window.dispatchEvent(new Event('beforeinstallprompt')));
    expect(container.querySelector('[data-testid="dismissed"]')?.textContent).toBe('true');

    act(() => (container.querySelectorAll('button')[1] as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="guide-open"]')?.textContent).toBe('true');
  });
});
