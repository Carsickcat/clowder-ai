import { useEffect } from 'react';

const KEYBOARD_INSET_THRESHOLD_PX = 80;
const VIEWPORT_WIDTH_RESET_THRESHOLD_PX = 40;
const CSS_PROPERTIES = [
  '--app-viewport-top',
  '--app-viewport-left',
  '--app-viewport-width',
  '--app-viewport-height',
] as const;

interface ViewportBaseline {
  height: number;
  width: number;
}

function hasFocusedComposer(): boolean {
  const activeElement = document.activeElement;
  return activeElement instanceof HTMLElement && Boolean(activeElement.closest('[data-chat-input-composer]'));
}

function resolveViewportBaseline(
  baseline: ViewportBaseline,
  frame: ViewportBaseline,
  composerFocused: boolean,
): ViewportBaseline {
  if (Math.abs(frame.width - baseline.width) >= VIEWPORT_WIDTH_RESET_THRESHOLD_PX) return frame;
  if (!composerFocused && frame.height > baseline.height) return { ...baseline, height: frame.height };
  return baseline;
}

export function useVisualViewportCssVars(): void {
  useEffect(() => {
    const root = document.documentElement;
    const previousValues = new Map(CSS_PROPERTIES.map((property) => [property, root.style.getPropertyValue(property)]));
    const previousKeyboardOpen = root.dataset.mobileKeyboardOpen;
    const viewport = window.visualViewport;
    let animationFrame = 0;
    let baseline = {
      height: Math.round(viewport?.height ?? window.innerHeight),
      width: Math.round(viewport?.width ?? window.innerWidth),
    };

    const writeFrame = () => {
      animationFrame = 0;
      const top = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      const left = Math.max(0, Math.round(viewport?.offsetLeft ?? 0));
      const width = Math.max(0, Math.round(viewport?.width ?? window.innerWidth));
      const height = Math.max(0, Math.round(viewport?.height ?? window.innerHeight));
      const obscuredHeight = Math.max(0, Math.round(window.innerHeight - height - top));
      const composerFocused = hasFocusedComposer();
      baseline = resolveViewportBaseline(baseline, { height, width }, composerFocused);
      const focusedViewportShrink = composerFocused && baseline.height - height - top >= KEYBOARD_INSET_THRESHOLD_PX;

      root.style.setProperty('--app-viewport-top', `${top}px`);
      root.style.setProperty('--app-viewport-left', `${left}px`);
      root.style.setProperty('--app-viewport-width', `${width}px`);
      root.style.setProperty('--app-viewport-height', `${height}px`);
      if (obscuredHeight >= KEYBOARD_INSET_THRESHOLD_PX || focusedViewportShrink) {
        root.dataset.mobileKeyboardOpen = 'true';
      } else delete root.dataset.mobileKeyboardOpen;
    };

    const scheduleFrame = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(writeFrame);
    };

    writeFrame();
    viewport?.addEventListener('resize', scheduleFrame);
    viewport?.addEventListener('scroll', scheduleFrame);
    window.addEventListener('resize', scheduleFrame);
    window.addEventListener('orientationchange', scheduleFrame);
    document.addEventListener('focusin', scheduleFrame);
    document.addEventListener('focusout', scheduleFrame);

    return () => {
      viewport?.removeEventListener('resize', scheduleFrame);
      viewport?.removeEventListener('scroll', scheduleFrame);
      window.removeEventListener('resize', scheduleFrame);
      window.removeEventListener('orientationchange', scheduleFrame);
      document.removeEventListener('focusin', scheduleFrame);
      document.removeEventListener('focusout', scheduleFrame);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      for (const property of CSS_PROPERTIES) {
        const previousValue = previousValues.get(property);
        if (previousValue) root.style.setProperty(property, previousValue);
        else root.style.removeProperty(property);
      }
      if (previousKeyboardOpen) root.dataset.mobileKeyboardOpen = previousKeyboardOpen;
      else delete root.dataset.mobileKeyboardOpen;
    };
  }, []);
}
