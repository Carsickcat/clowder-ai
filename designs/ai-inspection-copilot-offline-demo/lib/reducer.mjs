import { deepFreeze } from "./domain.mjs";
import { getScenario } from "./scenarios.mjs";
import { selectPlanReadiness } from "./selectors.mjs";

export function createDemoSession(scenarioId = "natural-language-pass") {
  if (!getScenario(scenarioId)) throw new Error(`Unknown scenario ${scenarioId}`);
  return deepFreeze({
    scenarioId,
    phase: "intake",
    candidateDisposition: {},
    executionStep: -1,
    rcExpanded: false,
  });
}

function disposeCandidate(state, action) {
  if (state.phase !== "plan") return state;
  const scenario = getScenario(state.scenarioId);
  const candidate = scenario.candidateChecks.find(
    (item) => item.id === action.candidateId,
  );
  if (!candidate || !["accepted", "rejected"].includes(action.disposition)) {
    return state;
  }
  const reason = action.reason?.trim() ?? "";
  if (action.disposition === "rejected" && !reason) return state;
  return {
    ...state,
    candidateDisposition: {
      ...state.candidateDisposition,
      [candidate.id]: {
        status: action.disposition,
        reason: reason || null,
      },
    },
  };
}

function reduceSession(state, action) {
  switch (action.type) {
    case "SCENARIO_SELECTED":
      return getScenario(action.scenarioId)
        ? createDemoSession(action.scenarioId)
        : state;
    case "RESET":
      return createDemoSession(state.scenarioId);
    case "INPUT_CONFIRMED":
      return state.phase === "intake" ? { ...state, phase: "context" } : state;
    case "SCOPE_ACCEPTED": {
      if (state.phase !== "context") return state;
      const reconciliation = getScenario(state.scenarioId).reconciliation;
      return ["Conflict", "Unverifiable"].includes(reconciliation.status)
        ? state
        : { ...state, phase: "plan" };
    }
    case "CANDIDATE_DISPOSED":
      return disposeCandidate(state, action);
    case "PLAN_CONFIRMED":
      return state.phase === "plan" &&
        selectPlanReadiness(state).status === "ready"
        ? { ...state, phase: "execution", executionStep: -1 }
        : state;
    case "EXECUTION_ADVANCED": {
      if (state.phase !== "execution") return state;
      const lastIndex = getScenario(state.scenarioId).execution.length - 1;
      const nextStep = state.executionStep + 1;
      return nextStep >= lastIndex
        ? { ...state, phase: "report", executionStep: lastIndex }
        : { ...state, executionStep: nextStep };
    }
    case "RC_TOGGLED":
      return state.phase === "report" &&
        getScenario(state.scenarioId).report.rcAgent
        ? { ...state, rcExpanded: !state.rcExpanded }
        : state;
    default:
      return state;
  }
}

export function demoReducer(state, action) {
  return deepFreeze(reduceSession(state, action));
}
