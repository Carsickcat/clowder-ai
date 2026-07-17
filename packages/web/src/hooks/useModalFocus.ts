'use client';

import { type RefObject, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface ModalFocusOptions {
  active: boolean;
  onEscape: () => void;
  initialFocusRef?: { readonly current: HTMLElement | null };
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
  );
}

function trapTabKey(event: KeyboardEvent, container: HTMLElement) {
  if (event.key !== 'Tab') return;

  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }

  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement;
  const focusEscaped = !(activeElement instanceof Node) || !container.contains(activeElement);
  const crossedStart = event.shiftKey && activeElement === first;
  const crossedEnd = !event.shiftKey && activeElement === last;

  if (focusEscaped || crossedStart || crossedEnd) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}

export function useModalFocus<T extends HTMLElement>({
  active,
  onEscape,
  initialFocusRef,
}: ModalFocusOptions): RefObject<T> {
  const containerRef = useRef<T>(null);
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initialFocus = initialFocusRef?.current ?? getFocusableElements(container)[0] ?? container;
    initialFocus.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onEscapeRef.current();
        return;
      }
      trapTabKey(event, container);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (previousActiveElement?.isConnected) previousActiveElement.focus();
    };
  }, [active, initialFocusRef]);

  return containerRef as RefObject<T>;
}
