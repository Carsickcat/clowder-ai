import assert from 'node:assert/strict';
import test from 'node:test';

import { compileInspectionRequest } from '../lib/compiler.mjs';
import {
  inspectionPlaybooks,
  matchInspectionPlaybook,
  selectInspectionPlaybookDefinition,
} from '../lib/playbooks.mjs';

function compile(request) {
  return compileInspectionRequest(request);
}

test('unknown business scenario remains user-defined and has no playbook match', () => {
  const workspace = compile({
    prompt: '升级 fulfillment-service v7.2.0，验证履约状态和下游调用是否正常。',
    targetService: 'fulfillment-service',
    contextReference: 'REL-FUL-72',
  });

  assert.equal(matchInspectionPlaybook(workspace), null);
});

test('known order release produces an exact immutable match snapshot', () => {
  const workspace = compile({
    prompt: '今晚升级 order-api v4.8.0，帮我确认订单提交和支付链路有没有问题。',
    targetService: 'order-api',
  });
  const match = matchInspectionPlaybook(workspace);

  assert.equal(match.status, 'exact');
  assert.equal(match.playbookRef.id, 'order-release-verification');
  assert.equal(match.playbookRef.version, 4);
  assert.ok(match.score >= 95);
  assert.equal(match.differences.length, 0);
  assert.equal(match.validations.length, 5);
  assert.ok(match.validations.every((validation) => validation.status === 'passed'));
  assert.equal(Object.isFrozen(match), true);
  assert.equal(Object.isFrozen(match.validations), true);
  assert.equal(Object.hasOwn(match, 'evidence'), false);
  assert.equal(Object.hasOwn(match, 'historicalEvidence'), false);
});

test('catalog match rules, not hard-coded service branches, select the latest applicable version', () => {
  const workspace = compile({
    prompt: 'release order-api v4.8.0',
    targetService: 'order-api',
  });
  const revised = {
    ...inspectionPlaybooks[0],
    version: 5,
    matchRules: {
      targetServices: ['order-api'],
      promptSignals: ['release'],
    },
  };

  const selected = selectInspectionPlaybookDefinition(workspace, [...inspectionPlaybooks, revised]);

  assert.equal(selected.version, 5);
});

test('a known service without the catalog intent signals remains unmatched', () => {
  const workspace = compile({
    prompt: 'inspect order-api error rate',
    targetService: 'order-api',
  });

  assert.equal(matchInspectionPlaybook(workspace), null);
});

test('payment configuration change exposes current dependency and metric drift', () => {
  const workspace = compile({
    prompt: '调整 payment-api Redis 超时，帮我生成巡检计划。',
    targetService: 'payment-api',
    contextReference: 'CHG-84217',
  });
  const match = matchInspectionPlaybook(workspace);

  assert.equal(match.status, 'minor-drift');
  assert.equal(match.playbookRef.id, 'payment-config-verification');
  assert.equal(match.playbookRef.version, 3);
  assert.ok(match.score >= 80 && match.score < 95);
  assert.deepEqual(
    match.differences.map((difference) => difference.dimension),
    ['dependency', 'metric'],
  );
  assert.match(match.differences[0].summary, /settlement-db/);
  assert.match(match.differences[1].summary, /v2.*v3/);
});

test('service split makes the old payment playbook reference-only', () => {
  const workspace = compile({
    prompt: 'payment-api 拆分出 risk-api，重新验证支付确认链路。',
    targetService: 'payment-api',
    contextReference: 'CHG-84501',
  });
  const match = matchInspectionPlaybook(workspace);

  assert.equal(match.status, 'major-drift');
  assert.equal(match.playbookRef.id, 'payment-config-verification');
  assert.ok(match.score < 80);
  assert.ok(match.differences.some((difference) => difference.dimension === 'entity'));
  assert.ok(match.differences.some((difference) => difference.severity === 'blocking'));
});

test('approved playbook catalog is immutable and contains structure but no evidence payload', () => {
  assert.equal(Object.isFrozen(inspectionPlaybooks), true);
  assert.ok(inspectionPlaybooks.length >= 2);
  for (const playbook of inspectionPlaybooks) {
    assert.equal(Object.isFrozen(playbook), true);
    assert.equal(Object.isFrozen(playbook.matchRules), true);
    assert.equal(Object.isFrozen(playbook.matchRules.targetServices), true);
    assert.equal(Object.isFrozen(playbook.matchRules.promptSignals), true);
    assert.ok(playbook.checkIds.length > 0);
    assert.equal(Object.hasOwn(playbook, 'evidence'), false);
    assert.equal(Object.hasOwn(playbook, 'report'), false);
    assert.equal(Object.hasOwn(playbook, 'execution'), false);
  }
});
