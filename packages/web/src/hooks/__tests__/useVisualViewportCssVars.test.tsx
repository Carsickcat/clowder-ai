import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisualViewportCssVars } from '../useVisualViewportCssVars';

function Harness() {
  useVisualViewportCssVars();
  return (
    <div className="app-viewport">
      <header>Trace header</header>
      <div className="mobile-transcript-scroller">
        <div data-chat-input-composer>
          <textarea aria-label="composer" />
        </div>
      </div>
    </div>
  );
}

interface ViewportTraceRecord {
  sequence: number;
  projectionId: number;
  source: string;
  stage: 'event' | 'initial' | 'immediate' | 'settled';
  phase: 'before' | 'after';
  eventTime: number;
  capturedAt: number;
  innerHeight: number;
  visualViewport: {
    top: number;
    left: number;
    width: number;
    height: number;
    scale: number;
  } | null;
  documentScroll: {
    windowX: number;
    windowY: number;
    documentElementTop: number;
    documentElementLeft: number;
    bodyTop: number;
    bodyLeft: number;
  };
  appShell: DOMRectSnapshot | null;
  header: DOMRectSnapshot | null;
  composer: DOMRectSnapshot | null;
  transcript: (DOMRectSnapshot & { scrollTop: number; scrollHeight: number; clientHeight: number }) | null;
  activeElement: string | null;
  css: Record<string, string | null> & { mobileKeyboardOpen: string | null };
}

interface DOMRectSnapshot {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

interface ViewportTracePayload {
  schemaVersion: 2;
  buildId: string;
  apiOrigin: string;
  pageUrl: string;
  pwaProvenance: {
    serviceWorker: {
      status: 'pending' | 'success' | 'unsupported' | 'error';
      controller: WorkerSnapshot | null;
      registration: {
        active: WorkerSnapshot | null;
        waiting: WorkerSnapshot | null;
        installing: WorkerSnapshot | null;
      } | null;
      error: { code: string; message: string } | null;
    };
    cacheStorage: {
      status: 'pending' | 'success' | 'unsupported' | 'error';
      names: string[] | null;
      error: { code: string; message: string } | null;
    };
  };
  capacity: number;
  records: ViewportTraceRecord[];
}

interface WorkerSnapshot {
  scriptURL: string;
  state: string;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function fakeWorker(scriptURL: string, state: ServiceWorkerState): ServiceWorker {
  return { scriptURL, state } as ServiceWorker;
}

function readTracePayload(): ViewportTracePayload {
  const payloadNode = document.querySelector<HTMLElement>('[data-viewport-geometry-debug-payload]');
  const details = payloadNode?.closest('details');
  if (details) {
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
  }
  if (!payloadNode?.textContent) throw new Error('Viewport trace payload is missing');
  const payload = JSON.parse(payloadNode.textContent) as ViewportTracePayload;
  if (details) {
    details.open = false;
    details.dispatchEvent(new Event('toggle'));
  }
  return payload;
}

async function waitForAnimationFrames(count = 2): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }
}

async function waitForViewportSettle(): Promise<void> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 160));
  await waitForAnimationFrames();
}

function installMutableViewport(height = 844, width = 390) {
  const viewport = new EventTarget() as EventTarget & {
    height: number;
    width: number;
    offsetTop: number;
    offsetLeft: number;
  };
  viewport.height = height;
  viewport.width = width;
  viewport.offsetTop = 0;
  viewport.offsetLeft = 0;
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  return viewport;
}

describe('useVisualViewportCssVars', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalVisualViewport: VisualViewport | null;
  let originalInnerHeight: number;
  let originalUrl: string;
  let originalNextData: unknown;
  let originalClipboardDescriptor: PropertyDescriptor | undefined;
  let originalServiceWorkerDescriptor: PropertyDescriptor | undefined;
  let originalCachesDescriptor: PropertyDescriptor | undefined;
  let originalAcceptanceTraceFlag: string | undefined;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    originalVisualViewport = window.visualViewport;
    originalInnerHeight = window.innerHeight;
    originalUrl = window.location.href;
    originalNextData = (window as unknown as Record<string, unknown>).__NEXT_DATA__;
    originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    originalServiceWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
    originalCachesDescriptor = Object.getOwnPropertyDescriptor(window, 'caches');
    originalAcceptanceTraceFlag = process.env.NEXT_PUBLIC_VIEWPORT_TRACE;
    delete process.env.NEXT_PUBLIC_VIEWPORT_TRACE;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: originalVisualViewport });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
    window.history.replaceState(null, '', originalUrl);
    if (originalNextData === undefined) Reflect.deleteProperty(window, '__NEXT_DATA__');
    else Reflect.set(window, '__NEXT_DATA__', originalNextData);
    if (originalClipboardDescriptor) Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
    else Reflect.deleteProperty(navigator, 'clipboard');
    if (originalServiceWorkerDescriptor)
      Object.defineProperty(navigator, 'serviceWorker', originalServiceWorkerDescriptor);
    else Reflect.deleteProperty(navigator, 'serviceWorker');
    if (originalCachesDescriptor) Object.defineProperty(window, 'caches', originalCachesDescriptor);
    else Reflect.deleteProperty(window, 'caches');
    if (originalAcceptanceTraceFlag === undefined) delete process.env.NEXT_PUBLIC_VIEWPORT_TRACE;
    else process.env.NEXT_PUBLIC_VIEWPORT_TRACE = originalAcceptanceTraceFlag;
    document.querySelectorAll('[data-viewport-geometry-debug]').forEach((node) => {
      node.remove();
    });
    document.querySelectorAll('[data-viewport-trace-test-flight]').forEach((node) => {
      node.remove();
    });
    document.documentElement.style.removeProperty('--app-viewport-height');
    document.documentElement.style.removeProperty('--app-viewport-top');
    document.documentElement.style.removeProperty('--app-viewport-left');
    document.documentElement.style.removeProperty('--app-viewport-width');
    document.documentElement.style.removeProperty('--app-keyboard-inset');
    delete document.documentElement.dataset.mobileKeyboardOpen;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('keeps viewport diagnostics completely absent unless vvdebug=1', () => {
    window.history.replaceState(null, '', '/thread/default');

    act(() => root.render(<Harness />));

    expect(document.querySelector('[data-viewport-geometry-debug]')).toBeNull();
    expect(document.querySelector('[data-viewport-geometry-debug-payload]')).toBeNull();
  });

  it('enables diagnostics at the standalone start URL only for an acceptance build', () => {
    process.env.NEXT_PUBLIC_VIEWPORT_TRACE = '1';
    window.history.replaceState(null, '', '/');

    act(() => root.render(<Harness />));

    expect(document.querySelector('[data-viewport-geometry-debug]')).not.toBeNull();
  });

  it('constrains the debug surface to the app viewport clipping layer', () => {
    window.history.replaceState(null, '', '/thread/default?vvdebug=1');

    act(() => root.render(<Harness />));

    const shell = container.querySelector<HTMLElement>('.app-viewport');
    const host = document.querySelector<HTMLElement>('[data-viewport-geometry-debug]');
    const panel = host?.querySelector<HTMLElement>('[data-viewport-geometry-debug-panel]');
    const copyButton = host?.querySelector<HTMLElement>('[data-viewport-geometry-debug-copy]');
    const details = host?.querySelector<HTMLElement>('details');
    expect(host?.parentElement).toBe(shell);
    expect(host?.style.position).toBe('absolute');
    expect(host?.style.inset).toBe('0');
    expect(host?.style.overflow).toBe('hidden');
    expect(host?.style.pointerEvents).toBe('none');
    expect(panel?.style.position).toBe('absolute');
    expect(copyButton?.style.pointerEvents).toBe('auto');
    expect(details?.style.pointerEvents).toBe('auto');
  });

  it('records ordered before/after geometry projections and exposes a copyable payload', async () => {
    window.history.replaceState(null, '', '/thread/default?vvdebug=1');
    Reflect.deleteProperty(window, '__NEXT_DATA__');
    const flightScript = document.createElement('script');
    flightScript.type = 'application/json';
    flightScript.dataset.viewportTraceTestFlight = 'true';
    flightScript.textContent = 'self.__next_f.push([1,"0:[{\\"buildId\\":\\"test-build-id\\"}]"])';
    document.head.appendChild(flightScript);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      width: number;
      offsetTop: number;
      offsetLeft: number;
      scale: number;
    };
    viewport.height = 844;
    viewport.width = 390;
    viewport.offsetTop = 0;
    viewport.offsetLeft = 0;
    viewport.scale = 1;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    act(() => root.render(<Harness />));

    expect(document.querySelector('[data-viewport-geometry-debug]')).not.toBeNull();
    let payload = readTracePayload();
    expect(payload).toMatchObject({
      schemaVersion: 2,
      buildId: 'test-build-id',
      pageUrl: expect.stringContaining('vvdebug=1'),
    });
    expect(payload.apiOrigin).toMatch(/^https?:\/\//);
    expect(payload.records.slice(0, 2).map(({ source, stage, phase }) => ({ source, stage, phase }))).toEqual([
      { source: 'mount', stage: 'initial', phase: 'before' },
      { source: 'mount', stage: 'initial', phase: 'after' },
    ]);

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    textarea.focus();
    viewport.height = 500;
    viewport.offsetTop = 96;
    const resizeEvent = new Event('resize');
    await act(async () => {
      viewport.dispatchEvent(resizeEvent);
      await waitForViewportSettle();
    });

    payload = readTracePayload();
    const eventPair = payload.records.filter(
      (record) => record.source === 'visualViewport.resize' && record.stage === 'event',
    );
    const immediatePair = payload.records.filter(
      (record) => record.source === 'visualViewport.resize' && record.stage === 'immediate',
    );
    const settledPair = payload.records.filter(
      (record) => record.source === 'visualViewport.resize' && record.stage === 'settled',
    );
    expect(eventPair.map((record) => record.phase)).toEqual(['before', 'after']);
    expect(new Set(eventPair.map((record) => record.projectionId)).size).toBe(1);
    expect(immediatePair.map((record) => record.phase)).toEqual(['before', 'after']);
    expect(new Set(immediatePair.map((record) => record.projectionId)).size).toBe(1);
    expect(new Set(immediatePair.map((record) => record.eventTime)).size).toBe(1);
    expect(settledPair.map((record) => record.phase)).toEqual(['before', 'after']);
    expect(settledPair[1]).toMatchObject({
      innerHeight: 844,
      visualViewport: { height: 500, top: 96, width: 390, scale: 1 },
      activeElement: expect.stringContaining('textarea'),
      appShell: expect.any(Object),
      header: expect.any(Object),
      composer: expect.any(Object),
      transcript: expect.objectContaining({ scrollTop: 0 }),
      css: expect.objectContaining({
        '--app-viewport-height': expect.any(String),
        '--app-keyboard-inset': expect.any(String),
        mobileKeyboardOpen: 'true',
      }),
    });

    const copyButton = document.querySelector<HTMLButtonElement>('[data-viewport-geometry-debug-copy]');
    expect(copyButton).not.toBeNull();
    copyButton?.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(JSON.parse(writeText.mock.calls[0][0] as string)).toEqual(readTracePayload());
  });

  it('records the controlling worker, registration lifecycle, and cache names after a pending probe', async () => {
    window.history.replaceState(null, '', '/thread/default?vvdebug=1');
    const registrationDeferred = createDeferred<ServiceWorkerRegistration | undefined>();
    const cachesDeferred = createDeferred<string[]>();
    const getRegistration = vi.fn(() => registrationDeferred.promise);
    const cacheKeys = vi.fn(() => cachesDeferred.promise);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: fakeWorker('https://phone.example/sw-controller.js', 'activated'),
        getRegistration,
      } as unknown as ServiceWorkerContainer,
    });
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: { keys: cacheKeys } as Pick<CacheStorage, 'keys'>,
    });

    act(() => root.render(<Harness />));

    expect(readTracePayload().pwaProvenance).toEqual({
      serviceWorker: {
        status: 'pending',
        controller: { scriptURL: 'https://phone.example/sw-controller.js', state: 'activated' },
        registration: null,
        error: null,
      },
      cacheStorage: { status: 'pending', names: null, error: null },
    });

    registrationDeferred.resolve({
      active: fakeWorker('https://phone.example/sw-active.js', 'activated'),
      waiting: fakeWorker('https://phone.example/sw-waiting.js', 'installed'),
      installing: fakeWorker('https://phone.example/sw-installing.js', 'installing'),
    } as ServiceWorkerRegistration);
    cachesDeferred.resolve(['next-cache-z', 'next-cache-a']);

    await vi.waitFor(() => {
      expect(readTracePayload().pwaProvenance).toEqual({
        serviceWorker: {
          status: 'success',
          controller: { scriptURL: 'https://phone.example/sw-controller.js', state: 'activated' },
          registration: {
            active: { scriptURL: 'https://phone.example/sw-active.js', state: 'activated' },
            waiting: { scriptURL: 'https://phone.example/sw-waiting.js', state: 'installed' },
            installing: { scriptURL: 'https://phone.example/sw-installing.js', state: 'installing' },
          },
          error: null,
        },
        cacheStorage: { status: 'success', names: ['next-cache-a', 'next-cache-z'], error: null },
      });
    });
    expect(getRegistration).toHaveBeenCalledOnce();
    expect(cacheKeys).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-viewport-geometry-debug]')?.textContent).toContain('SW success');
    expect(document.querySelector('[data-viewport-geometry-debug]')?.textContent).toContain('cache 2');
  });

  it('reports unsupported provenance sources explicitly', () => {
    window.history.replaceState(null, '', '/thread/default?vvdebug=1');
    Reflect.deleteProperty(navigator, 'serviceWorker');
    Reflect.deleteProperty(window, 'caches');

    act(() => root.render(<Harness />));

    expect(readTracePayload().pwaProvenance).toEqual({
      serviceWorker: { status: 'unsupported', controller: null, registration: null, error: null },
      cacheStorage: { status: 'unsupported', names: null, error: null },
    });
  });

  it('serializes service worker and cache probe rejections without dropping their fields', async () => {
    window.history.replaceState(null, '', '/thread/default?vvdebug=1');
    const getRegistration = vi.fn().mockRejectedValue(new Error('registration denied'));
    const cacheKeys = vi.fn().mockRejectedValue(new DOMException('cache denied', 'SecurityError'));
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: null, getRegistration } as unknown as ServiceWorkerContainer,
    });
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: { keys: cacheKeys } as Pick<CacheStorage, 'keys'>,
    });

    act(() => root.render(<Harness />));

    await vi.waitFor(() => {
      expect(readTracePayload().pwaProvenance).toEqual({
        serviceWorker: {
          status: 'error',
          controller: null,
          registration: null,
          error: { code: 'Error', message: 'registration denied' },
        },
        cacheStorage: {
          status: 'error',
          names: null,
          error: { code: 'SecurityError', message: 'cache denied' },
        },
      });
    });
  });

  it('does not write provenance results after the trace is unmounted', async () => {
    window.history.replaceState(null, '', '/thread/default?vvdebug=1');
    const registrationDeferred = createDeferred<ServiceWorkerRegistration | undefined>();
    const cachesDeferred = createDeferred<string[]>();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: null,
        getRegistration: vi.fn(() => registrationDeferred.promise),
      } as unknown as ServiceWorkerContainer,
    });
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: { keys: vi.fn(() => cachesDeferred.promise) } as Pick<CacheStorage, 'keys'>,
    });
    const probeContainer = document.createElement('div');
    document.body.appendChild(probeContainer);
    const probeRoot = createRoot(probeContainer);

    act(() => probeRoot.render(<Harness />));
    const payloadNode = document.querySelector<HTMLElement>('[data-viewport-geometry-debug-payload]');
    expect(readTracePayload().pwaProvenance.serviceWorker.status).toBe('pending');
    const details = payloadNode?.closest('details');
    if (details) {
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    }
    const payloadBeforeUnmount = payloadNode?.textContent;

    act(() => probeRoot.unmount());
    registrationDeferred.resolve(undefined);
    cachesDeferred.resolve(['late-cache']);
    await Promise.all([registrationDeferred.promise, cachesDeferred.promise]);
    await Promise.resolve();

    expect(document.querySelector('[data-viewport-geometry-debug]')).toBeNull();
    expect(payloadNode?.textContent).toBe(payloadBeforeUnmount);
    probeContainer.remove();
  });

  it('caps the trace ring and removes pending delivery plus debug DOM on unmount', async () => {
    window.history.replaceState(null, '', '/thread/default?vvdebug=1');
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      width: number;
      offsetTop: number;
      offsetLeft: number;
    };
    viewport.height = 844;
    viewport.width = 390;
    viewport.offsetTop = 0;
    viewport.offsetLeft = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    const probeContainer = document.createElement('div');
    document.body.appendChild(probeContainer);
    const probeRoot = createRoot(probeContainer);

    act(() => probeRoot.render(<Harness />));
    const capacity = readTracePayload().capacity;
    expect(capacity).toBeGreaterThan(0);

    await act(async () => {
      for (let index = 0; index < Math.ceil(capacity / 2) + 4; index += 1) {
        viewport.offsetTop = index;
        viewport.dispatchEvent(new Event('scroll'));
        await waitForAnimationFrames(1);
      }
    });

    const boundedPayload = readTracePayload();
    expect(boundedPayload.records).toHaveLength(capacity);
    expect(boundedPayload.records[0].sequence).toBeGreaterThan(1);
    const payloadNode = document.querySelector<HTMLElement>('[data-viewport-geometry-debug-payload]');
    expect(payloadNode).not.toBeNull();
    const details = payloadNode?.closest('details');
    if (details) {
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    }

    viewport.dispatchEvent(new Event('resize'));
    const payloadBeforeUnmount = payloadNode?.textContent;
    act(() => probeRoot.unmount());
    viewport.dispatchEvent(new Event('resize'));
    viewport.dispatchEvent(new Event('scroll'));
    await waitForViewportSettle();

    expect(document.querySelector('[data-viewport-geometry-debug]')).toBeNull();
    expect(payloadNode?.textContent).toBe(payloadBeforeUnmount);
    probeContainer.remove();
  });

  it('freezes the root shell through a settled 112px keyboard-opening pulse', async () => {
    const viewport = installMutableViewport();

    act(() => root.render(<Harness />));
    (container.querySelector('textarea') as HTMLTextAreaElement).focus();
    await act(async () => waitForAnimationFrames());

    viewport.height = 112;
    viewport.offsetTop = 360;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 112 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-width')).toBe('390px');
  });

  it('freezes the root shell through a non-zero intermediate keyboard frame', async () => {
    const viewport = installMutableViewport();

    act(() => root.render(<Harness />));
    (container.querySelector('textarea') as HTMLTextAreaElement).focus();
    await act(async () => waitForAnimationFrames());

    viewport.height = 420;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 420 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');
  });

  it('keeps the root frozen until two matching unobscured reads confirm keyboard close', async () => {
    const viewport = installMutableViewport();

    act(() => root.render(<Harness />));
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    textarea.focus();
    viewport.height = 500;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });
    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');

    textarea.blur();
    viewport.height = 844;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForAnimationFrames(1);
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');

    await act(async () => waitForViewportSettle());

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');
  });

  it('projects visual viewport dimensions without translating the fixed app shell', async () => {
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      width: number;
      offsetTop: number;
      offsetLeft: number;
    };
    viewport.height = 500;
    viewport.width = 390;
    viewport.offsetTop = 47;
    viewport.offsetLeft = 3;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    act(() => root.render(<Harness />));

    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('500px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-width')).toBe('390px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-top')).toBe('0px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-left')).toBe('0px');
    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');

    viewport.height = 820;
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('820px');
    expect(document.documentElement.dataset.mobileKeyboardOpen).toBeUndefined();
  });

  it('detects an iOS keyboard when the layout and visual viewports shrink together', async () => {
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      width: number;
      offsetTop: number;
      offsetLeft: number;
    };
    viewport.height = 844;
    viewport.width = 390;
    viewport.offsetTop = 0;
    viewport.offsetLeft = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    act(() => root.render(<Harness />));
    (container.querySelector('textarea') as HTMLTextAreaElement).focus();

    viewport.height = 500;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');

    viewport.height = 844;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBeUndefined();
  });

  it('keeps composing projected through the blur-to-keyboard-close transition', async () => {
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      width: number;
      offsetTop: number;
      offsetLeft: number;
    };
    viewport.height = 844;
    viewport.width = 390;
    viewport.offsetTop = 0;
    viewport.offsetLeft = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    act(() => root.render(<Harness />));
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    textarea.focus();

    viewport.height = 500;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });
    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');

    textarea.blur();
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });
    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');

    viewport.height = 844;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });
    expect(document.documentElement.dataset.mobileKeyboardOpen).toBeUndefined();
  });

  it('does not double-apply an installed-PWA pan that settles after resize', async () => {
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      width: number;
      offsetTop: number;
      offsetLeft: number;
    };
    viewport.height = 844;
    viewport.width = 390;
    viewport.offsetTop = 0;
    viewport.offsetLeft = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    act(() => root.render(<Harness />));
    (container.querySelector('textarea') as HTMLTextAreaElement).focus();

    viewport.height = 500;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForAnimationFrames(1);
      viewport.offsetTop = 96;
      await waitForViewportSettle();
    });

    expect(document.documentElement.style.getPropertyValue('--app-viewport-top')).toBe('0px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');
  });

  it('lifts only the composer by the keyboard inset in classic no-shrink geometry', async () => {
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      width: number;
      offsetTop: number;
      offsetLeft: number;
    };
    viewport.height = 844;
    viewport.width = 390;
    viewport.offsetTop = 0;
    viewport.offsetLeft = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    act(() => root.render(<Harness />));
    (container.querySelector('textarea') as HTMLTextAreaElement).focus();
    await act(async () => waitForAnimationFrames());

    // Classic iOS Safari: layout viewport does NOT shrink; only the visual
    // viewport does. The shell must stay frozen while the composer rides.
    viewport.height = 500;
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');
    expect(document.documentElement.style.getPropertyValue('--app-keyboard-inset')).toBe('344px');
  });

  it('does not project a stale visual offset after the keyboard is closed', () => {
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      width: number;
      offsetTop: number;
      offsetLeft: number;
    };
    viewport.height = 844;
    viewport.width = 390;
    viewport.offsetTop = 120;
    viewport.offsetLeft = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    act(() => root.render(<Harness />));

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue('--app-viewport-top')).toBe('0px');
  });

  it('commits a scroll-only installed-PWA keyboard frame without translating the root', async () => {
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      width: number;
      offsetTop: number;
      offsetLeft: number;
    };
    viewport.height = 844;
    viewport.width = 390;
    viewport.offsetTop = 0;
    viewport.offsetLeft = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    act(() => root.render(<Harness />));
    (container.querySelector('textarea') as HTMLTextAreaElement).focus();
    await act(async () => waitForAnimationFrames());

    viewport.height = 500;
    viewport.offsetTop = 360;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    await act(async () => {
      viewport.dispatchEvent(new Event('scroll'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-top')).toBe('0px');
  });

  it('keeps animation-time geometry provisional and commits only the settled frame', async () => {
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      width: number;
      offsetTop: number;
      offsetLeft: number;
    };
    viewport.height = 844;
    viewport.width = 390;
    viewport.offsetTop = 0;
    viewport.offsetLeft = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    act(() => root.render(<Harness />));
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    textarea.focus();
    await act(async () => waitForAnimationFrames());

    viewport.height = 112;
    viewport.offsetTop = 360;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForAnimationFrames(1);
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');

    viewport.height = 500;
    viewport.offsetTop = 96;
    await act(async () => {
      viewport.dispatchEvent(new Event('scroll'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-top')).toBe('0px');

    textarea.blur();
    viewport.height = 700;
    viewport.offsetTop = 40;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForAnimationFrames(1);
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');
    // Only one animation frame has passed: geometry stays at the previous
    // settled commit until the quiet window fires.
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');
    expect(document.documentElement.style.getPropertyValue('--app-keyboard-inset')).toBe('248px');

    viewport.height = 844;
    viewport.offsetTop = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    await act(async () => {
      viewport.dispatchEvent(new Event('scroll'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');
    expect(document.documentElement.style.getPropertyValue('--app-keyboard-inset')).toBe('0px');
  });

  it('rejects an unusable keyboard-opening pulse even when it outlives the settle timer', async () => {
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      width: number;
      offsetTop: number;
      offsetLeft: number;
    };
    viewport.height = 844;
    viewport.width = 390;
    viewport.offsetTop = 0;
    viewport.offsetLeft = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    act(() => root.render(<Harness />));
    (container.querySelector('textarea') as HTMLTextAreaElement).focus();
    await act(async () => waitForAnimationFrames());

    viewport.height = 112;
    viewport.offsetTop = 360;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');
    // The dirty 112px VisualViewport pulse cannot move the shell: neither
    // innerHeight nor VV geometry is allowed to replace the confirmed 844px
    // baseline. Only the composer follows the provisional visible bottom.
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');
    expect(document.documentElement.style.getPropertyValue('--app-keyboard-inset')).toBe('372px');

    viewport.height = 500;
    viewport.offsetTop = 96;
    await act(async () => {
      viewport.dispatchEvent(new Event('scroll'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');
    expect(document.documentElement.style.getPropertyValue('--app-keyboard-inset')).toBe('248px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-top')).toBe('0px');
  });

  it('commits a compact but usable keyboard frame when the PWA starts in landscape', async () => {
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      width: number;
      offsetTop: number;
      offsetLeft: number;
    };
    viewport.height = 390;
    viewport.width = 844;
    viewport.offsetTop = 0;
    viewport.offsetLeft = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 390 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    act(() => root.render(<Harness />));
    (container.querySelector('textarea') as HTMLTextAreaElement).focus();
    await act(async () => waitForAnimationFrames());

    viewport.height = 160;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 160 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('390px');
  });

  it('does not let a width-changing opening pulse poison the stable height baseline', async () => {
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      width: number;
      offsetTop: number;
      offsetLeft: number;
    };
    viewport.height = 844;
    viewport.width = 390;
    viewport.offsetTop = 0;
    viewport.offsetLeft = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    act(() => root.render(<Harness />));
    (container.querySelector('textarea') as HTMLTextAreaElement).focus();
    await act(async () => waitForAnimationFrames());

    viewport.width = 844;
    viewport.height = 112;
    viewport.offsetTop = 180;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 300 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');
    // Both root dimensions remain at the last unobscured portrait baseline.
    // The width-changing frame is only an orientation candidate until close.
    expect(document.documentElement.style.getPropertyValue('--app-viewport-width')).toBe('390px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');

    viewport.height = 300;
    viewport.offsetTop = 80;
    await act(async () => {
      viewport.dispatchEvent(new Event('scroll'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.style.getPropertyValue('--app-viewport-width')).toBe('390px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');
    expect(document.documentElement.style.getPropertyValue('--app-keyboard-inset')).toBe('464px');
  });

  it('keeps the keyboard latched while an open-keyboard orientation baseline settles', async () => {
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      width: number;
      offsetTop: number;
      offsetLeft: number;
    };
    viewport.height = 844;
    viewport.width = 390;
    viewport.offsetTop = 0;
    viewport.offsetLeft = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    act(() => root.render(<Harness />));
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    textarea.focus();

    viewport.height = 500;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });
    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');

    viewport.width = 844;
    viewport.height = 300;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 300 });
    await act(async () => {
      window.dispatchEvent(new Event('orientationchange'));
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-width')).toBe('390px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');

    textarea.blur();
    viewport.height = 390;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 390 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('390px');
  });

  it('cancels pending geometry and removes viewport event delivery on unmount', async () => {
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      width: number;
      offsetTop: number;
      offsetLeft: number;
    };
    viewport.height = 844;
    viewport.width = 390;
    viewport.offsetTop = 0;
    viewport.offsetLeft = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    const probeContainer = document.createElement('div');
    document.body.appendChild(probeContainer);
    const probeRoot = createRoot(probeContainer);

    act(() => probeRoot.render(<Harness />));
    viewport.height = 112;
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await waitForAnimationFrames(1);
    });

    act(() => probeRoot.unmount());
    viewport.height = 500;
    viewport.dispatchEvent(new Event('resize'));
    viewport.dispatchEvent(new Event('scroll'));
    await waitForViewportSettle();

    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--app-keyboard-inset')).toBe('');
    expect(document.documentElement.dataset.mobileKeyboardOpen).toBeUndefined();
    probeContainer.remove();
  });
});
