import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useVisualViewportCssVars } from '../useVisualViewportCssVars';

function Harness() {
  useVisualViewportCssVars();
  return null;
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
    document.documentElement.style.removeProperty('--visual-viewport-offset-top');
    document.documentElement.style.removeProperty('--mobile-keyboard-inset');
    delete document.documentElement.dataset.mobileKeyboardOpen;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('tracks the visual viewport and exposes a keyboard-safe fixed-bottom offset', () => {
    const viewport = new EventTarget() as EventTarget & { height: number; offsetTop: number };
    viewport.height = 500;
    viewport.offsetTop = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    act(() => root.render(<Harness />));

    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('500px');
    expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-inset')).toBe('344px');
    expect(document.documentElement.dataset.mobileKeyboardOpen).toBe('true');

    viewport.height = 820;
    act(() => viewport.dispatchEvent(new Event('resize')));

    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('820px');
    expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-inset')).toBe('0px');
    expect(document.documentElement.dataset.mobileKeyboardOpen).toBeUndefined();
  });
});
