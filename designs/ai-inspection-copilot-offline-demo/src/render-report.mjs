import { renderPlaybookProposal } from './render-playbook.mjs';
import { renderReportJourneyDetails, renderSelectedContextResults } from './render-saved-inspections.mjs';
import { escapeHtml } from './view-utils.mjs';

function formatReportTime(value) {
  if (!value) return '时间未知';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function renderDecisionHero(report, extra = '') {
  return `<div class="decision-hero">
    <div><h2>${escapeHtml(report.actionLabel)}</h2><p>${escapeHtml(report.title)}</p></div>
    ${extra}
  </div>`;
}

function renderReportEvidence(report) {
  return `<div class="semantic-pair">
      <div><span>证据结论</span><code>${escapeHtml(report.evidenceVerdict)}</code></div>
      <div><span>行动决策</span><code>${escapeHtml(report.action)}</code></div>
    </div>
    <div class="evidence-badges">
      <span class="verified">✓ ${report.evidenceCounts.verified} 已验证</span>
      <span class="violated">! ${report.evidenceCounts.violated} 违例</span>
      <span class="unresolved">? ${report.evidenceCounts.unresolved} 未决</span>
    </div>
    <p class="report-summary single-line-note" title="${escapeHtml(report.summary)}">${escapeHtml(report.summary)}</p>
    <div class="report-columns">
      <section><h3>关键证据</h3><ul>${report.keyEvidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>
      <section><h3>结论边界</h3><p>${escapeHtml(report.scopeStatement)}</p><h3>残余风险</h3><ul>${report.residualRisks.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>
    </div>`;
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
  return `<section class="run-comparison" data-testid="run-comparison">
    <h3>${escapeHtml(heading)}</h3>
    <ul>${comparison.items
      .map((item) => {
        const [symbol, label] = labels[item.kind];
        return `<li class="is-${item.kind}"><span>${symbol}</span><div><strong>${label}</strong><p>${escapeHtml(comparisonText(item))}</p></div></li>`;
      })
      .join('')}</ul>
  </section>`;
}

function renderShareControls(message) {
  return `<div class="report-share" aria-label="分享当前报告">
    <button data-share-action="copy" type="button">复制摘要</button>
    <button data-share-action="export" type="button">导出报告</button>
    ${message ? `<p class="share-toast" role="status">${escapeHtml(message)}</p>` : ''}
  </div>`;
}

export function renderHistoricalReportSnapshot(run) {
  const report = run.report;
  return `<div class="historical-report report-stage ${report.action.toLowerCase()}" data-testid="historical-report">
    <p class="historical-banner">历史快照 · ${escapeHtml(formatReportTime(run.completedAt))} · 不可修改</p>
    ${renderDecisionHero(report)}
    ${renderReportEvidence(report)}
    ${renderSelectedContextResults(run)}
  </div>`;
}

export function renderCurrentReport(vm) {
  const report = vm.report;
  return `<div class="report-stage ${report.action.toLowerCase()}" data-testid="final-report" data-current-run-id="${escapeHtml(vm.savedInspection.currentRun?.id ?? '')}">
    ${renderDecisionHero(report, renderShareControls(vm.state.shareToast))}
    ${renderRunComparison(vm.savedInspection.comparison)}
    ${renderReportEvidence(report)}
    ${renderReportJourneyDetails(vm)}
    ${renderPlaybookProposal(vm.playbook)}
    ${
      report.rcAgent
        ? `<button class="rc-button" data-action="RC_TOGGLED" type="button">${vm.state.rcExpanded ? '收起 RC Agent' : '启动 RC Agent'}</button>
          ${
            vm.state.rcExpanded
              ? `<section class="rc-panel"><span>${escapeHtml(report.rcAgent.title)}</span><h3>${escapeHtml(report.rcAgent.rootCause)}</h3><div class="rc-chain">${report.rcAgent.chain.map((item) => `<code>${escapeHtml(item)}</code>`).join('<i>→</i>')}</div><p>${escapeHtml(report.rcAgent.recommendation)}</p></section>`
              : ''
          }`
        : ''
    }
  </div>`;
}
