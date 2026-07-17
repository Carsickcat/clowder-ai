export type InstallPlatform = 'ios' | 'android' | 'other';
export type PwaManifestStatus = 'checking' | 'ready' | 'unavailable';
export type PwaInstallBlocker =
  | 'desktop'
  | 'already-installed'
  | 'insecure-context'
  | 'webview'
  | 'offline'
  | 'service-worker-unavailable'
  | 'service-worker-not-ready'
  | 'manifest-unavailable'
  | 'not-installable';

export type PwaInstallFacts = {
  platform: InstallPlatform;
  isDesktop: boolean;
  isSecureContext: boolean;
  isStandalone: boolean;
  isWebView: boolean;
  isOnline: boolean;
  serviceWorkerSupported: boolean;
  serviceWorkerReady: boolean;
  manifestStatus: PwaManifestStatus;
  hasNativePrompt: boolean;
};

export type PwaInstallability = {
  bannerEligible: boolean;
  primaryAction: 'native' | 'manual' | 'diagnostics';
  blockers: PwaInstallBlocker[];
};

export const PWA_DISMISSAL_STORAGE_KEY = 'clowder-ai:pwa-install-banner-dismissed-until';
export const PWA_BANNER_DISMISSAL_MS = 30 * 24 * 60 * 60 * 1000;

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

export function detectInstallPlatform(userAgent: string): InstallPlatform {
  const normalized = userAgent.toLowerCase();
  if (/(iphone|ipad|ipod)/.test(normalized)) return 'ios';
  if (normalized.includes('android')) return 'android';
  return 'other';
}

export function detectWebView(userAgent: string, platform = detectInstallPlatform(userAgent)): boolean {
  const normalized = userAgent.toLowerCase();
  if (/(fban|fbav|instagram|line\/|micromessenger)/.test(normalized)) return true;
  if (platform === 'ios') return !normalized.includes('safari');
  if (platform === 'android') return /;\s*wv\)|\bwv\b|version\/4\.0/.test(normalized);
  return false;
}

export function derivePwaInstallability(facts: PwaInstallFacts): PwaInstallability {
  const blockers: PwaInstallBlocker[] = [];
  if (facts.isDesktop) blockers.push('desktop');
  if (facts.isStandalone) blockers.push('already-installed');
  if (!facts.isSecureContext) blockers.push('insecure-context');
  if (facts.isWebView) blockers.push('webview');
  if (!facts.isOnline) blockers.push('offline');
  if (!facts.serviceWorkerSupported) blockers.push('service-worker-unavailable');
  else if (!facts.serviceWorkerReady) blockers.push('service-worker-not-ready');
  if (facts.manifestStatus !== 'ready') blockers.push('manifest-unavailable');

  const supportsManualInstall = facts.platform === 'ios' && !facts.isWebView;
  if (!facts.hasNativePrompt && !supportsManualInstall && blockers.length === 0) blockers.push('not-installable');

  return {
    bannerEligible: blockers.length === 0,
    primaryAction:
      blockers.length > 0
        ? 'diagnostics'
        : facts.hasNativePrompt
          ? 'native'
          : supportsManualInstall
            ? 'manual'
            : 'diagnostics',
    blockers,
  };
}

export function readPwaDismissedUntil(storage: ReadableStorage): number {
  const parsed = Number(storage.getItem(PWA_DISMISSAL_STORAGE_KEY));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function writePwaDismissal(storage: WritableStorage, now = Date.now()): number {
  const dismissedUntil = now + PWA_BANNER_DISMISSAL_MS;
  storage.setItem(PWA_DISMISSAL_STORAGE_KEY, String(dismissedUntil));
  return dismissedUntil;
}
