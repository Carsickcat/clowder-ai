import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('F010 web app manifest', () => {
  it('supports the same product in portrait and landscape without locking orientation', () => {
    const manifest = JSON.parse(readFileSync(resolve(__dirname, '../../../public/manifest.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(manifest.scope).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBeUndefined();
  });
});
