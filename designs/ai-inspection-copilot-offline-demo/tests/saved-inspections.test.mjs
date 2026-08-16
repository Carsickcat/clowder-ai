import assert from 'node:assert/strict';
import test from 'node:test';

import { compileInspectionRequest } from '../lib/compiler.mjs';
import {
  classifySavedInspectionRefresh,
  createContextOptions,
  createEmptyInspectionLibrary,
  createInspectionRun,
  createSavedInspectionDefinition,
  mergeInspectionLibraries,
  parseInspectionLibrary,
  serializeInspectionLibrary,
  toggleContextSelection,
} from '../lib/saved-inspections.mjs';

const request = {
  prompt: '升级 fulfillment-service v7.2.0，验证履约状态和下游调用是否正常。',
  targetService: 'fulfillment-service',
  contextReference: 'REL-FUL-72',
};

function task(workspace) {
  return {
    id: 'INS-0048',
    status: 'locked',
    inspectionPlan: {
      source: 'generated',
      sourcePlaybookRef: null,
      checkIds: workspace.committedChecks.map((check) => check.id),
      checks: structuredClone(workspace.committedChecks),
    },
    auditTrail: [{ type: 'task-locked' }],
  };
}

test('empty library and corrupt payloads always hydrate to a valid versioned envelope', () => {
  assert.deepEqual(createEmptyInspectionLibrary(), {
    schemaVersion: 1,
    revision: 0,
    savedInspections: [],
    runs: [],
  });
  assert.deepEqual(parseInspectionLibrary('{broken'), createEmptyInspectionLibrary());
  assert.deepEqual(
    parseInspectionLibrary(JSON.stringify({ schemaVersion: 99, savedInspections: [{ id: 'unsafe' }] })),
    createEmptyInspectionLibrary(),
  );
});

test('context options expose current changes, related services, and signals with stable selectable IDs', () => {
  const workspace = compileInspectionRequest(request);
  const options = createContextOptions(workspace);

  assert.ok(options.some((option) => option.kind === 'change'));
  assert.ok(options.some((option) => option.kind === 'service'));
  assert.ok(options.some((option) => option.kind === 'signal'));
  assert.ok(options.every((option) => option.selected));
  assert.ok(options.every((option) => typeof option.label === 'string' && option.label.trim()));
  assert.equal(new Set(options.map((option) => option.id)).size, options.length);

  const removed = toggleContextSelection(options, options[0].id);
  assert.equal(removed.find((option) => option.id === options[0].id).selected, false);
  assert.equal(options[0].selected, true, 'selection updates must not mutate the compiled draft');
  assert.equal(toggleContextSelection(removed, 'unknown-context-id'), removed);

  const onlyOne = options.map((option, index) => ({ ...option, selected: index === 0 }));
  assert.equal(toggleContextSelection(onlyOne, onlyOne[0].id), onlyOne, 'at least one context item stays selected');
});

test('a saved definition snapshots reusable structure without evidence or report payloads', () => {
  const workspace = compileInspectionRequest(request);
  const selectedContext = createContextOptions(workspace).slice(0, 3);
  const lockedTask = task(workspace);
  lockedTask.inspectionPlan.checks[0] = {
    ...lockedTask.inspectionPlan.checks[0],
    evidence: { value: 99 },
  };

  const definition = createSavedInspectionDefinition({
    id: 'SAVED-001',
    name: '履约发布后巡检',
    request,
    workspace,
    selectedContext,
    taskInstance: lockedTask,
    sourceRunId: 'RUN-0048',
    now: '2026-08-16T06:00:00.000Z',
  });

  assert.equal(definition.name, '履约发布后巡检');
  assert.equal(definition.version, 1);
  assert.deepEqual(definition.inspectionPlan.checkIds, lockedTask.inspectionPlan.checkIds);
  assert.deepEqual(
    definition.selectedContext.map((item) => item.id),
    selectedContext.map((item) => item.id),
  );
  assert.equal(JSON.stringify(definition).includes('evidence'), false);
  assert.equal(JSON.stringify(definition).includes('report'), false);
  assert.throws(() => createSavedInspectionDefinition({ ...definition, name: '   ' }), /name/i);
});

test('an inspection run is a locked immutable snapshot with selected results and no shared references', () => {
  const workspace = compileInspectionRequest(request);
  const lockedTask = task(workspace);
  const selectedContext = createContextOptions(workspace).slice(0, 2);
  const run = createInspectionRun({
    id: 'RUN-0048',
    definitionId: 'SAVED-001',
    taskInstance: lockedTask,
    selectedContext,
    report: workspace.report,
    startedAt: '2026-08-16T06:00:00.000Z',
    completedAt: '2026-08-16T06:01:00.000Z',
  });

  assert.equal(run.status, 'locked');
  assert.equal(run.taskInstanceId, lockedTask.id);
  assert.deepEqual(
    run.selectedContextResults.map((item) => item.contextId),
    selectedContext.map((item) => item.id),
  );
  assert.notEqual(run.inspectionPlan, lockedTask.inspectionPlan);
  assert.ok(Object.isFrozen(run));
  assert.ok(Object.isFrozen(run.report));
});

test('library serialization round-trips valid snapshots and rejects partial records', () => {
  const library = {
    schemaVersion: 1,
    revision: 3,
    savedInspections: [{ id: 'SAVED-001', version: 1, name: '巡检', updatedAt: '2026-08-16T06:00:00.000Z' }],
    runs: [{ id: 'RUN-001', status: 'locked' }],
  };
  const serialized = serializeInspectionLibrary(library);
  assert.deepEqual(parseInspectionLibrary(serialized), library);
  assert.deepEqual(
    parseInspectionLibrary(JSON.stringify({ ...library, savedInspections: [{ name: 'missing id' }] })),
    createEmptyInspectionLibrary(),
  );
});

test('concurrent libraries merge stable IDs without losing runs and newer definitions win', () => {
  const left = {
    schemaVersion: 1,
    revision: 2,
    savedInspections: [{ id: 'SAVED-001', version: 1, name: '旧名称', updatedAt: '2026-08-16T06:00:00.000Z' }],
    runs: [{ id: 'RUN-A', status: 'locked' }],
  };
  const right = {
    schemaVersion: 1,
    revision: 5,
    savedInspections: [
      { id: 'SAVED-001', version: 2, name: '新名称', updatedAt: '2026-08-16T06:05:00.000Z' },
      { id: 'SAVED-002', version: 1, name: '第二个', updatedAt: '2026-08-16T06:04:00.000Z' },
    ],
    runs: [{ id: 'RUN-B', status: 'locked' }],
  };

  const merged = mergeInspectionLibraries(left, right);
  assert.equal(merged.revision, 6);
  assert.equal(merged.savedInspections.length, 2);
  assert.equal(merged.savedInspections.find((item) => item.id === 'SAVED-001').name, '新名称');
  assert.deepEqual(merged.runs.map((run) => run.id).sort(), ['RUN-A', 'RUN-B']);
});

test('refresh classification distinguishes exact, explicit minor drift, and blocking structural drift', () => {
  const workspace = compileInspectionRequest(request);
  const definition = createSavedInspectionDefinition({
    id: 'SAVED-001',
    name: '履约巡检',
    request,
    workspace,
    selectedContext: createContextOptions(workspace),
    taskInstance: task(workspace),
    sourceRunId: 'RUN-0048',
    now: '2026-08-16T06:00:00.000Z',
  });

  assert.equal(classifySavedInspectionRefresh(definition, workspace).status, 'exact');
  assert.equal(
    classifySavedInspectionRefresh(definition, {
      ...workspace,
      observedChange: {
        ...workspace.observedChange,
        entities: [...workspace.observedChange.entities, 'new-worker'],
      },
    }).status,
    'minor-drift',
  );
  assert.equal(
    classifySavedInspectionRefresh(definition, {
      ...workspace,
      committedChecks: workspace.committedChecks.slice(1),
    }).status,
    'major-drift',
  );
});
