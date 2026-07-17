import { useEffect } from 'react';

const KEYBOARD_INSET_THRESHOLD_PX = 80;
const CSS_PROPERTIES = ['--app-viewport-height', '--visual-viewport-offset-top', '--mobile-keyboard-inset'] as const;

export function useVisualViewportCssVars(): void {
  useEffect(() => {
    const root = document.documentElement;
    const previousValues = new Map(CSS_PROPERTIES.map((property) => [property, root.style.getPropertyValue(property)]));
    const previousKeyboardOpen = root.dataset.mobileKeyboardOpen;
    const viewport = window.visualViewport;

    const update = () => {
      const height = Math.max(0, Math.round(viewport?.height ?? window.innerHeight));
      const offsetTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      const rawKeyboardInset = Math.max(0, Math.round(window.innerHeight - height - offsetTop));
      const keyboardInset = rawKeyboardInset >= KEYBOARD_INSET_THRESHOLD_PX ? rawKeyboardInset : 0;

      root.style.setProperty('--app-viewport-height', `${height}px`);
      root.style.setProperty('--visual-viewport-offset-top', `${offsetTop}px`);
      root.style.setProperty('--mobile-keyboard-inset', `${keyboardInset}px`);
      if (keyboardInset > 0) root.dataset.mobileKeyboardOpen = 'true';
      else delete root.dataset.mobileKeyboardOpen;
    };

    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
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
