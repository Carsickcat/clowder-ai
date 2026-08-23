import assert from 'node:assert/strict';
import test from 'node:test';

import { compileInspectionRequest } from '../lib/compiler.mjs';
import { createDemoReducer, createDemoSession, demoReducer } from '../lib/reducer.mjs';
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
  assert.match(html, /已保存巡检/);
  assert.match(html, /name="inspection-intent"/);
  assert.match(html, /name="context-reference"/);
  assert.match(html, /填入示例/);
  assert.match(html, /data-example-id="order-upgrade"/);
  assert.match(html, /data-example-id="payment-config"/);
  assert.doesNotMatch(html, /data-scenario-id=/);
  assert.doesNotMatch(html, /aria-label="验收场景"/);
  assert.doesNotMatch(html, /class="phase-rail"/);
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
  assert.match(html, /巡检任务/);
});

test('exact playbook is a green in-context accelerator with one primary action', () => {
  let state = orderState();
  state = dispatch(state, 'INPUT_CONFIRMED');
  const html = renderApp(selectViewModel(state));

  assert.match(html, /data-testid="playbook-match"/);
  assert.match(html, /data-match-status="exact"/);
  assert.match(html, /订单发布后验证 · v4/);
  assert.match(html, /匹配 98%/);
  assert.match(html, /五项校验通过/);
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
  assert.match(html, /方案 v3 不适用：2 项重大差异/);
  assert.match(html, /payment-api 已拆分为 payment-api \+ risk-api/);
  assert.match(html, /data-action="PLAYBOOK_DRIFT_REVIEWED"/);
  assert.match(html, />确认已查看 2 项差异<\/button>/);
  assert.match(html, /data-action="PLAYBOOK_REGENERATED"[^>]+disabled/);
  assert.doesNotMatch(html, /PLAYBOOK_EXECUTION_STARTED/);

  state = dispatch(state, 'PLAYBOOK_DRIFT_REVIEWED');
  html = renderApp(selectViewModel(state));
  assert.match(html, /class="playbook-reviewed">✓ 已确认看完全部当前差异<\/p>/);
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
  assert.match(html, /历史实例不受影响/);
  assert.match(html, new RegExp(`title="历史任务 ${state.taskInstance.id} 已锁定"`));
  assert.match(html, /提交方案更新 → v5/);
  assert.match(html, /data-action="PLAYBOOK_PROPOSAL_SUBMITTED"/);

  state = dispatch(state, 'PLAYBOOK_PROPOSAL_SUBMITTED');
  html = renderApp(selectViewModel(state));
  assert.match(html, /v5 · 待审批/);
  assert.doesNotMatch(html, /data-action="PLAYBOOK_PROPOSAL_SUBMITTED"/);
});

test('the product uses concise task copy instead of slogans or decorative module labels', () => {
  const states = [createDemoSession()];

  let state = paymentState();
  states.push(state);
  state = dispatch(state, 'INPUT_CONFIRMED');
  states.push(state);
  state = dismissMatchedPlaybook(state);
  state = dispatch(state, 'SCOPE_ACCEPTED');
  states.push(state);
  state = dispatch(state, 'CANDIDATE_DISPOSED', {
    candidateId: 'candidate-db-wait',
    disposition: 'accepted',
  });
  state = dispatch(state, 'PLAN_CONFIRMED');
  states.push(state);
  for (let index = 0; index < 4; index += 1) {
    state = dispatch(state, 'EXECUTION_ADVANCED');
  }
  states.push(state);

  const html = states.map((item) => renderApp(selectViewModel(item))).join('\n');
  const forbiddenCopy = [
    '不是把',
    '我只保留',
    '确定性引擎产生',
    '不会静默猜测',
    '值得 SRE 确认',
    'Module 0',
    'Blast radius',
    'Action first',
    'learning loop',
  ];

  for (const copy of forbiddenCopy) {
    assert.doesNotMatch(html, new RegExp(copy, 'i'));
  }
  assert.match(html, /确认巡检信息/);
  assert.match(html, /确认巡检范围/);
  assert.match(html, /执行检查/);
  assert.match(html, /<div class="decision-hero">[\s\S]*?建议暂停在 25% 灰度/);
});

test('the copilot rail stays operational and does not repeat judgement or guardrail speeches', () => {
  let state = paymentState();
  state = dispatch(state, 'INPUT_CONFIRMED');
  state = dismissMatchedPlaybook(state);
  state = dispatch(state, 'SCOPE_ACCEPTED');
  const html = renderApp(selectViewModel(state));

  assert.match(html, /data-action="PLAN_CONFIRMED"/);
  assert.doesNotMatch(html, />当前判断</);
  assert.doesNotMatch(html, />护栏</);
  assert.doesNotMatch(html, /class="copilot-message"/);
  assert.doesNotMatch(html, /class="copilot-principles"/);
});

test('home keeps saved inspections in the main area and natural-language input in the right rail', () => {
  const html = renderApp(selectViewModel(createDemoSession()));

  assert.match(html, /data-testid="saved-inspection-home"/);
  assert.match(html, /已保存巡检/);
  assert.match(html, /还没有保存的巡检，从右侧对话开始/);
  assert.match(html, /<aside[^>]+copilot-panel[\s\S]*?data-intent-form/);
  assert.match(html, /placeholder="例如：巡检 payment-api 本周配置变更"/);
  assert.doesNotMatch(html, /我是你的智能巡检助手/);
  assert.doesNotMatch(html, /data-testid="saved-inspection-card"/);
});

test('parsed intent renders selectable current context in the main area', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', {
    request: {
      prompt: '升级 fulfillment-service v7.2.0，验证履约状态和下游调用是否正常。',
      targetService: 'fulfillment-service',
      contextReference: 'REL-FUL-72',
    },
  });
  const firstId = state.contextOptions[0].id;
  state = dispatch(state, 'CONTEXT_ITEM_TOGGLED', { contextId: firstId });
  const html = renderApp(selectViewModel(state));

  assert.match(html, /确认巡检信息/);
  assert.match(html, /近期变更/);
  assert.match(html, /关联服务与依赖/);
  assert.match(html, /可用信号/);
  assert.match(html, new RegExp(`data-context-id="${firstId}"[^>]+aria-pressed="false"`));
  assert.match(html, /data-action="INPUT_CONFIRMED"/);
  assert.match(html, /生成任务草案/);
});

function completedFulfillmentReport() {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', {
    request: {
      prompt: '升级 fulfillment-service v7.2.0，验证履约状态和下游调用是否正常。',
      targetService: 'fulfillment-service',
      contextReference: 'REL-FUL-72',
    },
  });
  state = dispatch(state, 'INPUT_CONFIRMED');
  state = dispatch(state, 'SCOPE_ACCEPTED');
  state = dispatch(state, 'PLAN_CONFIRMED');
  for (let index = 0; index < state.workspace.execution.length; index += 1) {
    state = dispatch(state, 'EXECUTION_ADVANCED');
  }
  return state;
}

test('report echoes selected context and offers a quiet editable personal save', () => {
  const state = completedFulfillmentReport();
  const html = renderApp(selectViewModel(state));

  assert.match(html, /data-testid="selected-context-results"/);
  assert.match(html, /本次选择的巡检结果/);
  assert.match(html, /模型风险总结/);
  assert.match(html, /data-save-inspection-form/);
  assert.match(html, /name="saved-inspection-name"/);
  assert.match(html, /保存后下次可从首页直接执行/);
  assert.doesNotMatch(html, /庆祝/);
});

test('a saved inspection becomes a truthful home card with a direct-run action', () => {
  let state = completedFulfillmentReport();
  state = dispatch(state, 'SAVED_INSPECTION_CREATED', {
    name: '履约发布后巡检',
    now: '2026-08-16T06:10:00.000Z',
  });
  state = dispatch(state, 'RESET');
  const html = renderApp(selectViewModel(state));

  assert.match(html, /data-testid="saved-inspection-card"/);
  assert.match(html, /履约发布后巡检/);
  assert.match(html, /本地 mock/);
  assert.match(html, /data-action="SAVED_INSPECTION_RUN_REQUESTED"/);
  assert.match(html, /data-definition-id="SAVED-001"/);
  assert.match(html, /直跑/);
  assert.match(html, /data-action="SAVED_INSPECTION_HISTORY_OPENED"/);
  assert.match(html, /class="run-history-dot/);
});

test('saved inspection history renders reverse-chronological immutable snapshots without share or save controls', () => {
  let state = completedFulfillmentReport();
  state = dispatch(state, 'SAVED_INSPECTION_CREATED', {
    name: '履约发布后巡检',
    now: '2026-08-16T06:10:00.000Z',
  });
  state = dispatch(state, 'RESET');
  const definitionId = state.library.savedInspections[0].id;
  state = dispatch(state, 'SAVED_INSPECTION_HISTORY_OPENED', { definitionId });
  const html = renderApp(selectViewModel(state));

  assert.match(html, /data-testid="saved-inspection-history"/);
  assert.match(html, /运行历史/);
  assert.match(html, /历史快照/);
  assert.match(html, /不可修改/);
  assert.match(html, /data-action="SAVED_INSPECTION_HISTORY_CLOSED"/);
  assert.match(html, /data-action="SAVED_INSPECTION_RUN_REQUESTED"/);
  assert.doesNotMatch(html, /data-share-action=/);
  assert.doesNotMatch(html, /data-save-inspection-form/);
});

test('current saved run report shows comparison and share controls while degraded history stays runnable', () => {
  let state = completedFulfillmentReport();
  state = dispatch(state, 'SAVED_INSPECTION_CREATED', {
    name: '履约发布后巡检',
    now: '2026-08-16T06:10:00.000Z',
  });
  state = dispatch(state, 'RESET');
  const definitionId = state.library.savedInspections[0].id;
  const library = state.library;
  state = dispatch(state, 'SAVED_INSPECTION_RUN_REQUESTED', { definitionId });
  for (let index = 0; index < state.workspace.execution.length; index += 1) {
    state = dispatch(state, 'EXECUTION_ADVANCED');
  }
  const reportHtml = renderApp(selectViewModel(state));
  assert.match(reportHtml, /与上次相比/);
  assert.match(reportHtml, /与上次结论一致/);
  assert.match(reportHtml, /data-share-action="copy"/);
  assert.match(reportHtml, /data-share-action="export"/);

  const degraded = dispatch(createDemoSession(), 'LIBRARY_HYDRATED', {
    library,
    diagnostics: { status: 'degraded', rejectedRunCount: 1 },
  });
  const degradedHtml = renderApp(selectViewModel(degraded));
  assert.match(degradedHtml, /历史暂不可用/);
  assert.match(degradedHtml, /data-action="SAVED_INSPECTION_RUN_REQUESTED"/);
});

test('saved-inspection drift states expose one guarded next action', () => {
  let state = completedFulfillmentReport();
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
  const minor = minorReducer(state, { type: 'SAVED_INSPECTION_RUN_REQUESTED', definitionId });
  const minorHtml = renderApp(selectViewModel(minor));
  assert.match(minorHtml, /当前事实有差异/);
  assert.match(minorHtml, /data-action="SAVED_INSPECTION_RUN_CONFIRMED"/);
  assert.match(minorHtml, /仍要执行/);

  const majorReducer = createDemoReducer({
    compileSavedDefinition(request) {
      const workspace = compileInspectionRequest(request);
      return { ...workspace, committedChecks: workspace.committedChecks.slice(1) };
    },
  });
  const major = majorReducer(state, { type: 'SAVED_INSPECTION_RUN_REQUESTED', definitionId });
  const majorHtml = renderApp(selectViewModel(major));
  assert.match(majorHtml, /当前结构已变化，不能直跑/);
  assert.match(majorHtml, /data-action="SAVED_INSPECTION_REGENERATED"/);
  assert.doesNotMatch(majorHtml, /data-action="SAVED_INSPECTION_RUN_CONFIRMED"/);
});
