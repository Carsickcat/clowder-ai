import { formatCheckRules } from '../lib/metric-catalog.mjs';
import { renderPlaybookProposal } from './render-playbook.mjs';
import { renderReportJourneyDetails, renderSelectedContextResults } from './render-saved-inspections.mjs';
import {
  formatReportMetadata,
  formatReportTime,
  projectInterpretation,
  projectReportChecks,
  projectReportEvidence,
  REPORT_STATUS_COPY,
} from './report-model.mjs';
import { renderTrendChart } from './report-trend.mjs';
import { escapeHtml } from './view-utils.mjs';

function renderReportMetadata(run, taskName) {
  return `<p class="report-metadata" data-testid="report-metadata">${escapeHtml(formatReportMetadata(run, taskName).line)}</p>`;
}

function renderDecisionHero(report, extra = '') {
  return `<div class="decision-hero">
    <div><h2>${escapeHtml(report.actionLabel)}</h2><p>${escapeHtml(report.title)}</p></div>
    ${extra}
  </div>`;
}

function renderEvidenceSummary(report) {
  return `<div class="semantic-pair">
      <div><span>证据结论</span><code>${escapeHtml(report.evidenceVerdict)}</code></div>
      <div><span>行动决策</span><code>${escapeHtml(report.action)}</code></div>
    </div>
    <div class="evidence-badges">
      <span class="verified">✓ ${report.evidenceCounts.verified} 已验证</span>
      <span class="violated">! ${report.evidenceCounts.violated} 违例</span>
      <span class="unresolved">? ${report.evidenceCounts.unresolved} 未决</span>
    </div>
    <p class="report-summary">${escapeHtml(report.summary)}</p>`;
}

function renderEvidenceCard(item) {
  const status = REPORT_STATUS_COPY[item.status] ?? REPORT_STATUS_COPY.NotEvaluated;
  const measurement =
    item.kind === 'numeric'
      ? `<div class="evidence-measurement"><strong>${escapeHtml(item.displayValue)}</strong><span>门禁 ${escapeHtml(item.gateDisplayValue)}</span></div>
        <div class="evidence-track" role="progressbar" aria-label="${escapeHtml(item.label)}相对门禁" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${item.ratioPercent}"><i style="--evidence-progress:${item.ratioPercent}%"></i></div>`
      : `<div class="evidence-qualitative"><strong>${escapeHtml(item.displayValue)}</strong><span>门禁 ${escapeHtml(item.gateDisplayValue)}</span></div>`;
  return `<article tabindex="-1" class="evidence-card is-${status.tone}" data-evidence-id="${escapeHtml(item.id)}" data-check-id="${escapeHtml(item.checkId ?? '')}">
    <header><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.entity)}</small></div><span>${status.symbol} ${status.label}</span></header>
    ${measurement}
    ${renderTrendChart(item)}
  </article>`;
}

function renderEvidenceDashboard(report) {
  return `<section class="report-section evidence-dashboard" data-testid="evidence-dashboard" aria-labelledby="evidence-title">
    <header class="report-section-heading"><div><h3 id="evidence-title">证据仪表盘</h3><p>违例与未决优先显示</p></div></header>
    <div class="evidence-grid">${projectReportEvidence(report).map(renderEvidenceCard).join('')}</div>
  </section>`;
}

function renderCheckResult(item) {
  const { check } = item;
  const status = REPORT_STATUS_COPY[item.status] ?? REPORT_STATUS_COPY.NotEvaluated;
  return `<details class="report-check-result is-${status.tone}" data-testid="report-check-result">
    <summary>
      <span class="report-check-status">${status.symbol} ${status.label}</span>
      <span class="report-check-name"><strong>${escapeHtml(check.purpose)}</strong><small>${escapeHtml(check.entity)}</small></span>
      <span class="report-check-value"><small>实际值</small><strong>${escapeHtml(item.actualDisplay)}</strong></span>
      <span class="report-check-gate"><small>门禁</small><strong>${escapeHtml(item.gateDisplay)}</strong></span>
      <span class="report-check-toggle">查看细节⌄</span>
    </summary>
    <div class="report-check-body">
      <p>${escapeHtml(item.summary)}</p>
      <dl>
        <div><dt>目标实体</dt><dd>${escapeHtml(check.entity)}</dd></div>
        <div><dt>业务黄金指标</dt><dd>${check.metricRules.map((rule) => `<code>${escapeHtml(rule.label)} · ${escapeHtml(rule.metricId)}</code>`).join(' ')}</dd></div>
        <div><dt>执行能力</dt><dd>${escapeHtml(check.capability)}</dd></div>
        <div><dt>判定规则</dt><dd>${escapeHtml(formatCheckRules(check))}</dd></div>
        <div><dt>时间与基线</dt><dd>${escapeHtml(check.window)} · ${escapeHtml(check.baseline)}</dd></div>
        <div><dt>失败动作</dt><dd>${escapeHtml(check.failureAction)}</dd></div>
        <div><dt>事实来源</dt><dd>${check.sourceRefs.map((source) => `<code>${escapeHtml(source)}</code>`).join(' ')}</dd></div>
      </dl>
    </div>
  </details>`;
}

function renderReportChecks(run, report) {
  return `<section class="report-section report-checks" data-testid="report-checks" aria-labelledby="report-checks-title">
    <header class="report-section-heading"><div><h3 id="report-checks-title">检查结果</h3><p>共 ${run?.inspectionPlan?.checks?.length ?? 0} 项已执行检查</p></div>
      <div class="evidence-badges"><span class="verified">✓ ${report.evidenceCounts.verified}</span><span class="violated">! ${report.evidenceCounts.violated}</span><span class="unresolved">? ${report.evidenceCounts.unresolved}</span></div>
    </header>
    <div class="report-check-list">${projectReportChecks(run).map(renderCheckResult).join('')}</div>
  </section>`;
}

function renderInterpretation(report) {
  const evidenceOrder = new Map(projectReportEvidence(report).map((item, index) => [item.id, index + 1]));
  return `<section class="report-section ai-interpretation" data-testid="ai-interpretation" aria-labelledby="interpretation-title">
    <header class="report-section-heading"><div><h3 id="interpretation-title">AI 解读</h3><p>只解释已锁定证据</p></div></header>
    <div class="interpretation-list">${projectInterpretation(report)
      .map(
        (section) =>
          `<article><span>${escapeHtml(section.label)}</span><p>${escapeHtml(section.text)}</p><footer>${
            section.evidenceIds.length
              ? section.evidenceIds
                  .map(
                    (id) =>
                      `<button type="button" data-evidence-target="${escapeHtml(id)}">证据 ${evidenceOrder.get(id) ?? '·'}</button>`,
                  )
                  .join('')
              : '<small>证据不足</small>'
          }</footer></article>`,
      )
      .join('')}</div>
  </section>`;
}

function renderBoundary(report) {
  return `<section class="report-section report-boundary"><div><h3>结论边界</h3><p>${escapeHtml(report.scopeStatement)}</p></div><div><h3>残余风险</h3><ul>${report.residualRisks.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div></section>`;
}

function renderReportCore(run, taskName, report) {
  return `${renderReportMetadata(run, taskName)}
    ${renderEvidenceSummary(report)}
    ${renderEvidenceDashboard(report)}
    ${renderReportChecks(run, report)}
    ${renderInterpretation(report)}
    ${renderBoundary(report)}`;
}

function comparisonText(item) {
  if (item.kind === 'added') return `新增覆盖：${item.after.label}`;
  if (item.kind === 'removed') return `移除覆盖：${item.before.label}`;
  return `${item.label}：${item.before.fact} → ${item.after.fact}`;
}

function renderRunComparison(comparison) {
  if (!comparison) return '';
  const heading = `与上次相比（${formatReportTime(comparison.previousCompletedAt)} → 本次）`;
  if (comparison.summary === 'stable') {
    return `<section class="run-comparison is-stable" data-testid="run-comparison"><h3>${escapeHtml(heading)}</h3><p>→ 与上次结论一致</p></section>`;
  }
  const labels = {
    improved: ['✓', '改善'],
    worsened: ['✕', '恶化'],
    stable: ['→', '持平'],
    added: ['+', '新增'],
    removed: ['−', '移除'],
  };
  return `<section class="run-comparison" data-testid="run-comparison"><h3>${escapeHtml(heading)}</h3><ul>${comparison.items
    .map((item) => {
      const [symbol, label] = labels[item.kind];
      return `<li class="is-${item.kind}"><span>${symbol}</span><div><strong>${label}</strong><p>${escapeHtml(comparisonText(item))}</p></div></li>`;
    })
    .join('')}</ul></section>`;
}

function renderShareControls(message) {
  return `<div class="report-share" aria-label="分享当前报告"><button data-share-action="copy" type="button">复制摘要</button><button data-share-action="export" type="button">导出报告</button>${message ? `<p class="share-toast" role="status">${escapeHtml(message)}</p>` : ''}</div>`;
}

export function renderHistoricalReportSnapshot(run, taskName = '巡检报告') {
  const report = run.report;
  return `<div class="historical-report report-stage ${report.action.toLowerCase()}" data-testid="historical-report">
    <p class="historical-banner">历史快照 · ${escapeHtml(formatReportTime(run.completedAt))} · 不可修改</p>
    ${renderDecisionHero(report)}
    ${renderReportCore(run, taskName, report)}
    ${renderSelectedContextResults(run)}
  </div>`;
}

export function renderCurrentReport(vm) {
  const report = vm.report;
  const run = vm.savedInspection.currentRun;
  const taskName =
    vm.savedInspection.reportDefinition?.name ?? `${vm.workspace?.declaredChange?.entities?.[0] ?? '服务'} 巡检`;
  return `<div class="report-stage ${report.action.toLowerCase()}" data-testid="final-report" data-current-run-id="${escapeHtml(run?.id ?? '')}">
    ${renderDecisionHero(report, renderShareControls(vm.state.shareToast))}
    ${renderRunComparison(vm.savedInspection.comparison)}
    ${renderReportCore(run, taskName, report)}
    ${renderReportJourneyDetails(vm)}
    ${renderPlaybookProposal(vm.playbook)}
    ${
      report.rcAgent
        ? `<button class="rc-button" data-action="RC_TOGGLED" type="button">${vm.state.rcExpanded ? '收起 RC Agent' : '启动 RC Agent'}</button>${
            vm.state.rcExpanded
              ? `<section class="rc-panel"><span>${escapeHtml(report.rcAgent.title)}</span><h3>${escapeHtml(report.rcAgent.rootCause)}</h3><div class="rc-chain">${report.rcAgent.chain.map((item) => `<code>${escapeHtml(item)}</code>`).join('<i>→</i>')}</div><p>${escapeHtml(report.rcAgent.recommendation)}</p></section>`
              : ''
          }`
        : ''
    }
  </div>`;
}
