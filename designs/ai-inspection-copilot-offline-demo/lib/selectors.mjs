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
      String(right.completedAt).localeCompare(String(left.completedAt)) ||
      String(right.id).localeCompare(String(left.id)),
  );
}

function compareExecutionResult(id, before, after) {
  if (!before) return { id, label: after.label, kind: 'added', before: null, after };
  if (!after) return { id, label: before.label, kind: 'removed', before, after: null };
  if (
    before.status === after.status &&
    before.fact === after.fact &&
    before.label === after.label &&
    before.signature === after.signature
  ) {
    return null;
  }
  const beforeRank = RESULT_RANK[before.status];
  const afterRank = RESULT_RANK[after.status];
  const kind = afterRank > beforeRank ? 'improved' : afterRank < beforeRank ? 'worsened' : 'stable';
  return {
    id,
    label: after.label,
    kind,
    before,
    after,
    ...(before.fact === after.fact && before.signature !== after.signature ? { evidenceChanged: true } : {}),
  };
}

function reportComparisonResults(run) {
  if (!Array.isArray(run?.report?.checkResults)) return null;
  const labels = new Map((run.inspectionPlan?.checks ?? []).map((check) => [check.id, check.purpose]));
  return run.report.checkResults.map((result) => ({
    id: result.checkId,
    label: labels.get(result.checkId) ?? result.checkId,
    status: result.status,
    fact: result.summary,
    signature: JSON.stringify({ status: result.status, summary: result.summary, measurements: result.measurements }),
  }));
}

function comparisonResults(run) {
  const reportResults = reportComparisonResults(run);
  if (reportResults) return reportResults;
  if (!Array.isArray(run?.executionResults)) return null;
  return run.executionResults.map((result) => ({ ...result, signature: null }));
}

export function compareInspectionRuns(currentRun, previousRun) {
  const currentResults = comparisonResults(currentRun);
  const previousResults = comparisonResults(previousRun);
  if (!currentResults || !previousResults) return null;
  const current = new Map(currentResults.map((result) => [result.id, result]));
  const previous = new Map(previousResults.map((result) => [result.id, result]));
  const ids = [...new Set([...current.keys(), ...previous.keys()])].sort();
  const items = [];
  for (const id of ids) {
    const item = compareExecutionResult(id, previous.get(id), current.get(id));
    if (item) items.push(item);
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

function applyRuleOverrides(state, checks) {
  return checks.map((check) => {
    const overrides = state.checkRuleOverrides?.[check.id];
    if (!overrides) return check;
    let changed = false;
    const metricRules = check.metricRules.map((rule) => {
      const override = overrides[rule.id];
      if (!override) return rule;
      changed = true;
      return { ...rule, operator: override.operator, threshold: override.threshold };
    });
    return changed ? { ...check, metricRules } : check;
  });
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
  const checks = applyRuleOverrides(state, [...selectedBaseChecks, ...acceptedCandidates]);
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
  const pendingCandidates = workspace.candidateChecks.filter((candidate) => !dispositions[candidate.id]);
  return {
    required: selectedBaseChecks.filter((check) => check.priority === 'required').length,
    recommended: workspace.candidateChecks.filter((candidate) => dispositions[candidate.id]?.status === 'accepted')
      .length,
    pending: pendingCandidates.length,
    requiredPending: pendingCandidates.filter((candidate) => candidate.criticality === 'high').length,
    optionalPending: pendingCandidates.filter((candidate) => candidate.criticality !== 'high').length,
    rejected: workspace.candidateChecks.filter((candidate) => dispositions[candidate.id]?.status === 'rejected').length,
  };
}

export function selectReportView(state) {
  const workspace = requireWorkspace(state);
  if (state.phase !== 'report') return null;
  return state.library.runs.find((run) => run.id === state.currentRunId)?.report ?? workspace.report;
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
  const currentRun = state.library.runs.find((run) => run.id === state.currentRunId) ?? null;
  const historyDefinition =
    savedInspections.find((definition) => definition.id === state.activeHistoryDefinitionId) ?? null;
  const historyRuns = selectRunsForDefinition(historyDefinition, state.library.runs);
  const reportDefinitionId = state.activeSavedInspectionId ?? state.savedDefinitionId;
  const reportDefinition = savedInspections.find((definition) => definition.id === reportDefinitionId) ?? null;
  const reportRuns = selectRunsForDefinition(reportDefinition, state.library.runs);
  const currentRunIndex = currentRun ? reportRuns.findIndex((run) => run.id === currentRun.id) : -1;
  const comparison =
    currentRunIndex >= 0 && reportRuns[currentRunIndex + 1]
      ? compareInspectionRuns(currentRun, reportRuns[currentRunIndex + 1])
      : null;
  return {
    definitions: savedInspections,
    runs: state.library.runs,
    cards: savedInspections.map((definition) => {
      const definitionRuns = selectRunsForDefinition(definition, state.library.runs);
      return { definition, runs: definitionRuns, latestRun: definitionRuns[0] ?? null };
    }),
    activeDefinition: savedInspections.find((definition) => definition.id === state.activeSavedInspectionId) ?? null,
    historyDefinition,
    historyRuns,
    historyDiagnostics: state.historyDiagnostics,
    reportDefinition,
    comparison,
    refresh: state.savedRunRefresh,
    contextOptions: state.contextOptions,
    selectedContext: state.contextOptions.filter((item) => item.selected),
    currentRun,
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
    report: selectReportView(state),
    playbook: selectPlaybookView(state),
    savedInspection: selectSavedInspectionView(state),
  };
}
