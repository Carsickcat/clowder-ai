import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

const { openInstallGuide, push } = vi.hoisted(() => ({ openInstallGuide: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/thread/thread-1',
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../ThreadSidebar', () => ({
  ThreadSidebar: ({ onClose }: { onClose: () => void }) => (
    <button type="button" data-testid="thread-choice" onClick={onClose}>
      Thread one
    </button>
  ),
}));

vi.mock('../pwa/PwaInstallExperienceProvider', () => ({
  usePwaInstallExperience: () => ({
    facts: { isStandalone: false },
    openGuide: openInstallGuide,
  }),
}));

import { MobileGlobalNavDrawer } from '../MobileGlobalNavDrawer';

describe('MobileGlobalNavDrawer', () => {
  let container: HTMLDivElement;
  let root: Root;
  let onClose: Mock<() => void>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onClose = vi.fn();
    push.mockReset();
    openInstallGuide.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  function renderDrawer(open = true) {
    act(() => root.render(<MobileGlobalNavDrawer open={open} onClose={onClose} />));
  }

  it('groups Threads, global modules, and Settings in one drawer', () => {
    renderDrawer();

    expect(container.querySelector('[data-testid="mobile-global-nav-drawer"]')).not.toBeNull();
    expect(container.textContent).toContain('Threads');
    expect(container.textContent).toContain('Memory');
    expect(container.textContent).toContain('Mission');
    expect(container.textContent).toContain('Signals');
    expect(container.textContent).toContain('Settings');
  });

  it('preserves the source thread and closes after global navigation', () => {
    renderDrawer();
    const memoryButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Memory');

    act(() => memoryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(push).toHaveBeenCalledWith('/memory?from=thread-1');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on thread choice, backdrop click, and Escape', () => {
    renderDrawer();

    act(() =>
      container
        .querySelector('[data-testid="thread-choice"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );
    act(() =>
      container
        .querySelector('[data-testid="mobile-global-nav-backdrop"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('does not mount an overlay while closed', () => {
    renderDrawer(false);
    expect(container.querySelector('[data-testid="mobile-global-nav-drawer"]')).toBeNull();
  });

  it('keeps install guidance available even when the contextual banner is absent', () => {
    renderDrawer();
    const installButton = container.querySelector('[data-testid="mobile-pwa-install-entry"]') as HTMLButtonElement;
    expect(installButton).not.toBeNull();
    act(() => installButton.click());
    expect(openInstallGuide).toHaveBeenCalledTimes(1);
  });
});
