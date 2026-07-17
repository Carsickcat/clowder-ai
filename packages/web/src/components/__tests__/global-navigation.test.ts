import { describe, expect, it } from 'vitest';
import { GLOBAL_NAVIGATION_ITEMS, resolveGlobalNavTarget } from '../global-navigation';

describe('F010 global navigation model', () => {
  it('defines one route model for desktop rail and mobile drawer', () => {
    expect(GLOBAL_NAVIGATION_ITEMS.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'home', label: '对话' },
      { id: 'memory', label: '记忆' },
      { id: 'mission', label: 'Mission Hub' },
      { id: 'signals', label: '信号' },
      { id: 'settings', label: '设置' },
    ]);
  });

  it('preserves the current thread while entering and returning from global modules', () => {
    expect(resolveGlobalNavTarget('/memory', '/thread/thread-1', '')).toBe('/memory?from=thread-1');
    expect(resolveGlobalNavTarget('/signals', '/memory', 'from=thread-1')).toBe('/signals?from=thread-1');
    expect(resolveGlobalNavTarget('/', '/signals', 'from=thread-1')).toBe('/thread/thread-1');
  });
});
