import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertAcceptanceRosterReady, isAcceptanceRosterGateEnabled } from '../dist/config/acceptance-roster-gate.js';

const configs = {
  sonnet: { id: 'sonnet', clientId: 'anthropic', provider: 'anthropic' },
  opus: { id: 'opus', clientId: 'openai', provider: 'openai' },
};

function registryWith(...catIds) {
  const ids = new Set(catIds);
  return { has: (catId) => ids.has(catId) };
}

describe('acceptance roster startup gate', () => {
  it('is disabled by default and leaves normal product startup unchanged', () => {
    assert.equal(isAcceptanceRosterGateEnabled({}), false);
    assert.doesNotThrow(() =>
      assertAcceptanceRosterReady({
        enabled: false,
        configs,
        agentRegistry: registryWith(),
        resolveAdapterMode: () => 'legacy-cli',
      }),
    );
  });

  it('passes a complete acceptance roster and returns per-cat evidence', () => {
    const result = assertAcceptanceRosterReady({
      enabled: true,
      configs,
      agentRegistry: registryWith('sonnet', 'opus'),
      resolveAdapterMode: (catId) => (catId === 'sonnet' ? 'acp' : 'legacy-cli'),
    });

    assert.equal(result.enabled, true);
    assert.deepEqual(result.missingCatIds, []);
    assert.deepEqual(result.entries, [
      {
        catId: 'opus',
        clientId: 'openai',
        provider: 'openai',
        adapterMode: 'legacy-cli',
        agentServiceRegistered: true,
      },
      {
        catId: 'sonnet',
        clientId: 'anthropic',
        provider: 'anthropic',
        adapterMode: 'acp',
        agentServiceRegistered: true,
      },
    ]);
  });

  it('fails closed and lists every catalog member without an AgentService', () => {
    assert.throws(
      () =>
        assertAcceptanceRosterReady({
          enabled: true,
          configs,
          agentRegistry: registryWith('sonnet'),
          resolveAdapterMode: () => 'legacy-cli',
        }),
      (error) => {
        assert.equal(error.name, 'AcceptanceRosterGateError');
        assert.deepEqual(error.missingCatIds, ['opus']);
        assert.match(error.message, /opus/);
        return true;
      },
    );
  });
});
