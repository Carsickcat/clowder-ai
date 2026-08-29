import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  createInspectionMetricSources,
  InspectionRuntimeConfigurationError,
} from '../../dist/domains/observability/InspectionRuntimeSources.js';

describe('inspection runtime source composition', () => {
  test('registers no metric source when real configuration is absent', () => {
    assert.deepEqual(createInspectionMetricSources({}), []);
  });

  test('fails startup on partial or production-scoped configuration', () => {
    assert.throws(
      () => createInspectionMetricSources({ NOVA_INSPECTION_PROMETHEUS_URL: 'http://prometheus.invalid' }),
      InspectionRuntimeConfigurationError,
    );
    assert.throws(
      () =>
        createInspectionMetricSources({
          NOVA_INSPECTION_PROMETHEUS_URL: 'http://prometheus.invalid',
          NOVA_INSPECTION_PROMETHEUS_SCOPE: 'production',
        }),
      /scope/i,
    );
  });

  test('registers one bounded Prometheus source only from complete non-production configuration', () => {
    const sources = createInspectionMetricSources({
      NOVA_INSPECTION_PROMETHEUS_URL: 'http://127.0.0.1:9090/prometheus',
      NOVA_INSPECTION_PROMETHEUS_SCOPE: 'staging',
      NOVA_INSPECTION_PROMETHEUS_AUTHORIZATION: 'Bearer must-not-leak',
    });

    assert.equal(sources.length, 1);
    assert.equal(sources[0].id, 'prometheus-staging');
    assert.equal(sources[0].kind, 'prometheus');
    assert.equal(sources[0].scope, 'staging');
    assert.equal(sources[0].source.sourceId, 'prometheus-staging');
    assert.deepEqual(Object.keys(sources[0]).sort(), ['id', 'kind', 'label', 'scope', 'source']);
  });
});
