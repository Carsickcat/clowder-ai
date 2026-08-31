import assert from 'node:assert/strict';
import test from 'node:test';

import { createDemoSession, demoReducer } from '../lib/reducer.mjs';
import { parseInspectionLibraryWithDiagnostics } from '../lib/saved-inspections.mjs';
import { selectCommittedChecks, selectReportView, selectViewModel } from '../lib/selectors.mjs';
import { renderApp } from '../src/render.mjs';

const orderRequest = {
  prompt: '今晚升级 order-api v4.8.0，帮我确认订单提交和支付链路有没有问题。',
};

function dispatch(state, type, payload = {}) {
  return demoReducer(state, { type, ...payload });
}

function advanceToPlan() {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', { request: orderRequest });
  state = dispatch(state, 'INPUT_CONFIRMED');
  if (state.playbookMatch) state = dispatch(state, 'PLAYBOOK_DISMISSED');
  return dispatch(state, 'SCOPE_ACCEPTED');
}

test('formal checks enumerate structured golden metric rules instead of scalar rule copy', () => {
  const state = advanceToPlan();
  const checks = selectCommittedChecks(state);
  const business = checks.find((check) => check.id === 'order-success');
  const service = checks.find((check) => check.id === 'service-golden-signals');

  assert.ok(Array.isArray(business.metricRules));
  assert.ok(Array.isArray(service.metricRules));
  assert.deepEqual(
    business.metricRules.map(({ metricId, label, unit }) => ({ metricId, label, unit })),
    [{ metricId: 'order.submit.success_rate', label: '订单提交成功率', unit: '%' }],
  );
  assert.deepEqual(
    service.metricRules.map((rule) => rule.metricId),
    ['http.error_rate', 'http.duration.p95'],
  );
  assert.equal('metric' in business, false);
  assert.equal('rule' in business, false);
});

test('an editable threshold is materialized once and deterministically changes the report verdict', () => {
  let state = advanceToPlan();
  state = dispatch(state, 'CHECK_RULE_UPDATED', {
    checkId: 'order-success',
    ruleId: 'order.submit.success_rate',
    operator: '>=',
    threshold: 99.9,
  });

  const editedRule = selectCommittedChecks(state)
    .find((check) => check.id === 'order-success')
    .metricRules?.find((rule) => rule.id === 'order.submit.success_rate');
  assert.ok(editedRule);
  assert.equal(editedRule.threshold, 99.9);

  const invalid = dispatch(state, 'CHECK_RULE_UPDATED', {
    checkId: 'order-success',
    ruleId: 'order.submit.success_rate',
    operator: 'invented',
    threshold: Number.NaN,
  });
  assert.equal(invalid, state);

  state = dispatch(state, 'PLAN_CONFIRMED');
  assert.equal(state.phase, 'report');
  assert.equal(state.library.runs.length, 1);
  assert.equal(state.taskInstance.inspectionPlan.checks[0].metricRules[0].threshold, 99.9);

  const report = selectReportView(state);
  const result = report.checkResults.find((item) => item.checkId === 'order-success');
  assert.equal(result.measurements[0].gate.value, 99.9);
  assert.equal(result.status, 'Violated');
  assert.equal(report.evidenceVerdict, 'Violated');
  assert.equal(report.action, 'Pause');

  const repeated = dispatch(state, 'PLAN_CONFIRMED');
  assert.equal(repeated, state);
  assert.equal(repeated.library.runs.length, 1);
});

test('plan UI drills into golden metrics and offers one parallel execution action', () => {
  const html = renderApp(selectViewModel(advanceToPlan()));

  assert.match(html, /订单提交成功率/);
  assert.match(html, /HTTP 错误率/);
  assert.match(html, /服务延迟 p95/);
  assert.match(html, /data-rule-check-id="order-success"/);
  assert.match(html, /data-rule-id="order\.submit\.success_rate"/);
  assert.match(html, /无先后依赖，确认后将并行执行并直接生成报告/);
  assert.match(html, /确认并执行 4 项检查/);
  assert.doesNotMatch(html, /运行下一项|排队|等待结果/);
});

test('one confirmation skips sequential execution and renders immutable trend evidence', () => {
  let state = advanceToPlan();
  state = dispatch(state, 'PLAN_CONFIRMED');
  const html = renderApp(selectViewModel(state));

  assert.equal(state.phase, 'report');
  assert.match(html, /class="trend-chart"/);
  assert.match(html, /data-trend-metric-id="order\.submit\.success_rate"/);
  assert.match(html, /aria-label="订单提交成功率趋势"/);
  assert.match(html, /class="trend-threshold-line"/);
  assert.doesNotMatch(html, /execution-number|运行下一项|排队|等待结果/);
});

test('persisted scalar-rule history migrates without losing the locked run', () => {
  let state = advanceToPlan();
  state = dispatch(state, 'PLAN_CONFIRMED');
  const legacy = structuredClone(state.library);
  for (const check of legacy.runs[0].inspectionPlan.checks) {
    check.metric = check.metricRules.map((rule) => rule.metricId).join(' + ');
    check.rule = check.metricRules.map((rule) => `${rule.operator} ${rule.threshold}${rule.unit}`).join('；');
    delete check.metricRules;
  }

  const hydrated = parseInspectionLibraryWithDiagnostics(JSON.stringify(legacy));
  assert.deepEqual(hydrated.diagnostics, { status: 'available', rejectedRunCount: 0 });
  assert.equal(hydrated.library.runs.length, 1);
  assert.ok(hydrated.library.runs[0].inspectionPlan.checks.every((check) => check.metricRules.length > 0));
  assert.ok(
    hydrated.library.runs[0].inspectionPlan.checks.every((check) => !('metric' in check) && !('rule' in check)),
  );

  const malformed = structuredClone(hydrated.library);
  malformed.runs[0].inspectionPlan.checks[0].metricRules = [];
  const quarantined = parseInspectionLibraryWithDiagnostics(JSON.stringify(malformed));
  assert.deepEqual(quarantined.diagnostics, { status: 'degraded', rejectedRunCount: 1 });
  assert.equal(quarantined.library.runs.length, 0);
});
