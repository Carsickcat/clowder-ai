'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  derivePwaInstallability,
  detectInstallPlatform,
  detectWebView,
  PWA_BANNER_DISMISSAL_MS,
  type PwaInstallability,
  type PwaInstallFacts,
  readPwaDismissedUntil,
  writePwaDismissal,
} from '@/lib/pwa-installability';
import { WIDE_SHELL_QUERY } from '@/lib/responsive-breakpoints';

export interface DeferredInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PwaInstallExperience {
  facts: PwaInstallFacts;
  installability: PwaInstallability;
  isBannerDismissed: boolean;
  guideOpen: boolean;
  openGuide: () => void;
  closeGuide: () => void;
  dismissBanner: () => void;
  promptInstall: () => Promise<void>;
}

const PwaInstallExperienceContext = createContext<PwaInstallExperience | null>(null);

const SERVER_INSTALL_FACTS: PwaInstallFacts = {
  platform: 'other',
  isDesktop: false,
  isSecureContext: false,
  isStandalone: false,
  isWebView: false,
  isOnline: true,
  serviceWorkerSupported: false,
  serviceWorkerReady: false,
  manifestStatus: 'checking',
  hasNativePrompt: false,
};

function isStandaloneDisplayMode(): boolean {
  const standaloneByMedia =
    typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)').matches : false;
  const standaloneByNavigator = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneByMedia || standaloneByNavigator;
}

function readFacts(
  serviceWorkerReady: boolean,
  manifestStatus: PwaInstallFacts['manifestStatus'],
  hasNativePrompt: boolean,
): PwaInstallFacts {
  const userAgent = window.navigator.userAgent;
  const platform = detectInstallPlatform(userAgent);
  return {
    platform,
    isDesktop: typeof window.matchMedia === 'function' && window.matchMedia(WIDE_SHELL_QUERY).matches,
    isSecureContext: window.isSecureContext === true,
    isStandalone: isStandaloneDisplayMode(),
    isWebView: detectWebView(userAgent, platform),
    isOnline: window.navigator.onLine !== false,
    serviceWorkerSupported: 'serviceWorker' in window.navigator && Boolean(window.navigator.serviceWorker),
    serviceWorkerReady,
    manifestStatus,
    hasNativePrompt,
  };
}

async function readManifestStatus(): Promise<PwaInstallFacts['manifestStatus']> {
  try {
    const response = await fetch('/manifest.json', { cache: 'no-store' });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !/\bapplication\/(?:manifest\+json|json)\b/i.test(contentType)) return 'unavailable';
    const manifest = (await response.json()) as { name?: unknown; short_name?: unknown } | null;
    if (!manifest || (typeof manifest.name !== 'string' && typeof manifest.short_name !== 'string')) {
      return 'unavailable';
    }
    return 'ready';
  } catch {
    return 'unavailable';
  }
}

function readInitialDismissal(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return readPwaDismissedUntil(window.localStorage);
  } catch {
    return 0;
  }
}

export function PwaInstallExperienceProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPromptEvent | null>(null);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(
    () => typeof navigator !== 'undefined' && Boolean(navigator.serviceWorker?.controller),
  );
  const [environmentReady, setEnvironmentReady] = useState(false);
  const [manifestStatus, setManifestStatus] = useState<PwaInstallFacts['manifestStatus']>('checking');
  const [, setEnvironmentRevision] = useState(0);
  const [dismissedUntil, setDismissedUntil] = useState(readInitialDismissal);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    setEnvironmentReady(true);
    let active = true;
    const mediaQueries =
      typeof window.matchMedia === 'function'
        ? [window.matchMedia('(display-mode: standalone)'), window.matchMedia(WIDE_SHELL_QUERY)]
        : [];
    const refreshEnvironment = () => setEnvironmentRevision((revision) => revision + 1);
    const refreshManifest = async () => {
      const nextStatus = await readManifestStatus();
      if (active) setManifestStatus(nextStatus);
    };
    const handleOnline = () => {
      refreshEnvironment();
      setManifestStatus('checking');
      void refreshManifest();
    };
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPromptEvent);
      refreshEnvironment();
    };
    const handleInstalled = () => {
      setDeferredPrompt(null);
      setGuideOpen(false);
      refreshEnvironment();
    };
    const refreshServiceWorker = async () => {
      if (!navigator.serviceWorker) {
        setServiceWorkerReady(false);
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        setServiceWorkerReady(Boolean(navigator.serviceWorker.controller || registration?.active));
      } catch {
        setServiceWorkerReady(Boolean(navigator.serviceWorker.controller));
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', refreshEnvironment);
    for (const query of mediaQueries) query.addEventListener?.('change', refreshEnvironment);
    navigator.serviceWorker?.addEventListener?.('controllerchange', refreshServiceWorker);
    void refreshServiceWorker();
    void refreshManifest();

    return () => {
      active = false;
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', refreshEnvironment);
      for (const query of mediaQueries) query.removeEventListener?.('change', refreshEnvironment);
      navigator.serviceWorker?.removeEventListener?.('controllerchange', refreshServiceWorker);
    };
  }, []);

  const facts = environmentReady
    ? readFacts(serviceWorkerReady, manifestStatus, Boolean(deferredPrompt))
    : SERVER_INSTALL_FACTS;
  const installability = derivePwaInstallability(facts);
  const isBannerDismissed = dismissedUntil > Date.now();

  const dismissBanner = useCallback(() => {
    const now = Date.now();
    try {
      setDismissedUntil(writePwaDismissal(window.localStorage, now));
    } catch {
      setDismissedUntil(now + PWA_BANNER_DISMISSAL_MS);
    }
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt || typeof deferredPrompt.prompt !== 'function') {
      setGuideOpen(true);
      return;
    }
    const prompt = deferredPrompt;
    setDeferredPrompt(null);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        setGuideOpen(false);
        dismissBanner();
        return;
      }
    } catch {
      // The diagnostic guide is the safe fallback for rejected/failed native prompts.
    }
    setGuideOpen(true);
  }, [deferredPrompt, dismissBanner]);

  const value = useMemo<PwaInstallExperience>(
    () => ({
      facts,
      installability,
      isBannerDismissed,
      guideOpen,
      openGuide: () => setGuideOpen(true),
      closeGuide: () => setGuideOpen(false),
      dismissBanner,
      promptInstall,
    }),
    [dismissBanner, facts, guideOpen, installability, isBannerDismissed, promptInstall],
  );

  return <PwaInstallExperienceContext.Provider value={value}>{children}</PwaInstallExperienceContext.Provider>;
}

export function usePwaInstallExperience(): PwaInstallExperience {
  const value = useContext(PwaInstallExperienceContext);
  if (!value) throw new Error('usePwaInstallExperience must be used inside PwaInstallExperienceProvider');
  return value;
}
