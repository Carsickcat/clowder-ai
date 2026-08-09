import assert from "node:assert/strict";
import test from "node:test";

import { createDemoSession, demoReducer } from "../lib/reducer.mjs";
import { selectViewModel } from "../lib/selectors.mjs";
import { renderApp } from "../src/render.mjs";

function dispatch(state, type, payload = {}) {
  return demoReducer(state, { type, ...payload });
}

function paymentState() {
  let state = createDemoSession();
  state = dispatch(state, "INTENT_SUBMITTED", {
    request: {
      prompt: "调整 payment-api Redis 超时，帮我生成巡检计划。",
      targetService: "payment-api",
      contextReference: "CHG-84217",
    },
  });
  return state;
}

test("intake is a blank user-driven product entry, not fixed journey navigation", () => {
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

test("electronic-flow plan exposes reconciliation and blocks unresolved candidate", () => {
  let state = paymentState();
  state = dispatch(state, "INPUT_CONFIRMED");
  state = dispatch(state, "SCOPE_ACCEPTED");
  const html = renderApp(selectViewModel(state));

  assert.match(html, /Observed-Superset/);
  assert.match(html, /invoice-worker/);
  assert.match(html, /settlement-db/);
  assert.match(html, /数据库连接等待/);
  assert.match(html, /待处置/);
  assert.match(
    html,
    /data-testid="plan-stat-required"[\s\S]*?<strong>3<\/strong>/,
  );
  assert.match(
    html,
    /data-testid="plan-stat-recommended"[\s\S]*?<strong>0<\/strong>/,
  );
  assert.match(
    html,
    /data-testid="plan-stat-pending"[\s\S]*?<strong>1<\/strong>/,
  );
  assert.match(html, /data-action="PLAN_CONFIRMED"[^>]+disabled/);
});

test("accepted candidate becomes a formal check and unlocks confirmation", () => {
  let state = paymentState();
  state = dispatch(state, "INPUT_CONFIRMED");
  state = dispatch(state, "SCOPE_ACCEPTED");
  state = dispatch(state, "CANDIDATE_DISPOSED", {
    candidateId: "candidate-db-wait",
    disposition: "accepted",
  });
  const html = renderApp(selectViewModel(state));

  assert.match(html, /已纳入正式计划/);
  assert.match(html, /db\.pool\.wait_p95/);
  assert.match(
    html,
    /data-testid="plan-stat-recommended"[\s\S]*?<strong>1<\/strong>/,
  );
  assert.match(
    html,
    /data-testid="plan-stat-pending"[\s\S]*?<strong>0<\/strong>/,
  );
  assert.match(html, /<details[^>]+class="check-card[^>]*>/);
  assert.match(html, /来源与判定依据/);
  assert.match(html, /CHG-84217/);
  assert.match(html, /Observed-Superset/);
  assert.doesNotMatch(
    html,
    /data-action="PLAN_CONFIRMED"[^>]+disabled/,
  );
});

test("scope presents business, metric, trace, and middleware impact dimensions together", () => {
  let state = paymentState();
  state = dispatch(state, "INPUT_CONFIRMED");
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

test("risk report leads with action while preserving evidence semantics", () => {
  let state = paymentState();
  state = dispatch(state, "INPUT_CONFIRMED");
  state = dispatch(state, "SCOPE_ACCEPTED");
  state = dispatch(state, "CANDIDATE_DISPOSED", {
    candidateId: "candidate-db-wait",
    disposition: "accepted",
  });
  state = dispatch(state, "PLAN_CONFIRMED");
  for (let index = 0; index < 4; index += 1) {
    state = dispatch(state, "EXECUTION_ADVANCED");
  }
  const html = renderApp(selectViewModel(state));

  assert.match(html, /建议暂停在 25% 灰度/);
  assert.match(html, /证据结论/);
  assert.match(html, /Violated/);
  assert.match(html, /行动决策/);
  assert.match(html, /Pause/);
  assert.match(html, /启动 RC Agent/);
});
