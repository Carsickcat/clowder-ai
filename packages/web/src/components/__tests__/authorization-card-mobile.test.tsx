import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationCard } from '@/components/AuthorizationCard';

describe('AuthorizationCard mobile actions', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  function render() {
    act(() => {
      root.render(
        <AuthorizationCard
          request={{
            requestId: 'auth-1',
            catId: 'opus',
            threadId: 'thread-1',
            action: 'shell_command',
            reason: '需要运行检查',
            createdAt: 1,
          }}
          onRespond={vi.fn()}
        />,
      );
    });
  }

  it('wraps compact actions and keeps every authorization target at least 44px tall', () => {
    render();
    const buttons = Array.from(container.querySelectorAll('button'));

    expect(buttons).toHaveLength(4);
    expect(buttons[0]?.parentElement?.className).toContain('flex-wrap');
    for (const button of buttons) expect(button.className).toContain('min-h-11');
  });

  it('keeps expanded authorization choices at least 44px tall', () => {
    render();
    const more = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('更多选项'),
    );
    act(() => more?.click());

    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(4);
    for (const button of buttons) expect(button.className).toContain('min-h-11');
  });
});
