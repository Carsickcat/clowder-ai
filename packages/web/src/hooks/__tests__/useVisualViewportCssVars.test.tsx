import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useVisualViewportCssVars } from '../useVisualViewportCssVars';

function Harness() {
  useVisualViewportCssVars();
  return (
    <div data-chat-input-composer>
      <textarea aria-label="composer" />
    </div>
  );
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

describe('useVisualViewportCssVars', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalVisualViewport: VisualViewport | null;
  let originalInnerHeight: number;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    originalVisualViewport = window.visualViewport;
    originalInnerHeight = window.innerHeight;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: originalVisualViewport });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
    document.documentElement.style.removeProperty('--app-viewport-height');
    document.documentElement.style.removeProperty('--app-viewport-top');
    document.documentElement.style.removeProperty('--app-viewport-left');
    document.documentElement.style.removeProperty('--app-viewport-width');
    delete document.documentElement.dataset.mobileKeyboardOpen;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
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
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('500px');
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
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('500px');
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
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('500px');
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
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('500px');

    viewport.height = 844;
    viewport.offsetTop = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    await act(async () => {
      viewport.dispatchEvent(new Event('scroll'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');
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
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('844px');

    viewport.height = 500;
    viewport.offsetTop = 96;
    await act(async () => {
      viewport.dispatchEvent(new Event('scroll'));
      await waitForViewportSettle();
    });

    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('500px');
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
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('160px');
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
    expect(document.documentElement.style.getPropertyValue('--app-viewport-width')).toBe('844px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('300px');

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
    expect(document.documentElement.dataset.mobileKeyboardOpen).toBeUndefined();
    probeContainer.remove();
  });
});
