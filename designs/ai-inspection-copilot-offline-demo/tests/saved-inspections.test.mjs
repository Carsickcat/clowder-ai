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
  parseInspectionLibraryWithDiagnostics,
  serializeInspectionLibrary,
  toggleContextSelection,
} from '../lib/saved-inspections.mjs';
import { compareInspectionRuns, selectRunsForDefinition } from '../lib/selectors.mjs';

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

function definitionFixture({
  id = 'SAVED-001',
  name = '履约巡检',
  version = 1,
  sourceRunId = 'RUN-0048',
  updatedAt = '2026-08-16T06:00:00.000Z',
} = {}) {
  const workspace = compileInspectionRequest(request);
  return {
    ...createSavedInspectionDefinition({
      id,
      name,
      request,
      workspace,
      selectedContext: createContextOptions(workspace),
      taskInstance: task(workspace),
      sourceRunId,
      now: updatedAt,
      version,
    }),
    updatedAt,
  };
}

function runFixture({ id = 'RUN-0048', definitionId = 'SAVED-001', completedAt = '2026-08-16T06:01:00.000Z' } = {}) {
  const workspace = compileInspectionRequest(request);
  return createInspectionRun({
    id,
    definitionId,
    taskInstance: task(workspace),
    selectedContext: createContextOptions(workspace),
    report: workspace.report,
    startedAt: '2026-08-16T06:00:00.000Z',
    completedAt,
  });
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

  const signalIds = new Set(options.filter((option) => option.kind === 'signal').map((option) => option.id));
  const oneSignal = options.map((option) => ({
    ...option,
    selected: option.kind !== 'signal' || option.id === [...signalIds][0],
  }));
  assert.equal(
    toggleContextSelection(oneSignal, [...signalIds][0]),
    oneSignal,
    'a runnable draft retains at least one selected signal',
  );
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

test('a new inspection run keeps its plan-owned report without persisting duplicate execution truth', () => {
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
  assert.equal(Object.hasOwn(run, 'executionResults'), false);
  assert.ok(Object.isFrozen(run));
  assert.ok(Object.isFrozen(run.report));
  assert.deepEqual(
    run.report.checkResults.map((result) => result.checkId),
    lockedTask.inspectionPlan.checkIds,
  );
  assert.deepEqual(run.report.evidenceCounts, { verified: 4, violated: 0, unresolved: 0 });
  const evidenceIds = new Set(
    run.report.checkResults.flatMap((result) => result.measurements.map((measurement) => measurement.id)),
  );
  for (const section of Object.values(run.report.interpretation)) {
    assert.ok(section.text === '证据不足' || section.evidenceIds.every((id) => evidenceIds.has(id)));
  }
});

test('run materialization cannot report a rejected candidate as an executed violation', () => {
  const workspace = compileInspectionRequest({
    prompt: '调整 payment-api Redis 超时，帮我生成巡检计划。',
    targetService: 'payment-api',
    contextReference: 'CHG-84217',
  });
  const lockedTask = task(workspace);
  const run = createInspectionRun({
    id: 'RUN-0049',
    taskInstance: lockedTask,
    selectedContext: createContextOptions(workspace),
    report: workspace.report,
    startedAt: '2026-08-16T06:00:00.000Z',
    completedAt: '2026-08-16T06:01:00.000Z',
  });

  assert.deepEqual(
    run.report.checkResults.map((result) => result.checkId),
    lockedTask.inspectionPlan.checkIds,
  );
  assert.equal(
    run.report.checkResults.some((result) => result.checkId === 'candidate-db-wait'),
    false,
  );
  assert.equal(run.report.evidenceVerdict, 'Inconclusive');
  assert.equal(run.report.action, 'Proceed-with-conditions');
  assert.equal(run.report.rcAgent, null);
  assert.equal(run.report.interpretation.likelyCause.text, '证据不足');
});

test('run materialization removes AI claims whose evidence was deselected from the locked plan', () => {
  const workspace = compileInspectionRequest(request);
  const lockedTask = task(workspace);
  lockedTask.inspectionPlan.checks = lockedTask.inspectionPlan.checks.filter(
    (check) => check.id !== 'business-outcome',
  );
  lockedTask.inspectionPlan.checkIds = lockedTask.inspectionPlan.checks.map((check) => check.id);

  const run = createInspectionRun({
    id: 'RUN-0050',
    taskInstance: lockedTask,
    selectedContext: createContextOptions(workspace),
    report: workspace.report,
    startedAt: '2026-08-16T06:00:00.000Z',
    completedAt: '2026-08-16T06:01:00.000Z',
  });

  assert.doesNotMatch(run.report.interpretation.whatHappened.text, /核心业务成功率/);
  assert.doesNotMatch(run.report.interpretation.recommendedAction.text, /核心业务成功率/);
  assert.doesNotMatch(run.report.summary, /核心业务结果/);
  assert.doesNotMatch(run.report.title, /声明范围内/);
  assert.equal(run.report.interpretation.whatHappened.evidenceIds.includes('fulfillment-service-success-rate'), false);
  assert.match(run.report.interpretation.whatHappened.text, /p95|downstream|cache/);
});

test('run history is derived from the immutable run ledger and sorted newest first', () => {
  const definition = definitionFixture();
  const sourceRun = runFixture({
    id: definition.sourceRunId,
    definitionId: null,
    completedAt: '2026-08-16T06:01:00.000Z',
  });
  const secondRun = runFixture({ id: 'RUN-0049', completedAt: '2026-08-17T06:01:00.000Z' });
  const newestRun = runFixture({ id: 'RUN-0050', completedAt: '2026-08-18T06:01:00.000Z' });
  const unrelatedRun = runFixture({ id: 'RUN-OTHER', definitionId: 'SAVED-OTHER' });

  assert.deepEqual(
    selectRunsForDefinition(definition, [sourceRun, secondRun, unrelatedRun, newestRun]).map((run) => run.id),
    ['RUN-0050', 'RUN-0049', 'RUN-0048'],
  );
});

test('structured run comparison classifies improvement, worsening, coverage change, and stable collapse', () => {
  const previous = structuredClone(
    runFixture({
      id: 'RUN-PREVIOUS',
      completedAt: '2026-08-16T06:01:00.000Z',
    }),
  );
  previous.executionResults = [
    { id: 'database', label: '数据库连接', status: 'Violated', fact: '连接池占用 96%' },
    { id: 'trace', label: '调用链', status: 'Verified', fact: '错误率 0.1%' },
    { id: 'removed', label: '旧覆盖项', status: 'Verified', fact: '已验证' },
    { id: 'stable', label: '稳定项', status: 'Verified', fact: '无变化' },
  ];
  const current = structuredClone(
    runFixture({
      id: 'RUN-CURRENT',
      completedAt: '2026-08-17T06:01:00.000Z',
    }),
  );
  current.executionResults = [
    { id: 'database', label: '数据库连接', status: 'Verified', fact: '连接池占用 41%' },
    { id: 'trace', label: '调用链', status: 'Violated', fact: '错误率 8.4%' },
    { id: 'added', label: '新增覆盖项', status: 'Inconclusive', fact: '样本不足' },
    { id: 'stable', label: '稳定项', status: 'Verified', fact: '无变化' },
  ];
  previous.report = undefined;
  current.report = undefined;

  const comparison = compareInspectionRuns(current, previous);
  const kinds = Object.fromEntries(comparison.items.map((item) => [item.id, item.kind]));
  assert.equal(comparison.summary, 'changed');
  assert.deepEqual(kinds, {
    added: 'added',
    database: 'improved',
    removed: 'removed',
    trace: 'worsened',
  });

  const stablePrevious = structuredClone(runFixture({ id: 'RUN-SAME' }));
  stablePrevious.executionResults = structuredClone(current.executionResults);
  stablePrevious.report = undefined;
  const stable = compareInspectionRuns(current, stablePrevious);
  assert.deepEqual(stable, {
    previousRunId: 'RUN-SAME',
    previousCompletedAt: '2026-08-16T06:01:00.000Z',
    summary: 'stable',
    items: [],
  });

  const legacy = structuredClone(previous);
  delete legacy.executionResults;
  assert.equal(compareInspectionRuns(current, legacy), null);
});

test('library serialization round-trips valid snapshots and rejects partial records', () => {
  const library = {
    schemaVersion: 1,
    revision: 3,
    savedInspections: [definitionFixture({ name: '巡检' })],
    runs: [runFixture()],
  };
  const serialized = serializeInspectionLibrary(library);
  assert.deepEqual(parseInspectionLibrary(serialized), library);
  assert.deepEqual(
    parseInspectionLibrary(JSON.stringify({ ...library, savedInspections: [{ name: 'missing id' }] })),
    createEmptyInspectionLibrary(),
  );
  const partialRunPayload = JSON.stringify({ ...library, runs: [library.runs[0], { id: 'half-run' }] });
  const recovered = parseInspectionLibraryWithDiagnostics(partialRunPayload);
  assert.equal(recovered.diagnostics.status, 'degraded');
  assert.equal(recovered.diagnostics.rejectedRunCount, 1);
  assert.deepEqual(recovered.library.savedInspections, library.savedInspections);
  assert.deepEqual(recovered.library.runs, library.runs);
  assert.deepEqual(parseInspectionLibrary(partialRunPayload), recovered.library);
});

test('concurrent libraries merge stable IDs without losing runs and newer definitions win', () => {
  const left = {
    schemaVersion: 1,
    revision: 2,
    savedInspections: [definitionFixture({ name: '旧名称' })],
    runs: [runFixture({ id: 'RUN-A' })],
  };
  const right = {
    schemaVersion: 1,
    revision: 5,
    savedInspections: [
      definitionFixture({ version: 2, name: '新名称', updatedAt: '2026-08-16T06:05:00.000Z' }),
      definitionFixture({
        id: 'SAVED-002',
        name: '第二个',
        sourceRunId: 'RUN-B',
        updatedAt: '2026-08-16T06:04:00.000Z',
      }),
    ],
    runs: [runFixture({ id: 'RUN-B', definitionId: 'SAVED-002', completedAt: '2026-08-16T06:05:00.000Z' })],
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
