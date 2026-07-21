import { deriveHealthState, LENSES } from './domain.mjs';

const lensNames = {
  metrics: '监控指标',
  alerts: '关联告警',
  logs: '日志模式',
  checks: '巡检检查',
  synthetics: '用户拨测',
};

const healthNames = {
  unhealthy: '异常',
  unknown: '未知',
  recovering: '恢复观察',
};

const workflowStatusNames = {
  not_started: '未开始',
  assigned: '已分派',
  in_progress: '进行中',
  running: '运行中',
  passed: '已通过',
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function activeEvent(state) {
  return state.events[state.activeEventId];
}

export function renderEventQueue(state) {
  return Object.values(state.events)
    .filter((event) => state.eventQueueFilter === 'all' || event.severity === state.eventQueueFilter)
    .map((event) => {
      const health = deriveHealthState(event);
      return `<button class="event-card ${event.id === state.activeEventId ? 'is-active' : ''}" data-event-id="${event.id}" type="button">
        <span class="event-card__top"><span class="status-dot status-dot--${event.severity}"></span><span class="event-card__id">${event.id}</span></span>
        <h3>${escapeHtml(event.title)}</h3>
        <p>${escapeHtml(event.subtitle)}</p>
        <span class="event-card__meta"><span>${healthNames[health]}</span><span>覆盖 ${event.coverage}%</span><span>${escapeHtml(event.freshness)}</span></span>
      </button>`;
    })
    .join('');
}

export function renderContext(state) {
  const event = activeEvent(state);
  const items = [
    ['Event', event.id],
    ['Service', event.context.service],
    ['Env', event.context.env],
    ['Time', event.context.timeRange],
    ['Change', event.context.change],
  ];
  return items
    .map(([key, value]) => `<span class="context-chip"><strong>${key}</strong>${escapeHtml(value)}</span>`)
    .join('');
}

export function renderIncidentHeader(state) {
  const event = activeEvent(state);
  const health = deriveHealthState(event);
  const pillClass =
    health === 'unknown' ? 'severity-pill--unknown' : health === 'recovering' ? 'severity-pill--recovering' : '';
  return `<div>
      <div class="incident-title-row"><span class="severity-pill ${pillClass}">${healthNames[health]}</span><span class="event-card__id">${event.id}</span></div>
      <h2>${escapeHtml(event.title)}</h2>
      <p>${escapeHtml(event.businessImpact)}</p>
    </div>
    <div class="incident-meta">
      <div class="incident-kpi"><span>证据覆盖</span><strong>${event.coverage}%</strong></div>
      <div class="incident-kpi"><span>数据新鲜度</span><strong>${escapeHtml(event.freshness)}</strong></div>
      <div class="incident-kpi"><span>已钉入</span><strong>${event.pinnedEvidenceIds.length}</strong></div>
    </div>`;
}

export function renderGuardrail(state) {
  const event = activeEvent(state);
  if (event.baselineState === 'drifted') {
    return {
      visible: true,
      html: `<strong>基线漂移门禁</strong><span>检查定义或拓扑版本已变化，趋势不可比较；重建基线前状态保持 unknown。</span>`,
    };
  }
  if (event.coverageState === 'unknown') {
    return {
      visible: true,
      html: `<strong>证据链中断</strong><span>覆盖率 ${event.coverage}% · 最近证据 ${escapeHtml(event.freshness)} 前；“没有异常数据”不能解释为健康。</span>`,
    };
  }
  if (event.coverage < 100) {
    return {
      visible: true,
      html: `<strong>存在证据缺口</strong><span>当前覆盖 ${event.coverage}%；移动端订单回调尚未纳入，结论必须保留这一限制。</span>`,
    };
  }
  return { visible: false, html: '' };
}

function workflowStage(event) {
  if (event.verification.status === 'passed' || event.verification.status === 'running') return 3;
  if (event.action.status !== 'not_started') return 2;
  if (event.finding.status === 'confirmed') return 1;
  return 0;
}

export function renderWorkflow(state) {
  const event = activeEvent(state);
  const stage = workflowStage(event);
  const steps = ['调查取证', '确认 Finding', '整改处置', '复验与报告'];
  return steps
    .map(
      (label, index) =>
        `<span class="workflow-step ${index === stage ? 'is-active' : ''} ${index < stage ? 'is-complete' : ''}" data-index="${index + 1}">${label}</span>`,
    )
    .join('');
}

export function renderTimeline(state) {
  return activeEvent(state)
    .timeline.map(
      (entry) => `<div class="timeline-item">
      <time>${escapeHtml(entry.time)}</time>
      <span class="timeline-node timeline-node--${entry.kind}"></span>
      <span class="timeline-copy"><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(entry.detail)}</span></span>
    </div>`,
    )
    .join('');
}

function findingAction(event) {
  if (event.verification.status === 'passed')
    return { label: '复验通过 · 已进入恢复观察', action: 'done', disabled: true };
  if (event.verification.status === 'running') return { label: '完成复验', action: 'complete_verification' };
  if (event.action.status === 'in_progress') return { label: '发起复验', action: 'start_verification' };
  if (event.action.status === 'assigned') return { label: '开始受控整改', action: 'start_action' };
  if (event.finding.status === 'confirmed' && !event.action.owner)
    return { label: '分派给 陈曦', action: 'assign_action' };
  if (event.finding.status === 'candidate' && event.finding.evidenceIds.length > 0)
    return { label: '人工确认 Finding', action: 'confirm_finding' };
  return { label: '先从下方钉入证据', action: 'none', disabled: true };
}

export function renderFinding(state) {
  const event = activeEvent(state);
  const action = findingAction(event);
  const confirmed = event.finding.status === 'confirmed';
  return `<div class="finding-label"><span>Finding</span><span class="finding-status ${confirmed ? 'finding-status--confirmed' : ''}">${confirmed ? '已确认' : '候选'}</span></div>
    <h3>${escapeHtml(event.finding.title)}</h3>
    <p class="finding-confidence">置信度：${escapeHtml(event.finding.confidence)}</p>
    <div class="finding-facts">
      <div class="finding-fact"><span>可核验证据</span><strong>${event.finding.evidenceIds.length} 条</strong></div>
      <div class="finding-fact"><span>Owner</span><strong>${escapeHtml(event.action.owner ?? '待分派')}</strong></div>
      <div class="finding-fact"><span>整改状态</span><strong>${workflowStatusNames[event.action.status]}</strong></div>
      <div class="finding-fact"><span>复验状态</span><strong>${workflowStatusNames[event.verification.status]}</strong></div>
    </div>
    <button class="primary-action" data-workflow-action="${action.action}" type="button" ${action.disabled ? 'disabled' : ''}>${action.label}</button>`;
}

export function renderLensTabs(state) {
  return LENSES.map(
    (lens) =>
      `<button class="lens-tab ${lens === state.activeLens ? 'is-active' : ''}" data-lens="${lens}" role="tab" aria-selected="${lens === state.activeLens}">${lensNames[lens]}</button>`,
  ).join('');
}

function metricChart(event) {
  const summary =
    event.id === 'HE-1042'
      ? ['错误率 · 发布前后', '8.7%']
      : event.id === 'HE-1045'
        ? ['一致性序列 · 当前版本', '不可比']
        : ['遥测摄入 · 相对正常', '39%'];
  return `<div class="signal-visual"><div class="signal-visual__head"><span>${summary[0]}</span><span class="metric-value">${summary[1]}</span></div>
    <svg class="chart" viewBox="0 0 360 120" preserveAspectRatio="none" aria-label="错误率趋势图">
      <path class="grid" d="M0 25H360M0 60H360M0 95H360"/><path class="baseline" d="M0 79 C70 74 120 81 180 76 S290 79 360 73 L360 96 L0 96Z"/>
      <path class="deploy" d="M168 5V108"/><path class="actual" d="M0 83 C50 80 100 85 145 79 C162 76 170 73 181 55 C200 24 215 17 235 32 C262 53 278 21 301 28 C323 34 339 20 360 13"/>
      <text x="174" y="115">rc3 deploy</text><text x="5" y="18">10%</text><text x="5" y="91">baseline</text>
    </svg></div>`;
}

function alternateVisual(lens, evidenceItems) {
  const top = evidenceItems[0];
  const values = {
    alerts: top?.id === 'alert-slo-01' ? '4 → 1' : '1',
    logs: top?.id === 'log-timeout-01' ? '842' : top?.id === 'gap-log-01' ? '23m' : 'v2.4',
    checks: top?.id === 'check-contract-01' ? '96%' : top?.id === 'gap-check-01' ? '61%' : '7 / 9',
    synthetics: top?.id === 'synthetic-checkout-01' ? '3 / 5' : '1 path',
  };
  const labels = {
    alerts: ['告警已归并', values.alerts, top?.detail],
    logs: ['异常日志模式', values.logs, top?.detail],
    checks: ['检查覆盖', values.checks, top?.detail],
    synthetics: ['用户旅程', values.synthetics, top?.detail],
  }[lens] ?? ['证据摘要', '—', top?.detail ?? ''];
  return `<div class="signal-visual signal-visual--summary"><div class="signal-visual__head"><span>${labels[0]}</span><span>${escapeHtml(top?.timestamp ?? '')}</span></div><div class="summary-number">${labels[1]}</div><p>${labels[2]}</p><div class="summary-bars"><i></i><i></i><i></i><i></i><i></i></div></div>`;
}

export function renderLensContent(state) {
  const event = activeEvent(state);
  const items = event.evidence[state.activeLens];
  const visual = state.activeLens === 'metrics' ? metricChart(event) : alternateVisual(state.activeLens, items);
  const rows = items
    .map((item) => {
      const pinned = event.pinnedEvidenceIds.includes(item.id);
      return `<article class="evidence-row">
      <span class="evidence-accent evidence-accent--${item.status}"></span>
      <span class="evidence-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span><small>${escapeHtml(item.timestamp)} · ${escapeHtml(item.source)}</small></span>
      <button class="pin-button ${pinned ? 'is-pinned' : ''}" data-evidence-id="${item.id}" type="button">${pinned ? '已钉入' : '钉入证据'}</button>
    </article>`;
    })
    .join('');
  return `<div class="lens-overview">${visual}<div class="evidence-list">${rows}</div></div>`;
}

export function renderAI(state) {
  const event = activeEvent(state);
  const unknown = deriveHealthState(event) === 'unknown';
  const copy = unknown
    ? {
        summary: '当前信息不足以产生健康结论。优先修复证据链或重建基线，再重新运行检查。',
        fact:
          event.coverageState === 'unknown'
            ? `仅 ${event.coverage}% 检查有返回，最近日志已过期。`
            : '检查定义与拓扑同时变化，历史序列失去可比性。',
        hypothesis: '当前异常更可能来自观测条件变化，而不是已被证明的业务故障。',
        gap: '缺少可比较基线或最新日志；本次调查必须保持 inconclusive。',
        action: '钉入断点证据，创建数据质量 Finding，并指定恢复后复验。',
      }
    : {
        summary: '变更、错误率、日志配置差异和对照拨测形成同一条因果候选链。仍需人工确认 Finding。',
        fact: '错误率在 rc3 灰度完成后 3 分 12 秒首次偏离；旧版本承载区域保持正常。',
        hypothesis: 'rc3 将连接池上限从 120 回退为 40，支付请求排队并触发超时。',
        gap: '移动端订单回调未覆盖；结论不可外推到全部结算渠道。',
        action: '钉入超时日志与配置审计，确认 Finding 后由 Owner 执行受控回滚。',
      };
  return `<section class="ai-summary"><p>${copy.summary}</p></section>
    <article class="ai-card"><div class="ai-card__label"><span>事实</span><span>01</span></div><p>${copy.fact}</p><div class="ai-source">来源：可复核遥测 / 变更记录</div></article>
    <article class="ai-card ai-card--hypothesis"><div class="ai-card__label"><span>推断</span><span>待确认</span></div><p>${copy.hypothesis}</p><div class="ai-source">状态：候选解释，不等于事实</div></article>
    <article class="ai-card ai-card--gap"><div class="ai-card__label"><span>证据缺口</span><span>门禁</span></div><p>${copy.gap}</p></article>
    <article class="ai-card ai-card--action"><div class="ai-card__label"><span>建议动作</span><span>需人工</span></div><p>${copy.action}</p><button class="ai-action-button" data-ai-action="pin_recommended" type="button">钉入推荐证据</button></article>
    <p class="ai-disclaimer">AI 只组织可检查的事实、假设和建议；生产动作、最终判定与权限仍由规则和人工负责。</p>`;
}

export function renderModuleNav(state) {
  document.querySelectorAll('[data-module]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.module === state.activeModule);
  });
}

export { activeEvent, lensNames };
