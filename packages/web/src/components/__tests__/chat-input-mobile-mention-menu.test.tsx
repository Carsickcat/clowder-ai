import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInputMenus } from '@/components/ChatInputMenus';
import type { CatOption } from '@/components/chat-input-options';

const OPTIONS: CatOption[] = [
  {
    id: 'sonnet',
    label: '@布偶猫 (Sonnet)',
    desc: '快速灵活，适合日常对话和轻量任务',
    insert: '@sonnet ',
    color: 'var(--cat-sonnet-primary)',
    avatar: '/sonnet.png',
  },
  {
    id: 'thread',
    label: '@thread',
    desc: '本帖全体参与猫猫',
    insert: '@thread ',
    color: 'var(--color-group-mention)',
    avatar: '',
    isGroup: true,
  },
];

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { React?: typeof React }).React = React;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete (globalThis as { React?: typeof React }).React;
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderMentionMenu(showMentions = true) {
  const menuRef = React.createRef<HTMLDivElement>();
  act(() => {
    root.render(
      <ChatInputMenus
        catOptions={OPTIONS}
        showMentions={showMentions}
        showGameMenu={false}
        gameStep="list"
        onGameStepChange={vi.fn()}
        selectedIdx={0}
        onSelectIdx={vi.fn()}
        onInsertMention={vi.fn()}
        onSendCommand={vi.fn()}
        menuRef={menuRef}
      />,
    );
  });
}

describe('ChatInput mobile mention picker', () => {
  it('renders a compact two-column touch grid while preserving desktop details', () => {
    renderMentionMenu();

    const menu = container.querySelector<HTMLElement>('[data-testid="mention-menu"]');
    expect(menu).not.toBeNull();
    expect(menu?.className).toContain('max-h-52');
    expect(menu?.className).toContain('sm:max-h-80');

    const options = menu?.querySelector<HTMLElement>('[role="listbox"]');
    expect(options?.className).toContain('grid-cols-2');
    expect(options?.className).toContain('sm:block');
    expect(options?.className).toContain('overscroll-contain');

    const buttons = menu?.querySelectorAll<HTMLElement>('[role="option"]');
    expect(buttons).toHaveLength(OPTIONS.length);
    expect(buttons?.[0]?.className).toContain('min-h-12');
    expect(buttons?.[0]?.className).toContain('sm:min-h-11');
    expect(buttons?.[0]?.getAttribute('aria-selected')).toBe('true');

    const descriptions = menu?.querySelectorAll<HTMLElement>('[data-testid="mention-option-description"]');
    expect(descriptions).toHaveLength(OPTIONS.length);
    expect(descriptions?.[0]?.className).toContain('hidden');
    expect(descriptions?.[0]?.className).toContain('sm:block');
  });

  it('recomputes the overflow affordance when a closed picker opens', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(120);

    renderMentionMenu(false);
    expect(container.querySelector('[data-testid="mention-menu"]')).toBeNull();

    renderMentionMenu(true);
    expect(container.textContent).toContain('还有更多猫猫');
  });
});
