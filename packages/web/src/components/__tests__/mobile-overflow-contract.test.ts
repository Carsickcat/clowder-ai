import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = resolve(__dirname, '../../..');
const readWeb = (path: string) => readFileSync(resolve(webRoot, path), 'utf8');

describe('F010 mobile viewport and overflow contract', () => {
  it('defines four-direction safe areas and visual-viewport layout utilities', () => {
    const css = readWeb('src/app/globals.css');
    expect(css).toContain('.safe-area-inline');
    expect(css).toContain('env(safe-area-inset-left');
    expect(css).toContain('env(safe-area-inset-right');
    expect(css).toContain('.app-viewport');
    expect(css).toContain('top: var(--app-viewport-top, 0px)');
    expect(css).toContain('left: var(--app-viewport-left, 0px)');
    expect(css).toContain('width: var(--app-viewport-width, 100vw)');
    expect(css).toContain('height: var(--app-viewport-height, 100dvh)');
    expect(css).not.toContain('height: calc(var(--app-viewport-height');
    expect(css).toContain('--mobile-dock-reserve');
    expect(css).toMatch(/html\[data-mobile-keyboard-open=["']true["']\]/);
    expect(css).toContain('.mobile-keyboard-secondary-chrome');
  });

  it('limits composing-only secondary chrome hiding to widths below the shared wide breakpoint', () => {
    const css = readWeb('src/app/globals.css');
    const breakpoints = JSON.parse(readWeb('src/styles/responsive-breakpoints.json')) as { wide: number };
    const compactRule = `@media (max-width: ${breakpoints.wide - 1}px) {
  html[data-mobile-keyboard-open="true"] .mobile-keyboard-secondary-chrome {
    display: none;
  }
}`;

    expect(css).toContain(compactRule);
  });

  it('keeps the chat surface narrow, scroll-contained, and keyboard-safe', () => {
    const shell = readWeb('src/components/AppShell.tsx');
    const chat = readWeb('src/components/ChatContainer.tsx');
    const input = readWeb('src/components/ChatInput.tsx');
    expect(shell).toContain('safe-area-inline');
    expect(chat).toContain('overflow-x-hidden');
    expect(chat).toContain('overscroll-contain');
    expect(chat).toContain('pb-[var(--mobile-dock-reserve)]');
    expect(chat).not.toContain('pb-[calc(4rem+env(safe-area-inset-bottom))]');
    expect(input).toContain('flex-1 min-w-0 relative');
    expect(input).toContain('data-chat-input-composer');
    expect(input).not.toContain('bg-[var(--console-shell-bg)] safe-area-bottom');
    expect(chat).toContain('mobile-keyboard-secondary-chrome');
  });

  it('bounds mobile mentions and keeps the desktop keyboard legend out of compact layouts', () => {
    const menus = readWeb('src/components/ChatInputMenus.tsx');
    expect(menus).toContain('max-h-52');
    expect(menus).toContain('grid-cols-2');
    expect(menus).toContain('overscroll-contain');
    expect(menus).toContain('min-h-12');
    expect(menus).toContain('sm:min-h-11');
    expect(menus).toContain('hidden sm:block');
  });

  it('keeps the two mobile header actions at least 44px square', () => {
    const header = readWeb('src/components/ChatContainerHeader.tsx');
    expect(header.match(/min-h-11 min-w-11/g)).toHaveLength(2);
    expect(header).toContain('h-14');
    expect(header).toContain('hidden lg:flex');
  });
});
