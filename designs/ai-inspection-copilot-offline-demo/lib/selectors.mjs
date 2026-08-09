import { assertCheckContract } from "./domain.mjs";

function requireWorkspace(state) {
  if (!state.workspace) throw new Error("Inspection workspace is not compiled");
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
        candidate.criticality === "high" &&
        !["accepted", "rejected"].includes(
          state.candidateDisposition[candidate.id]?.status,
        ),
    )
    .map((candidate) => candidate.id);
  const reconciliationBlocked = ["Conflict", "Unverifiable"].includes(
    workspace.reconciliation.status,
  );
  return {
    status:
      reconciliationBlocked || unresolvedCandidateIds.length
        ? "blocked"
        : "ready",
    unresolvedCandidateIds,
    reconciliationBlocked,
  };
}

export function selectCommittedChecks(state) {
  const workspace = requireWorkspace(state);
  const acceptedCandidates = workspace.candidateChecks.filter(
    (candidate) =>
      state.candidateDisposition[candidate.id]?.status === "accepted",
  );
  const checks = [...workspace.committedChecks, ...acceptedCandidates];
  const sourceIds = new Set(
    workspace.contextSources.map((source) => source.id),
  );
  for (const check of checks) assertCheckContract(check, sourceIds);
  return checks;
}

export function selectPlanSummary(state) {
  const workspace = requireWorkspace(state);
  const dispositions = state.candidateDisposition;
  return {
    required: workspace.committedChecks.filter(
      (check) => check.priority === "required",
    ).length,
    recommended: workspace.candidateChecks.filter(
      (candidate) => dispositions[candidate.id]?.status === "accepted",
    ).length,
    pending: workspace.candidateChecks.filter(
      (candidate) => !dispositions[candidate.id],
    ).length,
    rejected: workspace.candidateChecks.filter(
      (candidate) => dispositions[candidate.id]?.status === "rejected",
    ).length,
  };
}

export function selectExecutionView(state) {
  const workspace = requireWorkspace(state);
  return workspace.execution.map((step, index) => ({
    ...step,
    progress:
      state.phase === "report" || index <= state.executionStep
        ? "complete"
        : index === state.executionStep + 1 && state.phase === "execution"
          ? "active"
          : "queued",
  }));
}

export function selectReportView(state) {
  const workspace = requireWorkspace(state);
  return state.phase === "report" ? workspace.report : null;
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
  };
}
