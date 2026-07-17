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
  });

  it('bounds mobile mentions and keeps the desktop keyboard legend out of compact layouts', () => {
    const menus = readWeb('src/components/ChatInputMenus.tsx');
    expect(menus).toContain('max-h-[min(40dvh,20rem)]');
    expect(menus).toContain('min-h-11');
    expect(menus).toContain('hidden sm:block');
  });

  it('keeps the two mobile header actions at least 44px square', () => {
    const header = readWeb('src/components/ChatContainerHeader.tsx');
    expect(header.match(/min-h-11 min-w-11/g)).toHaveLength(2);
  });
});
