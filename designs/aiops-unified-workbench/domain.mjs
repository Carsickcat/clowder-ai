import { createScenarios } from './scenario-data.mjs';

export const SCENARIO_IDS = Object.freeze(['release', 'incident', 'inspection']);
export const MODULE_IDS = Object.freeze(['metrics', 'alerts', 'logs', 'checks', 'synthetics']);

function createProgress() {
  return Object.fromEntries(
    SCENARIO_IDS.map((id) => [
      id,
      {
        status: 'not_started',
        completedStepIds: [],
        evidencePackage: [],
        aiVerdicts: {},
        moduleSelections: {},
        moduleOperations: {
          logs: {
            queryStatus: 'idle',
            executedQuery: null,
            resultCount: 0,
            pinnedSampleIds: [],
          },
        },
        decisionId: null,
        outcome: null,
        blockReason: null,
      },
    ]),
  );
}

export function createInitialState() {
  return {
    screen: 'home',
    scenarioOrder: [...SCENARIO_IDS],
    scenarios: createScenarios(),
    scenarioProgress: createProgress(),
    activeScenarioId: null,
    activeStepIndex: 0,
    activeModule: null,
    aiPanelOpen: false,
    capabilityMapOpen: false,
    mobileJourneyOpen: false,
  };
}

export function activeScenario(state) {
  return state.activeScenarioId ? state.scenarios[state.activeScenarioId] : null;
}

export function activeStep(state) {
  const scenario = activeScenario(state);
  return scenario?.steps[state.activeStepIndex] ?? null;
}

export function moduleDataset(scenario, module) {
  if (!scenario || !MODULE_IDS.includes(module)) return null;
  return scenario.datasets[module] ?? null;
}

export function deriveScenarioStatus(state, scenarioId = state.activeScenarioId) {
  if (!scenarioId || !state.scenarioProgress[scenarioId]) return 'not_started';
  return state.scenarioProgress[scenarioId].status;
}

function updateProgress(state, scenarioId, updater) {
  return {
    ...state,
    scenarioProgress: {
      ...state.scenarioProgress,
      [scenarioId]: updater(state.scenarioProgress[scenarioId]),
    },
  };
}

function unique(items) {
  return [...new Set(items)];
}

function startScenario(state, scenarioId) {
  if (!SCENARIO_IDS.includes(scenarioId)) return state;
  const next = updateProgress(state, scenarioId, (progress) => ({
    ...progress,
    status: progress.status === 'completed' ? 'completed' : 'active',
    blockReason: null,
  }));
  return {
    ...next,
    screen: 'journey',
    activeScenarioId: scenarioId,
    activeStepIndex: 0,
    activeModule: next.scenarios[scenarioId].steps[0].module,
    mobileJourneyOpen: false,
  };
}

function completeCurrentStep(state, actionId) {
  const scenario = activeScenario(state);
  const step = activeStep(state);
  if (!scenario || !step || step.requiredAction !== actionId) return state;

  const scenarioId = scenario.id;
  let next = updateProgress(state, scenarioId, (progress) => ({
    ...progress,
    status: 'active',
    completedStepIds: unique([...progress.completedStepIds, step.id]),
    evidencePackage: unique([...progress.evidencePackage, ...step.evidenceIds]),
    blockReason: null,
  }));

  if (state.activeStepIndex < scenario.steps.length - 1) {
    const nextIndex = state.activeStepIndex + 1;
    next = {
      ...next,
      activeStepIndex: nextIndex,
      activeModule: scenario.steps[nextIndex].module,
      screen: 'journey',
    };
  }
  return next;
}

function reviewAI(state, insightId, verdict) {
  const scenario = activeScenario(state);
  if (!scenario || !['accepted', 'rejected', 'needs_evidence'].includes(verdict)) return state;
  const insight = Object.values(scenario.ai)
    .flat()
    .find((item) => item.id === insightId);
  if (!insight) return state;
  return updateProgress(state, scenario.id, (progress) => ({
    ...progress,
    aiVerdicts: { ...progress.aiVerdicts, [insightId]: verdict },
  }));
}

function chooseDecision(state, decisionId) {
  const scenario = activeScenario(state);
  if (!scenario?.decisions.some((item) => item.id === decisionId)) return state;
  return updateProgress(state, scenario.id, (progress) => ({
    ...progress,
    status: progress.status === 'blocked' ? 'active' : progress.status,
    decisionId,
    blockReason: null,
  }));
}

export function evaluateRiskGates(riskGates) {
  const blockers = [];
  if (riskGates.coverageState !== 'complete') {
    blockers.push({ gate: 'coverage', reason: '检查覆盖尚未完整，不能形成正向健康结论' });
  }
  if (riskGates.freshnessState !== 'fresh') {
    blockers.push({ gate: 'freshness', reason: '证据已过期，不能形成正向健康结论' });
  }
  if (riskGates.baselineState !== 'comparable') {
    blockers.push({ gate: 'baseline', reason: '基线不可比，不能形成正向健康结论' });
  }
  return {
    blockers,
    canProjectPositiveHealth: blockers.length === 0,
    projectedHealthState: blockers.length === 0 ? 'recovering' : 'unknown',
  };
}

function blockReasonFor(scenario, decisionId) {
  if (decisionId !== 'mark_healthy') return null;
  return evaluateRiskGates(scenario.riskGates).blockers[0]?.reason ?? null;
}

function completeJourney(state) {
  const scenario = activeScenario(state);
  if (!scenario) return state;
  const progress = state.scenarioProgress[scenario.id];
  const allStepsComplete = scenario.steps.every((step) => progress.completedStepIds.includes(step.id));
  if (!allStepsComplete || !progress.decisionId) return state;

  const blockReason = blockReasonFor(scenario, progress.decisionId);
  if (blockReason) {
    return updateProgress(state, scenario.id, (current) => ({
      ...current,
      status: 'blocked',
      blockReason,
      outcome: null,
    }));
  }

  const gateAssessment = evaluateRiskGates(scenario.riskGates);

  return updateProgress(state, scenario.id, (current) => ({
    ...current,
    status: 'completed',
    blockReason: null,
    outcome: {
      ...structuredClone(scenario.outcomeBlueprint),
      decision: current.decisionId,
      evidencePackage: [...current.evidencePackage],
      completedAt: '现在',
      healthState: gateAssessment.projectedHealthState,
      openRiskGates: gateAssessment.blockers.map((item) => item.gate),
    },
  }));
}

function focusModuleItem(state, module, artifactId) {
  const scenario = activeScenario(state);
  if (!scenario || !MODULE_IDS.includes(module) || typeof artifactId !== 'string') return state;
  return updateProgress(state, scenario.id, (progress) => ({
    ...progress,
    moduleSelections: { ...progress.moduleSelections, [module]: artifactId },
  }));
}

function runLogQuery(state) {
  const scenario = activeScenario(state);
  if (!scenario?.datasets.logs) return state;
  const resultCount = scenario.datasets.logs.patterns.reduce((sum, item) => sum + item.count, 0);
  return updateProgress(state, scenario.id, (progress) => ({
    ...progress,
    moduleOperations: {
      ...progress.moduleOperations,
      logs: {
        ...progress.moduleOperations.logs,
        queryStatus: 'completed',
        executedQuery: scenario.datasets.logs.query,
        resultCount,
      },
    },
  }));
}

function pinLogSample(state, sampleId) {
  const scenario = activeScenario(state);
  if (!scenario?.datasets.logs.samples.some((sample) => sample.id === sampleId)) return state;
  return updateProgress(state, scenario.id, (progress) => ({
    ...progress,
    evidencePackage: unique([...progress.evidencePackage, sampleId]),
    moduleOperations: {
      ...progress.moduleOperations,
      logs: {
        ...progress.moduleOperations.logs,
        pinnedSampleIds: unique([...progress.moduleOperations.logs.pinnedSampleIds, sampleId]),
      },
    },
  }));
}

export function reduceWorkbench(state, action) {
  switch (action.type) {
    case 'start_scenario':
      return startScenario(state, action.scenarioId);
    case 'complete_current_step':
      return completeCurrentStep(state, action.actionId);
    case 'go_to_step': {
      const scenario = activeScenario(state);
      if (!scenario || action.stepIndex < 0 || action.stepIndex >= scenario.steps.length) return state;
      const target = scenario.steps[action.stepIndex];
      const progress = state.scenarioProgress[scenario.id];
      const firstIncomplete = scenario.steps.findIndex((step) => !progress.completedStepIds.includes(step.id));
      if (action.stepIndex > Math.max(firstIncomplete, state.activeStepIndex)) return state;
      return { ...state, screen: 'journey', activeStepIndex: action.stepIndex, activeModule: target.module };
    }
    case 'open_module':
      if (!MODULE_IDS.includes(action.module) || !activeScenario(state)) return state;
      return { ...state, screen: 'module', activeModule: action.module };
    case 'return_to_journey': {
      const step = activeStep(state);
      if (!step) return state;
      return { ...state, screen: 'journey', activeModule: step.module };
    }
    case 'review_ai':
      return reviewAI(state, action.insightId, action.verdict);
    case 'focus_module_item':
      return focusModuleItem(state, action.module, action.artifactId);
    case 'run_log_query':
      return runLogQuery(state);
    case 'pin_log_sample':
      return pinLogSample(state, action.sampleId);
    case 'choose_decision':
      return chooseDecision(state, action.decisionId);
    case 'complete_journey':
      return completeJourney(state);
    case 'toggle_ai':
      return { ...state, aiPanelOpen: !state.aiPanelOpen };
    case 'toggle_capability_map':
      return { ...state, capabilityMapOpen: !state.capabilityMapOpen };
    case 'toggle_mobile_journey':
      return { ...state, mobileJourneyOpen: !state.mobileJourneyOpen };
    case 'go_home':
      return {
        ...state,
        screen: 'home',
        activeScenarioId: null,
        activeStepIndex: 0,
        activeModule: null,
        mobileJourneyOpen: false,
      };
    default:
      return state;
  }
}
