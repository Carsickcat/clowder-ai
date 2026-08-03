import { createHash } from 'node:crypto';

export type ObservabilitySourceErrorCode =
  | 'http_error'
  | 'invalid_configuration'
  | 'malformed_response'
  | 'redirect_error'
  | 'response_too_large'
  | 'timeout'
  | 'transport_error';

export class ObservabilitySourceError extends Error {
  constructor(
    readonly code: ObservabilitySourceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ObservabilitySourceError';
  }
}

export interface ObservabilityCheckRequest {
  readonly id: string;
  readonly query: string;
}

export interface ObservabilityCollectRequest {
  readonly checks: readonly ObservabilityCheckRequest[];
  readonly window: string;
}

export type ObservabilityObservationStatus = 'ok' | 'missing' | 'error';

export interface ObservabilityObservation {
  readonly baselineValue: number | null;
  readonly checkId: string;
  readonly observedAt: string | null;
  readonly partial: boolean;
  readonly queryDigest: string;
  readonly status: ObservabilityObservationStatus;
  readonly value: number | null;
}

export interface ObservabilitySnapshot {
  readonly collectedAt: string;
  readonly fixtureCapturedAt?: string;
  readonly observations: readonly ObservabilityObservation[];
  readonly sourceId: string;
  readonly window: string;
}

export interface ObservabilitySource {
  readonly sourceId: string;
  collect(request: ObservabilityCollectRequest): Promise<ObservabilitySnapshot>;
}

export function createQueryDigest(query: string): string {
  return `sha256:${createHash('sha256').update(query, 'utf8').digest('hex')}`;
}
