import { PrometheusObservabilitySource } from './adapters/PrometheusObservabilitySource.js';
import type { RegisteredInspectionSource } from './InspectionService.js';

export type InspectionRuntimeEnvironment = Readonly<Record<string, string | undefined>> & {
  readonly NOVA_INSPECTION_PROMETHEUS_URL?: string;
  readonly NOVA_INSPECTION_PROMETHEUS_SCOPE?: string;
  readonly NOVA_INSPECTION_PROMETHEUS_AUTHORIZATION?: string;
};

export class InspectionRuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InspectionRuntimeConfigurationError';
  }
}

const ALLOWED_SCOPES = new Set(['development', 'acceptance', 'staging']);

function normalized(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

export function createInspectionMetricSources(
  environment: InspectionRuntimeEnvironment,
): readonly RegisteredInspectionSource[] {
  const baseUrl = normalized(environment.NOVA_INSPECTION_PROMETHEUS_URL);
  const scope = normalized(environment.NOVA_INSPECTION_PROMETHEUS_SCOPE);
  const authorization = normalized(environment.NOVA_INSPECTION_PROMETHEUS_AUTHORIZATION);

  if (!baseUrl && !scope && !authorization) return [];
  if (!baseUrl || !scope) {
    throw new InspectionRuntimeConfigurationError(
      'NOVA inspection Prometheus requires both endpoint and non-production scope',
    );
  }
  if (!ALLOWED_SCOPES.has(scope)) {
    throw new InspectionRuntimeConfigurationError('NOVA inspection Prometheus scope is invalid');
  }

  const sourceId = `prometheus-${scope}`;
  const source = new PrometheusObservabilitySource({
    sourceId,
    baseUrl,
    ...(authorization ? { authorization } : {}),
  });
  return [
    {
      id: sourceId,
      kind: 'prometheus',
      label: `Prometheus (${scope})`,
      scope,
      source,
    },
  ];
}
