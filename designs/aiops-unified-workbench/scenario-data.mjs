import { incidentScenario } from './scenario-incident.mjs';
import { inspectionScenario } from './scenario-inspection.mjs';
import { releaseScenario } from './scenario-release.mjs';

export const scenarios = Object.freeze({
  release: releaseScenario,
  incident: incidentScenario,
  inspection: inspectionScenario,
});

export function createScenarios() {
  return structuredClone(scenarios);
}
