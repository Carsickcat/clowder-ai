import assert from 'node:assert/strict';
import test from 'node:test';

import { createDemoSession, demoReducer } from '../lib/reducer.mjs';
import { selectViewModel } from '../lib/selectors.mjs';
import { renderApp } from '../src/render.mjs';

function dispatch(state, type, payload = {}) {
  return demoReducer(state, { type, ...payload });
}

function paymentState() {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', {
    request: {
      prompt: '调整 payment-api Redis 超时，帮我生成巡检计划。',
      targetService: 'payment-api',
      contextReference: 'CHG-84217',
    },
  });
  return state;
}

function orderState() {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', {
    request: {
      prompt: '今晚升级 order-api v4.8.0，帮我确认订单提交和支付链路有没有问题。',
      targetService: 'order-api',
    },
  });
  return state;
}

function majorDriftState() {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', {
    request: {
      prompt: 'payment-api 拆分出 risk-api，重新验证支付确认链路。',
      targetService: 'payment-api',
      contextReference: 'CHG-84501',
    },
  });
  return state;
}

function dismissMatchedPlaybook(state) {
  return state.playbookMatch ? dispatch(state, 'PLAYBOOK_DISMISSED') : state;
}

test('intake is a blank user-driven product entry, not fixed journey navigation', () => {
  const html = renderApp(selectViewModel(createDemoSession()));
  assert.match(html, /创建任意巡检工作区/);
  assert.match(html, /name="inspection-intent"/);
  assert.match(html, /name="context-reference"/);
  assert.match(html, /示例只负责填充/);
  assert.match(html, /data-example-id="order-upgrade"/);
  assert.match(html, /data-example-id="payment-config"/);
  assert.doesNotMatch(html, /data-scenario-id=/);
  assert.doesNotMatch(html, /aria-label="验收场景"/);
  assert.match(html, /输入理解/);
  assert.match(html, /范围对账/);
  assert.match(html, /任务草案/);
  assert.match(html, /执行取证/);
  assert.match(html, /行动报告/);
});

test('electronic-flow plan exposes reconciliation and blocks unresolved candidate', () => {
  let state = paymentState();
  state = dispatch(state, 'INPUT_CONFIRMED');
  state = dismissMatchedPlaybook(state);
  state = dispatch(state, 'SCOPE_ACCEPTED');
  const html = renderApp(selectViewModel(state));

  assert.match(html, /Observed-Superset/);
  assert.match(html, /invoice-worker/);
  assert.match(html, /settlement-db/);
  assert.match(html, /数据库连接等待/);
  assert.match(html, /待处置/);
  assert.match(html, /data-testid="plan-stat-required"[\s\S]*?<strong>3<\/strong>/);
  assert.match(html, /data-testid="plan-stat-recommended"[\s\S]*?<strong>0<\/strong>/);
  assert.match(html, /data-testid="plan-stat-pending"[\s\S]*?<strong>1<\/strong>/);
  assert.match(html, /data-action="PLAN_CONFIRMED"[^>]+disabled/);
});

test('accepted candidate becomes a formal check and unlocks confirmation', () => {
  let state = paymentState();
  state = dispatch(state, 'INPUT_CONFIRMED');
  state = dismissMatchedPlaybook(state);
  state = dispatch(state, 'SCOPE_ACCEPTED');
  state = dispatch(state, 'CANDIDATE_DISPOSED', {
    candidateId: 'candidate-db-wait',
    disposition: 'accepted',
  });
  const html = renderApp(selectViewModel(state));

  assert.match(html, /已纳入正式计划/);
  assert.match(html, /db\.pool\.wait_p95/);
  assert.match(html, /data-testid="plan-stat-recommended"[\s\S]*?<strong>1<\/strong>/);
  assert.match(html, /data-testid="plan-stat-pending"[\s\S]*?<strong>0<\/strong>/);
  assert.match(html, /<details[^>]+class="check-card[^>]*>/);
  assert.match(html, /来源与判定依据/);
  assert.match(html, /CHG-84217/);
  assert.match(html, /Observed-Superset/);
  assert.doesNotMatch(html, /data-action="PLAN_CONFIRMED"[^>]+disabled/);
});

test('scope presents business, metric, trace, and middleware impact dimensions together', () => {
  let state = paymentState();
  state = dispatch(state, 'INPUT_CONFIRMED');
  const html = renderApp(selectViewModel(state));

  assert.match(html, /data-testid="impact-matrix"/);
  assert.match(html, /业务场景/);
  assert.match(html, /支付确认 → 账单异步/);
  assert.match(html, /黄金指标/);
  assert.match(html, /payment\.confirm\.success_rate/);
  assert.match(html, /Trace 直接依赖/);
  assert.match(html, /payment-api → settlement-db/);
  assert.match(html, /中间件/);
  assert.match(html, /settlement-db · Redis · invoice queue/);
});

test('risk report leads with action while preserving evidence semantics', () => {
  let state = paymentState();
  state = dispatch(state, 'INPUT_CONFIRMED');
  state = dismissMatchedPlaybook(state);
  state = dispatch(state, 'SCOPE_ACCEPTED');
  state = dispatch(state, 'CANDIDATE_DISPOSED', {
    candidateId: 'candidate-db-wait',
    disposition: 'accepted',
  });
  state = dispatch(state, 'PLAN_CONFIRMED');
  for (let index = 0; index < 4; index += 1) {
    state = dispatch(state, 'EXECUTION_ADVANCED');
  }
  const html = renderApp(selectViewModel(state));

  assert.match(html, /建议暂停在 25% 灰度/);
  assert.match(html, /证据结论/);
  assert.match(html, /Violated/);
  assert.match(html, /行动决策/);
  assert.match(html, /Pause/);
  assert.match(html, /启动 RC Agent/);
});

test('unmatched context renders no playbook product surface', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', {
    request: {
      prompt: '升级 fulfillment-service v7.2.0，验证履约状态和下游调用是否正常。',
      targetService: 'fulfillment-service',
      contextReference: 'REL-FUL-72',
    },
  });
  state = dispatch(state, 'INPUT_CONFIRMED');
  const html = renderApp(selectViewModel(state));

  assert.doesNotMatch(html, /data-testid="playbook-match"/);
  assert.doesNotMatch(html, /场景巡检方案/);
  assert.match(html, /多源事实已经对齐/);
});

test('exact playbook is a green in-context accelerator with one primary action', () => {
  let state = orderState();
  state = dispatch(state, 'INPUT_CONFIRMED');
  const html = renderApp(selectViewModel(state));

  assert.match(html, /data-testid="playbook-match"/);
  assert.match(html, /data-match-status="exact"/);
  assert.match(html, /订单发布后验证 · v4/);
  assert.match(html, /匹配 98%/);
  assert.match(html, /五项现场校验全部通过/);
  assert.match(html, /data-action="PLAYBOOK_EXECUTION_STARTED"/);
  assert.match(html, /按方案直跑/);
  assert.match(html, /data-action="PLAYBOOK_DISMISSED"/);
  assert.equal((html.match(/\bplaybook-primary\b/g) ?? []).length, 1);
});

test('minor drift exposes dimension chips and a confirm-differences action', () => {
  let state = paymentState();
  state = dispatch(state, 'INPUT_CONFIRMED');
  const html = renderApp(selectViewModel(state));

  assert.match(html, /data-match-status="minor-drift"/);
  assert.match(html, /支付配置变更巡检 · v3/);
  assert.match(html, /2 项当前差异需要确认/);
  assert.match(html, /data-difference-dimension="dependency"/);
  assert.match(html, /settlement-db 新增只读实例/);
  assert.match(html, /data-difference-dimension="metric"/);
  assert.match(html, /支付成功率口径 v2 → v3/);
  assert.match(html, /data-action="PLAYBOOK_DIFF_CONFIRMED"/);
});

test('major drift blocks regeneration until the current differences are explicitly reviewed', () => {
  let state = majorDriftState();
  state = dispatch(state, 'INPUT_CONFIRMED');
  let html = renderApp(selectViewModel(state));

  assert.match(html, /data-match-status="major-drift"/);
  assert.match(html, /场景边界已改变/);
  assert.match(html, /payment-api 已拆分为 payment-api \+ risk-api/);
  assert.match(html, /data-action="PLAYBOOK_DRIFT_REVIEWED"/);
  assert.match(html, /data-action="PLAYBOOK_REGENERATED"[^>]+disabled/);
  assert.doesNotMatch(html, /PLAYBOOK_EXECUTION_STARTED/);

  state = dispatch(state, 'PLAYBOOK_DRIFT_REVIEWED');
  html = renderApp(selectViewModel(state));
  assert.doesNotMatch(html, /data-action="PLAYBOOK_REGENERATED"[^>]+disabled/);
});

test('major drift regeneration leaves a compact reference in the copilot rail', () => {
  let state = majorDriftState();
  state = dispatch(state, 'INPUT_CONFIRMED');
  state = dispatch(state, 'PLAYBOOK_DRIFT_REVIEWED');
  state = dispatch(state, 'PLAYBOOK_REGENERATED');
  const html = renderApp(selectViewModel(state));

  assert.match(html, /data-testid="playbook-reference"/);
  assert.match(html, /旧方案仅作参考/);
  assert.match(html, /payment-config-verification · v3/);
});

test('report keeps the task locked and offers a secondary versioned proposal', () => {
  let state = orderState();
  state = dispatch(state, 'INPUT_CONFIRMED');
  state = dispatch(state, 'PLAYBOOK_EXECUTION_STARTED');
  for (let index = 0; index < state.workspace.execution.length; index += 1) {
    state = dispatch(state, 'EXECUTION_ADVANCED');
  }
  let html = renderApp(selectViewModel(state));

  assert.match(html, /data-testid="playbook-proposal"/);
  assert.match(html, new RegExp(`不可变实例 ${state.taskInstance.id}`));
  assert.match(html, /提交方案更新 → v5/);
  assert.match(html, /data-action="PLAYBOOK_PROPOSAL_SUBMITTED"/);

  state = dispatch(state, 'PLAYBOOK_PROPOSAL_SUBMITTED');
  html = renderApp(selectViewModel(state));
  assert.match(html, /v5 · 待审批/);
  assert.doesNotMatch(html, /data-action="PLAYBOOK_PROPOSAL_SUBMITTED"/);
});
