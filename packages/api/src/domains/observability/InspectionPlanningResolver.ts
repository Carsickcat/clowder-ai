import { createHash } from 'node:crypto';
import type {
  InspectionChangeContext,
  InspectionPlanningSnapshot,
  InspectionTopologyDependency,
  InspectionTopologySnapshot,
} from '@cat-cafe/shared';
import {
  INSPECTION_CANDIDATE_CATALOG_DESCRIPTOR,
  INSPECTION_CANDIDATE_CATALOG_VERSION,
} from './InspectionCandidateGenerator.js';
import type { ChangeSource, ResolvedInspectionChange } from './ports/ChangeSource.js';
import type { ResolvedInspectionTopology, TopologySource } from './ports/TopologySource.js';

export interface InspectionPlanningSources {
  readonly changeSource: ChangeSource;
  readonly topologySource: TopologySource;
  readonly now?: () => Date;
  readonly maxAgeMs?: number;
}

export interface ResolveInspectionPlanningRequest {
  readonly changeRef: string;
  readonly intent?: string;
}

export interface ResolvedInspectionPlanning {
  readonly changeContext: InspectionChangeContext;
  readonly topologySnapshot: InspectionTopologySnapshot;
  readonly planningSnapshot: InspectionPlanningSnapshot;
}

export type InspectionPlanningSourceErrorCode =
  | 'change_unavailable'
  | 'invalid_change'
  | 'invalid_topology'
  | 'source_identity_mismatch'
  | 'stale_change'
  | 'stale_topology'
  | 'topology_unavailable';

export class InspectionPlanningSourceError extends Error {
  constructor(
    readonly code: InspectionPlanningSourceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'InspectionPlanningSourceError';
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(canonicalize(value)), 'utf8')
    .digest('hex')}`;
}

function requireNonEmpty(value: string, label: string, code: InspectionPlanningSourceErrorCode): string {
  const normalized = value.trim();
  if (!normalized) throw new InspectionPlanningSourceError(code, `${label} must be non-empty`);
  return normalized;
}

function requireTimestamp(value: string, label: string, code: InspectionPlanningSourceErrorCode): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new InspectionPlanningSourceError(code, `${label} must be an ISO timestamp`);
  }
  return value;
}

function sortDependencies(
  dependencies: readonly InspectionTopologyDependency[],
): readonly InspectionTopologyDependency[] {
  return dependencies
    .map((dependency) => ({ ...dependency }))
    .sort((left, right) => `${left.ref}:${left.direction}`.localeCompare(`${right.ref}:${right.direction}`));
}

export class InspectionPlanningResolver {
  private readonly changeSource: ChangeSource;
  private readonly topologySource: TopologySource;
  private readonly now: () => Date;
  private readonly maxAgeMs: number;

  constructor(sources: InspectionPlanningSources) {
    this.changeSource = sources.changeSource;
    this.topologySource = sources.topologySource;
    this.now = sources.now ?? (() => new Date());
    this.maxAgeMs = sources.maxAgeMs ?? 10 * 60 * 1_000;
    if (!sources.changeSource.sourceId.trim() || !sources.topologySource.sourceId.trim()) {
      throw new TypeError('Planning source ids must be non-empty');
    }
    if (!Number.isSafeInteger(this.maxAgeMs) || this.maxAgeMs <= 0) {
      throw new TypeError('Planning source maxAgeMs must be a positive safe integer');
    }
  }

  async resolve(input: ResolveInspectionPlanningRequest): Promise<ResolvedInspectionPlanning> {
    const changeRef = requireNonEmpty(input.changeRef, 'Change reference', 'invalid_change');
    let change: ResolvedInspectionChange;
    try {
      change = await this.changeSource.resolve({ changeRef });
    } catch {
      throw new InspectionPlanningSourceError('change_unavailable', 'Change source is unavailable');
    }
    this.assertChange(change, changeRef);

    let topology: ResolvedInspectionTopology;
    try {
      topology = await this.topologySource.resolve({
        service: change.service,
        environment: change.environment,
        changeId: change.changeId,
      });
    } catch {
      throw new InspectionPlanningSourceError('topology_unavailable', 'Topology source is unavailable');
    }
    this.assertTopology(topology, change.service);

    const changeContext: InspectionChangeContext = {
      intent: input.intent?.trim() || `Inspect change ${change.changeId}`,
      service: change.service,
      environment: change.environment,
      connectorRef: change.connectorRef,
      changeId: change.changeId,
      version: change.version,
    };
    const topologySnapshot: InspectionTopologySnapshot = {
      catalogVersion: topology.catalogVersion,
      rootService: topology.rootService,
      capturedAt: topology.capturedAt,
      dependencies: sortDependencies(topology.dependencies),
    };
    const changeContent = {
      changeRef: change.changeRef,
      context: changeContext,
    };
    const topologyContent = {
      catalogVersion: topologySnapshot.catalogVersion,
      rootService: topologySnapshot.rootService,
      dependencies: topologySnapshot.dependencies,
    };
    const catalog = {
      version: INSPECTION_CANDIDATE_CATALOG_VERSION,
      hash: digest(INSPECTION_CANDIDATE_CATALOG_DESCRIPTOR),
    };
    const planningDigest = digest({ change: changeContent, topology: topologyContent, catalog });

    return {
      changeContext,
      topologySnapshot,
      planningSnapshot: {
        change: {
          changeRef: change.changeRef,
          context: { ...changeContext },
          provenance: {
            sourceId: change.sourceId,
            capturedAt: change.capturedAt,
            contentHash: digest(changeContent),
          },
        },
        topology: {
          snapshot: topologySnapshot,
          provenance: {
            sourceId: topology.sourceId,
            capturedAt: topology.capturedAt,
            contentHash: digest(topologyContent),
          },
        },
        catalog,
        planningDigest,
      },
    };
  }

  private assertChange(change: ResolvedInspectionChange, requestedRef: string): void {
    if (change.sourceId !== this.changeSource.sourceId) {
      throw new InspectionPlanningSourceError('source_identity_mismatch', 'Change source identity mismatch');
    }
    requireTimestamp(change.capturedAt, 'Change capture time', 'invalid_change');
    this.requireFresh(change.capturedAt, 'Change fact', 'stale_change');
    if (change.changeRef !== requestedRef) {
      throw new InspectionPlanningSourceError('invalid_change', 'Change source returned a different reference');
    }
    for (const [label, value] of [
      ['Service', change.service],
      ['Environment', change.environment],
      ['Connector reference', change.connectorRef],
      ['Change id', change.changeId],
      ['Version', change.version],
    ] as const) {
      requireNonEmpty(value, label, 'invalid_change');
    }
  }

  private assertTopology(topology: ResolvedInspectionTopology, expectedService: string): void {
    if (topology.sourceId !== this.topologySource.sourceId) {
      throw new InspectionPlanningSourceError('source_identity_mismatch', 'Topology source identity mismatch');
    }
    requireTimestamp(topology.capturedAt, 'Topology capture time', 'invalid_topology');
    this.requireFresh(topology.capturedAt, 'Topology fact', 'stale_topology');
    requireNonEmpty(topology.catalogVersion, 'Topology catalog version', 'invalid_topology');
    if (topology.rootService !== expectedService) {
      throw new InspectionPlanningSourceError('invalid_topology', 'Topology root service does not match the change');
    }
  }

  private requireFresh(capturedAt: string, label: string, code: 'stale_change' | 'stale_topology'): void {
    const nowMs = this.now().getTime();
    const capturedAtMs = Date.parse(capturedAt);
    if (!Number.isFinite(nowMs)) {
      throw new TypeError('Planning resolver clock must return a valid date');
    }
    const ageMs = nowMs - capturedAtMs;
    if (ageMs > this.maxAgeMs || ageMs < -30_000) {
      throw new InspectionPlanningSourceError(code, `${label} is stale`);
    }
  }
}
