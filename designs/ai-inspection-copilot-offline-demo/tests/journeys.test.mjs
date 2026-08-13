import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectionPlaybooks } from '../lib/playbooks.mjs';
import { createDemoReducer, createDemoSession, demoReducer } from '../lib/reducer.mjs';
import {
  selectCommittedChecks,
  selectPlanReadiness,
  selectReportView,
  selectResolvedScope,
} from '../lib/selectors.mjs';

function dispatch(state, type, payload = {}) {
  return demoReducer(state, { type, ...payload });
}

const orderRequest = {
  prompt: '今晚升级 order-api v4.8.0，帮我确认订单提交和支付链路有没有问题。',
};

const paymentRequest = {
  prompt: '调整 payment-api Redis 超时，帮我生成巡检计划。',
  targetService: 'payment-api',
  contextReference: 'CHG-84217',
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
  state = dispatch(state, 'INPUT_CONFIRMED');
  if (state.playbookMatch) state = dispatch(state, 'PLAYBOOK_DISMISSED');
  state = dispatch(state, 'SCOPE_ACCEPTED');
  return state;
}

function finishJourney(state) {
  state = dispatch(state, 'PLAN_CONFIRMED');
  for (let index = 0; index < state.workspace.execution.length; index += 1) {
    state = dispatch(state, 'EXECUTION_ADVANCED');
  }
  return state;
}

test('natural-language journey reaches a scoped Proceed report', () => {
  let state = advanceToPlan(orderRequest);
  assert.equal(selectPlanReadiness(state).status, 'ready');
  state = finishJourney(state);

  assert.equal(state.phase, 'report');
  assert.equal(selectReportView(state).action, 'Proceed');
  assert.equal(selectReportView(state).evidenceVerdict, 'Verified');
  assert.match(selectReportView(state).scopeStatement, /订单提交/);
});

test('electronic-flow journey requires disposition of a critical AI candidate', () => {
  let state = advanceToPlan(paymentRequest);
  assert.equal(selectPlanReadiness(state).status, 'blocked');
  assert.equal(selectPlanReadiness(state).unresolvedCandidateIds.length, 1);

  const unchanged = dispatch(state, 'PLAN_CONFIRMED');
  assert.deepEqual(unchanged, state);

  state = dispatch(state, 'CANDIDATE_DISPOSED', {
    candidateId: 'candidate-db-wait',
    disposition: 'accepted',
  });
  assert.equal(selectPlanReadiness(state).status, 'ready');
  assert.ok(selectCommittedChecks(state).some((check) => check.id === 'candidate-db-wait'));

  state = finishJourney(state);
  const report = selectReportView(state);
  assert.equal(report.action, 'Pause');
  assert.equal(report.evidenceVerdict, 'Violated');
  assert.match(report.rcAgent.rootCause, /连接池/);
});

test('rejecting a candidate requires a reason and never executes it', () => {
  let state = advanceToPlan(paymentRequest);
  const withoutReason = dispatch(state, 'CANDIDATE_DISPOSED', {
    candidateId: 'candidate-db-wait',
    disposition: 'rejected',
  });
  assert.deepEqual(withoutReason, state);

  state = dispatch(state, 'CANDIDATE_DISPOSED', {
    candidateId: 'candidate-db-wait',
    disposition: 'rejected',
    reason: '数据库团队确认该连接池不由本次配置包管理',
  });
  assert.equal(selectPlanReadiness(state).status, 'ready');
  assert.ok(!selectCommittedChecks(state).some((check) => check.id === 'candidate-db-wait'));
});

test('starting a new request clears workspace, dispositions, execution, and RC state', () => {
  let state = advanceToPlan(paymentRequest);
  state = dispatch(state, 'CANDIDATE_DISPOSED', {
    candidateId: 'candidate-db-wait',
    disposition: 'accepted',
  });
  state = finishJourney(state);
  state = dispatch(state, 'RC_TOGGLED');
  assert.equal(state.rcExpanded, true);

  const nextTaskOrdinal = state.nextTaskOrdinal;
  state = dispatch(state, 'RESET');
  assert.deepEqual(state, createDemoSession({ nextTaskOrdinal }));
  assert.equal(state.workspace, null);
  assert.deepEqual(state.candidateDisposition, {});
  assert.equal(state.executionStep, -1);
  assert.equal(state.rcExpanded, false);
});

test('resolved scope is derived from reconciliation, not duplicated session state', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request: paymentRequest });
  assert.deepEqual(selectResolvedScope(state).entities, ['invoice-worker', 'payment-api', 'settlement-db']);
  assert.equal(Object.hasOwn(state, 'resolvedScope'), false);
});

test('exact playbook runs after one confirmation while current reconciliation remains authoritative', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request: orderRequest });
  state = dispatch(state, 'INPUT_CONFIRMED');

  assert.equal(state.phase, 'context');
  assert.equal(state.playbookMatch.status, 'exact');
  assert.equal(state.workspace.reconciliation.status, 'Exact');

  state = dispatch(state, 'PLAYBOOK_EXECUTION_STARTED');

  assert.equal(state.phase, 'execution');
  assert.equal(state.taskInstance.status, 'executing');
  assert.deepEqual(state.taskInstance.sourcePlaybookRef, {
    id: 'order-release-verification',
    version: 4,
  });
  assert.deepEqual(state.taskInstance.inspectionPlan.checkIds, inspectionPlaybooks[0].checkIds);
  assert.ok(state.taskInstance.inspectionPlan.checks.every((check) => !Object.hasOwn(check, 'evidence')));
  assert.ok(state.taskInstance.auditTrail.some((event) => event.type === 'playbook-applied'));
});

test('each reused task snapshots the selected catalog checks without rewriting a locked historical task', () => {
  let historical = createDemoSession();
  historical = dispatch(historical, 'INTENT_SUBMITTED', { request: orderRequest });
  historical = dispatch(historical, 'INPUT_CONFIRMED');
  historical = dispatch(historical, 'PLAYBOOK_EXECUTION_STARTED');
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
  current = revisedReducer(current, { type: 'INPUT_CONFIRMED' });
  current = revisedReducer(current, { type: 'PLAYBOOK_EXECUTION_STARTED' });

  assert.equal(current.taskInstance.sourcePlaybookRef.version, 5);
  assert.deepEqual(current.taskInstance.inspectionPlan.checkIds, ['service-golden-signals']);
  assert.deepEqual(
    current.taskInstance.inspectionPlan.checks.map((check) => check.id),
    ['service-golden-signals'],
  );
  assert.deepEqual(historical.taskInstance, lockedTask);
});

test('minor playbook drift records the acknowledged differences before adapting the plan', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request: paymentRequest });
  state = dispatch(state, 'INPUT_CONFIRMED');

  assert.equal(state.playbookMatch.status, 'minor-drift');
  state = dispatch(state, 'PLAYBOOK_DIFF_CONFIRMED');

  assert.equal(state.phase, 'plan');
  assert.equal(state.playbookDecision, 'accepted-with-diff');
  assert.deepEqual(state.taskInstance.sourcePlaybookRef, {
    id: 'payment-config-verification',
    version: 3,
  });
  assert.deepEqual(
    selectCommittedChecks(state).map((check) => check.id),
    inspectionPlaybooks[1].checkIds,
  );
  const audit = state.taskInstance.auditTrail.find((event) => event.type === 'playbook-differences-confirmed');
  assert.deepEqual(audit.differenceIds, ['payment-read-replica', 'payment-success-vocabulary']);
  assert.ok(selectResolvedScope(state).entities.includes('settlement-db'));

  state = dispatch(state, 'CANDIDATE_DISPOSED', {
    candidateId: 'candidate-db-wait',
    disposition: 'accepted',
  });
  state = dispatch(state, 'PLAN_CONFIRMED');
  assert.deepEqual(state.taskInstance.inspectionPlan.checkIds, [
    ...inspectionPlaybooks[1].checkIds,
    'candidate-db-wait',
  ]);
});

test('major drift rejects direct execution and keeps the old playbook reference-only', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request: majorDriftRequest });
  state = dispatch(state, 'INPUT_CONFIRMED');

  assert.equal(state.playbookMatch.status, 'major-drift');
  const forbidden = dispatch(state, 'PLAYBOOK_EXECUTION_STARTED');
  assert.deepEqual(forbidden, state);

  const hiddenRegenerate = dispatch(state, 'PLAYBOOK_REGENERATED');
  assert.deepEqual(hiddenRegenerate, state);
  state = dispatch(state, 'PLAYBOOK_DRIFT_REVIEWED');
  assert.equal(state.playbookDriftReviewed, true);
  state = dispatch(state, 'PLAYBOOK_REGENERATED');
  assert.equal(state.phase, 'plan');
  assert.equal(state.playbookDecision, 'regenerated');
  assert.equal(state.taskInstance.sourcePlaybookRef, null);
  assert.deepEqual(state.taskInstance.referencePlaybookRef, {
    id: 'payment-config-verification',
    version: 3,
  });
  assert.ok(selectResolvedScope(state).entities.includes('risk-api'));
  assert.ok(selectCommittedChecks(state).some((check) => check.entity === 'risk-api'));
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
  state = dispatch(state, 'INPUT_CONFIRMED');
  state = dispatch(state, 'PLAYBOOK_EXECUTION_STARTED');
  for (let index = 0; index < state.workspace.execution.length; index += 1) {
    state = dispatch(state, 'EXECUTION_ADVANCED');
  }

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
