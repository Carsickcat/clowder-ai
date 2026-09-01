import assert from 'node:assert/strict';
import test from 'node:test';

import { compileInspectionRequest } from '../lib/compiler.mjs';
import { formatReportMetadata, formatReportTime, projectReportEvidence } from '../src/report-model.mjs';
import { buildReportFilename, buildReportShareText, buildStandaloneReportHtml } from '../src/report-share.mjs';

const workspace = compileInspectionRequest({
  prompt: '巡检 fulfillment-service',
  targetService: 'fulfillment-service',
});

const run = {
  id: 'RUN-0048',
  taskInstanceId: 'INS-0049',
  startedAt: '2026-08-22T13:59:18.000Z',
  completedAt: '2026-08-22T14:00:00.000Z',
  inspectionPlan: {
    checkIds: workspace.committedChecks.map((check) => check.id),
    checks: workspace.committedChecks,
  },
  report: workspace.report,
};

test('copied report summary is exactly five readable lines', () => {
  const text = buildReportShareText(run, '履约发布后巡检');
  const lines = text.split('\n');

  assert.equal(lines.length, 5);
  assert.match(lines[0], /^结论：建议继续/);
  assert.equal(lines[1], `报告：${formatReportMetadata(run, '履约发布后巡检').line}`);
  assert.match(lines[2], /^关键证据：.+；.+/);
  assert.match(lines[3], /^AI 解读：/);
  assert.match(lines[4], /^结论边界：/);
});

test('report timestamps use one explicit timezone-bearing representation', () => {
  assert.equal(formatReportTime(run.completedAt), '2026-08-22 14:00 UTC');
  assert.equal(formatReportMetadata(run, '履约发布后巡检').completedAt, formatReportTime(run.completedAt));
});

test('exported report is one escaped self-contained offline HTML document', () => {
  const hostileName = '履约</title><script>alert(1)</script>巡检';
  const html = buildStandaloneReportHtml(run, hostileName);

  assert.match(html, /^<!doctype html>/i);
  assert.equal((html.match(/<!doctype html>/gi) ?? []).length, 1);
  assert.match(html, /履约&lt;\/title&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;巡检/);
  assert.match(html, /建议继续 fulfillment-service 发布/);
  assert.match(html, /履约&lt;\/title&gt;.*窗口 变更前 15 分钟 vs 变更后 15 分钟.*实例 INS-0049.*耗时 42s/s);
  assert.match(html, /证据仪表盘/);
  assert.match(html, /当前值 99\.82%/);
  assert.match(html, /AI 解读/);
  assert.match(html, /id="evidence-1"/);
  const evidenceLink = html.match(/href="#(evidence-\d+)"[^>]*>证据 \d+<\/a>/);
  assert.ok(evidenceLink);
  assert.match(html, new RegExp(`id="${evidenceLink[1]}"`));
  assert.match(html, /<style>[\s\S]+<\/style>/);
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<link/i);
});

test('report filename removes reserved characters and carries the run timestamp', () => {
  const filename = buildReportFilename(run, '履约/发布:巡检*?');
  assert.equal(filename, '履约-发布-巡检-20260822-1400.html');
});

test('structured evidence projection sorts violations first and caps numeric bars', () => {
  const risk = compileInspectionRequest({
    prompt: '调整 payment-api Redis 超时，帮我生成巡检计划。',
    targetService: 'payment-api',
    contextReference: 'CHG-84217',
  });
  const evidence = projectReportEvidence(risk.report);

  assert.equal(evidence[0].status, 'Violated');
  assert.equal(evidence[0].id, 'settlement-pool-utilization');
  assert.equal(evidence[0].ratioPercent, 100);
  assert.ok(evidence.some((item) => item.kind === 'qualitative' && item.ratioPercent === null));
});

test('each numeric evidence card derives status from its own locked gate inside a multi-rule check', () => {
  const evidence = projectReportEvidence({
    checkResults: [
      {
        checkId: 'cache-health',
        status: 'Violated',
        summary: '缓存命令延迟触及门禁',
        measurements: [
          {
            id: 'cache-hit-rate',
            metricId: 'redis.hit_rate',
            label: '缓存命中率',
            entity: 'cache',
            kind: 'numeric',
            value: 96.4,
            unit: '%',
            displayValue: '96.4%',
            gate: { operator: '>=', value: 94.4, unit: '%', displayValue: '>= 94.4%' },
          },
          {
            id: 'cache-command-latency',
            metricId: 'redis.command_latency',
            label: '缓存命令延迟',
            entity: 'cache',
            kind: 'numeric',
            value: 3.8,
            unit: 'ms',
            displayValue: '3.8ms',
            gate: { operator: '<=', value: 3, unit: 'ms', displayValue: '<= 3ms' },
          },
        ],
      },
    ],
  });

  assert.deepEqual(
    evidence.map(({ id, status }) => ({ id, status })),
    [
      { id: 'cache-command-latency', status: 'Violated' },
      { id: 'cache-hit-rate', status: 'Verified' },
    ],
  );
});

test('zero-valued numeric gates keep a valid progress representation', () => {
  const evidence = projectReportEvidence({
    checkResults: [
      {
        checkId: 'zero-error-budget',
        status: 'Violated',
        summary: '检测到错误',
        measurements: [
          {
            id: 'error-count',
            label: '错误数',
            entity: 'fulfillment-service',
            kind: 'numeric',
            value: 3,
            unit: '次',
            displayValue: '3 次',
            gate: { value: 0, unit: '次', operator: '<=', displayValue: '<= 0 次' },
          },
        ],
      },
    ],
  });

  assert.equal(evidence[0].ratioPercent, 100);
});
