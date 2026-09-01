import assert from 'node:assert/strict';
import test from 'node:test';

import { compileInspectionRequest, inspectionExamples } from '../lib/compiler.mjs';

test('examples are editable request starters rather than product modes', () => {
  assert.equal(inspectionExamples.length, 2);
  for (const example of inspectionExamples) {
    assert.ok(example.prompt);
    assert.ok(example.contextReference);
    assert.equal(Object.hasOwn(example, 'workspaceId'), false);
  }
});

test('an arbitrary user request compiles a service-specific workspace', () => {
  const workspace = compileInspectionRequest({
    prompt: '升级 inventory-api v2.3.1，验证库存锁定和下游调用是否正常。',
    contextReference: 'REL-20260809-17',
  });

  assert.equal(workspace.declaredChange.entities[0], 'inventory-api');
  assert.equal(workspace.declaredChange.version, 'v2.3.1');
  assert.match(workspace.title, /inventory-api/);
  assert.match(workspace.prompt, /库存锁定/);
  assert.ok(workspace.contextSources.some((source) => source.label === 'REL-20260809-17'));
  assert.ok(workspace.committedChecks.some((check) => check.entity === 'inventory-api'));
});

test('a generic workspace contains no domain fixture residue', () => {
  const workspace = compileInspectionRequest({
    prompt: '升级 fulfillment-service v7.2.0，验证履约状态和下游调用。',
    targetService: 'fulfillment-service',
    contextReference: 'REL-FUL-72',
  });

  const serialized = JSON.stringify(workspace);
  assert.doesNotMatch(serialized, /order|payment|订单|支付/i);
  assert.match(serialized, /fulfillment-service/);
  assert.ok(workspace.committedChecks.every((check) => check.failureAction.includes('fulfillment-service')));
});

test('known high-risk context still compiles the risk fixture semantics', () => {
  const workspace = compileInspectionRequest({
    prompt: '调整 payment-api Redis 超时，帮我生成巡检计划。',
    contextReference: 'CHG-84501',
  });

  assert.equal(workspace.reconciliation.status, 'Observed-Superset');
  assert.ok(workspace.candidateChecks.some((check) => check.criticality === 'high'));
  assert.equal(workspace.report.action, 'Pause');
  assert.equal(workspace.eyebrow, 'User-defined inspection workspace');
  assert.equal(workspace.title, 'payment-api 巡检工作区');
  assert.deepEqual(workspace.blockingScope, ['payment-api']);
  assert.deepEqual(workspace.coverageGaps.map((gap) => gap.entity), ['invoice-worker', 'settlement-db']);
});

test('a known change reference can compile without a natural-language intent', () => {
  const workspace = compileInspectionRequest({ contextReference: 'CHG-84501' });

  assert.equal(workspace.request.targetService, 'payment-api');
  assert.equal(workspace.request.contextReference, 'CHG-84501');
  assert.match(workspace.request.prompt, /CHG-84501/);
  assert.deepEqual(workspace.blockingScope, ['payment-api']);
});
