export const EVIDENCE_VERDICTS = Object.freeze([
  "Verified",
  "Violated",
  "Inconclusive",
  "NotEvaluated",
]);

export const ACTION_STATUSES = Object.freeze([
  "Proceed",
  "Proceed-with-conditions",
  "Pause",
  "Rollback",
]);

const REQUIRED_CHECK_FIELDS = Object.freeze([
  "id",
  "priority",
  "purpose",
  "entity",
  "capability",
  "metric",
  "window",
  "baseline",
  "rule",
  "severity",
  "failureAction",
  "rationale",
  "sourceRefs",
]);

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sortedUnique(values = []) {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function assertCheckContract(check, sourceIds) {
  for (const field of REQUIRED_CHECK_FIELDS) {
    const value = check?.[field];
    const missing =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);
    if (missing) throw new Error(`Check ${check?.id ?? "unknown"} missing ${field}`);
  }
  for (const sourceRef of check.sourceRefs) {
    if (!sourceIds.has(sourceRef)) {
      throw new Error(`Unknown sourceRef ${sourceRef} on ${check.id}`);
    }
  }
  return true;
}

export function reconcileChange(declaredChange, observedChange) {
  if (!declaredChange?.entities?.length || !observedChange?.entities?.length) {
    return deepFreeze({
      status: "Unverifiable",
      declaredEntities: sortedUnique(declaredChange?.entities),
      observedEntities: sortedUnique(observedChange?.entities),
      resolvedEntities: [],
      addedEntities: [],
      missingEntities: [],
    });
  }

  const declaredEntities = sortedUnique(declaredChange.entities);
  const observedEntities = sortedUnique(observedChange.entities);
  const declared = new Set(declaredEntities);
  const observed = new Set(observedEntities);
  const addedEntities = observedEntities.filter((entity) => !declared.has(entity));
  const missingEntities = declaredEntities.filter((entity) => !observed.has(entity));
  const shared = observedEntities.filter((entity) => declared.has(entity));
  let status = "Exact";
  if (shared.length === 0) status = "Conflict";
  else if (addedEntities.length && !missingEntities.length) {
    status = "Observed-Superset";
  } else if (missingEntities.length && !addedEntities.length) {
    status = "Observed-Subset";
  } else if (addedEntities.length || missingEntities.length) {
    status = "Conflict";
  }

  return deepFreeze({
    status,
    declaredEntities,
    observedEntities,
    resolvedEntities: status === "Conflict" ? [] : observedEntities,
    addedEntities,
    missingEntities,
  });
}
