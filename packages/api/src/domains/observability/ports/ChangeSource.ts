export interface ChangeSourceResolveRequest {
  readonly changeRef: string;
}

export interface ResolvedInspectionChange {
  readonly sourceId: string;
  readonly capturedAt: string;
  readonly changeRef: string;
  readonly service: string;
  readonly environment: string;
  readonly connectorRef: string;
  readonly changeId: string;
  readonly version: string;
}

export interface ChangeSource {
  readonly sourceId: string;
  resolve(request: ChangeSourceResolveRequest): Promise<ResolvedInspectionChange>;
}
