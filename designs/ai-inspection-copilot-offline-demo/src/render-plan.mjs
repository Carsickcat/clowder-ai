import { formatCheckRules, formatMetricRule } from '../lib/metric-catalog.mjs';
import { escapeHtml } from './view-utils.mjs';

function renderMetricList(metricRules = []) {
  return `<ul class="metric-name-list">${metricRules
    .map(
      (rule) =>
        `<li><strong>${escapeHtml(rule.label)}</strong><code>${escapeHtml(rule.metricId)}</code><span>${escapeHtml(rule.category)}</span></li>`,
    )
    .join('')}</ul>`;
}

function renderRuleEditor(check, rule) {
  if (!rule.editable) {
    return `<article class="metric-rule-row is-readonly"><div><strong>${escapeHtml(rule.label)}</strong><code>${escapeHtml(rule.metricId)}</code></div><span>${escapeHtml(formatMetricRule(rule))}</span><small>固定规则</small></article>`;
  }
  const operators = rule.allowedOperators
    .map(
      (operator) =>
        `<option value="${escapeHtml(operator)}" ${operator === rule.operator ? 'selected' : ''}>${escapeHtml(operator)}</option>`,
    )
    .join('');
  return `<form class="metric-rule-row rule-editor" data-rule-editor data-rule-check-id="${escapeHtml(check.id)}" data-rule-id="${escapeHtml(rule.id)}">
    <div><strong>${escapeHtml(rule.label)}</strong><code>${escapeHtml(rule.metricId)}</code><small>${escapeHtml(rule.category)}</small></div>
    <label><span>比较</span><select name="rule-operator" aria-label="${escapeHtml(rule.label)}比较符">${operators}</select></label>
    <label><span>门禁值</span><input name="rule-threshold" type="number" step="any" value="${escapeHtml(rule.threshold)}" aria-label="${escapeHtml(rule.label)}门禁值"><b>${escapeHtml(rule.unit)}</b></label>
    <button type="submit">应用</button>
  </form>`;
}

function renderCandidate(candidate, disposition) {
  const accepted = disposition?.status === 'accepted';
  const rejected = disposition?.status === 'rejected';
  const optional = candidate.criticality !== 'high' && !accepted && !rejected;
  const status = accepted ? '✓ 已加查' : rejected ? '— 不查' : optional ? '可选' : '待你选择';
  return `
    <article class="candidate-card ${accepted ? 'is-accepted' : ''} ${rejected ? 'is-rejected' : ''} ${optional ? 'is-optional' : ''}">
      <header><span>AI 建议</span><strong class="candidate-result">${status}</strong></header>
      <h4>${escapeHtml(candidate.purpose)}</h4>
      <p><span>为什么建议查</span>${escapeHtml(candidate.rationale)}</p>
      <details class="candidate-details">
        <summary>查看细节</summary>
        <dl>
          <div><dt>黄金指标</dt><dd>${renderMetricList(candidate.metricRules)}</dd></div>
          <div><dt>目标实体</dt><dd>${escapeHtml(candidate.entity)}</dd></div>
        </dl>
      </details>
      <div class="candidate-actions">
        <button class="${accepted ? 'is-selected' : ''}" data-action="CANDIDATE_DISPOSED" data-candidate-id="${candidate.id}" data-disposition="accepted" aria-pressed="${accepted}" type="button">加查</button>
        <button class="button-ghost ${rejected ? 'is-selected' : ''}" data-action="CANDIDATE_DISPOSED" data-candidate-id="${candidate.id}" data-disposition="rejected" data-reason="专家确认该风险不属于本次变更边界" aria-pressed="${rejected}" type="button">不查</button>
      </div>
      ${rejected ? `<small class="candidate-reason">已记录原因：${escapeHtml(disposition.reason)}</small>` : ''}
    </article>`;
}

function renderSourceRefs(check, contextSources) {
  const sourceById = new Map(contextSources.map((source) => [source.id, source]));
  return check.sourceRefs
    .map((sourceId) => {
      const source = sourceById.get(sourceId);
      return `<li><span>${escapeHtml(source?.kind ?? '未知来源')}</span><strong>${escapeHtml(source?.label ?? sourceId)}</strong></li>`;
    })
    .join('');
}

function renderCheck(check, isCandidate, contextSources) {
  const summary = `${check.purpose} · ${check.entity}`;
  return `
    <details class="check-card ${isCandidate ? 'is-candidate-check' : ''}">
      <summary>
        <span class="check-summary-line" title="${escapeHtml(summary)}"><strong>${escapeHtml(check.purpose)}</strong><span> · ${escapeHtml(check.entity)}</span></span>
        <span class="check-toggle">查看细节⌄</span>
      </summary>
      <div class="check-body">
        <div class="check-rationale"><span>检查依据</span><p>${escapeHtml(check.rationale)}</p></div>
        <dl>
          <div><dt>目标实体</dt><dd>${escapeHtml(check.entity)}</dd></div>
          <div><dt>业务黄金指标</dt><dd>${renderMetricList(check.metricRules)}</dd></div>
          <div><dt>执行能力</dt><dd>${escapeHtml(check.capability)} <small>由已注册能力提供，不可在草案中修改</small></dd></div>
          <div class="check-rule-editor"><dt>判定规则</dt><dd><p class="rule-summary">${escapeHtml(formatCheckRules(check))}</p>${check.metricRules
            .map((rule) => renderRuleEditor(check, rule))
            .join('')}</dd></div>
          <div><dt>时间与基线</dt><dd>${escapeHtml(check.window)} · ${escapeHtml(check.baseline)}</dd></div>
          <div><dt>失败动作</dt><dd>${escapeHtml(check.failureAction)}</dd></div>
          <div class="check-sources"><dt>事实来源</dt><dd><ul>${renderSourceRefs(check, contextSources)}</ul></dd></div>
        </dl>
      </div>
    </details>`;
}

function renderPlanSummary(committedCount, planSummary) {
  let pendingCopy = '无需额外确认';
  if (planSummary.requiredPending) {
    pendingCopy = `另有 ${planSummary.requiredPending} 项 AI 建议需要你确认${
      planSummary.optionalPending ? `，${planSummary.optionalPending} 项可选` : ''
    }`;
  } else if (planSummary.optionalPending) {
    pendingCopy = `另有 ${planSummary.optionalPending} 项 AI 可选建议`;
  }
  return `<p class="plan-summary" data-testid="plan-summary">本次将执行 ${committedCount} 项检查，${pendingCopy}</p>`;
}

function renderPlanAction(readiness, committedCount) {
  const ready = readiness.status === 'ready';
  const label = ready
    ? `确认并执行 ${committedCount} 项检查`
    : readiness.unresolvedCandidateIds.length
      ? '请先处理上方的建议项'
      : readiness.reconciliationBlocked
        ? '请先完成范围对账'
        : '暂时无法开始巡检';
  return `<button class="primary-action plan-primary-action" data-action="PLAN_CONFIRMED" ${ready ? '' : 'disabled'} type="button"><span>${label}</span><b>→</b></button>`;
}

function renderReadinessLabel(readiness) {
  if (readiness.status === 'ready') return '可以开始';
  if (readiness.unresolvedCandidateIds.length) return '有建议待确认';
  if (readiness.reconciliationBlocked) return '范围待确认';
  return '暂不可开始';
}

function sortChecks(checks) {
  const rank = { required: 0, recommended: 1 };
  return checks
    .map((check, index) => ({ check, index }))
    .sort(
      (left, right) => (rank[left.check.priority] ?? 2) - (rank[right.check.priority] ?? 2) || left.index - right.index,
    )
    .map(({ check }) => check);
}

export function renderInspectionPlan(vm) {
  const disposition = vm.state.candidateDisposition;
  const candidates = vm.workspace.candidateChecks
    .map((candidate) => renderCandidate(candidate, disposition[candidate.id]))
    .join('');
  const acceptedIds = new Set(
    Object.entries(disposition)
      .filter(([, item]) => item.status === 'accepted')
      .map(([id]) => id),
  );
  const candidateSectionTitle = vm.planSummary.requiredPending
    ? '需要你确认'
    : vm.planSummary.optionalPending
      ? '可选建议'
      : '已处理的 AI 建议';
  const candidateSectionClass = vm.planSummary.requiredPending ? '' : ' is-optional';
  const candidateSection = candidates
    ? `<section class="plan-section plan-confirmation${candidateSectionClass}" aria-labelledby="pending-title">
        <h3 id="pending-title">${candidateSectionTitle}</h3>
        <div class="candidate-stack">${candidates}</div>
      </section>`
    : '';
  return `
    <div class="plan-stage" data-testid="inspection-plan">
      <header class="stage-heading">
        <div><h2 data-stage-title>巡检任务</h2></div>
        <span class="readiness ${vm.readiness.status}">${renderReadinessLabel(vm.readiness)}</span>
      </header>
      ${renderPlanSummary(vm.committedChecks.length, vm.planSummary)}
      <p class="parallel-execution-note">所有已选检查无先后依赖，确认后将并行执行并直接生成报告。</p>
      ${candidateSection}
      <section class="plan-section" aria-labelledby="formal-title">
        <h3 id="formal-title">将执行的检查</h3>
        <div class="check-stack">
          ${sortChecks(vm.committedChecks)
            .map((check) => renderCheck(check, acceptedIds.has(check.id), vm.workspace.contextSources))
            .join('')}
        </div>
      </section>
      ${renderPlanAction(vm.readiness, vm.committedChecks.length)}
    </div>`;
}
