import { useEffect } from 'react';
import { API_URL } from '@/utils/api-client';

const KEYBOARD_INSET_THRESHOLD_PX = 80;
const VIEWPORT_WIDTH_RESET_THRESHOLD_PX = 40;
const VIEWPORT_SETTLE_DELAY_MS = 120;
const VIEWPORT_TRACE_CAPACITY = 240;
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

type ViewportProjectionStage = 'event' | 'initial' | 'immediate' | 'settled';
type ViewportProjectionPhase = 'before' | 'after';

interface ViewportTraceContext {
  projectionId: number;
  source: string;
  stage: ViewportProjectionStage;
  phase: ViewportProjectionPhase;
  eventTime: number;
}

interface RectSnapshot {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

interface ViewportTraceRecord extends ViewportTraceContext {
  sequence: number;
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
  appShell: RectSnapshot | null;
  header: RectSnapshot | null;
  composer: RectSnapshot | null;
  transcript: (RectSnapshot & { scrollTop: number; scrollHeight: number; clientHeight: number }) | null;
  activeElement: string | null;
  css: Record<string, string | null> & { mobileKeyboardOpen: string | null };
}

interface ViewportTraceController {
  capture(context: ViewportTraceContext): void;
  dispose(): void;
}

function roundTraceValue(value: number): number {
  return Math.round(value * 100) / 100;
}

function readRect(element: Element | null): RectSnapshot | null {
  if (!(element instanceof HTMLElement)) return null;
  const rect = element.getBoundingClientRect();
  return {
    top: roundTraceValue(rect.top),
    right: roundTraceValue(rect.right),
    bottom: roundTraceValue(rect.bottom),
    left: roundTraceValue(rect.left),
    width: roundTraceValue(rect.width),
    height: roundTraceValue(rect.height),
  };
}

function describeActiveElement(): string | null {
  const element = document.activeElement;
  if (!(element instanceof HTMLElement)) return null;
  const descriptor = [element.tagName.toLowerCase()];
  if (element.id) descriptor.push(`#${element.id}`);
  const testId = element.dataset.testid;
  if (testId) descriptor.push(`[data-testid="${testId}"]`);
  const label = element.getAttribute('aria-label');
  if (label) descriptor.push(`[aria-label="${label}"]`);
  if (element.closest('[data-chat-input-composer]')) descriptor.push('[composer]');
  return descriptor.join('');
}

function resolveBuildId(): string {
  const nextData = (window as typeof window & { __NEXT_DATA__?: { buildId?: string } }).__NEXT_DATA__;
  if (nextData?.buildId) return nextData.buildId;
  const dataBuildId = document.documentElement.dataset.buildId;
  if (dataBuildId) return dataBuildId;

  // The App Router serializes buildId into its flight-data scripts rather
  // than exposing __NEXT_DATA__. This parser is diagnostic-only and falls
  // back honestly when a future Next.js version changes that representation.
  for (const script of document.scripts) {
    const match = script.textContent?.match(/\\?"buildId\\?":\\?"([^"\\]+)\\?"/);
    if (match?.[1]) return match[1];
  }
  return 'unknown';
}

function resolveApiOrigin(): string {
  try {
    return new URL(API_URL || window.location.origin, window.location.origin).origin;
  } catch {
    return API_URL || window.location.origin;
  }
}

function readTraceRecord(
  root: HTMLElement,
  viewport: VisualViewport | null,
  sequence: number,
  context: ViewportTraceContext,
): ViewportTraceRecord {
  const transcriptElement = document.querySelector<HTMLElement>('.mobile-transcript-scroller');
  const transcriptRect = readRect(transcriptElement);
  const transcript =
    transcriptElement && transcriptRect
      ? {
          ...transcriptRect,
          scrollTop: roundTraceValue(transcriptElement.scrollTop),
          scrollHeight: transcriptElement.scrollHeight,
          clientHeight: transcriptElement.clientHeight,
        }
      : null;
  const css = Object.fromEntries(
    CSS_PROPERTIES.map((property) => [property, root.style.getPropertyValue(property) || null]),
  ) as Record<string, string | null> & { mobileKeyboardOpen: string | null };
  css.mobileKeyboardOpen = root.dataset.mobileKeyboardOpen ?? null;

  return {
    ...context,
    sequence,
    capturedAt: roundTraceValue(performance.now()),
    innerHeight: roundTraceValue(window.innerHeight),
    visualViewport: viewport
      ? {
          top: roundTraceValue(viewport.offsetTop),
          left: roundTraceValue(viewport.offsetLeft),
          width: roundTraceValue(viewport.width),
          height: roundTraceValue(viewport.height),
          scale: roundTraceValue(viewport.scale ?? 1),
        }
      : null,
    documentScroll: {
      windowX: roundTraceValue(window.scrollX),
      windowY: roundTraceValue(window.scrollY),
      documentElementTop: roundTraceValue(document.documentElement.scrollTop),
      documentElementLeft: roundTraceValue(document.documentElement.scrollLeft),
      bodyTop: roundTraceValue(document.body.scrollTop),
      bodyLeft: roundTraceValue(document.body.scrollLeft),
    },
    appShell: readRect(document.querySelector('.app-viewport')),
    header: readRect(document.querySelector('.app-viewport header, header')),
    composer: readRect(document.querySelector('[data-chat-input-composer]')),
    transcript,
    activeElement: describeActiveElement(),
    css,
  };
}

function createViewportTrace(root: HTMLElement, viewport: VisualViewport | null): ViewportTraceController {
  const host = document.createElement('aside');
  host.dataset.viewportGeometryDebug = 'true';
  host.setAttribute('aria-label', 'Viewport geometry trace');
  host.style.cssText = [
    'position:fixed',
    'z-index:2147483647',
    'top:max(env(safe-area-inset-top),0.25rem)',
    'right:max(env(safe-area-inset-right),0.25rem)',
    'max-width:min(96vw,32rem)',
    'max-height:42vh',
    'overflow:auto',
    'padding:0.5rem',
    'border:1px solid var(--cafe-border,currentColor)',
    'border-radius:0.5rem',
    'background:var(--cafe-surface,Canvas)',
    'color:var(--cafe-text,CanvasText)',
    'box-shadow:var(--shadow-lg,0 0.25rem 1rem color-mix(in srgb,currentColor 20%,transparent))',
    'font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace',
  ].join(';');

  const heading = document.createElement('strong');
  const summary = document.createElement('div');
  const metadata = document.createElement('div');
  metadata.style.opacity = '0.75';
  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.dataset.viewportGeometryDebugCopy = 'true';
  copyButton.textContent = 'Copy trace';
  copyButton.style.cssText = [
    'min-height:2.75rem',
    'margin-top:0.25rem',
    'padding:0.25rem 0.5rem',
    'border:1px solid currentColor',
    'border-radius:0.375rem',
    'background:transparent',
    'color:inherit',
  ].join(';');
  const details = document.createElement('details');
  const detailsSummary = document.createElement('summary');
  detailsSummary.textContent = 'JSON payload';
  const payloadNode = document.createElement('pre');
  payloadNode.dataset.viewportGeometryDebugPayload = 'true';
  payloadNode.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;margin:0.25rem 0 0';
  details.append(detailsSummary, payloadNode);
  host.append(heading, metadata, summary, copyButton, details);
  document.body.appendChild(host);

  const buildId = resolveBuildId();
  const apiOrigin = resolveApiOrigin();
  const pageUrl = window.location.href;
  const records: ViewportTraceRecord[] = [];
  let active = true;
  let sequence = 0;

  const serialize = () =>
    JSON.stringify(
      {
        schemaVersion: 1,
        buildId,
        apiOrigin,
        pageUrl,
        capacity: VIEWPORT_TRACE_CAPACITY,
        records,
      },
      null,
      2,
    );

  const renderPayload = () => {
    if (!active || !details.open) return;
    payloadNode.textContent = serialize();
  };

  const render = () => {
    if (!active) return;
    const latest = records.at(-1);
    heading.textContent = `VV trace · ${buildId}`;
    metadata.textContent = `API ${apiOrigin} · ${records.length}/${VIEWPORT_TRACE_CAPACITY}`;
    summary.textContent = latest
      ? `#${latest.sequence} ${latest.source}/${latest.stage}/${latest.phase} · inner ${latest.innerHeight} · vv ${latest.visualViewport?.height ?? 'none'}@${latest.visualViewport?.top ?? 'none'} · shell ${latest.appShell?.height ?? 'none'}@${latest.appShell?.top ?? 'none'} · composer ${latest.composer?.bottom ?? 'none'}`
      : 'Waiting for viewport events';
    renderPayload();
  };

  const copyTrace = async () => {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(serialize());
      if (active) copyButton.textContent = 'Copied';
    } catch {
      if (active) copyButton.textContent = 'Copy failed';
    }
  };
  copyButton.addEventListener('click', copyTrace);
  details.addEventListener('toggle', renderPayload);
  render();

  return {
    capture(context) {
      if (!active) return;
      sequence += 1;
      records.push(readTraceRecord(root, viewport, sequence, context));
      if (records.length > VIEWPORT_TRACE_CAPACITY) {
        records.splice(0, records.length - VIEWPORT_TRACE_CAPACITY);
      }
      render();
    },
    dispose() {
      if (!active) return;
      active = false;
      copyButton.removeEventListener('click', copyTrace);
      details.removeEventListener('toggle', renderPayload);
      host.remove();
    },
  };
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
    const trace =
      new URLSearchParams(window.location.search).get('vvdebug') === '1' ? createViewportTrace(root, viewport) : null;
    let animationFrame = 0;
    let settlingTimer = 0;
    let projectionId = 0;
    let keyboardOpen = previousKeyboardOpen === 'true';
    let pendingWidthBaseline: ViewportBaseline | null = null;
    let baseline = {
      height: Math.round(viewport?.height ?? window.innerHeight),
      width: Math.round(viewport?.width ?? window.innerWidth),
    };

    const projectWithTrace = (
      source: string,
      stage: ViewportProjectionStage,
      eventTime: number,
      project: () => void,
    ) => {
      projectionId += 1;
      const currentProjectionId = projectionId;
      trace?.capture({
        projectionId: currentProjectionId,
        source,
        stage,
        phase: 'before',
        eventTime: roundTraceValue(eventTime),
      });
      project();
      trace?.capture({
        projectionId: currentProjectionId,
        source,
        stage,
        phase: 'after',
        eventTime: roundTraceValue(eventTime),
      });
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

    const commitSettledFrame = (source: string, eventTime: number) => {
      settlingTimer = 0;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        projectWithTrace(source, 'settled', eventTime, () => {
          const frame = readViewportFrame(viewport);
          updateKeyboardState(frame, true);
          commitFrame(frame);
        });
      });
    };

    const scheduleFrame = (source: string, eventTime: number) => {
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
        projectWithTrace(source, 'immediate', eventTime, () => {
          updateKeyboardState(readViewportFrame(viewport), false, false);
        });
        settlingTimer = window.setTimeout(() => commitSettledFrame(source, eventTime), VIEWPORT_SETTLE_DELAY_MS);
      });
    };

    const scheduleEvent = (source: string, event: Event) => {
      projectWithTrace(source, 'event', event.timeStamp, () => scheduleFrame(source, event.timeStamp));
    };
    const onVisualViewportResize = (event: Event) => scheduleEvent('visualViewport.resize', event);
    const onVisualViewportScroll = (event: Event) => scheduleEvent('visualViewport.scroll', event);
    const onWindowResize = (event: Event) => scheduleEvent('window.resize', event);
    const onOrientationChange = (event: Event) => scheduleEvent('window.orientationchange', event);
    const onFocusIn = (event: Event) => scheduleEvent('document.focusin', event);
    const onFocusOut = (event: Event) => scheduleEvent('document.focusout', event);

    const initialFrame = readViewportFrame(viewport);
    projectWithTrace('mount', 'initial', performance.now(), () => {
      updateKeyboardState(initialFrame, true);
      commitFrame(initialFrame);
    });
    viewport?.addEventListener('resize', onVisualViewportResize);
    viewport?.addEventListener('scroll', onVisualViewportScroll);
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', onOrientationChange);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);

    return () => {
      viewport?.removeEventListener('resize', onVisualViewportResize);
      viewport?.removeEventListener('scroll', onVisualViewportScroll);
      window.removeEventListener('orientationchange', onOrientationChange);
      window.removeEventListener('resize', onWindowResize);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (settlingTimer) window.clearTimeout(settlingTimer);
      trace?.dispose();
      restoreViewportProjection(root, previousValues, previousKeyboardOpen);
    };
  }, []);
}
