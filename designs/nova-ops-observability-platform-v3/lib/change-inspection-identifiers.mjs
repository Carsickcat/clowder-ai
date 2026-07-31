const executionIdPattern = /^[a-z0-9-]{4,64}$/i;

export function createInspectionExecutionId() {
  return globalThis.crypto.randomUUID();
}

export function createInspectionCaseId(sourceId, executionId) {
  if (!executionIdPattern.test(executionId ?? "")) return null;
  return `CIC-${sourceId}-${executionId.toUpperCase()}`;
}

export function createCaseEvidenceId(caseId, kind, ordinal) {
  return `${caseId}:${kind}-${String(ordinal).padStart(3, "0")}`;
}
