import { compileInspectionRequest } from './compiler.mjs';
import { deepFreeze } from './domain.mjs';
import { selectPlanReadiness } from './selectors.mjs';

export function createDemoSession() {
  return deepFreeze({
    workspace: null,
    phase: 'intake',
    candidateDisposition: {},
    executionStep: -1,
    rcExpanded: false,
  });
}

function disposeCandidate(state, action) {
  if (state.phase !== 'plan' || !state.workspace) return state;
  const candidate = state.workspace.candidateChecks.find((item) => item.id === action.candidateId);
  if (!candidate || !['accepted', 'rejected'].includes(action.disposition)) {
    return state;
  }
  const reason = action.reason?.trim() ?? '';
  if (action.disposition === 'rejected' && !reason) return state;
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
    case 'INTENT_SUBMITTED':
      if (state.phase !== 'intake') return state;
      return {
        ...createDemoSession(),
        workspace: compileInspectionRequest(action.request),
      };
    case 'RESET':
      return createDemoSession();
    case 'INPUT_CONFIRMED':
      return state.phase === 'intake' && state.workspace ? { ...state, phase: 'context' } : state;
    case 'SCOPE_ACCEPTED': {
      if (state.phase !== 'context' || !state.workspace) return state;
      const { reconciliation } = state.workspace;
      return ['Conflict', 'Unverifiable'].includes(reconciliation.status) ? state : { ...state, phase: 'plan' };
    }
    case 'CANDIDATE_DISPOSED':
      return disposeCandidate(state, action);
    case 'PLAN_CONFIRMED':
      return state.phase === 'plan' && selectPlanReadiness(state).status === 'ready'
        ? { ...state, phase: 'execution', executionStep: -1 }
        : state;
    case 'EXECUTION_ADVANCED': {
      if (state.phase !== 'execution' || !state.workspace) return state;
      const lastIndex = state.workspace.execution.length - 1;
      const nextStep = state.executionStep + 1;
      return nextStep >= lastIndex
        ? { ...state, phase: 'report', executionStep: lastIndex }
        : { ...state, executionStep: nextStep };
    }
    case 'RC_TOGGLED':
      return state.phase === 'report' && state.workspace?.report.rcAgent
        ? { ...state, rcExpanded: !state.rcExpanded }
        : state;
    default:
      return state;
  }
}

export function demoReducer(state, action) {
  return deepFreeze(reduceSession(state, action));
}
