import {
  createQueryDigest,
  type ObservabilityCollectRequest,
  type ObservabilityObservation,
  type ObservabilityObservationStatus,
  type ObservabilitySnapshot,
  type ObservabilitySource,
} from '../ports/ObservabilitySource.js';

export interface ReplayObservation {
  readonly baselineValue?: number | null;
  readonly observedAt?: string | null;
  readonly partial?: boolean;
  readonly status?: ObservabilityObservationStatus;
  readonly value?: number | null;
}

export interface ReplayAcceptanceBundle {
  readonly collectedAt: string;
  readonly observations: Readonly<Record<string, ReplayObservation>>;
  readonly sourceId: string;
}

export class ReplayObservabilitySource implements ObservabilitySource {
  readonly sourceId: string;
  private readonly collectedAt: string;
  private readonly observations: ReadonlyMap<string, ReplayObservation>;

  constructor(bundle: ReplayAcceptanceBundle) {
    this.sourceId = bundle.sourceId;
    this.collectedAt = bundle.collectedAt;
    this.observations = new Map(
      Object.entries(bundle.observations).map(([checkId, observation]) => [checkId, { ...observation }]),
    );
  }

  async collect(request: ObservabilityCollectRequest): Promise<ObservabilitySnapshot> {
    const observations: ObservabilityObservation[] = request.checks.map((check) => {
      const configured = this.observations.get(check.id);
      if (!configured) {
        return {
          baselineValue: null,
          checkId: check.id,
          observedAt: null,
          partial: false,
          queryDigest: createQueryDigest(check.query),
          status: 'missing',
          value: null,
        };
      }

      return {
        baselineValue: configured.baselineValue ?? null,
        checkId: check.id,
        observedAt: configured.observedAt ?? null,
        partial: configured.partial ?? false,
        queryDigest: createQueryDigest(check.query),
        status: configured.status ?? 'ok',
        value: configured.value ?? null,
      };
    });

    return {
      collectedAt: this.collectedAt,
      observations,
      sourceId: this.sourceId,
      window: request.window,
    };
  }
}
