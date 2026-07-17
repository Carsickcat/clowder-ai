import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PWA_BEFORE_RELOAD_EVENT, PWA_RECOVERY_EVENT } from '@/lib/pwa-lifecycle';
import { PwaUpdateController } from '../pwa/PwaUpdateController';

type Listener = EventListenerOrEventListenerObject;

function createServiceWorkerHarness(initialController: object | null = {}) {
  const listeners = new Map<string, Set<Listener>>();
  const registration = {
    update: vi.fn(async () => undefined),
  };
  const serviceWorker = {
    controller: initialController,
    getRegistration: vi.fn(async () => registration),
    addEventListener: vi.fn((type: string, listener: Listener) => {
      const current = listeners.get(type) ?? new Set<Listener>();
      current.add(listener);
      listeners.set(type, current);
    }),
    removeEventListener: vi.fn((type: string, listener: Listener) => listeners.get(type)?.delete(listener)),
  };

  const emit = (type: string) => {
    const event = new Event(type);
    for (const listener of listeners.get(type) ?? []) {
      if (typeof listener === 'function') listener(event);
      else listener.handleEvent(event);
    }
  };

  return { emit, registration, serviceWorker };
}

describe('PwaUpdateController', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalServiceWorker: ServiceWorkerContainer | undefined;
  let originalVisibilityState: DocumentVisibilityState;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    originalServiceWorker = navigator.serviceWorker;
    originalVisibilityState = document.visibilityState;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: originalServiceWorker });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: originalVisibilityState });
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('surfaces a controller update without silently reloading and reloads at most once after confirmation', async () => {
    const harness = createServiceWorkerHarness();
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: harness.serviceWorker });
    const reloadPage = vi.fn();

    await act(async () => {
      root.render(<PwaUpdateController reloadPage={reloadPage} />);
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain('新版本已就绪');

    act(() => {
      harness.emit('controllerchange');
      harness.emit('controllerchange');
    });
    expect(container.textContent).toContain('新版本已就绪');
    expect(reloadPage).not.toHaveBeenCalled();

    const updateButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('更新并重新载入'),
    ) as HTMLButtonElement;
    act(() => {
      updateButton.click();
      updateButton.click();
    });
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it('honors a canceled pre-reload flush signal instead of losing transient work', async () => {
    const harness = createServiceWorkerHarness();
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: harness.serviceWorker });
    const reloadPage = vi.fn();
    const protectTransientWork = (event: Event) => event.preventDefault();
    window.addEventListener(PWA_BEFORE_RELOAD_EVENT, protectTransientWork);

    await act(async () => {
      root.render(<PwaUpdateController reloadPage={reloadPage} />);
      await Promise.resolve();
    });
    act(() => harness.emit('controllerchange'));
    const updateButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('更新并重新载入'),
    ) as HTMLButtonElement;
    act(() => updateButton.click());

    expect(reloadPage).not.toHaveBeenCalled();
    expect(container.textContent).toContain('仍有未保存的内容');
    window.removeEventListener(PWA_BEFORE_RELOAD_EVENT, protectTransientWork);
  });

  it('checks for a new worker and emits one recovery signal when returning to the foreground', async () => {
    const harness = createServiceWorkerHarness();
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: harness.serviceWorker });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    const recovery = vi.fn();
    window.addEventListener(PWA_RECOVERY_EVENT, recovery);

    await act(async () => {
      root.render(<PwaUpdateController reloadPage={vi.fn()} />);
      await Promise.resolve();
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(harness.registration.update).toHaveBeenCalledTimes(1);
    expect(recovery).toHaveBeenCalledTimes(1);
    window.removeEventListener(PWA_RECOVERY_EVENT, recovery);
  });

  it('does not report the first controller claim as a version update', async () => {
    const harness = createServiceWorkerHarness(null);
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: harness.serviceWorker });

    await act(async () => {
      root.render(<PwaUpdateController reloadPage={vi.fn()} />);
      await Promise.resolve();
    });
    harness.serviceWorker.controller = {};
    act(() => harness.emit('controllerchange'));

    expect(container.textContent).not.toContain('新版本已就绪');
  });

  it('surfaces registration failures without a reload loop and allows a manual retry', async () => {
    const harness = createServiceWorkerHarness();
    harness.serviceWorker.getRegistration
      .mockRejectedValueOnce(new Error('registration failed'))
      .mockResolvedValue(harness.registration);
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: harness.serviceWorker });
    const reloadPage = vi.fn();

    await act(async () => {
      root.render(<PwaUpdateController reloadPage={reloadPage} />);
      await Promise.resolve();
    });
    expect(container.textContent).toContain('更新检查失败');

    const retryButton = [...container.querySelectorAll('button')].find((button) => button.textContent === '重试');
    await act(async () => {
      retryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(reloadPage).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="pwa-update-status"]')).toBeNull();
    expect(harness.registration.update).toHaveBeenCalledTimes(1);
  });
});
