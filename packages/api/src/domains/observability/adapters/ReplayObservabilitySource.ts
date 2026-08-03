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
  readonly query: string;
  readonly status?: ObservabilityObservationStatus;
  readonly value?: number | null;
}

export interface ReplayAcceptanceBundle {
  readonly collectedAt: string;
  readonly observations: Readonly<Record<string, ReplayObservation>>;
  readonly sourceId: string;
}

export interface ReplayObservabilitySourceOptions {
  readonly clock?: () => Date;
}

export class ReplayObservabilitySource implements ObservabilitySource {
  readonly sourceId: string;
  private readonly collectedAt: string;
  private readonly clock: (() => Date) | undefined;
  private readonly observations: ReadonlyMap<string, ReplayObservation>;

  constructor(bundle: ReplayAcceptanceBundle, options: ReplayObservabilitySourceOptions = {}) {
    this.sourceId = bundle.sourceId;
    this.collectedAt = bundle.collectedAt;
    this.clock = options.clock;
    this.observations = new Map(
      Object.entries(bundle.observations).map(([checkId, observation]) => [checkId, { ...observation }]),
    );
  }

  async collect(request: ObservabilityCollectRequest): Promise<ObservabilitySnapshot> {
    const collectedAt = this.clock ? this.clock().toISOString() : this.collectedAt;
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

      const queryDigest = createQueryDigest(configured.query);
      if (configured.query !== check.query) {
        return {
          baselineValue: null,
          checkId: check.id,
          observedAt: configured.observedAt ?? collectedAt,
          partial: false,
          queryDigest,
          status: 'error',
          value: null,
        };
      }

      return {
        baselineValue: configured.baselineValue ?? null,
        checkId: check.id,
        observedAt: configured.observedAt ?? collectedAt,
        partial: configured.partial ?? false,
        queryDigest,
        status: configured.status ?? 'ok',
        value: configured.value ?? null,
      };
    });

    return {
      collectedAt,
      observations,
      sourceId: this.sourceId,
      window: request.window,
    };
  }
}
