import { assertCheckContract, deepFreeze } from './domain.mjs';

const RESULT_RANK = Object.freeze({
  Violated: 0,
  Inconclusive: 1,
  NotEvaluated: 1,
  Verified: 2,
});

export function selectRunsForDefinition(definition, runs = []) {
  if (!definition) return [];
  const unique = new Map();
  for (const run of runs) {
    if (run?.definitionId === definition.id || run?.id === definition.sourceRunId) unique.set(run.id, run);
  }
  return [...unique.values()].sort(
    (left, right) =>
      String(right.completedAt).localeCompare(String(left.completedAt)) || String(right.id).localeCompare(String(left.id)),
  );
}

export function compareInspectionRuns(currentRun, previousRun) {
  if (!Array.isArray(currentRun?.executionResults) || !Array.isArray(previousRun?.executionResults)) return null;
  const current = new Map(currentRun.executionResults.map((result) => [result.id, result]));
  const previous = new Map(previousRun.executionResults.map((result) => [result.id, result]));
  const ids = [...new Set([...current.keys(), ...previous.keys()])].sort();
  const items = [];
  for (const id of ids) {
    const before = previous.get(id);
    const after = current.get(id);
    if (!before) {
      items.push({ id, label: after.label, kind: 'added', before: null, after });
      continue;
    }
    if (!after) {
      items.push({ id, label: before.label, kind: 'removed', before, after: null });
      continue;
    }
    if (before.status === after.status && before.fact === after.fact && before.label === after.label) continue;
    const beforeRank = RESULT_RANK[before.status];
    const afterRank = RESULT_RANK[after.status];
    const kind = afterRank > beforeRank ? 'improved' : afterRank < beforeRank ? 'worsened' : 'stable';
    items.push({ id, label: after.label, kind, before, after });
  }
  return deepFreeze({
    previousRunId: previousRun.id,
    previousCompletedAt: previousRun.completedAt,
    summary: items.length ? 'changed' : 'stable',
    items,
  });
}

function requireWorkspace(state) {
  if (!state.workspace) throw new Error('Inspection workspace is not compiled');
  return state.workspace;
}

export function selectResolvedScope(state) {
  const workspace = requireWorkspace(state);
  return {
    status: workspace.reconciliation.status,
    entities: workspace.reconciliation.resolvedEntities,
    addedEntities: workspace.reconciliation.addedEntities,
  };
}

export function selectPlanReadiness(state) {
  const workspace = requireWorkspace(state);
  const unresolvedCandidateIds = workspace.candidateChecks
    .filter(
      (candidate) =>
        candidate.criticality === 'high' &&
        !['accepted', 'rejected'].includes(state.candidateDisposition[candidate.id]?.status),
    )
    .map((candidate) => candidate.id);
  const reconciliationBlocked = ['Conflict', 'Unverifiable'].includes(workspace.reconciliation.status);
  return {
    status: reconciliationBlocked || unresolvedCandidateIds.length ? 'blocked' : 'ready',
    unresolvedCandidateIds,
    reconciliationBlocked,
  };
}

export function selectCommittedChecks(state) {
  const workspace = requireWorkspace(state);
  if (state.taskInstance?.inspectionPlan) {
    const checks = state.taskInstance.inspectionPlan.checks;
    const sourceIds = new Set(workspace.contextSources.map((source) => source.id));
    for (const check of checks) assertCheckContract(check, sourceIds);
    return checks;
  }
  const baseChecks =
    state.playbookDecision === 'accepted-with-diff' ? state.playbookMatch.checks : workspace.committedChecks;
  const selectedBaseChecks = selectChecksForContext(state, baseChecks);
  const acceptedCandidates = workspace.candidateChecks.filter(
    (candidate) => state.candidateDisposition[candidate.id]?.status === 'accepted',
  );
  const checks = [...selectedBaseChecks, ...acceptedCandidates];
  const sourceIds = new Set(workspace.contextSources.map((source) => source.id));
  for (const check of checks) assertCheckContract(check, sourceIds);
  return checks;
}

export function selectChecksForContext(state, checks) {
  const signalOptions = state.contextOptions.filter((item) => item.kind === 'signal');
  if (!signalOptions.length) return checks;
  const selectedSignalIds = new Set(
    signalOptions.filter((item) => item.selected).map((item) => item.id.slice('signal:'.length)),
  );
  return checks.filter((check) => selectedSignalIds.has(check.id));
}

export function selectPlanSummary(state) {
  const workspace = requireWorkspace(state);
  const dispositions = state.candidateDisposition;
  const baseChecks =
    state.playbookDecision === 'accepted-with-diff' ? state.playbookMatch.checks : workspace.committedChecks;
  const selectedBaseChecks = selectChecksForContext(state, baseChecks);
  return {
    required: selectedBaseChecks.filter((check) => check.priority === 'required').length,
    recommended: workspace.candidateChecks.filter((candidate) => dispositions[candidate.id]?.status === 'accepted')
      .length,
    pending: workspace.candidateChecks.filter((candidate) => !dispositions[candidate.id]).length,
    rejected: workspace.candidateChecks.filter((candidate) => dispositions[candidate.id]?.status === 'rejected').length,
  };
}

export function selectExecutionView(state) {
  const workspace = requireWorkspace(state);
  return workspace.execution.map((step, index) => ({
    ...step,
    progress:
      state.phase === 'report' || index <= state.executionStep
        ? 'complete'
        : index === state.executionStep + 1 && state.phase === 'execution'
          ? 'active'
          : 'queued',
  }));
}

export function selectReportView(state) {
  const workspace = requireWorkspace(state);
  return state.phase === 'report' ? workspace.report : null;
}

export function selectPlaybookView(state) {
  const matchVisible =
    state.phase === 'context' && Boolean(state.playbookMatch) && state.playbookDecision !== 'dismissed';
  return {
    match: matchVisible ? state.playbookMatch : null,
    reference: state.playbookDecision === 'regenerated' ? state.playbookMatch : null,
    decision: state.playbookDecision,
    driftReviewed: state.playbookDriftReviewed,
    taskInstance: state.taskInstance,
    proposal: state.playbookProposal,
  };
}

export function selectSavedInspectionView(state) {
  const savedInspections = [...state.library.savedInspections].sort((left, right) =>
    String(right.updatedAt).localeCompare(String(left.updatedAt)),
  );
  return {
    definitions: savedInspections,
    runs: state.library.runs,
    activeDefinition: savedInspections.find((definition) => definition.id === state.activeSavedInspectionId) ?? null,
    refresh: state.savedRunRefresh,
    contextOptions: state.contextOptions,
    selectedContext: state.contextOptions.filter((item) => item.selected),
    currentRun: state.library.runs.find((run) => run.id === state.currentRunId) ?? null,
    savedDefinitionId: state.savedDefinitionId,
    composerPrefill: state.composerPrefill,
    conversation: state.conversation,
    storageError: state.storageError,
    toast: state.toast,
  };
}

export function selectViewModel(state) {
  if (!state.workspace) {
    return {
      state,
      workspace: null,
      scope: null,
      readiness: null,
      committedChecks: [],
      planSummary: null,
      execution: [],
      report: null,
      playbook: selectPlaybookView(state),
      savedInspection: selectSavedInspectionView(state),
    };
  }
  return {
    state,
    workspace: state.workspace,
    scope: selectResolvedScope(state),
    readiness: selectPlanReadiness(state),
    committedChecks: selectCommittedChecks(state),
    planSummary: selectPlanSummary(state),
    execution: selectExecutionView(state),
    report: selectReportView(state),
    playbook: selectPlaybookView(state),
    savedInspection: selectSavedInspectionView(state),
  };
}
