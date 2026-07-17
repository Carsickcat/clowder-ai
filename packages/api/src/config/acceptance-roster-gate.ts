import type { CatConfig } from '@cat-cafe/shared';

export const ACCEPTANCE_ROSTER_GATE_ENV = 'CAT_CAFE_ACCEPTANCE_ROSTER_GATE';

type AcceptanceCatConfig = Pick<CatConfig, 'id' | 'clientId' | 'provider'>;

export interface AcceptanceRosterEvidence {
  catId: string;
  clientId: string;
  provider: string;
  adapterMode: string;
  agentServiceRegistered: boolean;
}

export interface AcceptanceRosterGateResult {
  enabled: boolean;
  entries: AcceptanceRosterEvidence[];
  missingCatIds: string[];
}

interface AcceptanceRosterGateInput {
  enabled: boolean;
  configs: Readonly<Record<string, AcceptanceCatConfig>>;
  agentRegistry: { has(catId: string): boolean };
  resolveAdapterMode: (catId: string, config: AcceptanceCatConfig) => string;
}

export class AcceptanceRosterGateError extends Error {
  readonly missingCatIds: string[];
  readonly entries: AcceptanceRosterEvidence[];

  constructor(missingCatIds: string[], entries: AcceptanceRosterEvidence[]) {
    super(`Acceptance roster is not dispatchable: missing AgentService for ${missingCatIds.join(', ')}`);
    this.name = 'AcceptanceRosterGateError';
    this.missingCatIds = missingCatIds;
    this.entries = entries;
  }
}

export function isAcceptanceRosterGateEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const value = env[ACCEPTANCE_ROSTER_GATE_ENV]?.trim().toLowerCase();
  return value === '1' || value === 'true';
}

/**
 * Acceptance-only fail-closed check. This deliberately does not add a
 * product-level readiness field or change the public cat catalog schema.
 */
export function assertAcceptanceRosterReady(input: AcceptanceRosterGateInput): AcceptanceRosterGateResult {
  if (!input.enabled) return { enabled: false, entries: [], missingCatIds: [] };

  const entries = Object.values(input.configs)
    .map(
      (config): AcceptanceRosterEvidence => ({
        catId: config.id,
        clientId: config.clientId,
        provider: config.provider ?? config.clientId,
        adapterMode: input.resolveAdapterMode(config.id, config),
        agentServiceRegistered: input.agentRegistry.has(config.id),
      }),
    )
    .sort((a, b) => a.catId.localeCompare(b.catId));
  const missingCatIds = entries.filter((entry) => !entry.agentServiceRegistered).map((entry) => entry.catId);

  if (missingCatIds.length > 0) throw new AcceptanceRosterGateError(missingCatIds, entries);
  return { enabled: true, entries, missingCatIds };
}
