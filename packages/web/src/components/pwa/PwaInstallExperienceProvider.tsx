'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  derivePwaInstallability,
  detectInstallPlatform,
  detectWebView,
  PWA_BANNER_DISMISSAL_MS,
  readPwaDismissedUntil,
  writePwaDismissal,
  type PwaInstallFacts,
  type PwaInstallability,
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

function isStandaloneDisplayMode(): boolean {
  const standaloneByMedia =
    typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)').matches : false;
  const standaloneByNavigator = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneByMedia || standaloneByNavigator;
}

function readFacts(serviceWorkerReady: boolean, hasNativePrompt: boolean): PwaInstallFacts {
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
    hasNativePrompt,
  };
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
  const [, setEnvironmentRevision] = useState(0);
  const [dismissedUntil, setDismissedUntil] = useState(readInitialDismissal);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const mediaQueries =
      typeof window.matchMedia === 'function'
        ? [window.matchMedia('(display-mode: standalone)'), window.matchMedia(WIDE_SHELL_QUERY)]
        : [];
    const refreshEnvironment = () => setEnvironmentRevision((revision) => revision + 1);
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
    window.addEventListener('online', refreshEnvironment);
    window.addEventListener('offline', refreshEnvironment);
    for (const query of mediaQueries) query.addEventListener?.('change', refreshEnvironment);
    navigator.serviceWorker?.addEventListener?.('controllerchange', refreshServiceWorker);
    void refreshServiceWorker();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('online', refreshEnvironment);
      window.removeEventListener('offline', refreshEnvironment);
      for (const query of mediaQueries) query.removeEventListener?.('change', refreshEnvironment);
      navigator.serviceWorker?.removeEventListener?.('controllerchange', refreshServiceWorker);
    };
  }, []);

  const facts = readFacts(serviceWorkerReady, Boolean(deferredPrompt));
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
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
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
