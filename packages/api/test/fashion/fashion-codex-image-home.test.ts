import assert from 'node:assert/strict';
import { join } from 'node:path';
import { it } from 'node:test';
import { resolveCodexImageHome } from '../../src/domains/cats/services/agents/providers/codex-image-scanner.js';

it('Windows image publication follows the native USERPROFILE home when HOME is absent', () => {
  assert.equal(
    resolveCodexImageHome({ USERPROFILE: 'C:/isolated/user' }, 'win32', 'C:/os-user'),
    join('C:/isolated/user', '.codex'),
  );
});
it('explicit CODEX_HOME wins over both profile variables, including account overrides', () => {
  assert.equal(
    resolveCodexImageHome(
      { CODEX_HOME: 'D:/isolated/codex', USERPROFILE: 'C:/user', HOME: 'C:/posix' },
      'win32',
      'C:/os-user',
    ),
    'D:/isolated/codex',
  );
});
it('OS home is used instead of a relative .codex directory when no home environment exists', () => {
  assert.equal(resolveCodexImageHome({}, 'win32', 'C:/os-user'), join('C:/os-user', '.codex'));
  assert.equal(
    resolveCodexImageHome({ HOME: '/isolated/unix' }, 'linux', '/os-user'),
    join('/isolated/unix', '.codex'),
  );
});
