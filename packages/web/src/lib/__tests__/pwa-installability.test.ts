import { describe, expect, it } from 'vitest';
import {
  derivePwaInstallability,
  detectInstallPlatform,
  detectWebView,
  PWA_BANNER_DISMISSAL_MS,
  readPwaDismissedUntil,
  writePwaDismissal,
  type PwaInstallFacts,
} from '../pwa-installability';

const BASE_FACTS: PwaInstallFacts = {
  platform: 'android',
  isDesktop: false,
  isSecureContext: true,
  isStandalone: false,
  isWebView: false,
  isOnline: true,
  serviceWorkerSupported: true,
  serviceWorkerReady: true,
  hasNativePrompt: false,
};

describe('PWA installability state machine', () => {
  it('offers manual install on iOS Safari and native install only after Android emits its prompt', () => {
    expect(derivePwaInstallability({ ...BASE_FACTS, platform: 'ios' })).toMatchObject({
      bannerEligible: true,
      primaryAction: 'manual',
      blockers: [],
    });
    expect(derivePwaInstallability(BASE_FACTS)).toMatchObject({
      bannerEligible: false,
      primaryAction: 'diagnostics',
      blockers: ['not-installable'],
    });
    expect(derivePwaInstallability({ ...BASE_FACTS, hasNativePrompt: true })).toMatchObject({
      bannerEligible: true,
      primaryAction: 'native',
      blockers: [],
    });
  });

  it.each([
    ['insecure-context', { isSecureContext: false }],
    ['service-worker-not-ready', { serviceWorkerReady: false }],
    ['webview', { isWebView: true }],
    ['offline', { isOnline: false }],
    ['already-installed', { isStandalone: true }],
  ] as const)('exposes %s as a precise diagnostic blocker', (blocker, patch) => {
    const result = derivePwaInstallability({ ...BASE_FACTS, hasNativePrompt: true, ...patch });
    expect(result.bannerEligible).toBe(false);
    expect(result.blockers).toContain(blocker);
  });

  it('distinguishes system browsers from common iOS and Android WebViews', () => {
    const iosSafari =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1';
    const iosWebView =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
    const androidWebView =
      'Mozilla/5.0 (Linux; Android 15; Pixel Build/AP3A; wv) AppleWebKit/537.36 Version/4.0 Chrome/127 Mobile Safari/537.36';

    expect(detectInstallPlatform(iosSafari)).toBe('ios');
    expect(detectWebView(iosSafari, 'ios')).toBe(false);
    expect(detectWebView(iosWebView, 'ios')).toBe(true);
    expect(detectWebView(androidWebView, 'android')).toBe(true);
  });

  it('persists contextual-banner dismissal for exactly 30 days', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const now = 1_700_000_000_000;

    expect(writePwaDismissal(storage, now)).toBe(now + PWA_BANNER_DISMISSAL_MS);
    expect(readPwaDismissedUntil(storage)).toBe(now + PWA_BANNER_DISMISSAL_MS);
  });
});
