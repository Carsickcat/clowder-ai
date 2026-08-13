import { compileInspectionRequest } from './compiler.mjs';
import { deepFreeze } from './domain.mjs';
import { matchInspectionPlaybook } from './playbooks.mjs';
import { selectPlanReadiness } from './selectors.mjs';

export function createDemoSession(options = {}) {
  return deepFreeze({
    workspace: null,
    phase: 'intake',
    candidateDisposition: {},
    executionStep: -1,
    rcExpanded: false,
    playbookMatch: null,
    playbookDecision: null,
    playbookDriftReviewed: false,
    playbookProposal: null,
    taskInstance: null,
    nextTaskOrdinal: options.nextTaskOrdinal ?? 48,
  });
}

function taskId(ordinal) {
  return `INS-${String(ordinal).padStart(4, '0')}`;
}

function createTaskInstance(ordinal) {
  const id = taskId(ordinal);
  return {
    id,
    status: 'draft',
    sourcePlaybookRef: null,
    referencePlaybookRef: null,
    auditTrail: [{ type: 'task-created', taskInstanceId: id }],
  };
}

function updateTaskInstance(taskInstance, patch, auditEvent) {
  if (!taskInstance || taskInstance.status === 'locked') return taskInstance;
  return {
    ...taskInstance,
    ...patch,
    auditTrail: auditEvent ? [...taskInstance.auditTrail, auditEvent] : taskInstance.auditTrail,
  };
}

function playbookRef(match) {
  return match ? { ...match.playbookRef } : null;
}

function reconciliationAllowsExecution(workspace) {
  return workspace && !['Conflict', 'Unverifiable'].includes(workspace.reconciliation.status);
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

function submitIntent(state, action) {
  if (state.phase !== 'intake') return state;
  const workspace = compileInspectionRequest(action.request);
  const ordinal = state.nextTaskOrdinal;
  return {
    ...createDemoSession({ nextTaskOrdinal: ordinal + 1 }),
    workspace,
    playbookMatch: matchInspectionPlaybook(workspace),
    taskInstance: createTaskInstance(ordinal),
  };
}

function confirmInput(state) {
  return state.phase === 'intake' && state.workspace ? { ...state, phase: 'context' } : state;
}

function dismissPlaybook(state) {
  if (state.phase !== 'context' || !state.playbookMatch || state.playbookDecision) return state;
  return {
    ...state,
    playbookDecision: 'dismissed',
    taskInstance: updateTaskInstance(
      state.taskInstance,
      {},
      { type: 'playbook-dismissed', playbookRef: playbookRef(state.playbookMatch) },
    ),
  };
}

function startPlaybookExecution(state) {
  if (
    state.phase !== 'context' ||
    state.playbookMatch?.status !== 'exact' ||
    state.playbookDecision ||
    !reconciliationAllowsExecution(state.workspace)
  ) {
    return state;
  }
  return {
    ...state,
    phase: 'execution',
    playbookDecision: 'applied',
    taskInstance: updateTaskInstance(
      state.taskInstance,
      { status: 'executing', sourcePlaybookRef: playbookRef(state.playbookMatch) },
      { type: 'playbook-applied', playbookRef: playbookRef(state.playbookMatch) },
    ),
  };
}

function confirmPlaybookDifference(state) {
  if (
    state.phase !== 'context' ||
    state.playbookMatch?.status !== 'minor-drift' ||
    state.playbookDecision ||
    !reconciliationAllowsExecution(state.workspace)
  ) {
    return state;
  }
  return {
    ...state,
    phase: 'plan',
    playbookDecision: 'accepted-with-diff',
    taskInstance: updateTaskInstance(
      state.taskInstance,
      { sourcePlaybookRef: playbookRef(state.playbookMatch) },
      {
        type: 'playbook-differences-confirmed',
        playbookRef: playbookRef(state.playbookMatch),
        differenceIds: state.playbookMatch.differences.map((difference) => difference.id),
      },
    ),
  };
}

function reviewPlaybookDrift(state) {
  return state.phase === 'context' && state.playbookMatch?.status === 'major-drift'
    ? { ...state, playbookDriftReviewed: true }
    : state;
}

function regenerateFromPlaybook(state) {
  if (
    state.phase !== 'context' ||
    state.playbookMatch?.status !== 'major-drift' ||
    state.playbookDecision ||
    !state.playbookDriftReviewed
  ) {
    return state;
  }
  return {
    ...state,
    phase: 'plan',
    playbookDecision: 'regenerated',
    taskInstance: updateTaskInstance(
      state.taskInstance,
      { referencePlaybookRef: playbookRef(state.playbookMatch) },
      { type: 'playbook-regenerated', referencePlaybookRef: playbookRef(state.playbookMatch) },
    ),
  };
}

function acceptScope(state) {
  if (state.phase !== 'context' || !state.workspace) return state;
  if (state.playbookMatch && state.playbookDecision !== 'dismissed') return state;
  const { reconciliation } = state.workspace;
  return ['Conflict', 'Unverifiable'].includes(reconciliation.status) ? state : { ...state, phase: 'plan' };
}

function confirmPlan(state) {
  if (state.phase !== 'plan' || selectPlanReadiness(state).status !== 'ready') return state;
  return {
    ...state,
    phase: 'execution',
    executionStep: -1,
    taskInstance: updateTaskInstance(state.taskInstance, { status: 'executing' }, { type: 'plan-confirmed' }),
  };
}

function advanceExecution(state) {
  if (state.phase !== 'execution' || !state.workspace) return state;
  const lastIndex = state.workspace.execution.length - 1;
  const nextStep = state.executionStep + 1;
  return nextStep >= lastIndex
    ? {
        ...state,
        phase: 'report',
        executionStep: lastIndex,
        taskInstance: updateTaskInstance(state.taskInstance, { status: 'locked' }, { type: 'task-locked' }),
      }
    : { ...state, executionStep: nextStep };
}

function toggleRootCause(state) {
  return state.phase === 'report' && state.workspace?.report.rcAgent
    ? { ...state, rcExpanded: !state.rcExpanded }
    : state;
}

function submitPlaybookProposal(state) {
  if (state.phase !== 'report' || state.taskInstance?.status !== 'locked' || state.playbookProposal) return state;
  const source = state.taskInstance.sourcePlaybookRef;
  return {
    ...state,
    playbookProposal: {
      id: `PB-PROP-${state.taskInstance.id}`,
      kind: source ? 'update' : 'create',
      sourceTaskInstanceId: state.taskInstance.id,
      sourcePlaybookRef: source ? { ...source } : null,
      targetVersion: source ? source.version + 1 : 1,
      status: 'pending-approval',
    },
  };
}

const sessionHandlers = {
  INTENT_SUBMITTED: submitIntent,
  RESET: (state) => createDemoSession({ nextTaskOrdinal: state.nextTaskOrdinal }),
  INPUT_CONFIRMED: confirmInput,
  PLAYBOOK_DISMISSED: dismissPlaybook,
  PLAYBOOK_EXECUTION_STARTED: startPlaybookExecution,
  PLAYBOOK_DIFF_CONFIRMED: confirmPlaybookDifference,
  PLAYBOOK_DRIFT_REVIEWED: reviewPlaybookDrift,
  PLAYBOOK_REGENERATED: regenerateFromPlaybook,
  SCOPE_ACCEPTED: acceptScope,
  CANDIDATE_DISPOSED: disposeCandidate,
  PLAN_CONFIRMED: confirmPlan,
  EXECUTION_ADVANCED: advanceExecution,
  RC_TOGGLED: toggleRootCause,
  PLAYBOOK_PROPOSAL_SUBMITTED: submitPlaybookProposal,
};

function reduceSession(state, action) {
  return (sessionHandlers[action.type] ?? ((currentState) => currentState))(state, action);
}

export function demoReducer(state, action) {
  return deepFreeze(reduceSession(state, action));
}
