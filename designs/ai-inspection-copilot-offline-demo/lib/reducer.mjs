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
import { selectChecksForContext, selectCommittedChecks, selectPlanReadiness } from './selectors.mjs';

export function createDemoSession(options = {}) {
  const library = options.library
    ? mergeInspectionLibraries(createEmptyInspectionLibrary(), options.library)
    : createEmptyInspectionLibrary();
  return deepFreeze({
    workspace: null,
    phase: 'intake',
    candidateDisposition: {},
    checkRuleOverrides: {},
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
    activeHistoryDefinitionId: null,
    savedRunRefresh: null,
    composerPrefill: options.composerPrefill ?? null,
    currentRunId: null,
    savedDefinitionId: null,
    storageError: null,
    toast: null,
    shareToast: null,
    historyDiagnostics: {
      status: options.historyDiagnostics?.status ?? 'available',
      rejectedRunCount: options.historyDiagnostics?.rejectedRunCount ?? 0,
    },
    actorId: normalizeActorId(options.actorId),
    nextTaskOrdinal:
      options.nextTaskOrdinal ??
      nextOrdinal(
        library.runs.map((run) => run.taskInstanceId),
        'INS',
        48,
      ),
    nextRunOrdinal:
      options.nextRunOrdinal ??
      nextOrdinal(
        library.runs.map((run) => run.id),
        'RUN',
        48,
      ),
    nextSavedOrdinal:
      options.nextSavedOrdinal ??
      nextOrdinal(
        library.savedInspections.map((definition) => definition.id),
        'SAVED',
        1,
      ),
  });
}

function nextOrdinal(ids, prefix, fallback) {
  const ordinals = ids
    .map((id) => new RegExp(`^${prefix}-(\\d+)(?:$|-)`).exec(String(id))?.[1])
    .filter(Boolean)
    .map(Number);
  return ordinals.length ? Math.max(...ordinals) + 1 : fallback;
}

function normalizeActorId(actorId) {
  return typeof actorId === 'string' ? actorId.replace(/[^a-zA-Z0-9]/g, '') : '';
}

function scopedId(prefix, ordinal, width, actorId) {
  const base = `${prefix}-${String(ordinal).padStart(width, '0')}`;
  return actorId ? `${base}-${actorId}` : base;
}

function taskId(ordinal, actorId) {
  return scopedId('INS', ordinal, 4, actorId);
}

function runId(ordinal, actorId) {
  return scopedId('RUN', ordinal, 4, actorId);
}

function savedInspectionId(ordinal, actorId) {
  return scopedId('SAVED', ordinal, 3, actorId);
}

function demoTimestamp(ordinal, offset = 0) {
  return new Date(Date.UTC(2026, 7, 16, 6, ordinal + offset)).toISOString();
}

function createTaskInstance(ordinal, sourceSavedInspectionId = null, actorId = '') {
  const id = taskId(ordinal, actorId);
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
  return checks.map((check) => ({
    ...check,
    sourceRefs: [...check.sourceRefs],
    metricRules: check.metricRules.map((rule) => ({
      ...rule,
      allowedOperators: [...rule.allowedOperators],
    })),
  }));
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

function updateCheckRule(state, action) {
  if (state.phase !== 'plan' || !state.workspace) return state;
  const check = selectCommittedChecks(state).find((item) => item.id === action.checkId);
  const rule = check?.metricRules.find((item) => item.id === action.ruleId);
  const operator = String(action.operator ?? '');
  const threshold =
    typeof action.threshold === 'string' && !action.threshold.trim() ? Number.NaN : Number(action.threshold);
  if (!rule?.editable || !rule.allowedOperators.includes(operator) || !Number.isFinite(threshold)) return state;
  if (rule.operator === operator && rule.threshold === threshold) return state;
  return {
    ...state,
    checkRuleOverrides: {
      ...state.checkRuleOverrides,
      [check.id]: {
        ...(state.checkRuleOverrides[check.id] ?? {}),
        [rule.id]: { operator, threshold },
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
      actorId: state.actorId,
      nextTaskOrdinal: ordinal + 1,
      nextRunOrdinal: state.nextRunOrdinal,
      nextSavedOrdinal: state.nextSavedOrdinal,
      historyDiagnostics: state.historyDiagnostics,
    }),
    workspace,
    contextOptions: createContextOptions(workspace),
    conversation: [
      { role: 'user', text: action.request.prompt },
      { role: 'assistant', text: `已识别：${workspace.declaredChange.entities[0]} 巡检` },
    ],
    activeRequest: { ...action.request },
    playbookMatch: matchInspectionPlaybook(workspace, playbookCatalog),
    taskInstance: createTaskInstance(ordinal, null, state.actorId),
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
  const checks = selectChecksForContext(state, state.playbookMatch.checks);
  const plannedState = {
    ...state,
    playbookDecision: 'applied',
    taskInstance: updateTaskInstance(
      state.taskInstance,
      {
        status: 'executing',
        sourcePlaybookRef: playbookRef(state.playbookMatch),
        inspectionPlan: createInspectionPlan(checks, playbookRef(state.playbookMatch)),
      },
      { type: 'playbook-applied', playbookRef: playbookRef(state.playbookMatch) },
    ),
  };
  return completeInspectionRun(plannedState);
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
  const plannedState = {
    ...state,
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
  return completeInspectionRun(plannedState);
}

function completeInspectionRun(state) {
  if (!state.workspace || state.taskInstance?.status !== 'executing' || !state.taskInstance.inspectionPlan)
    return state;
  const taskInstance = updateTaskInstance(state.taskInstance, { status: 'locked' }, { type: 'task-locked' });
  const id = runId(state.nextRunOrdinal, state.actorId);
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
  const id = savedInspectionId(state.nextSavedOrdinal, state.actorId);
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
  return current.some((item) => item.selected)
    ? current
    : definition.selectedContext.map((item) => ({ ...item, selected: true }));
}

function requestSavedInspectionRun(state, action, compileSavedDefinition) {
  if (state.phase !== 'intake' || state.workspace) return state;
  const definition = state.library.savedInspections.find((item) => item.id === action.definitionId);
  if (!definition) return state;
  let workspace;
  try {
    workspace = compileSavedDefinition(definition.request);
  } catch {
    return state;
  }
  const refresh = classifySavedInspectionRefresh(definition, workspace);
  const ordinal = state.nextTaskOrdinal;
  let taskInstance = createTaskInstance(ordinal, definition.id, state.actorId);
  if (refresh.status === 'exact') {
    taskInstance = updateTaskInstance(
      taskInstance,
      { status: 'executing', inspectionPlan: savedPlan(definition) },
      { type: 'saved-inspection-applied', definitionId: definition.id, refreshStatus: 'exact' },
    );
  }
  const preparedState = {
    ...createDemoSession({
      library: state.library,
      actorId: state.actorId,
      nextTaskOrdinal: ordinal + 1,
      nextRunOrdinal: state.nextRunOrdinal,
      nextSavedOrdinal: state.nextSavedOrdinal,
      historyDiagnostics: state.historyDiagnostics,
    }),
    phase: 'context',
    workspace,
    contextOptions: selectedSavedContext(definition, workspace),
    activeRequest: { ...definition.request },
    activeSavedInspectionId: definition.id,
    savedRunRefresh: refresh,
    taskInstance,
  };
  return refresh.status === 'exact' ? completeInspectionRun(preparedState) : preparedState;
}

function confirmSavedInspectionRun(state) {
  if (state.phase !== 'context' || state.savedRunRefresh?.status !== 'minor-drift') return state;
  const definition = state.library.savedInspections.find((item) => item.id === state.activeSavedInspectionId);
  if (!definition) return state;
  const plannedState = {
    ...state,
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
  return completeInspectionRun(plannedState);
}

function regenerateSavedInspection(state) {
  if (state.phase !== 'context' || state.savedRunRefresh?.status !== 'major-drift') return state;
  const definition = state.library.savedInspections.find((item) => item.id === state.activeSavedInspectionId);
  if (!definition) return state;
  return createDemoSession({
    library: state.library,
    actorId: state.actorId,
    nextTaskOrdinal: state.nextTaskOrdinal,
    nextRunOrdinal: state.nextRunOrdinal,
    nextSavedOrdinal: state.nextSavedOrdinal,
    composerPrefill: { ...definition.request },
    historyDiagnostics: state.historyDiagnostics,
  });
}

function resetSession(state) {
  return createDemoSession({
    library: state.library,
    actorId: state.actorId,
    nextTaskOrdinal: state.nextTaskOrdinal,
    nextRunOrdinal: state.nextRunOrdinal,
    nextSavedOrdinal: state.nextSavedOrdinal,
    historyDiagnostics: state.historyDiagnostics,
  });
}

function hydrateLibrary(state, action) {
  if (state.phase !== 'intake' || state.workspace || state.library.revision > 0) return state;
  return createDemoSession({
    library: action.library,
    actorId: state.actorId,
    historyDiagnostics: action.diagnostics,
  });
}

function mergeLibrary(state, action) {
  const library = mergeInspectionLibraries(state.library, action.library);
  const historyDiagnostics = action.diagnostics ?? state.historyDiagnostics;
  return JSON.stringify(library) === JSON.stringify(state.library) && historyDiagnostics === state.historyDiagnostics
    ? state
    : { ...state, library, historyDiagnostics };
}

function openSavedInspectionHistory(state, action) {
  if (state.phase !== 'intake' || state.workspace) return state;
  const exists = state.library.savedInspections.some((definition) => definition.id === action.definitionId);
  return exists ? { ...state, activeHistoryDefinitionId: action.definitionId } : state;
}

function closeSavedInspectionHistory(state) {
  return state.activeHistoryDefinitionId ? { ...state, activeHistoryDefinitionId: null } : state;
}

function markStorageFailure(state, action) {
  return { ...state, storageError: action.message || '本地保存失败', toast: null };
}

function setShareFeedback(state, action) {
  return state.phase === 'report' ? { ...state, shareToast: action.message ?? null } : state;
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
    SHARE_FEEDBACK_SET: setShareFeedback,
    CONTEXT_ITEM_TOGGLED: toggleDraftContext,
    INPUT_CONFIRMED: confirmInput,
    PLAYBOOK_DISMISSED: dismissPlaybook,
    PLAYBOOK_EXECUTION_STARTED: startPlaybookExecution,
    PLAYBOOK_DIFF_CONFIRMED: confirmPlaybookDifference,
    PLAYBOOK_DRIFT_REVIEWED: reviewPlaybookDrift,
    PLAYBOOK_REGENERATED: regenerateFromPlaybook,
    SCOPE_ACCEPTED: acceptScope,
    CANDIDATE_DISPOSED: disposeCandidate,
    CHECK_RULE_UPDATED: updateCheckRule,
    PLAN_CONFIRMED: confirmPlan,
    RC_TOGGLED: toggleRootCause,
    PLAYBOOK_PROPOSAL_SUBMITTED: submitPlaybookProposal,
    SAVED_INSPECTION_CREATED: createPersonalSavedInspection,
    SAVED_INSPECTION_HISTORY_OPENED: openSavedInspectionHistory,
    SAVED_INSPECTION_HISTORY_CLOSED: closeSavedInspectionHistory,
    SAVED_INSPECTION_RUN_REQUESTED: (state, action) => requestSavedInspectionRun(state, action, compileSavedDefinition),
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
