import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  InspectionPlanningResolver,
  InspectionPlanningSourceError,
} from '../../dist/domains/observability/InspectionPlanningResolver.js';

function createSources({ version = 'v3.18.0', capturedAt = '2026-08-30T01:00:00.000Z' } = {}) {
  const calls = [];
  return {
    calls,
    now: () => new Date(capturedAt),
    changeSource: {
      sourceId: 'change-api',
      async resolve(request) {
        calls.push(['change', request]);
        return {
          sourceId: 'change-api',
          capturedAt,
          changeRef: request.changeRef,
          service: 'payments-router',
          environment: 'staging',
          connectorRef: 'prometheus-staging',
          changeId: 'CHG-23841',
          version,
        };
      },
    },
    topologySource: {
      sourceId: 'topology-api',
      async resolve(request) {
        calls.push(['topology', request]);
        return {
          sourceId: 'topology-api',
          capturedAt,
          catalogVersion: 'topology-42',
          rootService: request.service,
          dependencies: [
            {
              ref: 'service:risk-engine',
              kind: 'service',
              direction: 'downstream',
              criticality: 'critical',
              signalMapped: true,
            },
          ],
        };
      },
    },
  };
}

describe('InspectionPlanningResolver', () => {
  test('resolves browser changeRef into authoritative change/topology facts and immutable digests', async () => {
    const sources = createSources();
    const resolver = new InspectionPlanningResolver({
      changeSource: sources.changeSource,
      topologySource: sources.topologySource,
      now: () => new Date('2026-08-30T01:00:00.000Z'),
    });

    const resolved = await resolver.resolve({ changeRef: 'ticket/CHG-23841', intent: 'verify the payments change' });

    assert.deepEqual(resolved.changeContext, {
      intent: 'verify the payments change',
      service: 'payments-router',
      environment: 'staging',
      connectorRef: 'prometheus-staging',
      changeId: 'CHG-23841',
      version: 'v3.18.0',
    });
    assert.equal(resolved.topologySnapshot.rootService, 'payments-router');
    assert.equal(resolved.planningSnapshot.change.changeRef, 'ticket/CHG-23841');
    assert.match(resolved.planningSnapshot.change.provenance.contentHash, /^sha256:[a-f0-9]{64}$/);
    assert.match(resolved.planningSnapshot.topology.provenance.contentHash, /^sha256:[a-f0-9]{64}$/);
    assert.match(resolved.planningSnapshot.catalog.hash, /^sha256:[a-f0-9]{64}$/);
    assert.match(resolved.planningSnapshot.planningDigest, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(sources.calls, [
      ['change', { changeRef: 'ticket/CHG-23841' }],
      ['topology', { service: 'payments-router', environment: 'staging', changeId: 'CHG-23841' }],
    ]);
  });

  test('keeps planningDigest stable across capture time changes but changes it when facts drift', async () => {
    const first = await new InspectionPlanningResolver(
      createSources({
        capturedAt: '2026-08-30T01:00:00.000Z',
      }),
    ).resolve({ changeRef: 'CHG-23841' });
    const recaptured = await new InspectionPlanningResolver(
      createSources({
        capturedAt: '2026-08-30T02:00:00.000Z',
      }),
    ).resolve({ changeRef: 'CHG-23841' });
    const drifted = await new InspectionPlanningResolver(
      createSources({
        capturedAt: '2026-08-30T02:00:00.000Z',
        version: 'v3.19.0',
      }),
    ).resolve({ changeRef: 'CHG-23841' });

    assert.equal(first.planningSnapshot.planningDigest, recaptured.planningSnapshot.planningDigest);
    assert.notEqual(first.planningSnapshot.planningDigest, drifted.planningSnapshot.planningDigest);
  });

  test('fails closed when topology resolves a different root service', async () => {
    const sources = createSources();
    sources.topologySource.resolve = async () => ({
      sourceId: 'topology-api',
      capturedAt: '2026-08-30T01:00:00.000Z',
      catalogVersion: 'topology-42',
      rootService: 'forged-service',
      dependencies: [],
    });
    const resolver = new InspectionPlanningResolver({
      changeSource: sources.changeSource,
      topologySource: sources.topologySource,
      now: () => new Date('2026-08-30T01:00:00.000Z'),
    });

    await assert.rejects(() => resolver.resolve({ changeRef: 'CHG-23841' }), /root service/i);
  });

  test('fails closed when an authoritative planning fact is stale', async () => {
    const sources = createSources({ capturedAt: '2026-08-30T01:00:00.000Z' });
    const resolver = new InspectionPlanningResolver({
      changeSource: sources.changeSource,
      topologySource: sources.topologySource,
      now: () => new Date('2026-08-30T01:11:00.000Z'),
      maxAgeMs: 10 * 60 * 1_000,
    });

    await assert.rejects(() => resolver.resolve({ changeRef: 'CHG-23841' }), /stale/i);
  });

  test('bounds provider failures without leaking their payload or credentials', async () => {
    const sources = createSources();
    sources.changeSource.resolve = async () => {
      throw new Error('401 body=Bearer must-not-leak');
    };
    const resolver = new InspectionPlanningResolver(sources);

    await assert.rejects(
      () => resolver.resolve({ changeRef: 'CHG-23841' }),
      (error) => {
        assert.ok(error instanceof InspectionPlanningSourceError);
        assert.equal(error.code, 'change_unavailable');
        assert.equal(error.message.includes('must-not-leak'), false);
        return true;
      },
    );
  });
});
