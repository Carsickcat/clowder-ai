import { useEffect } from 'react';

const KEYBOARD_INSET_THRESHOLD_PX = 80;
const VIEWPORT_WIDTH_RESET_THRESHOLD_PX = 40;
const VIEWPORT_SETTLE_DELAY_MS = 120;
// The composer inset is a transient transform, never shell geometry. Clamp it
// to a plausible keyboard band so a stuck dirty frame can at worst misplace
// the composer for one settle window; the next settled frame self-heals.
const KEYBOARD_INSET_MAX_RATIO = 0.6;
const CSS_PROPERTIES = [
  '--app-viewport-top',
  '--app-viewport-left',
  '--app-viewport-width',
  '--app-viewport-height',
  '--app-keyboard-inset',
] as const;

interface ViewportBaseline {
  height: number;
  width: number;
}

interface ViewportFrame extends ViewportBaseline {
  top: number;
}

function hasFocusedComposer(): boolean {
  const activeElement = document.activeElement;
  return activeElement instanceof HTMLElement && Boolean(activeElement.closest('[data-chat-input-composer]'));
}

function resolveViewportBaseline(
  baseline: ViewportBaseline,
  frame: ViewportBaseline,
  composerFocused: boolean,
  keyboardOpen: boolean,
  pendingWidthBaseline: ViewportBaseline | null,
): { baseline: ViewportBaseline; pendingWidthBaseline: ViewportBaseline | null } {
  const widthChanged = Math.abs(frame.width - baseline.width) >= VIEWPORT_WIDTH_RESET_THRESHOLD_PX;
  if (widthChanged) {
    if (keyboardOpen) {
      return {
        baseline: { ...baseline, width: frame.width },
        pendingWidthBaseline: frame,
      };
    }
    return { baseline: frame, pendingWidthBaseline: null };
  }

  if (pendingWidthBaseline?.width === frame.width) {
    if (composerFocused) {
      return {
        baseline,
        pendingWidthBaseline: {
          ...pendingWidthBaseline,
          height: Math.min(pendingWidthBaseline.height, frame.height),
        },
      };
    }
    if (frame.height > pendingWidthBaseline.height) {
      return { baseline: frame, pendingWidthBaseline: null };
    }
  }

  if (!composerFocused && frame.height > baseline.height) {
    return { baseline: { ...baseline, height: frame.height }, pendingWidthBaseline };
  }
  return { baseline, pendingWidthBaseline };
}

function readViewportFrame(viewport: VisualViewport | null): ViewportFrame {
  return {
    top: Math.max(0, Math.round(viewport?.offsetTop ?? 0)),
    width: Math.max(0, Math.round(viewport?.width ?? window.innerWidth)),
    height: Math.max(0, Math.round(viewport?.height ?? window.innerHeight)),
  };
}

function frameIndicatesKeyboard(
  baseline: ViewportBaseline,
  frame: ViewportFrame,
  composerFocused: boolean,
  keyboardOpen: boolean,
): boolean {
  const obscuredBottom = Math.max(0, Math.round(window.innerHeight - frame.height - frame.top));
  const viewportShrink = baseline.height - frame.height >= KEYBOARD_INSET_THRESHOLD_PX;
  const focusedViewportPan = composerFocused && frame.top >= KEYBOARD_INSET_THRESHOLD_PX;
  return (
    obscuredBottom >= KEYBOARD_INSET_THRESHOLD_PX ||
    (composerFocused && (viewportShrink || focusedViewportPan)) ||
    (keyboardOpen && (viewportShrink || frame.top >= KEYBOARD_INSET_THRESHOLD_PX))
  );
}

function projectKeyboardState(root: HTMLElement, keyboardOpen: boolean): void {
  if (keyboardOpen) root.dataset.mobileKeyboardOpen = 'true';
  else delete root.dataset.mobileKeyboardOpen;
}

function restoreViewportProjection(
  root: HTMLElement,
  previousValues: ReadonlyMap<string, string>,
  previousKeyboardOpen: string | undefined,
): void {
  for (const property of CSS_PROPERTIES) {
    const previousValue = previousValues.get(property);
    if (previousValue) root.style.setProperty(property, previousValue);
    else root.style.removeProperty(property);
  }
  if (previousKeyboardOpen) root.dataset.mobileKeyboardOpen = previousKeyboardOpen;
  else delete root.dataset.mobileKeyboardOpen;
}

export function useVisualViewportCssVars(): void {
  useEffect(() => {
    const root = document.documentElement;
    const previousValues = new Map(CSS_PROPERTIES.map((property) => [property, root.style.getPropertyValue(property)]));
    const previousKeyboardOpen = root.dataset.mobileKeyboardOpen;
    const viewport = window.visualViewport;
    let animationFrame = 0;
    let settlingTimer = 0;
    let keyboardOpen = previousKeyboardOpen === 'true';
    let pendingWidthBaseline: ViewportBaseline | null = null;
    let baseline = {
      height: Math.round(viewport?.height ?? window.innerHeight),
      width: Math.round(viewport?.width ?? window.innerWidth),
    };

    const updateKeyboardState = (frame: ViewportFrame, allowClose: boolean, stageBaseline = true) => {
      const composerFocused = hasFocusedComposer();
      if (stageBaseline) {
        const baselineResolution = resolveViewportBaseline(
          baseline,
          frame,
          composerFocused,
          keyboardOpen,
          pendingWidthBaseline,
        );
        baseline = baselineResolution.baseline;
        pendingWidthBaseline = baselineResolution.pendingWidthBaseline;
      }
      const indicated = frameIndicatesKeyboard(baseline, frame, composerFocused, keyboardOpen);
      if (indicated) keyboardOpen = true;
      else if (allowClose) keyboardOpen = false;
      projectKeyboardState(root, keyboardOpen);
    };

    const commitFrame = (frame: ViewportFrame) => {
      // The app shell is already fixed to the viewport. offsetTop/offsetLeft
      // describe panning within the layout viewport; applying them again to
      // the fixed root double-translates installed iOS PWAs during focus.
      root.style.setProperty('--app-viewport-top', '0px');
      root.style.setProperty('--app-viewport-left', '0px');
      root.style.setProperty('--app-viewport-width', `${frame.width}px`);
      // Stable-shell contract: the shell height never consumes VisualViewport
      // keyboard frames at all. window.innerHeight is the real layout height
      // (on installed iOS PWAs and Android resizes-content it already excludes
      // the keyboard); the guarded baseline only bounds it from above for
      // classic no-shrink geometry. Dirty animation pulses therefore cannot
      // collapse or move the shell or transcript — they can at worst nudge
      // the composer inset for one settle window.
      const shellHeight = Math.min(baseline.height, Math.max(0, Math.round(window.innerHeight)));
      root.style.setProperty('--app-viewport-height', `${shellHeight}px`);
      const rawInset = keyboardOpen ? shellHeight - frame.height - frame.top : 0;
      const inset = Math.min(Math.max(0, rawInset), Math.round(shellHeight * KEYBOARD_INSET_MAX_RATIO));
      root.style.setProperty('--app-keyboard-inset', `${inset}px`);
    };

    const commitSettledFrame = () => {
      settlingTimer = 0;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        const frame = readViewportFrame(viewport);
        updateKeyboardState(frame, true);
        commitFrame(frame);
      });
    };

    const scheduleFrame = () => {
      if (settlingTimer) {
        window.clearTimeout(settlingTimer);
        settlingTimer = 0;
      }
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        // State may enter composing mode as soon as a focused shrink or pan
        // appears, so Dock/secondary chrome leave immediately. Geometry and
        // the composer inset remain at the last settled frame until
        // resize/scroll has been quiet long enough to trust the values.
        // Animation-time frames may latch composing state, but only the
        // settled commit path may stage a new geometry baseline.
        updateKeyboardState(readViewportFrame(viewport), false, false);
        settlingTimer = window.setTimeout(commitSettledFrame, VIEWPORT_SETTLE_DELAY_MS);
      });
    };

    const initialFrame = readViewportFrame(viewport);
    updateKeyboardState(initialFrame, true);
    commitFrame(initialFrame);
    viewport?.addEventListener('resize', scheduleFrame);
    viewport?.addEventListener('scroll', scheduleFrame);
    window.addEventListener('resize', scheduleFrame);
    window.addEventListener('orientationchange', scheduleFrame);
    document.addEventListener('focusin', scheduleFrame);
    document.addEventListener('focusout', scheduleFrame);

    return () => {
      viewport?.removeEventListener('resize', scheduleFrame);
      viewport?.removeEventListener('scroll', scheduleFrame);
      window.removeEventListener('orientationchange', scheduleFrame);
      window.removeEventListener('resize', scheduleFrame);
      document.removeEventListener('focusin', scheduleFrame);
      document.removeEventListener('focusout', scheduleFrame);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (settlingTimer) window.clearTimeout(settlingTimer);
      restoreViewportProjection(root, previousValues, previousKeyboardOpen);
    };
  }, []);
}
