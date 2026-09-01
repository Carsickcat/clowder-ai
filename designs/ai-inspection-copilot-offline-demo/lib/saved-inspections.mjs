import { deepFreeze, validReportContract } from './domain.mjs';
import { createMetricRule, formatMetricRule } from './metric-catalog.mjs';

export const INSPECTION_LIBRARY_SCHEMA_VERSION = 1;

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  }
  return value;
}

function stripRuntimePayload(value) {
  if (Array.isArray(value)) return value.map(stripRuntimePayload);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !['evidence', 'report'].includes(key))
      .map(([key, item]) => [key, stripRuntimePayload(item)]),
  );
}

function sortedUnique(values = []) {
  return [...new Set(values.filter(Boolean))].sort();
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringArray(value, { allowEmpty = true } = {}) {
  return Array.isArray(value) && (allowEmpty || value.length > 0) && value.every(nonEmptyString);
}

function validRequest(request) {
  return (
    request &&
    typeof request === 'object' &&
    nonEmptyString(request.prompt) &&
    (request.targetService === undefined || typeof request.targetService === 'string') &&
    (request.contextReference === undefined || typeof request.contextReference === 'string')
  );
}

function validContextItem(item) {
  return (
    item &&
    typeof item === 'object' &&
    nonEmptyString(item.id) &&
    nonEmptyString(item.kind) &&
    nonEmptyString(item.label) &&
    typeof item.detail === 'string'
  );
}

function validMetricRule(rule) {
  return (
    rule &&
    typeof rule === 'object' &&
    nonEmptyString(rule.id) &&
    nonEmptyString(rule.metricId) &&
    nonEmptyString(rule.label) &&
    nonEmptyString(rule.category) &&
    nonEmptyString(rule.operator) &&
    Number.isFinite(rule.threshold) &&
    nonEmptyString(rule.unit) &&
    typeof rule.editable === 'boolean' &&
    stringArray(rule.allowedOperators, { allowEmpty: false }) &&
    rule.allowedOperators.includes(rule.operator) &&
    nonEmptyString(rule.sourceRef)
  );
}

function legacyMetricRules(check) {
  const sourceRef = check.sourceRefs.includes('metric-catalog')
    ? 'metric-catalog'
    : (check.sourceRefs.at(-1) ?? 'legacy-snapshot');
  const create = (metricId, operator, threshold, options = {}) =>
    createMetricRule(metricId, operator, threshold, { sourceRef, ...options });
  if (check.id === 'candidate-memory-trend') {
    return [create('container.memory.working_set', '<=', 1, { editable: false })];
  }
  if (check.id === 'order-success') return [create('order.submit.success_rate', '>=', 99.59)];
  if (check.id === 'payment-success') return [create('payment.confirm.success_rate', '>=', 99.82)];
  if (check.id === 'business-outcome') {
    const metricId = String(check.metric).split(' + ')[0];
    return [
      create(metricId, '>=', 99.59, {
        label: `${check.entity}成功率`,
        category: '业务结果',
        unit: '%',
      }),
    ];
  }
  if (check.id === 'service-golden-signals' || check.id === 'payment-service') {
    if (check.entity === 'order-api') {
      return [create('http.error_rate', '<=', 0.5), create('http.duration.p95', '<=', 198)];
    }
    if (check.entity === 'payment-api') {
      return [create('http.error_rate', '<=', 0.3), create('http.duration.p95', '<=', 216)];
    }
    return [create('http.error_rate', '<=', 0.5), create('http.duration.p95.change_rate', '<=', 10)];
  }
  if (check.id === 'payment-dependency' || check.id === 'downstream-dependency') {
    return [create('span.client.error_rate', '<=', 0), create('span.client.duration.p95.change_rate', '<=', 8)];
  }
  if (check.id === 'cache-health' || check.id === 'middleware-health') {
    return [create('redis.hit_rate', '>=', 94.4), create('redis.command_latency', '<=', 6)];
  }
  if (check.id === 'candidate-db-wait') {
    return [create('db.pool.wait_p95', '<=', 20), create('db.pool.utilization', '<=', 80)];
  }
  if (check.id === 'invoice-backlog') return [create('invoice.queue.lag', '<=', 5)];
  const metricId = String(check.metric ?? check.id).split(' + ')[0];
  return [
    create(metricId, '<=', 0, {
      label: metricId,
      category: '历史指标',
      unit: '%',
      editable: false,
    }),
  ];
}

function upgradeCheck(check) {
  if (Array.isArray(check.metricRules)) return clone(check);
  if (!nonEmptyString(check.metric) || !nonEmptyString(check.rule)) return clone(check);
  const { metric: _legacyMetric, rule: _legacyRule, ...rest } = check;
  return { ...clone(rest), metricRules: legacyMetricRules(check) };
}

function upgradePlan(plan) {
  return plan && Array.isArray(plan.checks) ? { ...clone(plan), checks: plan.checks.map(upgradeCheck) } : clone(plan);
}

function upgradeLibraryPlans(value) {
  const upgraded = clone(value);
  if (!upgraded || typeof upgraded !== 'object') return upgraded;
  if (Array.isArray(upgraded.savedInspections)) {
    upgraded.savedInspections = upgraded.savedInspections.map((definition) => ({
      ...definition,
      inspectionPlan: upgradePlan(definition.inspectionPlan),
    }));
  }
  if (Array.isArray(upgraded.runs)) {
    upgraded.runs = upgraded.runs.map((run) => ({ ...run, inspectionPlan: upgradePlan(run.inspectionPlan) }));
  }
  return upgraded;
}

function validPlan(plan) {
  if (
    !plan ||
    typeof plan !== 'object' ||
    !stringArray(plan.checkIds, { allowEmpty: false }) ||
    !Array.isArray(plan.checks) ||
    plan.checks.length !== plan.checkIds.length
  ) {
    return false;
  }
  const checkIds = new Set(plan.checkIds);
  return plan.checks.every(
    (check) =>
      check &&
      typeof check === 'object' &&
      nonEmptyString(check.id) &&
      checkIds.has(check.id) &&
      stringArray(check.sourceRefs) &&
      Array.isArray(check.metricRules) &&
      check.metricRules.length > 0 &&
      check.metricRules.every(validMetricRule),
  );
}

function validBaseline(baseline) {
  return (
    baseline &&
    typeof baseline === 'object' &&
    nonEmptyString(baseline.fingerprint) &&
    stringArray(baseline.entities, { allowEmpty: false }) &&
    stringArray(baseline.checkIds, { allowEmpty: false })
  );
}

function validDefinition(definition) {
  return (
    definition &&
    typeof definition === 'object' &&
    nonEmptyString(definition.id) &&
    Number.isInteger(definition.version) &&
    definition.version > 0 &&
    nonEmptyString(definition.name) &&
    nonEmptyString(definition.createdAt) &&
    nonEmptyString(definition.updatedAt) &&
    nonEmptyString(definition.sourceRunId) &&
    validRequest(definition.request) &&
    Array.isArray(definition.selectedContext) &&
    definition.selectedContext.length > 0 &&
    definition.selectedContext.every(validContextItem) &&
    validPlan(definition.inspectionPlan) &&
    validBaseline(definition.baseline)
  );
}

function validRun(run) {
  return (
    run &&
    typeof run === 'object' &&
    nonEmptyString(run.id) &&
    nonEmptyString(run.taskInstanceId) &&
    run.status === 'locked' &&
    nonEmptyString(run.startedAt) &&
    nonEmptyString(run.completedAt) &&
    Array.isArray(run.selectedContextResults) &&
    validPlan(run.inspectionPlan) &&
    (run.executionResults === undefined ||
      (Array.isArray(run.executionResults) && run.executionResults.every(validExecutionResult))) &&
    validReportContract(run.report)
  );
}

const EXECUTION_RESULT_STATUSES = new Set(['Verified', 'Violated', 'Inconclusive', 'NotEvaluated']);

function validExecutionResult(result) {
  return (
    result &&
    typeof result === 'object' &&
    nonEmptyString(result.id) &&
    nonEmptyString(result.label) &&
    EXECUTION_RESULT_STATUSES.has(result.status) &&
    typeof result.fact === 'string'
  );
}

function normalizeLibrary(value) {
  value = upgradeLibraryPlans(value);
  if (
    !value ||
    value.schemaVersion !== INSPECTION_LIBRARY_SCHEMA_VERSION ||
    !Number.isInteger(value.revision) ||
    value.revision < 0 ||
    !Array.isArray(value.savedInspections) ||
    !Array.isArray(value.runs) ||
    !value.savedInspections.every(validDefinition) ||
    !value.runs.every(validRun)
  ) {
    return null;
  }
  return deepFreeze({
    schemaVersion: INSPECTION_LIBRARY_SCHEMA_VERSION,
    revision: value.revision,
    savedInspections: clone(value.savedInspections),
    runs: clone(value.runs),
  });
}

export function createEmptyInspectionLibrary() {
  return deepFreeze({
    schemaVersion: INSPECTION_LIBRARY_SCHEMA_VERSION,
    revision: 0,
    savedInspections: [],
    runs: [],
  });
}

export function parseInspectionLibrary(serialized) {
  return parseInspectionLibraryWithDiagnostics(serialized).library;
}

export function parseInspectionLibraryWithDiagnostics(serialized) {
  const unavailable = () =>
    deepFreeze({
      library: createEmptyInspectionLibrary(),
      diagnostics: { status: 'unavailable', rejectedRunCount: 0 },
    });
  if (typeof serialized !== 'string' || !serialized.trim()) {
    return deepFreeze({
      library: createEmptyInspectionLibrary(),
      diagnostics: { status: 'available', rejectedRunCount: 0 },
    });
  }
  try {
    const value = upgradeLibraryPlans(JSON.parse(serialized));
    if (
      !value ||
      value.schemaVersion !== INSPECTION_LIBRARY_SCHEMA_VERSION ||
      !Number.isInteger(value.revision) ||
      value.revision < 0 ||
      !Array.isArray(value.savedInspections) ||
      !value.savedInspections.every(validDefinition) ||
      !Array.isArray(value.runs)
    ) {
      return unavailable();
    }
    const validRuns = value.runs.filter(validRun);
    const rejectedRunCount = value.runs.length - validRuns.length;
    return deepFreeze({
      library: {
        schemaVersion: INSPECTION_LIBRARY_SCHEMA_VERSION,
        revision: value.revision,
        savedInspections: clone(value.savedInspections),
        runs: clone(validRuns),
      },
      diagnostics: {
        status: rejectedRunCount ? 'degraded' : 'available',
        rejectedRunCount,
      },
    });
  } catch {
    return unavailable();
  }
}

export function serializeInspectionLibrary(library) {
  const normalized = normalizeLibrary(library);
  if (!normalized) throw new TypeError('Invalid inspection library envelope');
  return JSON.stringify(normalized);
}

function contextOption(id, kind, label, detail) {
  return { id, kind, label, detail, selected: true };
}

export function createContextOptions(workspace) {
  if (!workspace) return deepFreeze([]);
  const changes = (workspace.contextSources ?? []).map((source) =>
    contextOption(`change:${source.id}`, 'change', source.label, source.detail),
  );
  const services = sortedUnique([
    ...(workspace.declaredChange?.entities ?? []),
    ...(workspace.observedChange?.entities ?? []),
  ]).map((entity) => contextOption(`service:${entity}`, 'service', entity, '本次巡检关联服务'));
  const signals = (workspace.committedChecks ?? []).map((check) =>
    contextOption(
      `signal:${check.id}`,
      'signal',
      check.title ?? check.purpose ?? check.metric ?? check.id,
      check.metric ?? check.purpose ?? check.id,
    ),
  );
  return deepFreeze([...changes, ...services, ...signals]);
}

export function toggleContextSelection(options, contextId) {
  const target = options.find((option) => option.id === contextId);
  if (!target) return options;
  if (target.selected && options.filter((option) => option.selected).length === 1) return options;
  if (
    target.selected &&
    target.kind === 'signal' &&
    options.filter((option) => option.kind === 'signal' && option.selected).length === 1
  ) {
    return options;
  }
  return deepFreeze(
    options.map((option) => (option.id === contextId ? { ...option, selected: !option.selected } : option)),
  );
}

function planSnapshot(inspectionPlan) {
  if (!inspectionPlan || !Array.isArray(inspectionPlan.checkIds) || !Array.isArray(inspectionPlan.checks)) {
    throw new TypeError('A locked inspection plan is required');
  }
  return stripRuntimePayload({
    source: inspectionPlan.source,
    sourcePlaybookRef: inspectionPlan.sourcePlaybookRef ? clone(inspectionPlan.sourcePlaybookRef) : null,
    checkIds: [...inspectionPlan.checkIds],
    checks: inspectionPlan.checks,
  });
}

export function createSavedInspectionDefinition({
  id,
  name,
  request,
  workspace,
  selectedContext,
  taskInstance,
  sourceRunId,
  now,
  version = 1,
}) {
  if (typeof name !== 'string' || !name.trim()) throw new TypeError('Saved inspection name is required');
  if (!id || !sourceRunId || !now) throw new TypeError('Saved inspection identity and timestamp are required');
  if (taskInstance?.status !== 'locked') throw new TypeError('Only a locked inspection task can be saved');
  const chosen = (selectedContext ?? []).filter((item) => item.selected !== false).map(clone);
  if (!chosen.length) throw new TypeError('At least one selected context item is required');
  return deepFreeze({
    id,
    version,
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
    sourceRunId,
    request: clone(request),
    selectedContext: chosen,
    inspectionPlan: planSnapshot(taskInstance.inspectionPlan),
    baseline: {
      fingerprint: workspace.declaredChange.fingerprint,
      entities: sortedUnique(workspace.observedChange?.entities ?? workspace.declaredChange.entities),
      checkIds: [...taskInstance.inspectionPlan.checkIds],
    },
  });
}

const CONTEXT_STATE_LABELS = Object.freeze({
  referenced: '已引用',
  'included-in-plan': '已纳入计划',
  uncovered: '未覆盖',
});

function contextState(item, inspectionPlan) {
  if (item.kind === 'service') {
    return inspectionPlan.checks.some((check) => check.entity === item.label) ? 'included-in-plan' : 'uncovered';
  }
  if (item.kind === 'signal') {
    const checkId = item.id.startsWith('signal:') ? item.id.slice('signal:'.length) : null;
    return checkId && inspectionPlan.checkIds.includes(checkId) ? 'included-in-plan' : 'uncovered';
  }
  return 'referenced';
}

function selectedContextResults(selectedContext, inspectionPlan) {
  return selectedContext
    .filter((item) => item.selected !== false)
    .map((item) => {
      const state = contextState(item, inspectionPlan);
      return {
        contextId: item.id,
        kind: item.kind,
        label: item.label,
        contextState: state,
        contextStateLabel: CONTEXT_STATE_LABELS[state],
        detail: item.detail,
      };
    });
}

const REPORT_RESULT_RANK = Object.freeze({ Violated: 0, Inconclusive: 1, NotEvaluated: 1, Verified: 2 });

function missingRuleMeasurement(check, rule) {
  return {
    id: `missing-${check.id}-${rule.metricId.replaceAll('.', '-')}`,
    metricId: rule.metricId,
    label: rule.label,
    entity: check.entity,
    kind: 'qualitative',
    displayValue: '证据不足',
    gate: {
      operator: rule.operator,
      value: rule.threshold,
      unit: rule.unit,
      displayValue: `${rule.operator} ${rule.threshold}${rule.unit}`,
    },
  };
}

function missingCheckResult(check) {
  return {
    checkId: check.id,
    status: 'NotEvaluated',
    summary: `${check.purpose}：证据不足`,
    measurements: check.metricRules.map((rule) => missingRuleMeasurement(check, rule)),
  };
}

function evaluateNumericRule(value, rule) {
  if (rule.operator === '<=') return value <= rule.threshold;
  if (rule.operator === '>=') return value >= rule.threshold;
  if (rule.operator === '<') return value < rule.threshold;
  if (rule.operator === '>') return value > rule.threshold;
  return false;
}

function materializeCheckResult(check, sourceResult) {
  const result = clone(sourceResult ?? missingCheckResult(check));
  const rules = new Map(check.metricRules.map((rule) => [rule.metricId, rule]));
  const sourceMeasurements = new Map(result.measurements.map((measurement) => [measurement.metricId, measurement]));
  const evaluated = [];
  const missingRules = [];
  const ruleMeasurements = check.metricRules.map((rule) => {
    const measurement = sourceMeasurements.get(rule.metricId);
    const requiresNumericEvidence = rule.editable !== false;
    if (
      !measurement ||
      (requiresNumericEvidence && (measurement.kind !== 'numeric' || !Number.isFinite(measurement.value)))
    ) {
      missingRules.push(rule);
      return missingRuleMeasurement(check, rule);
    }
    if (measurement.kind !== 'numeric' || !Number.isFinite(measurement.value)) {
      return measurement;
    }
    const passed = evaluateNumericRule(measurement.value, rule);
    evaluated.push({ measurement, rule, passed });
    return {
      ...measurement,
      metricId: rule.metricId,
      gate: {
        operator: rule.operator,
        value: rule.threshold,
        unit: rule.unit,
        displayValue: `${rule.operator} ${rule.threshold}${rule.unit}`,
      },
      ...(measurement.series ? { series: measurement.series } : {}),
    };
  });
  const contextualMeasurements = result.measurements.filter((measurement) => !rules.has(measurement.metricId));
  const measurements = [...ruleMeasurements, ...contextualMeasurements];
  let status = result.status;
  if (missingRules.length) {
    status = 'NotEvaluated';
  } else if (!['Inconclusive', 'NotEvaluated'].includes(status) && evaluated.length) {
    status = evaluated.every((item) => item.passed) ? 'Verified' : 'Violated';
  }
  const summary = missingRules.length
    ? `${check.purpose}：${missingRules.map((rule) => rule.label).join('、')}证据不足`
    : evaluated.length && !['Inconclusive', 'NotEvaluated'].includes(status)
      ? evaluated
          .map(
            ({ measurement, rule, passed }) =>
              `${rule.label} ${measurement.displayValue}（门禁 ${formatMetricRule(rule)}，${passed ? '通过' : '违例'}）`,
          )
          .join('；')
      : result.summary;
  return { ...result, status, summary, measurements };
}

function hasLockedTrendEvidence(report) {
  return (
    Array.isArray(report?.checkResults) &&
    report.checkResults.every((result) =>
      result.measurements.every(
        (measurement) =>
          measurement.kind !== 'numeric' ||
          (Array.isArray(measurement.series) &&
            measurement.series.length >= 2 &&
            measurement.series.every((point) =>
              Boolean(point && typeof point.label === 'string' && point.label.trim() && Number.isFinite(point.value)),
            )),
      ),
    )
  );
}

function reportCounts(checkResults) {
  return checkResults.reduce(
    (counts, result) => {
      if (result.status === 'Verified') counts.verified += 1;
      else if (result.status === 'Violated') counts.violated += 1;
      else counts.unresolved += 1;
      return counts;
    },
    { verified: 0, violated: 0, unresolved: 0 },
  );
}

function interpretationForResults(report, checkResults, allowSourceNarrative) {
  const evidenceIds = new Set(
    checkResults.flatMap((result) => result.measurements.map((measurement) => measurement.id)),
  );
  const groundSection = (section) => {
    if (!allowSourceNarrative) return { text: '证据不足', evidenceIds: [] };
    const anchors = section?.evidenceIds ?? [];
    return section?.text && anchors.length && anchors.every((id) => evidenceIds.has(id))
      ? { text: section.text, evidenceIds: anchors }
      : { text: '证据不足', evidenceIds: [] };
  };
  const summarizeResults = (results) => {
    const grounded = results.filter((result) => result.measurements.length);
    return grounded.length
      ? {
          text: grounded.map((result) => result.summary).join('；'),
          evidenceIds: grounded.map((result) => result.measurements[0].id),
        }
      : { text: '证据不足', evidenceIds: [] };
  };
  const violated = checkResults.filter((result) => result.status === 'Violated');
  if (violated.length) {
    const whatHappened = groundSection(report.interpretation.whatHappened);
    const recommendedAction = groundSection(report.interpretation.recommendedAction);
    return {
      whatHappened: whatHappened.evidenceIds.length ? whatHappened : summarizeResults(violated),
      likelyCause: groundSection(report.interpretation.likelyCause),
      recommendedAction: recommendedAction.evidenceIds.length
        ? recommendedAction
        : {
            text: '按违例检查的失败动作处置，并在证据恢复前保持当前变更范围。',
            evidenceIds: summarizeResults(violated).evidenceIds,
          },
    };
  }
  const unresolved = checkResults.filter((result) => ['Inconclusive', 'NotEvaluated'].includes(result.status));
  if (unresolved.length) {
    const unresolvedEvidenceIds = unresolved.flatMap((result) =>
      result.measurements.map((measurement) => measurement.id),
    );
    return {
      whatHappened: { text: unresolved.map((result) => result.summary).join('；'), evidenceIds: unresolvedEvidenceIds },
      likelyCause: { text: '证据不足', evidenceIds: [] },
      recommendedAction: {
        text: '保持当前进度，补足未决检查证据后再扩大变更范围。',
        evidenceIds: unresolvedEvidenceIds,
      },
    };
  }
  const verifiedEvidenceIds = checkResults.flatMap((result) =>
    result.measurements.slice(0, 1).map((measurement) => measurement.id),
  );
  const whatHappened = groundSection(report.interpretation.whatHappened);
  const recommendedAction = groundSection(report.interpretation.recommendedAction);
  return {
    whatHappened: whatHappened.evidenceIds.length ? whatHappened : summarizeResults(checkResults),
    likelyCause: groundSection(report.interpretation.likelyCause),
    recommendedAction: recommendedAction.evidenceIds.length
      ? recommendedAction
      : {
          text: '锁定计划内的检查均通过；按当前计划继续，并保持原观察窗口。',
          evidenceIds: verifiedEvidenceIds,
        },
    ...(verifiedEvidenceIds.length ? {} : { whatHappened: { text: '证据不足', evidenceIds: [] } }),
  };
}

function materializedDecision(report, counts, removedConclusiveResult) {
  if (counts.violated > 0) {
    const retainOriginalCopy = report.evidenceVerdict === 'Violated' && !removedConclusiveResult;
    return {
      evidenceVerdict: 'Violated',
      action: 'Pause',
      actionLabel: retainOriginalCopy ? report.actionLabel : '建议暂停并处理违例',
      title: retainOriginalCopy ? report.title : '编辑后的检查门禁发现违例',
      summary: retainOriginalCopy ? report.summary : `锁定计划中有 ${counts.violated} 项检查触及门禁。`,
      rcAgent: retainOriginalCopy ? report.rcAgent : null,
    };
  }
  if (counts.unresolved > 0) {
    return {
      evidenceVerdict: 'Inconclusive',
      action: 'Proceed-with-conditions',
      actionLabel: '建议保持当前进度并继续观察',
      title: '部分检查证据不足',
      summary: `已执行检查未发现违例，但有 ${counts.unresolved} 项证据不足。`,
      rcAgent: null,
    };
  }
  const retainOriginalCopy = report.evidenceVerdict === 'Verified' && !removedConclusiveResult;
  return {
    evidenceVerdict: 'Verified',
    action: 'Proceed',
    actionLabel: retainOriginalCopy ? report.actionLabel : '建议按当前检查计划继续',
    title: retainOriginalCopy ? report.title : '已执行检查未发现关键违例',
    summary: retainOriginalCopy ? report.summary : `锁定计划内的 ${counts.verified} 项检查均通过确定性验证。`,
    rcAgent: null,
  };
}

function materializeReportForPlan(report, inspectionPlan) {
  if (!Array.isArray(report?.checkResults) || !report.interpretation) return clone(report);
  const resultByCheckId = new Map(report.checkResults.map((result) => [result.checkId, result]));
  const checkResults = inspectionPlan.checks.map((check) =>
    materializeCheckResult(check, resultByCheckId.get(check.id)),
  );
  const counts = reportCounts(checkResults);
  const orderedEvidence = [...checkResults].sort(
    (left, right) =>
      REPORT_RESULT_RANK[left.status] - REPORT_RESULT_RANK[right.status] ||
      inspectionPlan.checkIds.indexOf(left.checkId) - inspectionPlan.checkIds.indexOf(right.checkId),
  );
  const planCheckIds = new Set(inspectionPlan.checkIds);
  const removedConclusiveResult = report.checkResults.some(
    (result) => !planCheckIds.has(result.checkId) && ['Verified', 'Violated'].includes(result.status),
  );
  const sourceByCheckId = new Map(report.checkResults.map((result) => [result.checkId, result]));
  const executionTruthChanged =
    removedConclusiveResult ||
    checkResults.some((result) => {
      const source = sourceByCheckId.get(result.checkId);
      if (!source || source.status !== result.status) return true;
      if (source.measurements.length !== result.measurements.length) return true;
      const sourceMeasurements = new Map(source.measurements.map((measurement) => [measurement.id, measurement]));
      return result.measurements.some((measurement) => {
        const sourceMeasurement = sourceMeasurements.get(measurement.id);
        if (!sourceMeasurement || sourceMeasurement.kind !== measurement.kind) return true;
        if (measurement.kind !== 'numeric') return false;
        return (
          sourceMeasurement.gate?.operator !== measurement.gate?.operator ||
          sourceMeasurement.gate?.value !== measurement.gate?.value ||
          sourceMeasurement.gate?.unit !== measurement.gate?.unit
        );
      });
    });
  const hasUnresolved = counts.unresolved > 0;
  const materialized = {
    ...clone(report),
    ...materializedDecision(report, counts, removedConclusiveResult),
    evidenceCounts: counts,
    keyEvidence: orderedEvidence.slice(0, 3).map((result) => result.summary),
    residualRisks: hasUnresolved
      ? checkResults.filter((result) => result.status !== 'Verified').map((result) => result.summary)
      : clone(report.residualRisks),
    checkResults,
    interpretation: interpretationForResults(report, checkResults, !executionTruthChanged),
  };
  if (!validReportContract(materialized)) throw new TypeError('Inspection run requires a valid report contract');
  return materialized;
}

export function createInspectionRun({
  id,
  taskInstance,
  definitionId = null,
  selectedContext,
  report,
  startedAt,
  completedAt,
}) {
  if (!id || !startedAt || !completedAt) throw new TypeError('Inspection run identity and timestamps are required');
  if (taskInstance?.status !== 'locked') throw new TypeError('Inspection run requires a locked task');
  const runReport = materializeReportForPlan(report, taskInstance.inspectionPlan);
  if (!hasLockedTrendEvidence(runReport)) {
    throw new TypeError('Inspection run requires persisted trend series for numeric measurements');
  }
  return deepFreeze({
    id,
    taskInstanceId: taskInstance.id,
    definitionId,
    startedAt,
    completedAt,
    status: 'locked',
    selectedContextResults: selectedContextResults(selectedContext ?? [], taskInstance.inspectionPlan),
    inspectionPlan: planSnapshot(taskInstance.inspectionPlan),
    report: runReport,
  });
}

function chooseDefinition(left, right) {
  if (!left) return right;
  if (!right) return left;
  if (right.version !== left.version) return right.version > left.version ? right : left;
  return String(right.updatedAt).localeCompare(String(left.updatedAt)) > 0 ? right : left;
}

export function mergeInspectionLibraries(leftInput, rightInput) {
  const left = normalizeLibrary(leftInput) ?? createEmptyInspectionLibrary();
  const right = normalizeLibrary(rightInput) ?? createEmptyInspectionLibrary();
  const definitions = new Map();
  for (const definition of [...left.savedInspections, ...right.savedInspections]) {
    definitions.set(definition.id, chooseDefinition(definitions.get(definition.id), definition));
  }
  const runs = new Map();
  for (const run of [...left.runs, ...right.runs]) {
    if (!runs.has(run.id)) runs.set(run.id, run);
  }
  const savedInspections = [...definitions.values()].sort((a, b) => a.id.localeCompare(b.id)).map(clone);
  const mergedRuns = [...runs.values()].sort((a, b) => a.id.localeCompare(b.id)).map(clone);
  const rightDefinitions = [...right.savedInspections].sort((a, b) => a.id.localeCompare(b.id));
  const rightRuns = [...right.runs].sort((a, b) => a.id.localeCompare(b.id));
  const incomingAlreadyContainsUnion =
    JSON.stringify(savedInspections) === JSON.stringify(rightDefinitions) &&
    JSON.stringify(mergedRuns) === JSON.stringify(rightRuns);
  return deepFreeze({
    schemaVersion: INSPECTION_LIBRARY_SCHEMA_VERSION,
    revision: Math.max(left.revision, right.revision) + (incomingAlreadyContainsUnion ? 0 : 1),
    savedInspections,
    runs: mergedRuns,
  });
}

export function classifySavedInspectionRefresh(definition, workspace) {
  if (!validDefinition(definition) || !workspace) {
    return deepFreeze({ status: 'major-drift', differences: [{ id: 'definition-unavailable', severity: 'blocking' }] });
  }
  const currentCheckIds = new Set((workspace.committedChecks ?? []).map((check) => check.id));
  const missingCheckIds = definition.baseline.checkIds.filter((id) => !currentCheckIds.has(id));
  const fingerprintChanged = workspace.declaredChange?.fingerprint !== definition.baseline.fingerprint;
  if (missingCheckIds.length || fingerprintChanged) {
    return deepFreeze({
      status: 'major-drift',
      differences: [
        ...(missingCheckIds.length
          ? [{ id: 'check-structure', severity: 'blocking', summary: `缺少检查项：${missingCheckIds.join('、')}` }]
          : []),
        ...(fingerprintChanged ? [{ id: 'change-fingerprint', severity: 'blocking', summary: '变更指纹已变化' }] : []),
      ],
    });
  }
  const baselineEntities = new Set(definition.baseline.entities);
  const currentEntities = sortedUnique(workspace.observedChange?.entities ?? workspace.declaredChange?.entities);
  const addedEntities = currentEntities.filter((entity) => !baselineEntities.has(entity));
  const selectedSignalCheckIds = new Set(
    definition.selectedContext
      .filter((item) => item.kind === 'signal' && item.id.startsWith('signal:'))
      .map((item) => item.id.slice('signal:'.length)),
  );
  const extraCheckIds = [...currentCheckIds].filter(
    (id) => selectedSignalCheckIds.has(id) && !definition.baseline.checkIds.includes(id),
  );
  if (addedEntities.length || extraCheckIds.length) {
    return deepFreeze({
      status: 'minor-drift',
      differences: [
        ...addedEntities.map((entity) => ({
          id: `entity:${entity}`,
          severity: 'review',
          summary: `新增关联服务 ${entity}`,
        })),
        ...extraCheckIds.map((id) => ({ id: `check:${id}`, severity: 'review', summary: `新增检查项 ${id}` })),
      ],
    });
  }
  return deepFreeze({ status: 'exact', differences: [] });
}
