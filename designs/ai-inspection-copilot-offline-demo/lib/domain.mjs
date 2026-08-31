export const EVIDENCE_VERDICTS = Object.freeze(['Verified', 'Violated', 'Inconclusive', 'NotEvaluated']);

export const ACTION_STATUSES = Object.freeze(['Proceed', 'Proceed-with-conditions', 'Pause', 'Rollback']);

const ACTION_STATUS_SET = new Set(ACTION_STATUSES);
const EVIDENCE_VERDICT_SET = new Set(EVIDENCE_VERDICTS);

const REQUIRED_CHECK_FIELDS = Object.freeze([
  'id',
  'priority',
  'purpose',
  'entity',
  'capability',
  'metricRules',
  'window',
  'baseline',
  'severity',
  'failureAction',
  'rationale',
  'sourceRefs',
]);

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sortedUnique(values = []) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function assertCheckContract(check, sourceIds) {
  for (const field of REQUIRED_CHECK_FIELDS) {
    const value = check?.[field];
    const missing =
      value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
    if (missing) throw new Error(`Check ${check?.id ?? 'unknown'} missing ${field}`);
  }
  for (const sourceRef of check.sourceRefs) {
    if (!sourceIds.has(sourceRef)) {
      throw new Error(`Unknown sourceRef ${sourceRef} on ${check.id}`);
    }
  }
  const ruleIds = new Set();
  for (const rule of check.metricRules) {
    const validRule =
      rule &&
      typeof rule === 'object' &&
      nonEmptyString(rule.id) &&
      nonEmptyString(rule.metricId) &&
      rule.id === rule.metricId &&
      nonEmptyString(rule.label) &&
      nonEmptyString(rule.category) &&
      nonEmptyString(rule.operator) &&
      Number.isFinite(rule.threshold) &&
      nonEmptyString(rule.unit) &&
      typeof rule.editable === 'boolean' &&
      stringArray(rule.allowedOperators) &&
      rule.allowedOperators.includes(rule.operator) &&
      nonEmptyString(rule.sourceRef) &&
      check.sourceRefs.includes(rule.sourceRef) &&
      sourceIds.has(rule.sourceRef) &&
      !ruleIds.has(rule.id);
    if (!validRule) throw new Error(`Check ${check.id} has invalid metricRule ${rule?.id ?? 'unknown'}`);
    ruleIds.add(rule.id);
  }
  return true;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringArray(value) {
  return Array.isArray(value) && value.every(nonEmptyString);
}

function validEvidenceCounts(counts) {
  return (
    counts &&
    typeof counts === 'object' &&
    ['verified', 'violated', 'unresolved'].every((key) => Number.isInteger(counts[key]) && counts[key] >= 0)
  );
}

function validRootCauseAgent(agent) {
  return (
    agent == null ||
    (typeof agent === 'object' &&
      nonEmptyString(agent.title) &&
      nonEmptyString(agent.rootCause) &&
      stringArray(agent.chain) &&
      nonEmptyString(agent.recommendation))
  );
}

function validMeasurement(measurement) {
  if (
    !measurement ||
    typeof measurement !== 'object' ||
    !nonEmptyString(measurement.id) ||
    !nonEmptyString(measurement.label) ||
    !nonEmptyString(measurement.entity) ||
    !['numeric', 'qualitative'].includes(measurement.kind) ||
    !nonEmptyString(measurement.displayValue) ||
    !measurement.gate ||
    typeof measurement.gate !== 'object' ||
    !nonEmptyString(measurement.gate.displayValue)
  ) {
    return false;
  }
  if (measurement.kind === 'qualitative') return true;
  return (
    Number.isFinite(measurement.value) &&
    nonEmptyString(measurement.unit) &&
    Number.isFinite(measurement.gate.value) &&
    nonEmptyString(measurement.gate.operator) &&
    nonEmptyString(measurement.gate.unit)
  );
}

function validV2ReportContract(report) {
  const hasResults = Object.hasOwn(report, 'checkResults');
  const hasInterpretation = Object.hasOwn(report, 'interpretation');
  if (!hasResults && !hasInterpretation) return true;
  if (!hasResults || !hasInterpretation || !Array.isArray(report.checkResults) || !report.checkResults.length) {
    return false;
  }
  const checkIds = new Set();
  const measurementIds = new Set();
  for (const result of report.checkResults) {
    if (
      !result ||
      typeof result !== 'object' ||
      !nonEmptyString(result.checkId) ||
      checkIds.has(result.checkId) ||
      !EVIDENCE_VERDICT_SET.has(result.status) ||
      !nonEmptyString(result.summary) ||
      !Array.isArray(result.measurements) ||
      !result.measurements.length ||
      !result.measurements.every(validMeasurement)
    ) {
      return false;
    }
    checkIds.add(result.checkId);
    for (const measurement of result.measurements) {
      if (measurementIds.has(measurement.id)) return false;
      measurementIds.add(measurement.id);
    }
  }
  const interpretationKeys = ['whatHappened', 'likelyCause', 'recommendedAction'];
  return interpretationKeys.every((key) => {
    const section = report.interpretation?.[key];
    if (!section || typeof section !== 'object' || !nonEmptyString(section.text) || !stringArray(section.evidenceIds)) {
      return false;
    }
    if (section.text === '证据不足') return section.evidenceIds.length === 0;
    return section.evidenceIds.length > 0 && section.evidenceIds.every((id) => measurementIds.has(id));
  });
}

export function validReportContract(report) {
  return (
    report &&
    typeof report === 'object' &&
    EVIDENCE_VERDICT_SET.has(report.evidenceVerdict) &&
    ACTION_STATUS_SET.has(report.action) &&
    nonEmptyString(report.actionLabel) &&
    nonEmptyString(report.title) &&
    nonEmptyString(report.summary) &&
    nonEmptyString(report.scopeStatement) &&
    validEvidenceCounts(report.evidenceCounts) &&
    stringArray(report.keyEvidence) &&
    stringArray(report.residualRisks) &&
    validRootCauseAgent(report.rcAgent) &&
    validV2ReportContract(report)
  );
}

export function reconcileChange(declaredChange, observedChange) {
  if (!declaredChange?.entities?.length || !observedChange?.entities?.length) {
    return deepFreeze({
      status: 'Unverifiable',
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
  let status = 'Exact';
  if (shared.length === 0) status = 'Conflict';
  else if (addedEntities.length && !missingEntities.length) {
    status = 'Observed-Superset';
  } else if (missingEntities.length && !addedEntities.length) {
    status = 'Observed-Subset';
  } else if (addedEntities.length || missingEntities.length) {
    status = 'Conflict';
  }

  return deepFreeze({
    status,
    declaredEntities,
    observedEntities,
    resolvedEntities: status === 'Conflict' ? [] : observedEntities,
    addedEntities,
    missingEntities,
  });
}
