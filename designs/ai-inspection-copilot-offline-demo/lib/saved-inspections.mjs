import { deepFreeze } from './domain.mjs';

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

function validDefinition(definition) {
  return (
    definition &&
    typeof definition === 'object' &&
    typeof definition.id === 'string' &&
    definition.id.length > 0 &&
    Number.isInteger(definition.version) &&
    definition.version > 0 &&
    typeof definition.name === 'string' &&
    definition.name.trim().length > 0 &&
    typeof definition.updatedAt === 'string'
  );
}

function validRun(run) {
  return run && typeof run === 'object' && typeof run.id === 'string' && run.id.length > 0 && run.status === 'locked';
}

function normalizeLibrary(value) {
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
  if (typeof serialized !== 'string' || !serialized.trim()) return createEmptyInspectionLibrary();
  try {
    return normalizeLibrary(JSON.parse(serialized)) ?? createEmptyInspectionLibrary();
  } catch {
    return createEmptyInspectionLibrary();
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
    contextOption(`signal:${check.id}`, 'signal', check.title, check.metric),
  );
  return deepFreeze([...changes, ...services, ...signals]);
}

export function toggleContextSelection(options, contextId) {
  const target = options.find((option) => option.id === contextId);
  if (!target) return options;
  if (target.selected && options.filter((option) => option.selected).length === 1) return options;
  return deepFreeze(options.map((option) => (option.id === contextId ? { ...option, selected: !option.selected } : option)));
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

function selectedContextResults(selectedContext) {
  return selectedContext
    .filter((item) => item.selected !== false)
    .map((item) => ({
      contextId: item.id,
      kind: item.kind,
      label: item.label,
      status: 'Verified',
      detail: item.detail,
    }));
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
  return deepFreeze({
    id,
    taskInstanceId: taskInstance.id,
    definitionId,
    startedAt,
    completedAt,
    status: 'locked',
    selectedContextResults: selectedContextResults(selectedContext ?? []),
    inspectionPlan: planSnapshot(taskInstance.inspectionPlan),
    report: clone(report),
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
  return deepFreeze({
    schemaVersion: INSPECTION_LIBRARY_SCHEMA_VERSION,
    revision: Math.max(left.revision, right.revision) + 1,
    savedInspections: [...definitions.values()].sort((a, b) => a.id.localeCompare(b.id)).map(clone),
    runs: [...runs.values()].sort((a, b) => a.id.localeCompare(b.id)).map(clone),
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
        ...(fingerprintChanged
          ? [{ id: 'change-fingerprint', severity: 'blocking', summary: '变更指纹已变化' }]
          : []),
      ],
    });
  }
  const baselineEntities = new Set(definition.baseline.entities);
  const currentEntities = sortedUnique(workspace.observedChange?.entities ?? workspace.declaredChange?.entities);
  const addedEntities = currentEntities.filter((entity) => !baselineEntities.has(entity));
  const extraCheckIds = [...currentCheckIds].filter((id) => !definition.baseline.checkIds.includes(id));
  if (addedEntities.length || extraCheckIds.length) {
    return deepFreeze({
      status: 'minor-drift',
      differences: [
        ...addedEntities.map((entity) => ({ id: `entity:${entity}`, severity: 'review', summary: `新增关联服务 ${entity}` })),
        ...extraCheckIds.map((id) => ({ id: `check:${id}`, severity: 'review', summary: `新增检查项 ${id}` })),
      ],
    });
  }
  return deepFreeze({ status: 'exact', differences: [] });
}
