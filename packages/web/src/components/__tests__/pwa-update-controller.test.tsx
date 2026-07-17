import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PWA_BEFORE_RELOAD_EVENT, PWA_RECOVERY_EVENT } from '@/lib/pwa-lifecycle';
import { PwaUpdateController } from '../pwa/PwaUpdateController';

type Listener = EventListenerOrEventListenerObject;

function createServiceWorkerHarness(initialController: object | null = {}) {
  const serviceWorkerListeners = new Map<string, Set<Listener>>();
  const registrationListeners = new Map<string, Set<Listener>>();
  const installingListeners = new Map<string, Set<Listener>>();
  const waitingWorker = { postMessage: vi.fn() };
  let installingState: ServiceWorkerState = 'installing';
  const installingWorker = {
    get state() {
      return installingState;
    },
    addEventListener: vi.fn((type: string, listener: Listener) => {
      const current = installingListeners.get(type) ?? new Set<Listener>();
      current.add(listener);
      installingListeners.set(type, current);
    }),
    removeEventListener: vi.fn((type: string, listener: Listener) => installingListeners.get(type)?.delete(listener)),
  } as unknown as ServiceWorker;
  const registration = {
    waiting: null as typeof waitingWorker | null,
    installing: null as ServiceWorker | null,
    update: vi.fn(async () => undefined),
    addEventListener: vi.fn((type: string, listener: Listener) => {
      const current = registrationListeners.get(type) ?? new Set<Listener>();
      current.add(listener);
      registrationListeners.set(type, current);
    }),
    removeEventListener: vi.fn((type: string, listener: Listener) => registrationListeners.get(type)?.delete(listener)),
  };
  const serviceWorker = {
    controller: initialController,
    getRegistration: vi.fn(async () => registration),
    addEventListener: vi.fn((type: string, listener: Listener) => {
      const current = serviceWorkerListeners.get(type) ?? new Set<Listener>();
      current.add(listener);
      serviceWorkerListeners.set(type, current);
    }),
    removeEventListener: vi.fn((type: string, listener: Listener) =>
      serviceWorkerListeners.get(type)?.delete(listener),
    ),
  };

  const emit = (listeners: Map<string, Set<Listener>>, type: string) => {
    const event = new Event(type);
    for (const listener of listeners.get(type) ?? []) {
      if (typeof listener === 'function') listener(event);
      else listener.handleEvent(event);
    }
  };

  return {
    emitRegistration: (type: string) => emit(registrationListeners, type),
    emitServiceWorker: (type: string) => emit(serviceWorkerListeners, type),
    emitInstallingState: (state: ServiceWorkerState) => {
      installingState = state;
      emit(installingListeners, 'statechange');
    },
    installingWorker,
    registration,
    serviceWorker,
    waitingWorker,
  };
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
    vi.restoreAllMocks();
  });

  it('keeps a waiting worker inert until confirmation, then reloads once after it takes control', async () => {
    const harness = createServiceWorkerHarness();
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: harness.serviceWorker });
    const reloadPage = vi.fn();

    await act(async () => {
      root.render(<PwaUpdateController reloadPage={reloadPage} />);
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain('新版本已就绪');

    harness.registration.waiting = harness.waitingWorker;
    act(() => harness.emitRegistration('updatefound'));
    expect(container.textContent).toContain('新版本已就绪');
    expect(reloadPage).not.toHaveBeenCalled();
    expect(harness.waitingWorker.postMessage).not.toHaveBeenCalled();

    const updateButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('更新并重新载入'),
    ) as HTMLButtonElement;
    act(() => {
      updateButton.click();
      updateButton.click();
    });
    expect(harness.waitingWorker.postMessage).toHaveBeenCalledTimes(1);
    expect(harness.waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reloadPage).not.toHaveBeenCalled();

    act(() => {
      harness.emitServiceWorker('controllerchange');
      harness.emitServiceWorker('controllerchange');
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
    harness.registration.waiting = harness.waitingWorker;
    act(() => harness.emitRegistration('updatefound'));
    const updateButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('更新并重新载入'),
    ) as HTMLButtonElement;
    act(() => updateButton.click());

    expect(reloadPage).not.toHaveBeenCalled();
    expect(harness.waitingWorker.postMessage).not.toHaveBeenCalled();
    expect(container.textContent).toContain('仍有未保存的内容');
    window.removeEventListener(PWA_BEFORE_RELOAD_EVENT, protectTransientWork);
  });

  it('surfaces a worker only after its installation reaches the waiting phase', async () => {
    const harness = createServiceWorkerHarness();
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: harness.serviceWorker });

    await act(async () => {
      root.render(<PwaUpdateController reloadPage={vi.fn()} />);
      await Promise.resolve();
    });
    harness.registration.installing = harness.installingWorker;
    act(() => harness.emitRegistration('updatefound'));
    expect(container.textContent).not.toContain('新版本已就绪');

    harness.registration.waiting = harness.waitingWorker;
    act(() => harness.emitInstallingState('installed'));
    expect(container.textContent).toContain('新版本已就绪');
  });

  it('observes an installing worker that already exists when the controller mounts', async () => {
    const harness = createServiceWorkerHarness();
    harness.registration.installing = harness.installingWorker;
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: harness.serviceWorker });

    await act(async () => {
      root.render(<PwaUpdateController reloadPage={vi.fn()} />);
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain('新版本已就绪');
    expect(harness.installingWorker.addEventListener).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });
    expect(harness.installingWorker.addEventListener).toHaveBeenCalledTimes(1);

    harness.registration.waiting = harness.waitingWorker;
    act(() => harness.emitInstallingState('installed'));

    expect(container.textContent).toContain('新版本已就绪');
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

  it('still emits foreground recovery when Service Worker is unsupported', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    const recovery = vi.fn();
    window.addEventListener(PWA_RECOVERY_EVENT, recovery);

    await act(async () => {
      root.render(<PwaUpdateController reloadPage={vi.fn()} />);
      await Promise.resolve();
    });
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    expect(recovery).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="pwa-update-status"]')).toBeNull();
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
    act(() => harness.emitServiceWorker('controllerchange'));

    expect(container.textContent).not.toContain('新版本已就绪');
  });

  it('keeps background registration failures out of the task surface', async () => {
    const harness = createServiceWorkerHarness();
    harness.serviceWorker.getRegistration.mockRejectedValueOnce(new Error('registration failed'));
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: harness.serviceWorker });
    const reloadPage = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await act(async () => {
      root.render(<PwaUpdateController reloadPage={reloadPage} />);
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain('更新检查失败');
    expect(reloadPage).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="pwa-update-status"]')).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});
