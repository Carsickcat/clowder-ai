import { renderAIInspector } from './views-ai.mjs';
import { renderModule } from './views-modules.mjs';
import {
  renderDeepModuleHeader,
  renderHome,
  renderOutcomeShell,
  renderStageAction,
  renderStageHeader,
  renderWorkbenchShell,
} from './views-shell.mjs';

function renderJourneyContent(state) {
  const scenario = state.scenarios[state.activeScenarioId];
  const progress = state.scenarioProgress[scenario.id];
  if (progress.status === 'completed' && progress.outcome) return renderOutcomeShell(scenario, progress);
  const step = scenario.steps[state.activeStepIndex];
  return `${renderStageHeader(state)}${renderModule(step.module, scenario, progress)}${renderStageAction(state)}`;
}

function renderModuleContent(state) {
  const scenario = state.scenarios[state.activeScenarioId];
  const progress = state.scenarioProgress[scenario.id];
  return `${renderDeepModuleHeader(state)}${renderModule(state.activeModule, scenario, progress)}`;
}

export function renderApp(state) {
  if (state.screen === 'home' || !state.activeScenarioId) return renderHome(state);
  const content = state.screen === 'module' ? renderModuleContent(state) : renderJourneyContent(state);
  return renderWorkbenchShell(state, content, renderAIInspector(state));
}
