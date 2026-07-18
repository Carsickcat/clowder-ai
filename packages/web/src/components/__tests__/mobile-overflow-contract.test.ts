import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = resolve(__dirname, '../../..');
const readWeb = (path: string) => readFileSync(resolve(webRoot, path), 'utf8');

describe('F010 mobile viewport and overflow contract', () => {
  it('defines four-direction safe areas and visual-viewport layout utilities', () => {
    const css = readWeb('src/app/globals.css');
    const shellCss = readWeb('src/app/console-shell.css');
    const mobileCss = readWeb('src/app/mobile-shell.css');
    expect(css).toContain('.safe-area-inline');
    expect(css).toContain('env(safe-area-inset-left');
    expect(css).toContain('env(safe-area-inset-right');
    expect(shellCss).toContain('.app-viewport');
    expect(shellCss).toMatch(/\.app-viewport\s*{[^}]*top:\s*0;/);
    expect(shellCss).toMatch(/\.app-viewport\s*{[^}]*left:\s*0;/);
    expect(shellCss).toContain('width: var(--app-viewport-width, 100vw)');
    expect(shellCss).toContain('height: var(--app-viewport-height, 100dvh)');
    expect(shellCss).not.toContain('height: calc(var(--app-viewport-height');
    expect(mobileCss).toContain('--mobile-dock-reserve');
    expect(mobileCss).toContain('--mobile-chat-bottom-reserve');
    expect(mobileCss).not.toContain('--mobile-browser-input-assistant-reserve');
    expect(mobileCss).toMatch(/html\[data-mobile-keyboard-open=["']true["']\]/);
    expect(mobileCss).toContain('.mobile-keyboard-secondary-chrome');
  });

  it('does not duplicate the native iOS form-assistant height in app chrome', () => {
    const css = readWeb('src/app/mobile-shell.css');
    expect(css).not.toContain('@supports (-webkit-touch-callout: none)');
    expect(css).toMatch(
      /html\[data-mobile-keyboard-open=["']true["']\]\s*{[^}]*--mobile-dock-reserve:\s*0px;[^}]*--mobile-chat-bottom-reserve:\s*0px;/,
    );
    expect(css).toContain('top: var(--app-viewport-height, 100dvh)');
    expect(css).not.toContain('var(--app-viewport-top');
  });

  it('does not split modal ownership by hiding only the status sheet in CSS', () => {
    const css = readWeb('src/app/mobile-shell.css');
    expect(css).not.toMatch(
      /html\[data-mobile-keyboard-open=["']true["']\]\s+\.mobile-status-sheet\s*{[^}]*visibility:\s*hidden/,
    );
  });

  it('does not park a closed fixed status sheet below the visual viewport', () => {
    const sheet = readWeb('src/components/MobileStatusSheet.tsx');

    expect(sheet).toContain('if (!open) return null');
    expect(sheet).not.toMatch(/open\s*\?\s*['"]-translate-y-full['"]\s*:\s*['"]translate-y-0['"]/);
    expect(sheet).not.toContain('aria-hidden={!open}');
  });

  it('locks root scrolling so the fixed shell cannot rubber-band into blank space', () => {
    const css = readWeb('src/app/console-shell.css');
    expect(css).toMatch(
      /html\.app-shell-scroll-lock,\s*body\.app-shell-scroll-lock\s*{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;[^}]*overscroll-behavior:\s*none;/,
    );
  });

  it('limits composing-only secondary chrome hiding to widths below the shared wide breakpoint', () => {
    const css = readWeb('src/app/mobile-shell.css');
    const breakpoints = JSON.parse(readWeb('src/styles/responsive-breakpoints.json')) as { wide: number };
    const compactRule = new RegExp(
      `@media \\(max-width: ${breakpoints.wide - 1}px\\) \\{[\\s\\S]*?html\\[data-mobile-keyboard-open="true"\\] \\.mobile-keyboard-secondary-chrome \\{[\\s\\S]*?display: none;`,
    );

    expect(css).toMatch(compactRule);
  });

  it('keeps the chat surface narrow, scroll-contained, and keyboard-safe', () => {
    const shell = readWeb('src/components/AppShell.tsx');
    const chat = readWeb('src/components/ChatContainer.tsx');
    const input = readWeb('src/components/ChatInput.tsx');
    expect(shell).toContain('safe-area-inline');
    expect(chat).toContain('overflow-x-hidden');
    expect(chat).toContain('overscroll-contain');
    expect(chat).toContain('pb-[var(--mobile-chat-bottom-reserve)]');
    expect(chat).not.toContain('pb-[calc(4rem+env(safe-area-inset-bottom))]');
    expect(input).toContain('flex-1 min-w-0 relative');
    expect(input).toContain('data-chat-input-composer');
    expect(input).not.toContain('bg-[var(--console-shell-bg)] safe-area-bottom');
    expect(chat).toContain('mobile-keyboard-secondary-chrome');
    expect(chat).toContain('data-mobile-hook-health-summary');
    expect(input).toContain('focus({ preventScroll: true })');
    expect(input).not.toContain('textareaRef.current?.focus()');
  });

  it('keeps mobile message and composer copy on one optical text scale', () => {
    const input = readWeb('src/components/ChatInput.tsx');
    const markdown = readWeb('src/components/MarkdownContent.tsx');

    expect(input).toContain('text-base leading-5');
    expect(markdown).toContain('markdown-content text-base sm:text-sm');
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

  it('keeps global-page tabs and primary content usable at compact widths', () => {
    const signalNav = readWeb('src/components/signals/SignalNav.tsx');
    const signalInbox = readWeb('src/components/signals/SignalInboxView.tsx');
    const mission = readWeb('src/components/mission-control/MissionControlPage.tsx');
    const ops = readWeb('src/components/settings/OpsContent.tsx');
    const capabilitySettings = readWeb('src/components/settings/capability-settings-ui.tsx');

    expect(signalNav).toContain('overflow-x-auto');
    expect(signalNav).toContain('whitespace-nowrap');
    expect(signalNav).toContain('shrink-0');
    expect(signalInbox).toContain('lg:flex-row');
    expect(signalInbox).toContain('w-full');
    expect(signalInbox).toContain('lg:w-[420px]');
    expect(mission).toContain('flex h-full');
    expect(mission).not.toContain('flex h-screen');
    expect(mission).toContain('overflow-x-auto');
    expect(ops).toContain('overflow-x-auto');
    expect(ops).toContain('whitespace-nowrap');
    expect(ops).toContain('shrink-0');
    expect(capabilitySettings).toContain('overflow-x-auto');
    expect(capabilitySettings).toContain('whitespace-nowrap');
    expect(capabilitySettings).toContain('shrink-0');
  });

  it('projects the settings directory as a compact horizontal rail on mobile', () => {
    const shell = readWeb('src/components/settings/SettingsShell.tsx');
    const nav = readWeb('src/components/settings/SettingsNav.tsx');

    expect(shell).not.toContain('max-h-[42vh]');
    expect(shell).toContain('overflow-x-auto');
    expect(nav).toContain('md:flex-col');
    expect(nav).toContain('shrink-0');
    expect(nav).toContain('whitespace-nowrap');
  });
});
