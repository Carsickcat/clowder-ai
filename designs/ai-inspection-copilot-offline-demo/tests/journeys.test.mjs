import assert from 'node:assert/strict';
import test from 'node:test';

import { compileInspectionRequest } from '../lib/compiler.mjs';
import { inspectionPlaybooks } from '../lib/playbooks.mjs';
import { createDemoReducer, createDemoSession, demoReducer } from '../lib/reducer.mjs';
import { mergeInspectionLibraries, parseInspectionLibraryWithDiagnostics } from '../lib/saved-inspections.mjs';
import {
  selectCommittedChecks,
  selectPlanReadiness,
  selectReportView,
  selectResolvedScope,
  selectViewModel,
} from '../lib/selectors.mjs';
import { renderApp } from '../src/render.mjs';

function dispatch(state, type, payload = {}) {
  return demoReducer(state, { type, ...payload });
}

const orderRequest = {
  prompt: '今晚升级 order-api v4.8.0，帮我确认订单提交和支付链路有没有问题。',
};

const paymentRequest = {
  prompt: '调整 payment-api Redis 超时，帮我生成巡检计划。',
  targetService: 'payment-api',
  contextReference: 'CHG-84501',
};

const releaseRequest = {
  prompt: '关注扣款成功和 Redis 客户端',
  contextReference: 'CHG-84501',
};

const majorDriftRequest = {
  prompt: 'payment-api 拆分出 risk-api，重新验证支付确认链路。',
  targetService: 'payment-api',
  contextReference: 'CHG-84501',
};

const fulfillmentRequest = {
  prompt: '升级 fulfillment-service v7.2.0，验证履约状态和下游调用是否正常。',
  targetService: 'fulfillment-service',
  contextReference: 'REL-FUL-72',
};

function advanceToPlan(request) {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request });
  return state;
}

function finishJourney(state) {
  return dispatch(state, 'PLAN_CONFIRMED');
}

function assertLockedRunProjection(state) {
  const run = state.library.runs.find((item) => item.id === state.currentRunId);
  assert.ok(run, 'completed entry path must create one current Run');
  assert.equal(Object.hasOwn(run, 'executionResults'), false, 'new Runs keep the locked report as their only truth');
  const results = new Map(run.report.checkResults.map((result) => [result.checkId, result]));
  for (const check of run.inspectionPlan.checks) {
    const measurements = results.get(check.id)?.measurements ?? [];
    for (const rule of check.metricRules.filter((item) => item.editable !== false)) {
      const measurement = measurements.find((item) => item.metricId === rule.metricId);
      assert.equal(measurement?.kind, 'numeric', `${check.id}/${rule.metricId} must have numeric evidence`);
      assert.ok(measurement.series.length >= 2, `${check.id}/${rule.metricId} must retain its trend`);
      assert.deepEqual(
        {
          operator: measurement.gate.operator,
          value: measurement.gate.value,
          unit: measurement.gate.unit,
        },
        { operator: rule.operator, value: rule.threshold, unit: rule.unit },
      );
    }
  }
}

test('release intake reaches a coverage-honest plan with PLAN_CONFIRMED as its only authorization', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request: releaseRequest });

  assert.equal(state.phase, 'plan');
  assert.equal(state.library.runs.length, 0);
  assert.deepEqual(state.workspace.blockingScope, ['payment-api']);
  assert.deepEqual(
    state.workspace.coverageGaps.map((gap) => gap.entity),
    ['invoice-worker', 'settlement-db'],
  );
  assert.deepEqual(
    selectCommittedChecks(state).map((check) => check.entity),
    ['支付确认旅程', 'payment-api'],
  );
  assert.equal(selectPlanReadiness(state).status, 'ready');

  assert.equal(dispatch(state, 'INPUT_CONFIRMED'), state, 'legacy intake confirmation is inert on the release plan');
  assert.equal(dispatch(state, 'SCOPE_ACCEPTED'), state, 'scope acceptance is not a second release authorization');

  state = dispatch(state, 'PLAN_CONFIRMED');
  assert.equal(state.phase, 'report');
  assert.equal(state.library.runs.length, 1);
  assert.match(state.library.runs[0].report.scopeStatement, /声明范围/);
  assert.ok(state.library.runs[0].report.residualRisks.some((risk) => /未覆盖：invoice-worker/.test(risk)));
  assert.ok(state.library.runs[0].report.residualRisks.some((risk) => /未覆盖：settlement-db/.test(risk)));
  const contextById = new Map(state.library.runs[0].selectedContextResults.map((item) => [item.contextId, item]));
  assert.equal(contextById.get('service:payment-api').contextState, 'included-in-plan');
  assert.equal(contextById.get('service:invoice-worker').contextState, 'uncovered');
  assert.equal(contextById.get('service:settlement-db').contextState, 'uncovered');
  assert.equal(
    state.library.runs[0].selectedContextResults.some((item) => Object.hasOwn(item, 'status')),
    false,
    'context metadata must never persist an evidence verdict',
  );
  assertLockedRunProjection(state);
});

test('only an approved coverage-gap candidate can be explicitly included before the release is locked', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request: releaseRequest });
  const settlementGap = state.workspace.coverageGaps.find((gap) => gap.entity === 'settlement-db');
  const invoiceGap = state.workspace.coverageGaps.find((gap) => gap.entity === 'invoice-worker');

  assert.equal(settlementGap.eligibleCandidateId, 'candidate-db-wait');
  assert.equal(invoiceGap.eligibleCandidateId, null);
  assert.equal(dispatch(state, 'CANDIDATE_INCLUDED', { candidateId: 'invoice-backlog' }), state);

  state = dispatch(state, 'CANDIDATE_INCLUDED', { candidateId: settlementGap.eligibleCandidateId });
  assert.ok(selectCommittedChecks(state).some((check) => check.id === 'candidate-db-wait'));
  state = dispatch(state, 'PLAN_CONFIRMED');

  assert.equal(state.library.runs[0].report.action, 'Pause');
  assert.ok(state.library.runs[0].report.residualRisks.some((risk) => /未覆盖：invoice-worker/.test(risk)));
  assert.ok(!state.library.runs[0].report.residualRisks.some((risk) => /未覆盖：settlement-db/.test(risk)));
  assertLockedRunProjection(state);
});

test('natural-language journey reaches a scoped Proceed report', () => {
  let state = advanceToPlan(orderRequest);
  assert.equal(selectPlanReadiness(state).status, 'ready');
  state = finishJourney(state);

  assert.equal(state.phase, 'report');
  assert.equal(selectReportView(state).action, 'Proceed');
  assert.equal(selectReportView(state).evidenceVerdict, 'Verified');
  assert.match(selectReportView(state).scopeStatement, /订单提交/);
  assertLockedRunProjection(state);
});

test('electronic-flow journey can proceed without silently adding a declaration-external candidate', () => {
  let state = advanceToPlan(paymentRequest);
  assert.equal(selectPlanReadiness(state).status, 'ready');
  assert.equal(selectPlanReadiness(state).unresolvedCandidateIds.length, 0);
  assert.ok(!selectCommittedChecks(state).some((check) => check.id === 'candidate-db-wait'));

  state = finishJourney(state);
  const report = selectReportView(state);
  assert.equal(report.action, 'Proceed');
  assert.equal(report.evidenceVerdict, 'Verified');
  assert.ok(report.residualRisks.some((risk) => /未覆盖：settlement-db/.test(risk)));
});

test('excluding an optional candidate needs no reason and never executes it', () => {
  let state = advanceToPlan(paymentRequest);
  state = dispatch(state, 'CANDIDATE_EXCLUDED', { candidateId: 'candidate-db-wait' });
  assert.equal(selectPlanReadiness(state).status, 'ready');
  assert.ok(!selectCommittedChecks(state).some((check) => check.id === 'candidate-db-wait'));
  state = finishJourney(state);
  assertLockedRunProjection(state);
  assert.equal(
    JSON.stringify(state.library.runs[0]).includes('candidate-db-wait'),
    false,
    'a rejected candidate must be absent from the complete new Run snapshot',
  );
});

test('starting a new request clears workspace, dispositions, execution, and RC state', () => {
  let state = advanceToPlan(paymentRequest);
  state = dispatch(state, 'CANDIDATE_INCLUDED', { candidateId: 'candidate-db-wait' });
  state = finishJourney(state);
  state = dispatch(state, 'RC_TOGGLED');
  assert.equal(state.rcExpanded, true);

  const library = state.library;
  const nextTaskOrdinal = state.nextTaskOrdinal;
  const nextRunOrdinal = state.nextRunOrdinal;
  state = dispatch(state, 'RESET');
  assert.deepEqual(state, createDemoSession({ library, nextTaskOrdinal, nextRunOrdinal }));
  assert.equal(state.workspace, null);
  assert.deepEqual(state.candidateDisposition, {});
  assert.equal(state.rcExpanded, false);
});

test('resolved scope is derived from reconciliation, not duplicated session state', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request: paymentRequest });
  assert.deepEqual(selectResolvedScope(state).entities, ['payment-api']);
  assert.deepEqual(selectResolvedScope(state).addedEntities, ['invoice-worker', 'settlement-db']);
  assert.equal(Object.hasOwn(state, 'resolvedScope'), false);
});

test('exact playbook runs after one confirmation while current reconciliation remains authoritative', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request: orderRequest });

  assert.equal(state.phase, 'plan');
  assert.equal(state.playbookMatch.status, 'exact');
  assert.equal(state.workspace.reconciliation.status, 'Exact');

  state = dispatch(state, 'PLAN_CONFIRMED');

  assert.equal(state.phase, 'report');
  assert.equal(state.taskInstance.status, 'locked');
  assert.equal(state.library.runs.length, 1);
  assert.deepEqual(state.taskInstance.sourcePlaybookRef, {
    id: 'order-release-verification',
    version: 4,
  });
  assert.deepEqual(state.taskInstance.inspectionPlan.checkIds, inspectionPlaybooks[0].checkIds);
  assert.ok(state.taskInstance.inspectionPlan.checks.every((check) => !Object.hasOwn(check, 'evidence')));
  assert.ok(state.taskInstance.auditTrail.some((event) => event.type === 'plan-confirmed'));
  assertLockedRunProjection(state);
});

test('each reused task snapshots the selected catalog checks without rewriting a locked historical task', () => {
  let historical = createDemoSession();
  historical = dispatch(historical, 'INTENT_SUBMITTED', { request: orderRequest });
  historical = finishJourney(historical);
  const lockedTask = structuredClone(historical.taskInstance);

  assert.deepEqual(historical.taskInstance.inspectionPlan.checkIds, inspectionPlaybooks[0].checkIds);

  const revised = {
    ...inspectionPlaybooks[0],
    version: 5,
    checkIds: ['service-golden-signals'],
  };
  const revisedReducer = createDemoReducer({ playbookCatalog: [...inspectionPlaybooks, revised] });
  let current = createDemoSession({ nextTaskOrdinal: historical.nextTaskOrdinal });
  current = revisedReducer(current, { type: 'INTENT_SUBMITTED', request: orderRequest });
  current = revisedReducer(current, { type: 'PLAN_CONFIRMED' });

  assert.equal(current.taskInstance.sourcePlaybookRef.version, 5);
  assert.deepEqual(current.taskInstance.inspectionPlan.checkIds, ['service-golden-signals']);
  assert.deepEqual(
    current.taskInstance.inspectionPlan.checks.map((check) => check.id),
    ['service-golden-signals'],
  );
  assert.deepEqual(historical.taskInstance, lockedTask);
});

test('minor playbook drift remains reference-only while the current CandidateSet is locked', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request: paymentRequest });

  assert.equal(state.playbookMatch.status, 'minor-drift');
  assert.equal(state.phase, 'plan');
  assert.equal(state.playbookDecision, null);
  assert.equal(state.taskInstance.sourcePlaybookRef, null);
  assert.deepEqual(
    selectCommittedChecks(state).map((check) => check.id),
    ['payment-success', 'payment-service'],
  );
  assert.deepEqual(dispatch(state, 'PLAYBOOK_DIFF_CONFIRMED'), state);

  state = dispatch(state, 'CANDIDATE_INCLUDED', { candidateId: 'candidate-db-wait' });
  state = dispatch(state, 'PLAN_CONFIRMED');
  assert.deepEqual(state.taskInstance.inspectionPlan.checkIds, [
    'payment-success',
    'payment-service',
    'candidate-db-wait',
  ]);
  assert.equal(state.taskInstance.sourcePlaybookRef, null);
});

test('major playbook drift cannot direct-run and the release still uses the current generated plan', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request: majorDriftRequest });

  assert.equal(state.playbookMatch.status, 'major-drift');
  const forbidden = dispatch(state, 'PLAYBOOK_EXECUTION_STARTED');
  assert.deepEqual(forbidden, state);
  assert.deepEqual(dispatch(state, 'PLAYBOOK_DRIFT_REVIEWED'), state);
  assert.deepEqual(dispatch(state, 'PLAYBOOK_REGENERATED'), state);

  state = dispatch(state, 'PLAN_CONFIRMED');
  assert.equal(state.phase, 'report');
  assert.equal(state.taskInstance.sourcePlaybookRef, null);
  assert.equal(state.taskInstance.referencePlaybookRef, null);
  assert.deepEqual(state.taskInstance.inspectionPlan.checkIds, ['payment-success', 'payment-service']);
});

test('reset clears playbook state and assigns a new task instance to the next request', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request: orderRequest });
  const firstTaskId = state.taskInstance.id;
  assert.equal(state.playbookMatch.status, 'exact');

  state = dispatch(state, 'RESET');
  assert.equal(state.workspace, null);
  assert.equal(state.playbookMatch, null);
  assert.equal(state.playbookDecision, null);
  assert.equal(state.taskInstance, null);
  assert.equal(state.playbookProposal, null);

  state = dispatch(state, 'INTENT_SUBMITTED', { request: fulfillmentRequest });
  assert.notEqual(state.taskInstance.id, firstTaskId);
  assert.equal(state.playbookMatch, null);
});

test('locked task remains immutable while a report submits one idempotent playbook proposal', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request: orderRequest });
  state = dispatch(state, 'PLAN_CONFIRMED');

  assert.equal(state.phase, 'report');
  assert.equal(state.taskInstance.status, 'locked');
  const lockedTask = state.taskInstance;

  state = dispatch(state, 'PLAYBOOK_PROPOSAL_SUBMITTED');
  assert.deepEqual(state.taskInstance, lockedTask);
  assert.equal(state.playbookProposal.kind, 'update');
  assert.equal(state.playbookProposal.targetVersion, 5);
  assert.equal(state.playbookProposal.status, 'pending-approval');
  assert.equal(state.playbookProposal.sourceTaskInstanceId, lockedTask.id);

  const proposed = state;
  state = dispatch(state, 'PLAYBOOK_PROPOSAL_SUBMITTED');
  assert.equal(state, proposed);
});

function completePersonalInspection(reducer = demoReducer, sessionOptions = {}) {
  let state = createDemoSession(sessionOptions);
  state = reducer(state, { type: 'INTENT_SUBMITTED', request: fulfillmentRequest });
  const deselectedId = state.contextOptions[0].id;
  state = reducer(state, { type: 'CONTEXT_ITEM_TOGGLED', contextId: deselectedId });
  state = reducer(state, { type: 'PLAN_CONFIRMED' });
  return { state, deselectedId };
}

test('first-use selected context flows into one immutable run and an immediately active personal save', () => {
  let { state, deselectedId } = completePersonalInspection();

  assert.equal(state.phase, 'report');
  assert.equal(state.library.runs.length, 1);
  assert.equal(state.currentRunId, state.library.runs[0].id);
  assertLockedRunProjection(state);
  assert.equal(
    state.library.runs[0].selectedContextResults.some((item) => item.contextId === deselectedId),
    false,
  );
  const lockedRun = structuredClone(state.library.runs[0]);

  state = dispatch(state, 'SAVED_INSPECTION_CREATED', {
    name: '履约发布后巡检',
    now: '2026-08-16T06:10:00.000Z',
  });
  assert.equal(state.library.savedInspections.length, 1);
  assert.equal(state.library.savedInspections[0].name, '履约发布后巡检');
  assert.equal(state.library.savedInspections[0].sourceRunId, lockedRun.id);
  assert.equal(JSON.stringify(state.library.savedInspections[0]).includes('report'), false);
  assert.deepEqual(state.library.runs[0], lockedRun);

  const savedState = state;
  state = dispatch(state, 'SAVED_INSPECTION_CREATED', {
    name: 'duplicate',
    now: '2026-08-16T06:11:00.000Z',
  });
  assert.equal(state, savedState, 'the report can create only one personal definition');

  state = dispatch(state, 'RESET');
  assert.equal(state.workspace, null);
  assert.equal(state.library.savedInspections.length, 1);
  assert.equal(state.library.runs.length, 1);
});

test('deselected signal is removed from the generated inspection plan', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request: fulfillmentRequest });
  const signal = state.contextOptions.find((item) => item.kind === 'signal');
  assert.ok(signal);

  state = dispatch(state, 'CONTEXT_ITEM_TOGGLED', { contextId: signal.id });

  assert.equal(
    selectCommittedChecks(state).some((check) => `signal:${check.id}` === signal.id),
    false,
  );
  state = dispatch(state, 'PLAN_CONFIRMED');
  assert.equal(state.taskInstance.inspectionPlan.checkIds.includes(signal.id.slice('signal:'.length)), false);
  assertLockedRunProjection(state);
});

test('a deselected signal remains outside an exact saved-inspection revisit', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request: fulfillmentRequest });
  const signal = state.contextOptions.find((item) => item.kind === 'signal');
  assert.ok(signal);

  state = dispatch(state, 'CONTEXT_ITEM_TOGGLED', { contextId: signal.id });
  state = dispatch(state, 'PLAN_CONFIRMED');
  state = dispatch(state, 'SAVED_INSPECTION_CREATED', {
    name: '排除业务结果信号的履约巡检',
    now: '2026-08-16T06:10:00.000Z',
  });
  state = dispatch(state, 'RESET');

  const definitionId = state.library.savedInspections[0].id;
  state = dispatch(state, 'SAVED_INSPECTION_RUN_REQUESTED', { definitionId });

  assert.deepEqual(state.savedRunRefresh, { status: 'exact', differences: [] });
  assert.equal(state.phase, 'report');
  assert.equal(state.contextOptions.find((item) => item.id === signal.id)?.selected, false);
  assert.equal(state.taskInstance.inspectionPlan.checkIds.includes(signal.id.slice('signal:'.length)), false);
});

test('saved inspection exact direct-run bypasses intent compilation and creates a new immutable run', () => {
  let { state } = completePersonalInspection();
  state = dispatch(state, 'SAVED_INSPECTION_CREATED', {
    name: '履约发布后巡检',
    now: '2026-08-16T06:10:00.000Z',
  });
  state = dispatch(state, 'RESET');
  const definitionId = state.library.savedInspections[0].id;
  const historicalRun = structuredClone(state.library.runs[0]);
  let intentCalls = 0;
  let savedCalls = 0;
  const reducer = createDemoReducer({
    compileIntent(request) {
      intentCalls += 1;
      return compileInspectionRequest(request);
    },
    compileSavedDefinition(request) {
      savedCalls += 1;
      return compileInspectionRequest(request);
    },
  });

  state = reducer(state, { type: 'SAVED_INSPECTION_RUN_REQUESTED', definitionId });
  assert.equal(intentCalls, 0);
  assert.equal(savedCalls, 1);
  assert.equal(state.savedRunRefresh.status, 'exact');
  assert.equal(state.phase, 'report');
  assert.equal(state.taskInstance.sourceSavedInspectionId, definitionId);
  assert.notEqual(state.taskInstance.id, historicalRun.taskInstanceId);

  assert.equal(state.library.runs.length, 2);
  assert.notEqual(state.library.runs[0].id, state.library.runs[1].id);
  assert.deepEqual(state.library.runs[0], historicalRun);
  assertLockedRunProjection(state);
});

test('hydrated saved inspections continue task, run, and definition identifiers without collisions', () => {
  let { state } = completePersonalInspection();
  state = dispatch(state, 'SAVED_INSPECTION_CREATED', {
    name: '履约发布后巡检',
    now: '2026-08-16T06:10:00.000Z',
  });
  const persistedLibrary = state.library;
  const historicalRunId = persistedLibrary.runs[0].id;
  const historicalTaskId = persistedLibrary.runs[0].taskInstanceId;
  const definitionId = persistedLibrary.savedInspections[0].id;

  let hydrated = dispatch(createDemoSession(), 'LIBRARY_HYDRATED', { library: persistedLibrary });
  hydrated = dispatch(hydrated, 'SAVED_INSPECTION_RUN_REQUESTED', { definitionId });
  assert.notEqual(hydrated.taskInstance.id, historicalTaskId);
  assert.notEqual(hydrated.currentRunId, historicalRunId);
  assert.equal(new Set(hydrated.library.runs.map((run) => run.id)).size, 2);
});

test('concurrent browser actors create unique tasks, runs, and merged audit records', () => {
  let { state } = completePersonalInspection();
  state = dispatch(state, 'SAVED_INSPECTION_CREATED', {
    name: '履约发布后巡检',
    now: '2026-08-16T06:10:00.000Z',
  });
  const definitionId = state.library.savedInspections[0].id;
  const commonLibrary = state.library;

  function completeDirectRun(actorId) {
    let tab = createDemoSession({ library: commonLibrary, actorId });
    tab = dispatch(tab, 'SAVED_INSPECTION_RUN_REQUESTED', { definitionId });
    const taskInstanceId = tab.taskInstance.id;
    return { tab, taskInstanceId };
  }

  const left = completeDirectRun('tab-a');
  const right = completeDirectRun('tab-b');
  assert.notEqual(left.taskInstanceId, right.taskInstanceId);
  assert.notEqual(left.tab.currentRunId, right.tab.currentRunId);

  const merged = mergeInspectionLibraries(left.tab.library, right.tab.library);
  assert.equal(merged.runs.length, commonLibrary.runs.length + 2);
  assert.equal(new Set(merged.runs.map((run) => run.id)).size, merged.runs.length);
});

test('concurrent browser actors also create merge-safe saved definition IDs', () => {
  function completeAndSave(actorId, name) {
    let { state } = completePersonalInspection(demoReducer, { actorId });
    state = dispatch(state, 'SAVED_INSPECTION_CREATED', {
      name,
      now: '2026-08-16T06:10:00.000Z',
    });
    return state.library;
  }

  const left = completeAndSave('tab-a', '标签 A 巡检');
  const right = completeAndSave('tab-b', '标签 B 巡检');
  assert.notEqual(left.savedInspections[0].id, right.savedInspections[0].id);

  const merged = mergeInspectionLibraries(left, right);
  assert.equal(merged.savedInspections.length, 2);
  assert.equal(new Set(merged.savedInspections.map((item) => item.id)).size, 2);
  assert.equal(merged.runs.length, 2);
});

test('saved inspection minor drift requires acknowledgement and major drift cannot enter execution', () => {
  let { state } = completePersonalInspection();
  state = dispatch(state, 'SAVED_INSPECTION_CREATED', {
    name: '履约发布后巡检',
    now: '2026-08-16T06:10:00.000Z',
  });
  state = dispatch(state, 'RESET');
  const definitionId = state.library.savedInspections[0].id;
  const minorReducer = createDemoReducer({
    compileSavedDefinition(request) {
      const workspace = compileInspectionRequest(request);
      return {
        ...workspace,
        observedChange: {
          ...workspace.observedChange,
          entities: [...workspace.observedChange.entities, 'new-worker'],
        },
      };
    },
  });

  let minor = minorReducer(state, { type: 'SAVED_INSPECTION_RUN_REQUESTED', definitionId });
  assert.equal(minor.savedRunRefresh.status, 'minor-drift');
  assert.equal(minor.phase, 'context');
  assert.equal(minor.taskInstance.status, 'draft');
  minor = minorReducer(minor, { type: 'SAVED_INSPECTION_RUN_CONFIRMED' });
  assert.equal(minor.phase, 'report');
  assert.equal(minor.taskInstance.status, 'locked');
  assert.ok(minor.taskInstance.auditTrail.some((event) => event.type === 'saved-inspection-drift-confirmed'));

  const majorReducer = createDemoReducer({
    compileSavedDefinition(request) {
      const workspace = compileInspectionRequest(request);
      return { ...workspace, committedChecks: workspace.committedChecks.slice(1) };
    },
  });
  let major = majorReducer(state, { type: 'SAVED_INSPECTION_RUN_REQUESTED', definitionId });
  assert.equal(major.savedRunRefresh.status, 'major-drift');
  assert.equal(major.phase, 'context');
  const forbidden = majorReducer(major, { type: 'SAVED_INSPECTION_RUN_CONFIRMED' });
  assert.equal(forbidden, major);
  major = majorReducer(major, { type: 'SAVED_INSPECTION_REGENERATED' });
  assert.equal(major.phase, 'intake');
  assert.equal(major.workspace, null);
  assert.match(major.composerPrefill.prompt, /fulfillment-service/);
  assert.equal(major.library.savedInspections.length, 1);
});

test('unknown saved definition and deprecated execution events are no-ops', () => {
  const empty = createDemoSession();
  assert.equal(dispatch(empty, 'SAVED_INSPECTION_RUN_REQUESTED', { definitionId: 'missing' }), empty);
  let { state } = completePersonalInspection();
  const completed = state;
  state = dispatch(state, 'EXECUTION_ADVANCED');
  assert.equal(state, completed);
  assert.equal(state.library.runs.length, 1);
});

test('saved inspection history navigation is transient and never mutates the audit ledger', () => {
  let { state } = completePersonalInspection();
  state = dispatch(state, 'SAVED_INSPECTION_CREATED', {
    name: '履约发布后巡检',
    now: '2026-08-16T06:10:00.000Z',
  });
  state = dispatch(state, 'RESET');
  const definitionId = state.library.savedInspections[0].id;
  const librarySnapshot = structuredClone(state.library);

  state = dispatch(state, 'SAVED_INSPECTION_HISTORY_OPENED', { definitionId });
  assert.equal(state.phase, 'intake');
  assert.equal(state.workspace, null);
  assert.equal(state.activeHistoryDefinitionId, definitionId);
  assert.deepEqual(state.library, librarySnapshot);

  state = dispatch(state, 'SAVED_INSPECTION_HISTORY_CLOSED');
  assert.equal(state.activeHistoryDefinitionId, null);
  assert.deepEqual(state.library, librarySnapshot);
});

test('malformed persisted report is quarantined before saved-history rendering', () => {
  let { state } = completePersonalInspection();
  state = dispatch(state, 'SAVED_INSPECTION_CREATED', {
    name: '履约发布后巡检',
    now: '2026-08-16T06:10:00.000Z',
  });
  const corruptLibrary = structuredClone(state.library);
  corruptLibrary.runs[0].report = {};

  const hydrated = parseInspectionLibraryWithDiagnostics(JSON.stringify(corruptLibrary));
  assert.deepEqual(hydrated.diagnostics, { status: 'degraded', rejectedRunCount: 1 });
  assert.equal(hydrated.library.runs.length, 0);

  let recovered = dispatch(createDemoSession(), 'LIBRARY_HYDRATED', hydrated);
  const definitionId = recovered.library.savedInspections[0].id;
  const home = renderApp(selectViewModel(recovered));
  assert.match(home, /历史暂不可用/);
  assert.match(home, /SAVED_INSPECTION_RUN_REQUESTED/);

  recovered = dispatch(recovered, 'SAVED_INSPECTION_HISTORY_OPENED', { definitionId });
  assert.doesNotThrow(() => renderApp(selectViewModel(recovered)));
  assert.match(renderApp(selectViewModel(recovered)), /还没有执行记录/);

  recovered = dispatch(recovered, 'SAVED_INSPECTION_RUN_REQUESTED', { definitionId });
  assert.equal(recovered.phase, 'report');
});

test('library hydration keeps history diagnostics separate from persisted user data', () => {
  let { state } = completePersonalInspection();
  state = dispatch(state, 'SAVED_INSPECTION_CREATED', {
    name: '履约发布后巡检',
    now: '2026-08-16T06:10:00.000Z',
  });
  const library = state.library;
  const diagnostics = { status: 'degraded', rejectedRunCount: 1 };

  const hydrated = dispatch(createDemoSession(), 'LIBRARY_HYDRATED', { library, diagnostics });
  assert.deepEqual(hydrated.historyDiagnostics, diagnostics);
  assert.equal(JSON.stringify(hydrated.library).includes('historyDiagnostics'), false);
});
