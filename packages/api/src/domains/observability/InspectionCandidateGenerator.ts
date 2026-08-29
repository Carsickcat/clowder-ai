import type {
  InspectionCandidate,
  InspectionChangeContext,
  InspectionCoverageOmission,
  InspectionTopologyDependency,
  InspectionTopologySnapshot,
} from '@cat-cafe/shared';

export interface InspectionCandidateDraft {
  readonly changeContext: InspectionChangeContext;
  readonly topologySnapshot: InspectionTopologySnapshot;
  readonly candidates: readonly InspectionCandidate[];
  readonly coverageOmissions: readonly InspectionCoverageOmission[];
  readonly generatedAt: string;
}

export interface InspectionCandidateGeneratorOptions {
  readonly now?: () => Date;
  readonly topologySnapshot?: InspectionTopologySnapshot;
}

export const INSPECTION_CANDIDATE_CATALOG_VERSION = 'nova-mvp-1';

export const INSPECTION_CANDIDATE_CATALOG_DESCRIPTOR = {
  version: INSPECTION_CANDIDATE_CATALOG_VERSION,
  checks: [
    {
      id: 'availability',
      operator: 'gte',
      threshold: 0.995,
      stages: ['admission', 'canary', 'verification', 'post_change'],
    },
    { id: 'latency', operator: 'lte', threshold: 250, stages: ['admission', 'canary', 'verification', 'post_change'] },
    { id: 'error-rate', operator: 'lte', threshold: 0.005, stages: ['canary', 'verification', 'post_change'] },
  ],
  topologyCoverage: 'every-unmapped-dependency-produces-an-omission',
} as const;

function ruleRefs(context: InspectionChangeContext, rule: string) {
  return [
    {
      kind: 'change_context' as const,
      ref: `change:${context.changeId}`,
      label: `${context.service} ${context.version}`,
    },
    {
      kind: 'rule' as const,
      ref: `rule:${rule}`,
      label: `NOVA rule catalog ${INSPECTION_CANDIDATE_CATALOG_VERSION}`,
    },
  ];
}

function serviceQuery(service: string, metric: string): string {
  return `${metric}{service="${service}"}`;
}

function createCandidates(context: InspectionChangeContext): InspectionCandidate[] {
  const acceptanceReplay = context.service === 'payments-router' && context.connectorRef === 'replay-acceptance';
  return [
    {
      id: 'availability',
      name: 'Service availability',
      priority: 'required',
      readiness: 'ready',
      stages: ['admission', 'canary', 'verification', 'post_change'],
      check: {
        id: 'availability',
        name: 'Service availability',
        query: acceptanceReplay ? 'safe_availability_metric' : serviceQuery(context.service, 'service_availability'),
        unit: 'ratio',
        operator: 'gte',
        threshold: 0.995,
        maxAgeMs: 120_000,
      },
      reason: 'A route or configuration change must preserve successful request availability.',
      evidenceRefs: ruleRefs(context, 'service-availability'),
    },
    {
      id: 'latency',
      name: 'p95 request latency',
      priority: 'required',
      readiness: 'ready',
      stages: ['admission', 'canary', 'verification', 'post_change'],
      check: {
        id: 'latency',
        name: 'p95 request latency',
        query: acceptanceReplay ? 'safe_metric' : serviceQuery(context.service, 'service_latency_p95_ms'),
        unit: 'ms',
        operator: 'lte',
        threshold: 250,
        maxAgeMs: 120_000,
      },
      reason: 'Routing changes can add downstream hops or contention before error rate moves.',
      evidenceRefs: ruleRefs(context, 'service-latency'),
    },
    {
      id: 'error-rate',
      name: 'Server error rate',
      priority: 'recommended',
      readiness: 'ready',
      stages: ['canary', 'verification', 'post_change'],
      check: {
        id: 'error-rate',
        name: 'Server error rate',
        query: acceptanceReplay ? 'safe_error_rate_metric' : serviceQuery(context.service, 'service_error_rate'),
        unit: 'ratio',
        operator: 'lte',
        threshold: 0.005,
        maxAgeMs: 120_000,
      },
      reason: 'The change may be healthy at the process level while increasing failed business requests.',
      evidenceRefs: ruleRefs(context, 'service-error-rate'),
    },
  ];
}

function dependenciesFor(service: string): InspectionTopologyDependency[] {
  if (service !== 'payments-router') return [];
  return [
    {
      criticality: 'critical',
      direction: 'downstream',
      kind: 'baas',
      ref: 'baas:payments-connection-pool',
      signalMapped: false,
    },
  ];
}

function omissionsFor(
  context: InspectionChangeContext,
  dependencies: readonly InspectionTopologyDependency[],
): InspectionCoverageOmission[] {
  return dependencies
    .filter((dependency) => !dependency.signalMapped)
    .map((dependency) => ({
      id: `coverage-${dependency.ref.replace(/[^A-Za-z0-9_-]/g, '-')}`,
      code: 'COVERAGE_OMISSION' as const,
      dependencyRef: dependency.ref,
      reason: 'The topology dependency has no approved read-only signal mapping in the current catalog.',
      risk: 'Connection-pool saturation could remain outside machine-evaluated coverage.',
      evidenceRefs: [
        {
          kind: 'topology' as const,
          ref: dependency.ref,
          label: `${dependency.kind} ${dependency.direction} dependency`,
        },
        {
          kind: 'change_context' as const,
          ref: `change:${context.changeId}`,
          label: context.intent,
        },
      ],
    }));
}

export function generateInspectionCandidateDraft(
  context: InspectionChangeContext,
  options: InspectionCandidateGeneratorOptions = {},
): InspectionCandidateDraft {
  const generatedAt = (options.now ?? (() => new Date()))().toISOString();
  const dependencies = options.topologySnapshot?.dependencies ?? dependenciesFor(context.service);
  return {
    changeContext: { ...context },
    topologySnapshot: options.topologySnapshot
      ? {
          ...options.topologySnapshot,
          dependencies: options.topologySnapshot.dependencies.map((dependency) => ({ ...dependency })),
        }
      : {
          catalogVersion: INSPECTION_CANDIDATE_CATALOG_VERSION,
          rootService: context.service,
          capturedAt: generatedAt,
          dependencies,
        },
    candidates: createCandidates(context),
    coverageOmissions: omissionsFor(context, dependencies),
    generatedAt,
  };
}
