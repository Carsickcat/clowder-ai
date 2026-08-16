import { compileInspectionRequest } from './compiler.mjs';
import { deepFreeze } from './domain.mjs';
import { inspectionPlaybooks, matchInspectionPlaybook } from './playbooks.mjs';
import {
  classifySavedInspectionRefresh,
  createContextOptions,
  createEmptyInspectionLibrary,
  createInspectionRun,
  createSavedInspectionDefinition,
  mergeInspectionLibraries,
  toggleContextSelection,
} from './saved-inspections.mjs';
import { selectCommittedChecks, selectPlanReadiness } from './selectors.mjs';

export function createDemoSession(options = {}) {
  const library = options.library ?? createEmptyInspectionLibrary();
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
    library,
    contextOptions: [],
    conversation: [],
    activeRequest: null,
    activeSavedInspectionId: null,
    savedRunRefresh: null,
    composerPrefill: options.composerPrefill ?? null,
    currentRunId: null,
    savedDefinitionId: null,
    storageError: null,
    toast: null,
    nextTaskOrdinal:
      options.nextTaskOrdinal ?? nextOrdinal(library.runs.map((run) => run.taskInstanceId), 'INS', 48),
    nextRunOrdinal: options.nextRunOrdinal ?? nextOrdinal(library.runs.map((run) => run.id), 'RUN', 48),
    nextSavedOrdinal:
      options.nextSavedOrdinal ?? nextOrdinal(library.savedInspections.map((definition) => definition.id), 'SAVED', 1),
  });
}

function nextOrdinal(ids, prefix, fallback) {
  const ordinals = ids
    .map((id) => new RegExp(`^${prefix}-(\\d+)$`).exec(String(id))?.[1])
    .filter(Boolean)
    .map(Number);
  return ordinals.length ? Math.max(...ordinals) + 1 : fallback;
}

function taskId(ordinal) {
  return `INS-${String(ordinal).padStart(4, '0')}`;
}

function runId(ordinal) {
  return `RUN-${String(ordinal).padStart(4, '0')}`;
}

function savedInspectionId(ordinal) {
  return `SAVED-${String(ordinal).padStart(3, '0')}`;
}

function demoTimestamp(ordinal, offset = 0) {
  return new Date(Date.UTC(2026, 7, 16, 6, ordinal + offset)).toISOString();
}

function createTaskInstance(ordinal, sourceSavedInspectionId = null) {
  const id = taskId(ordinal);
  return {
    id,
    status: 'draft',
    startedAt: demoTimestamp(ordinal),
    sourceSavedInspectionId,
    sourcePlaybookRef: null,
    referencePlaybookRef: null,
    inspectionPlan: null,
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

function snapshotChecks(checks) {
  return checks.map((check) => ({ ...check, sourceRefs: [...check.sourceRefs] }));
}

function createInspectionPlan(checks, sourcePlaybookRef = null, sourceSavedInspectionId = null) {
  return {
    source: sourceSavedInspectionId ? 'saved-inspection' : sourcePlaybookRef ? 'approved-playbook' : 'generated',
    sourcePlaybookRef: sourcePlaybookRef ? { ...sourcePlaybookRef } : null,
    sourceSavedInspectionId,
    checkIds: checks.map((check) => check.id),
    checks: snapshotChecks(checks),
  };
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

function submitIntent(state, action, playbookCatalog, compileIntent) {
  if (state.phase !== 'intake') return state;
  const workspace = compileIntent(action.request);
  const ordinal = state.nextTaskOrdinal;
  return {
    ...createDemoSession({
      library: state.library,
      nextTaskOrdinal: ordinal + 1,
      nextRunOrdinal: state.nextRunOrdinal,
      nextSavedOrdinal: state.nextSavedOrdinal,
    }),
    workspace,
    contextOptions: createContextOptions(workspace),
    conversation: [
      { role: 'user', text: action.request.prompt },
      { role: 'assistant', text: `已识别：${workspace.declaredChange.entities[0]} 巡检` },
    ],
    activeRequest: { ...action.request },
    playbookMatch: matchInspectionPlaybook(workspace, playbookCatalog),
    taskInstance: createTaskInstance(ordinal),
  };
}

function toggleDraftContext(state, action) {
  if (state.phase !== 'intake' || !state.workspace) return state;
  const contextOptions = toggleContextSelection(state.contextOptions, action.contextId);
  return contextOptions === state.contextOptions ? state : { ...state, contextOptions };
}

function confirmInput(state) {
  if (state.phase !== 'intake' || !state.workspace) return state;
  return { ...state, phase: state.playbookMatch ? 'context' : 'plan' };
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
      {
        status: 'executing',
        sourcePlaybookRef: playbookRef(state.playbookMatch),
        inspectionPlan: createInspectionPlan(state.playbookMatch.checks, playbookRef(state.playbookMatch)),
      },
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
  const checks = selectCommittedChecks(state);
  return {
    ...state,
    phase: 'execution',
    executionStep: -1,
    taskInstance: updateTaskInstance(
      state.taskInstance,
      {
        status: 'executing',
        inspectionPlan: createInspectionPlan(
          checks,
          state.taskInstance.sourcePlaybookRef,
          state.taskInstance.sourceSavedInspectionId,
        ),
      },
      { type: 'plan-confirmed', checkIds: checks.map((check) => check.id) },
    ),
  };
}

function advanceExecution(state) {
  if (state.phase !== 'execution' || !state.workspace) return state;
  const lastIndex = state.workspace.execution.length - 1;
  const nextStep = state.executionStep + 1;
  if (nextStep < lastIndex) return { ...state, executionStep: nextStep };
  const taskInstance = updateTaskInstance(state.taskInstance, { status: 'locked' }, { type: 'task-locked' });
  const id = runId(state.nextRunOrdinal);
  const run = createInspectionRun({
    id,
    taskInstance,
    definitionId: state.activeSavedInspectionId,
    selectedContext: state.contextOptions,
    report: state.workspace.report,
    startedAt: taskInstance.startedAt,
    completedAt: demoTimestamp(state.nextRunOrdinal, 1),
  });
  return {
    ...state,
    phase: 'report',
    executionStep: lastIndex,
    taskInstance,
    currentRunId: id,
    nextRunOrdinal: state.nextRunOrdinal + 1,
    library: {
      ...state.library,
      revision: state.library.revision + 1,
      runs: [...state.library.runs, run],
    },
  };
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

function createPersonalSavedInspection(state, action) {
  if (
    state.phase !== 'report' ||
    state.taskInstance?.status !== 'locked' ||
    !state.currentRunId ||
    state.savedDefinitionId
  ) {
    return state;
  }
  const currentRun = state.library.runs.find((run) => run.id === state.currentRunId);
  if (!currentRun) return state;
  const id = savedInspectionId(state.nextSavedOrdinal);
  let definition;
  try {
    definition = createSavedInspectionDefinition({
      id,
      name: action.name,
      request: state.activeRequest,
      workspace: state.workspace,
      selectedContext: state.contextOptions,
      taskInstance: state.taskInstance,
      sourceRunId: currentRun.id,
      now: action.now ?? demoTimestamp(state.nextSavedOrdinal),
    });
  } catch {
    return state;
  }
  return {
    ...state,
    savedDefinitionId: id,
    nextSavedOrdinal: state.nextSavedOrdinal + 1,
    toast: '已保存，下次可从首页直接执行',
    library: {
      ...state.library,
      revision: state.library.revision + 1,
      savedInspections: [...state.library.savedInspections, definition],
    },
  };
}

function savedPlan(definition) {
  return {
    ...definition.inspectionPlan,
    source: 'saved-inspection',
    sourceSavedInspectionId: definition.id,
    sourcePlaybookRef: definition.inspectionPlan.sourcePlaybookRef
      ? { ...definition.inspectionPlan.sourcePlaybookRef }
      : null,
    checkIds: [...definition.inspectionPlan.checkIds],
    checks: snapshotChecks(definition.inspectionPlan.checks),
  };
}

function selectedSavedContext(definition, workspace) {
  const selectedIds = new Set(definition.selectedContext.map((item) => item.id));
  const current = createContextOptions(workspace).map((item) => ({ ...item, selected: selectedIds.has(item.id) }));
  return current.some((item) => item.selected) ? current : definition.selectedContext.map((item) => ({ ...item, selected: true }));
}

function requestSavedInspectionRun(state, action, compileSavedDefinition) {
  if (state.phase !== 'intake' || state.workspace) return state;
  const definition = state.library.savedInspections.find((item) => item.id === action.definitionId);
  if (!definition) return state;
  const workspace = compileSavedDefinition(definition.request);
  const refresh = classifySavedInspectionRefresh(definition, workspace);
  const ordinal = state.nextTaskOrdinal;
  let taskInstance = createTaskInstance(ordinal, definition.id);
  let phase = 'context';
  if (refresh.status === 'exact') {
    phase = 'execution';
    taskInstance = updateTaskInstance(
      taskInstance,
      { status: 'executing', inspectionPlan: savedPlan(definition) },
      { type: 'saved-inspection-applied', definitionId: definition.id, refreshStatus: 'exact' },
    );
  }
  return {
    ...createDemoSession({
      library: state.library,
      nextTaskOrdinal: ordinal + 1,
      nextRunOrdinal: state.nextRunOrdinal,
      nextSavedOrdinal: state.nextSavedOrdinal,
    }),
    phase,
    workspace,
    contextOptions: selectedSavedContext(definition, workspace),
    activeRequest: { ...definition.request },
    activeSavedInspectionId: definition.id,
    savedRunRefresh: refresh,
    taskInstance,
  };
}

function confirmSavedInspectionRun(state) {
  if (state.phase !== 'context' || state.savedRunRefresh?.status !== 'minor-drift') return state;
  const definition = state.library.savedInspections.find((item) => item.id === state.activeSavedInspectionId);
  if (!definition) return state;
  return {
    ...state,
    phase: 'execution',
    taskInstance: updateTaskInstance(
      state.taskInstance,
      { status: 'executing', inspectionPlan: savedPlan(definition) },
      {
        type: 'saved-inspection-drift-confirmed',
        definitionId: definition.id,
        differenceIds: state.savedRunRefresh.differences.map((difference) => difference.id),
      },
    ),
  };
}

function regenerateSavedInspection(state) {
  if (state.phase !== 'context' || state.savedRunRefresh?.status !== 'major-drift') return state;
  const definition = state.library.savedInspections.find((item) => item.id === state.activeSavedInspectionId);
  if (!definition) return state;
  return createDemoSession({
    library: state.library,
    nextTaskOrdinal: state.nextTaskOrdinal,
    nextRunOrdinal: state.nextRunOrdinal,
    nextSavedOrdinal: state.nextSavedOrdinal,
    composerPrefill: { ...definition.request },
  });
}

function resetSession(state) {
  return createDemoSession({
    library: state.library,
    nextTaskOrdinal: state.nextTaskOrdinal,
    nextRunOrdinal: state.nextRunOrdinal,
    nextSavedOrdinal: state.nextSavedOrdinal,
  });
}

function hydrateLibrary(state, action) {
  if (state.phase !== 'intake' || state.workspace || state.library.revision > 0) return state;
  return createDemoSession({
    library: action.library,
  });
}

function mergeLibrary(state, action) {
  const library = mergeInspectionLibraries(state.library, action.library);
  return JSON.stringify(library) === JSON.stringify(state.library) ? state : { ...state, library };
}

function markStorageFailure(state, action) {
  return { ...state, storageError: action.message || '本地保存失败', toast: null };
}

export function createDemoReducer(options = {}) {
  const playbookCatalog = options.playbookCatalog ?? inspectionPlaybooks;
  const compileIntent = options.compileIntent ?? compileInspectionRequest;
  const compileSavedDefinition = options.compileSavedDefinition ?? compileInspectionRequest;
  const sessionHandlers = {
    INTENT_SUBMITTED: (state, action) => submitIntent(state, action, playbookCatalog, compileIntent),
    RESET: resetSession,
    LIBRARY_HYDRATED: hydrateLibrary,
    LIBRARY_MERGED: mergeLibrary,
    LIBRARY_SAVE_FAILED: markStorageFailure,
    CONTEXT_ITEM_TOGGLED: toggleDraftContext,
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
    SAVED_INSPECTION_CREATED: createPersonalSavedInspection,
    SAVED_INSPECTION_RUN_REQUESTED: (state, action) =>
      requestSavedInspectionRun(state, action, compileSavedDefinition),
    SAVED_INSPECTION_RUN_CONFIRMED: confirmSavedInspectionRun,
    SAVED_INSPECTION_REGENERATED: regenerateSavedInspection,
  };
  return (state, action) =>
    deepFreeze((sessionHandlers[action.type] ?? ((currentState) => currentState))(state, action));
}

const defaultReducer = createDemoReducer();

export function demoReducer(state, action) {
  return defaultReducer(state, action);
}
