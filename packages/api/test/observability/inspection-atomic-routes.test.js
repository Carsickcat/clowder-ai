import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import Fastify from 'fastify';

import { inspectionsRoutes } from '../../dist/routes/inspections.js';

const USER_HEADER = { 'x-cat-cafe-user': 'user-a' };

describe('inspection atomic capability routes', () => {
  let app;
  let calls;

  beforeEach(async () => {
    calls = [];
    const service = {
      listSources: () => [],
      listJobs: () => [],
      listCases: () => [],
      listCandidateSets(userId) {
        calls.push(['listCandidateSets', userId]);
        return [{ id: 'candidates-1' }];
      },
      getCandidateSet(userId, candidateSetId) {
        calls.push(['getCandidateSet', userId, candidateSetId]);
        return candidateSetId === 'candidates-1' ? { id: candidateSetId } : null;
      },
      async generateCandidateSet(userId, input) {
        calls.push(['generateCandidateSet', userId, input]);
        return { id: 'candidates-1', userId, changeRef: input.changeRef };
      },
      materializeCandidateSet(userId, candidateSetId, input) {
        calls.push(['materializeCandidateSet', userId, candidateSetId, input]);
        return { job: { id: 'job-1' }, revision: { id: 'revision-1' } };
      },
    };
    app = Fastify({ logger: false });
    await app.register(inspectionsRoutes, { service });
    await app.ready();
  });

  afterEach(async () => app.close());

  test('generates, lists, reopens and materializes candidate sets through bounded commands', async () => {
    const request = {
      intent: 'inspect the payments route change',
      changeRef: 'CHG-23841',
    };
    const generated = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-candidate-sets',
      headers: USER_HEADER,
      payload: request,
    });
    assert.equal(generated.statusCode, 201);

    const listed = await app.inject({
      method: 'GET',
      url: '/api/observability/inspection-candidate-sets',
      headers: USER_HEADER,
    });
    assert.equal(listed.statusCode, 200);

    const reopened = await app.inject({
      method: 'GET',
      url: '/api/observability/inspection-candidate-sets/candidates-1',
      headers: USER_HEADER,
    });
    assert.equal(reopened.statusCode, 200);

    const materialized = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-candidate-sets/candidates-1/materialize',
      headers: USER_HEADER,
      payload: {
        name: 'Payments route verification',
        selectedCandidateIds: ['availability', 'latency'],
        waivers: [],
      },
    });
    assert.equal(materialized.statusCode, 201);
    assert.deepEqual(calls, [
      ['generateCandidateSet', 'user-a', request],
      ['listCandidateSets', 'user-a'],
      ['getCandidateSet', 'user-a', 'candidates-1'],
      [
        'materializeCandidateSet',
        'user-a',
        'candidates-1',
        {
          name: 'Payments route verification',
          selectedCandidateIds: ['availability', 'latency'],
          waivers: [],
        },
      ],
    ]);
  });

  test('rejects every browser-authored authority field from candidate generation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/observability/inspection-candidate-sets',
      headers: USER_HEADER,
      payload: {
        changeRef: 'CHG-23841',
        intent: 'inspect payments',
        service: 'payments-router',
        environment: 'acceptance',
        connectorRef: 'replay-acceptance',
        changeId: 'CHG-23841',
        version: 'v3.18.0',
        topologySnapshot: { dependencies: [] },
        observations: [{ value: 1, verdict: 'passed' }],
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(calls.length, 0);
  });
});
