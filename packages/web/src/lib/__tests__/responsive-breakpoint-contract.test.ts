import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { MOBILE_WORK_SURFACE_QUERY, RESPONSIVE_BREAKPOINTS, WIDE_SHELL_QUERY } from '@/lib/responsive-breakpoints';

const require = createRequire(import.meta.url);
const tailwindConfig = require('../../../tailwind.config.js') as {
  theme: { screens: Record<string, string> };
};

describe('F010 responsive breakpoint contract', () => {
  it('defines compact, medium, and wide ranges from one shared source', () => {
    expect(RESPONSIVE_BREAKPOINTS).toEqual({
      compact: 0,
      medium: 768,
      wide: 1024,
    });
    expect(WIDE_SHELL_QUERY).toBe('(min-width: 1024px)');
    expect(MOBILE_WORK_SURFACE_QUERY).toBe('(max-width: 1023px)');
  });

  it('keeps Tailwind md/lg aligned with the runtime contract', () => {
    expect(tailwindConfig.theme.screens.md).toBe('768px');
    expect(tailwindConfig.theme.screens.lg).toBe('1024px');
  });
});
