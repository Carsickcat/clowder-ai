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
    let settlingFrame = 0;
    let keyboardOpen = previousKeyboardOpen === 'true';
    let baseline = {
      height: Math.round(viewport?.height ?? window.innerHeight),
      width: Math.round(viewport?.width ?? window.innerWidth),
    };

    const writeFrame = () => {
      const top = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      const left = Math.max(0, Math.round(viewport?.offsetLeft ?? 0));
      const width = Math.max(0, Math.round(viewport?.width ?? window.innerWidth));
      const height = Math.max(0, Math.round(viewport?.height ?? window.innerHeight));
      const obscuredHeight = Math.max(0, Math.round(window.innerHeight - height - top));
      const composerFocused = hasFocusedComposer();
      baseline = resolveViewportBaseline(baseline, { height, width }, composerFocused);
      const viewportShrink = baseline.height - height - top >= KEYBOARD_INSET_THRESHOLD_PX;
      const focusedViewportShrink = composerFocused && viewportShrink;
      keyboardOpen =
        obscuredHeight >= KEYBOARD_INSET_THRESHOLD_PX || focusedViewportShrink || (keyboardOpen && viewportShrink);
      const projectedTop = keyboardOpen ? top : 0;

      root.style.setProperty('--app-viewport-top', `${projectedTop}px`);
      root.style.setProperty('--app-viewport-left', `${left}px`);
      root.style.setProperty('--app-viewport-width', `${width}px`);
      root.style.setProperty('--app-viewport-height', `${height}px`);
      if (keyboardOpen) {
        root.dataset.mobileKeyboardOpen = 'true';
      } else delete root.dataset.mobileKeyboardOpen;
    };

    const scheduleFrame = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (settlingFrame) window.cancelAnimationFrame(settlingFrame);
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        writeFrame();
        // WebKit can publish the installed-PWA offset one frame after resize.
        // A second read converges the same source instead of introducing a
        // timeout, a UA-specific coordinate path, or a second geometry owner.
        settlingFrame = window.requestAnimationFrame(() => {
          settlingFrame = 0;
          writeFrame();
        });
      });
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
      if (settlingFrame) window.cancelAnimationFrame(settlingFrame);
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
