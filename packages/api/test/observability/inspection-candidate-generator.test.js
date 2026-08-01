import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { generateInspectionCandidateDraft } from '../../dist/domains/observability/InspectionCandidateGenerator.js';

const CONTEXT = {
  intent: '帮我巡检 payments-router v3.18.0 的支付路由配置变更',
  service: 'payments-router',
  environment: 'acceptance',
  connectorRef: 'replay-acceptance',
  changeId: 'CHG-23841',
  version: 'v3.18.0',
};

describe('InspectionCandidateGenerator', () => {
  test('builds an explainable candidate package from intent, change context, topology and rules', () => {
    const draft = generateInspectionCandidateDraft(CONTEXT, {
      now: () => new Date('2026-08-02T01:00:00.000Z'),
    });

    assert.deepEqual(
      draft.candidates.map(({ id, priority, readiness }) => ({ id, priority, readiness })),
      [
        { id: 'availability', priority: 'required', readiness: 'ready' },
        { id: 'latency', priority: 'required', readiness: 'ready' },
        { id: 'error-rate', priority: 'recommended', readiness: 'ready' },
      ],
    );
    assert.equal(
      draft.candidates.every((candidate) => candidate.reason.length > 0),
      true,
    );
    assert.equal(
      draft.candidates.every((candidate) => candidate.evidenceRefs.length >= 2),
      true,
    );
    assert.deepEqual(draft.topologySnapshot.dependencies, [
      {
        criticality: 'critical',
        direction: 'downstream',
        kind: 'baas',
        ref: 'baas:payments-connection-pool',
        signalMapped: false,
      },
    ]);
    assert.equal(draft.coverageOmissions[0].code, 'COVERAGE_OMISSION');
    assert.match(draft.coverageOmissions[0].reason, /signal mapping/i);
    assert.equal(draft.generatedAt, '2026-08-02T01:00:00.000Z');
  });

  test('does not invent dependencies for an unknown service', () => {
    const draft = generateInspectionCandidateDraft({ ...CONTEXT, service: 'catalog-api' });

    assert.deepEqual(draft.topologySnapshot.dependencies, []);
    assert.deepEqual(draft.coverageOmissions, []);
    assert.equal(
      draft.candidates.every((candidate) => candidate.check.query.includes('catalog-api')),
      true,
    );
  });
});
