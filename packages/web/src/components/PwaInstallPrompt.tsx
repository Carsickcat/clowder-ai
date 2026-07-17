'use client';

import { useMemo, useRef } from 'react';
import { useModalFocus } from '@/hooks/useModalFocus';
import type { InstallPlatform, PwaInstallFacts } from '@/lib/pwa-installability';
import { usePwaInstallExperience } from './pwa/PwaInstallExperienceProvider';

function getManualSteps(platform: InstallPlatform): string[] {
  if (platform === 'ios') {
    return ['在 Safari 里点“分享”。', '选择“添加到主屏幕”。', '回到桌面后，从 Clowder AI 图标进入。'];
  }
  return [
    '在系统浏览器菜单里找“安装应用”或“添加到主屏幕”。',
    '确认后把 Clowder AI 固定到手机桌面。',
    '如果安装项没有出现，请查看下方诊断并修复阻塞项。',
  ];
}

function InstallDiagnostics({ facts }: { facts: PwaInstallFacts }) {
  const rows = [
    facts.isSecureContext ? '安全连接：HTTPS 已就绪' : '安全连接：需要 HTTPS',
    facts.serviceWorkerSupported && facts.serviceWorkerReady
      ? '离线基础：Service Worker 已就绪'
      : '离线基础：Service Worker 未就绪',
    facts.manifestStatus === 'ready'
      ? '应用清单：已就绪'
      : facts.manifestStatus === 'checking'
        ? '应用清单：正在检测'
        : '应用清单：不可用',
    facts.isWebView ? '浏览器环境：请改用系统浏览器' : '浏览器环境：系统浏览器可用',
    facts.isOnline ? '网络状态：已连接' : '网络状态：当前离线',
    facts.isStandalone
      ? '安装状态：已在独立窗口运行'
      : facts.hasNativePrompt
        ? '安装状态：浏览器已允许安装'
        : facts.platform === 'ios'
          ? '安装状态：使用“添加到主屏幕”'
          : '安装状态：等待浏览器确认可安装',
  ];

  return (
    <div
      className="mt-4 rounded-2xl border border-cafe bg-cafe-surface-sunken p-3"
      data-testid="pwa-install-diagnostics"
    >
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cafe-muted">环境诊断</p>
      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-cafe-secondary">
        {rows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    </div>
  );
}

export function PwaInstallPrompt({ hasMobileNav = false }: { hasMobileNav?: boolean }) {
  const { facts, installability, isBannerDismissed, guideOpen, openGuide, closeGuide, dismissBanner, promptInstall } =
    usePwaInstallExperience();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useModalFocus<HTMLElement>({
    active: guideOpen,
    onEscape: closeGuide,
    initialFocusRef: closeButtonRef,
  });
  const manualSteps = useMemo(() => getManualSteps(facts.platform), [facts.platform]);
  const showBanner = installability.bannerEligible && !isBannerDismissed && !hasMobileNav;
  const primaryLabel =
    installability.primaryAction === 'native'
      ? '立即安装'
      : installability.primaryAction === 'manual'
        ? '添加到主屏幕'
        : '查看安装诊断';

  if (!showBanner && !guideOpen) return null;

  return (
    <>
      {showBanner && (
        <div
          className="fixed z-[29] lg:hidden"
          style={{
            left: 'calc(env(safe-area-inset-left) + 0.75rem)',
            right: 'calc(env(safe-area-inset-right) + 0.75rem)',
            bottom: 'calc(var(--mobile-keyboard-inset, 0px) + env(safe-area-inset-bottom) + 0.75rem)',
          }}
          data-testid="pwa-install-banner"
        >
          <div className="rounded-2xl border border-[var(--console-border-soft)] bg-[var(--console-card-bg)] px-4 py-3 shadow-xl backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--console-hover-bg)] text-base">
                📱
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-cafe-black">把 Clowder AI 装到手机桌面</p>
                <p className="mt-1 text-xs leading-5 text-cafe-secondary">
                  通过 Tailscale 全屏打开，功能和当前网页保持一致。
                </p>
              </div>
              <button
                type="button"
                onClick={dismissBanner}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-cafe-muted transition-colors hover:bg-[var(--console-hover-bg)] hover:text-cafe-secondary"
                aria-label="关闭安装提示"
              >
                ×
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void promptInstall()}
                className="console-button-primary min-h-11 text-xs"
                data-testid="pwa-install-primary"
              >
                {primaryLabel}
              </button>
              <button
                type="button"
                onClick={openGuide}
                className="min-h-11 rounded-xl px-3 py-2 text-xs text-cafe-secondary transition-colors hover:bg-[var(--console-hover-bg)] hover:text-cafe-black"
              >
                安装说明
              </button>
            </div>
          </div>
        </div>
      )}

      {guideOpen && (
        <div className="mobile-visual-viewport safe-area-inline fixed inset-x-0 z-[60] flex items-end px-3">
          <button
            type="button"
            tabIndex={-1}
            className="absolute inset-0 bg-[var(--console-overlay-medium)]"
            aria-label="关闭 PWA 安装说明"
            onClick={closeGuide}
          />
          <section
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className="relative mx-auto w-full max-w-lg rounded-t-[28px] border border-[var(--console-border-soft)] bg-[var(--console-card-bg)] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl"
            aria-label="PWA 安装说明"
            data-testid="pwa-install-sheet"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[var(--console-border-soft)]" />
            <h2 className="text-base font-semibold text-cafe-black">像 app 一样打开 Clowder AI</h2>
            <p className="mt-2 text-sm leading-6 text-cafe-secondary">
              安装后会以独立窗口运行；业务、身份和数据仍与当前 Clowder AI 完全同源。
            </p>

            <div className="mt-4 rounded-2xl bg-[var(--console-card-soft-bg)] p-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-cafe-muted">安装步骤</p>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-cafe-secondary">
                {manualSteps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--console-hover-bg)] text-micro font-semibold text-cafe-black">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <InstallDiagnostics facts={facts} />

            <div className="mt-4 flex justify-end gap-2">
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeGuide}
                className="min-h-11 rounded-xl px-3 py-2 text-sm text-cafe-secondary transition-colors hover:bg-[var(--console-hover-bg)] hover:text-cafe-black"
              >
                稍后
              </button>
              {facts.hasNativePrompt && !facts.isStandalone && (
                <button
                  type="button"
                  onClick={() => void promptInstall()}
                  className="console-button-primary min-h-11 text-sm"
                >
                  立即安装
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
