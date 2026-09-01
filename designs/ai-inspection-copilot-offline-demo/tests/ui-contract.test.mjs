import assert from 'node:assert/strict';
import test from 'node:test';

import { compileInspectionRequest } from '../lib/compiler.mjs';
import { createDemoReducer, createDemoSession, demoReducer } from '../lib/reducer.mjs';
import { selectViewModel } from '../lib/selectors.mjs';
import { renderApp } from '../src/render.mjs';
import { formatReportTime } from '../src/report-model.mjs';

function dispatch(state, type, payload = {}) {
  return demoReducer(state, { type, ...payload });
}

function paymentState() {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', {
    request: {
      prompt: '调整 payment-api Redis 超时，帮我生成巡检计划。',
      targetService: 'payment-api',
      contextReference: 'CHG-84501',
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

test('release-first entry makes the change reference primary and risk intent optional', () => {
  const html = renderApp(selectViewModel(createDemoSession()));

  assert.match(html, /变更单 \/ 发布单号/);
  assert.match(html, /name="context-reference"[^>]*required/);
  assert.match(html, /本次关注什么（可选）/);
  assert.match(html, /生成巡检计划/);
  assert.match(html, /CHG-84501/);
  assert.ok(html.indexOf('name="context-reference"') < html.indexOf('name="inspection-intent"'));
});

test('release plan shows one authorization and keeps declaration-external entities in amber coverage gaps', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', {
    request: { contextReference: 'CHG-84501', prompt: '关注扣款成功和 Redis 客户端' },
  });
  const html = renderApp(selectViewModel(state));

  assert.equal(state.phase, 'plan');
  assert.match(html, /data-testid="release-context-strip"/);
  assert.match(html, /CHG-84501/);
  assert.match(html, /2 项阻断/);
  assert.match(html, /影响面缺口/);
  assert.match(html, /coverage-gap-card is-eligible/);
  assert.match(html, /settlement-db[\s\S]*?data-action="CANDIDATE_INCLUDED"/);
  assert.match(html, /invoice-worker[\s\S]*?无可信规则[\s\S]*?本次不覆盖/);
  const invoiceCard = html.match(/<article[^>]+data-gap-entity="invoice-worker"[\s\S]*?<\/article>/)?.[0] ?? '';
  assert.doesNotMatch(invoiceCard, /data-action="CANDIDATE_INCLUDED"/);
  assert.doesNotMatch(html, /已扩大巡检范围|INPUT_CONFIRMED|SCOPE_ACCEPTED/);
  assert.equal((html.match(/data-action="PLAN_CONFIRMED"/g) ?? []).length, 1);
  assert.match(html, /确认并开始巡检/);
});

test('electronic-flow plan exposes reconciliation without making an optional gap block execution', () => {
  const state = paymentState();
  const html = renderApp(selectViewModel(state));

  assert.match(html, /Observed-Superset/);
  assert.match(html, /invoice-worker/);
  assert.match(html, /settlement-db/);
  assert.match(html, /已有高权威规则[\s\S]*?加入本次检查/);
  assert.match(html, /data-testid="plan-summary"[\s\S]*?2 项阻断[\s\S]*?0 项观察[\s\S]*?2 项影响未覆盖/);
  assert.doesNotMatch(html, /data-action="PLAN_CONFIRMED"[^>]+disabled/);
  assert.doesNotMatch(html, /已扩大巡检范围|需要你确认|请先处理上方的建议项/);
  assert.ok(
    html.indexOf('data-action="PLAN_CONFIRMED"') < html.indexOf('class="panel copilot-panel"'),
    'the plan action belongs to the draft rather than the conversation rail',
  );
});

test('accepted candidate becomes a formal check and unlocks confirmation', () => {
  let state = paymentState();
  state = dispatch(state, 'CANDIDATE_INCLUDED', { candidateId: 'candidate-db-wait' });
  const html = renderApp(selectViewModel(state));

  assert.match(html, /已加入锁定计划/);
  assert.match(html, /db\.pool\.wait_p95/);
  assert.match(html, /data-testid="plan-summary"[\s\S]*?3 项阻断[\s\S]*?1 项影响未覆盖/);
  assert.match(html, /data-action="CANDIDATE_EXCLUDED"[^>]*>移出本次检查<\/button>/);
  assert.match(html, /<details[^>]+class="check-card[^>]*>/);
  assert.match(html, /查看细节/);
  assert.match(html, /目标实体/);
  assert.match(html, /业务黄金指标/);
  assert.match(html, /执行能力/);
  assert.match(html, /判定规则/);
  assert.match(html, /时间与基线/);
  assert.match(html, /失败动作/);
  assert.match(html, /事实来源/);
  assert.doesNotMatch(html, /class="check-index"/);
  assert.match(html, /CHG-84501/);
  assert.match(html, /Observed-Superset/);
  assert.doesNotMatch(html, /data-action="PLAN_CONFIRMED"[^>]+disabled/);
  assert.match(html, /data-action="PLAN_CONFIRMED"[^>]*>[\s\S]*?确认并开始巡检/);
});

test('medium candidate is presented as optional without pretending to block the plan', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', {
    request: {
      prompt: '升级 fulfillment-service v7.2.0，验证履约状态和下游调用是否正常。',
      targetService: 'fulfillment-service',
      contextReference: 'REL-FUL-72',
    },
  });
  const html = renderApp(selectViewModel(state));

  assert.match(html, /data-testid="plan-summary"[\s\S]*?4 项阻断[\s\S]*?0 项观察/);
  assert.match(html, /id="pending-title">可选观察/);
  assert.match(html, /class="readiness ready">可以开始/);
  assert.match(html, /data-action="CANDIDATE_INCLUDED"[^>]*>加入观察<\/button>/);
  assert.doesNotMatch(html, /需要你确认|有建议待确认|请先处理上方的建议项/);
  assert.doesNotMatch(html, /data-action="PLAN_CONFIRMED"[^>]+disabled/);
});

test('candidate decision stays visible and can switch between rejected and accepted', () => {
  let state = paymentState();
  state = dispatch(state, 'CANDIDATE_INCLUDED', { candidateId: 'candidate-db-wait' });
  state = dispatch(state, 'CANDIDATE_EXCLUDED', { candidateId: 'candidate-db-wait' });
  let html = renderApp(selectViewModel(state));

  assert.match(html, /本次尚未覆盖/);
  assert.match(html, /data-action="CANDIDATE_INCLUDED"[^>]*>加入本次检查<\/button>/);
  assert.match(html, /data-testid="plan-summary"[\s\S]*?2 项阻断[\s\S]*?2 项影响未覆盖/);
  assert.doesNotMatch(html, /class="check-card is-candidate-check"/);

  state = dispatch(state, 'CANDIDATE_INCLUDED', { candidateId: 'candidate-db-wait' });
  html = renderApp(selectViewModel(state));

  assert.match(html, /已加入锁定计划/);
  assert.match(html, /data-testid="plan-summary"[\s\S]*?3 项阻断[\s\S]*?1 项影响未覆盖/);
  assert.match(html, /class="check-card is-candidate-check"/);
});

test('draft without AI suggestions skips the confirmation section', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', {
    request: {
      prompt: '升级 fulfillment-service v7.2.0，验证履约状态和下游调用是否正常。',
      targetService: 'fulfillment-service',
      contextReference: 'REL-FUL-72',
    },
  });
  state = { ...state, workspace: { ...state.workspace, candidateChecks: [] } };
  const html = renderApp(selectViewModel(state));

  assert.match(html, /data-testid="plan-summary"[\s\S]*?4 项阻断/);
  assert.doesNotMatch(html, /id="pending-title"/);
  assert.match(html, /id="formal-title">将执行的检查/);
  assert.match(html, /确认并开始巡检/);
});

test('plan presents release facts, blocking boundary, source freshness, and external impact together', () => {
  const state = paymentState();
  const html = renderApp(selectViewModel(state));

  assert.match(html, /data-testid="release-context-strip"/);
  assert.match(html, /CHG-84501/);
  assert.match(html, /阻断范围[\s\S]*?payment-api/);
  assert.match(html, /刚刚 · 电子流/);
  assert.match(html, /data-testid="coverage-gaps"[\s\S]*?invoice-worker[\s\S]*?settlement-db/);
  assert.match(html, /payment\.confirm\.success_rate/);
});

test('risk report leads with action while preserving evidence semantics', () => {
  let state = paymentState();
  state = dispatch(state, 'CANDIDATE_INCLUDED', { candidateId: 'candidate-db-wait' });
  state = dispatch(state, 'PLAN_CONFIRMED');
  const html = renderApp(selectViewModel(state));

  assert.match(html, /建议暂停在 25% 灰度/);
  assert.match(html, /证据结论/);
  assert.match(html, /Violated/);
  assert.match(html, /行动决策/);
  assert.match(html, /Pause/);
  assert.match(html, /data-testid="report-metadata"[\s\S]*?payment-api 巡检[\s\S]*?实例 INS-/);
  assert.match(html, /data-testid="evidence-dashboard"/);
  assert.match(html, /class="evidence-card is-violated"[^>]*data-evidence-id="settlement-pool-utilization"/);
  assert.ok(html.indexOf('settlement-pool-utilization') < html.indexOf('payment-success-rate'));
  assert.match(html, /role="progressbar"[^>]*aria-valuenow="100"/);
  assert.equal((html.match(/data-testid="report-check-result"/g) ?? []).length, 3);
  assert.match(html, /coverage-badge has-gap[^>]*>覆盖：3 项已验证 · 1 项未覆盖/);
  assert.match(html, /未覆盖：invoice-worker/);
  assert.match(html, /data-testid="report-check-result"[\s\S]*?实际值[\s\S]*?门禁/);
  assert.match(html, /data-testid="ai-interpretation"[\s\S]*?发生了什么[\s\S]*?可能原因[\s\S]*?建议动作/);
  assert.match(html, /data-evidence-target="settlement-pool-utilization"/);
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
  const html = renderApp(selectViewModel(state));

  assert.doesNotMatch(html, /data-testid="playbook-match"/);
  assert.doesNotMatch(html, /场景巡检方案/);
  assert.match(html, /CandidateSet/);
  assert.match(html, /确认并开始巡检/);
});

test('exact playbook is projected into the candidate plan behind the same single authorization', () => {
  const state = orderState();
  const html = renderApp(selectViewModel(state));

  assert.equal(state.playbookMatch.status, 'exact');
  assert.match(html, /CandidateSet/);
  assert.match(html, /订单提交成功率/);
  assert.doesNotMatch(html, /PLAYBOOK_EXECUTION_STARTED|PLAYBOOK_DISMISSED|data-testid="playbook-match"/);
  assert.equal((html.match(/data-action="PLAN_CONFIRMED"/g) ?? []).length, 1);
});

test('minor playbook drift stays reference-only and does not add another confirmation surface', () => {
  const state = paymentState();
  const html = renderApp(selectViewModel(state));

  assert.equal(state.playbookMatch.status, 'minor-drift');
  assert.doesNotMatch(html, /PLAYBOOK_DIFF_CONFIRMED|data-match-status="minor-drift"/);
  assert.equal((html.match(/data-action="PLAN_CONFIRMED"/g) ?? []).length, 1);
  assert.match(html, /影响面缺口/);
});

test('major drift cannot expose an old-package direct-run or a second authorization', () => {
  const state = majorDriftState();
  const html = renderApp(selectViewModel(state));

  assert.equal(state.playbookMatch.status, 'major-drift');
  assert.doesNotMatch(html, /PLAYBOOK_EXECUTION_STARTED|PLAYBOOK_DRIFT_REVIEWED|PLAYBOOK_REGENERATED/);
  assert.equal((html.match(/data-action="PLAN_CONFIRMED"/g) ?? []).length, 1);
  assert.match(html, /CHG-84501/);
});

test('major drift compatibility events remain inert on the release plan', () => {
  const state = majorDriftState();
  const reviewed = dispatch(state, 'PLAYBOOK_DRIFT_REVIEWED');
  const regenerated = dispatch(state, 'PLAYBOOK_REGENERATED');
  const html = renderApp(selectViewModel(state));

  assert.equal(reviewed, state);
  assert.equal(regenerated, state);
  assert.doesNotMatch(html, /data-testid="playbook-reference"/);
});

test('report keeps the task locked and offers a secondary versioned proposal', () => {
  let state = orderState();
  state = dispatch(state, 'PLAN_CONFIRMED');
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
  state = dispatch(state, 'CANDIDATE_INCLUDED', { candidateId: 'candidate-db-wait' });
  state = dispatch(state, 'PLAN_CONFIRMED');
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
  assert.match(html, /生成巡检计划/);
  assert.match(html, /确认并开始巡检/);
  assert.doesNotMatch(html, /确认巡检信息|确认巡检范围|已扩大巡检范围/);
  assert.match(html, /<div class="decision-hero">[\s\S]*?建议暂停在 25% 灰度/);
});

test('the copilot rail stays operational and does not repeat judgement or guardrail speeches', () => {
  const state = paymentState();
  const html = renderApp(selectViewModel(state));

  assert.match(html, /data-action="PLAN_CONFIRMED"/);
  assert.doesNotMatch(html, />当前判断</);
  assert.doesNotMatch(html, />护栏</);
  assert.doesNotMatch(html, /class="copilot-message"/);
  assert.doesNotMatch(html, /class="copilot-principles"/);
});

test('home keeps the release-first form and saved inspections together in the main area', () => {
  const html = renderApp(selectViewModel(createDemoSession()));

  assert.match(html, /data-testid="saved-inspection-home"/);
  assert.match(html, /已保存巡检/);
  assert.match(html, /还没有保存的巡检，从上方变更单开始/);
  assert.match(html, /data-testid="release-intake"[\s\S]*?data-intent-form/);
  assert.match(html, /placeholder="例如 CHG-84501"/);
  assert.doesNotMatch(html, /<aside[^>]+copilot-panel[\s\S]*?data-intent-form/);
  assert.doesNotMatch(html, /我是你的智能巡检助手/);
  assert.doesNotMatch(html, /data-testid="saved-inspection-card"/);
});

test('parsed release renders a compact fact strip and the single plan authorization', () => {
  let state = createDemoSession();
  state = dispatch(state, 'INTENT_SUBMITTED', {
    request: {
      prompt: '升级 fulfillment-service v7.2.0，验证履约状态和下游调用是否正常。',
      targetService: 'fulfillment-service',
      contextReference: 'REL-FUL-72',
    },
  });
  const html = renderApp(selectViewModel(state));

  assert.match(html, /data-testid="release-context-strip"/);
  assert.match(html, /REL-FUL-72/);
  assert.match(html, /阻断范围/);
  assert.doesNotMatch(html, /data-action="INPUT_CONFIRMED"|data-action="SCOPE_ACCEPTED"/);
  assert.equal((html.match(/data-action="PLAN_CONFIRMED"/g) ?? []).length, 1);
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
  state = dispatch(state, 'PLAN_CONFIRMED');
  return state;
}

test('report echoes selected context and offers a quiet editable personal save', () => {
  const state = completedFulfillmentReport();
  const html = renderApp(selectViewModel(state));

  assert.match(html, /data-testid="selected-context-results"/);
  assert.match(html, /本次选择的巡检结果/);
  assert.match(html, /AI 解读/);
  assert.doesNotMatch(html, /模型风险总结/);
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
  const reportTime = formatReportTime(state.library.runs[0].completedAt);

  assert.match(html, /data-testid="saved-inspection-history"/);
  assert.match(html, /运行历史/);
  assert.match(html, /历史快照/);
  assert.match(html, /不可修改/);
  assert.match(html, /data-testid="report-metadata"[\s\S]*?履约发布后巡检/);
  assert.match(html, /data-testid="evidence-dashboard"/);
  assert.match(html, /data-testid="report-checks"/);
  assert.match(html, /data-testid="ai-interpretation"/);
  assert.ok(html.split(reportTime).length - 1 >= 2);
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
