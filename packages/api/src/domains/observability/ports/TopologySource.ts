import type { InspectionTopologyDependency } from '@cat-cafe/shared';

export interface TopologySourceResolveRequest {
  readonly service: string;
  readonly environment: string;
  readonly changeId: string;
}

export interface ResolvedInspectionTopology {
  readonly sourceId: string;
  readonly capturedAt: string;
  readonly catalogVersion: string;
  readonly rootService: string;
  readonly dependencies: readonly InspectionTopologyDependency[];
}

export interface TopologySource {
  readonly sourceId: string;
  resolve(request: TopologySourceResolveRequest): Promise<ResolvedInspectionTopology>;
}
