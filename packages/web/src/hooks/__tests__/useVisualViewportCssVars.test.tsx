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

  it('projects one complete visual viewport rectangle without adding the offset to its height', async () => {
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
    expect(document.documentElement.style.getPropertyValue('--app-viewport-top')).toBe('47px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-left')).toBe('3px');
    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');

    viewport.height = 820;
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
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
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');

    viewport.height = 844;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    });

    expect(document.documentElement.dataset.mobileKeyboardOpen).toBeUndefined();
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
});
