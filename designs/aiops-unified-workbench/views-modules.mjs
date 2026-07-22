import { badge, escapeHTML, icon, polylinePoints, statusLabel } from './view-utils.mjs';

function panelTitle(kicker, title, aside = '') {
  return `<header class="panel-title"><div><p>${kicker}</p><h2>${title}</h2></div>${aside}</header>`;
}

function renderMetrics(data, progress) {
  const width = 720;
  const markerX = 14 + (data.changeMarker.at / (data.series.length - 1)) * (width - 28);
  return `<section class="module-canvas metrics-canvas" data-module="metrics">
    <div class="metric-kpis">
      <article><span>SLO / ${escapeHTML(data.slo.name)}</span><strong>${escapeHTML(data.slo.current)}</strong><small>目标 ${escapeHTML(data.slo.target)}</small>${badge(data.slo.status)}</article>
      <article><span>ERROR BUDGET BURN</span><strong>${escapeHTML(data.slo.burnRate)}</strong><small>30 分钟窗口</small></article>
      <article><span>CHANGE CORRELATION</span><strong>+0:03:12</strong><small>变更后首次偏离</small></article>
    </div>
    <article class="viz-panel metric-chart">
      ${panelTitle('SLO & BASELINE', '发布前后、灰度组与对照组', '<div class="chart-legend"><span class="legend-current">当前</span><span class="legend-baseline">基线</span><span class="legend-control">对照</span></div>')}
      <div class="chart-wrap">
        <svg viewBox="0 0 720 190" preserveAspectRatio="none" aria-label="SLO 趋势图">
          <defs><linearGradient id="metricFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".34"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
          <g class="chart-grid"><path d="M14 35H706M14 80H706M14 125H706M14 170H706"/></g>
          <polyline class="line line--baseline" points="${polylinePoints(data.baseline)}"/>
          <polyline class="line line--control" points="${polylinePoints(data.comparison)}"/>
          <polygon class="area" points="14,176 ${polylinePoints(data.series)} 706,176"/>
          <polyline class="line line--current" points="${polylinePoints(data.series)}"/>
          <line class="change-line" x1="${markerX}" y1="10" x2="${markerX}" y2="180"/>
          <text class="change-label" x="${Math.min(markerX + 8, 565)}" y="22">${escapeHTML(data.changeMarker.label)}</text>
        </svg>
        <div class="chart-axis"><span>-30m</span><span>-20m</span><span>-10m</span><span>NOW</span></div>
      </div>
    </article>
    <article class="viz-panel topology-panel">
      ${panelTitle('SERVICE TOPOLOGY', '异常从哪里开始，沿哪条依赖扩散', '<span class="panel-hint">点击节点可继续深挖（演示态）</span>')}
      <div class="topology-flow">
        ${data.topology.map((node, index) => `<button type="button" data-focus-module="metrics" data-focus-id="${node.id}" class="topology-node topology-node--${node.state} ${progress.moduleSelections.metrics === node.id ? 'is-selected' : ''}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHTML(node.label)}</strong><small>${escapeHTML(node.latency)}</small>${badge(node.state)}</button>${index < data.topology.length - 1 ? '<i class="topology-edge">→</i>' : ''}`).join('')}
      </div>
    </article>
  </section>`;
}

function renderAlerts(data, progress) {
  return `<section class="module-canvas alerts-canvas" data-module="alerts">
    <div class="alert-collapse">
      <div><span>RAW SIGNALS</span><strong>${data.rawCount}</strong><small>原始告警</small></div><i>→</i>
      <div><span>CORRELATED</span><strong>${data.clusters.length}</strong><small>可处置告警簇</small></div><i>→</i>
      <div><span>PRIMARY EVENT</span><strong>1</strong><small>需要人工确认</small></div>
    </div>
    <div class="module-two-column">
      <article class="viz-panel cluster-list">
        ${panelTitle('CORRELATION QUEUE', 'AI 归并建议，人确认事件边界')}
        ${data.clusters.map((cluster) => `<button type="button" data-focus-module="alerts" data-focus-id="${cluster.id}" class="cluster-row ${(progress.moduleSelections.alerts ?? data.clusters[0].id) === cluster.id ? 'is-primary' : ''}"><span class="cluster-count">${cluster.count}</span><span><strong>${escapeHTML(cluster.title)}</strong><small>${escapeHTML(cluster.relation)}</small></span>${badge(cluster.severity.toLowerCase().replace('sev-', 'critical').replace('p1', 'critical').replace('p2', 'warning').replace('p3', 'neutral'), cluster.severity)}</button>`).join('')}
      </article>
      <div class="alert-side-stack">
        <article class="viz-panel impact-panel">
          ${panelTitle('BUSINESS IMPACT', '影响面不是告警数量')}
          <div class="impact-numbers"><span><strong>${escapeHTML(data.impact.sessions)}</strong><small>受影响会话</small></span><span><strong>${escapeHTML(data.impact.orders ?? data.impact.queries)}</strong><small>业务暴露</small></span></div>
        </article>
        <article class="viz-panel route-panel">
          ${panelTitle('OWNER ROUTING', '谁接手、多久响应、在哪协同')}
          ${data.routes.map((route) => `<div class="route-row"><span class="route-avatar">${escapeHTML(route.team.slice(0, 2).toUpperCase())}</span><span><strong>${escapeHTML(route.team)}</strong><small>${escapeHTML(route.channel)}</small></span><em>SLA ${escapeHTML(route.sla)}</em></div>`).join('')}
        </article>
      </div>
    </div>
  </section>`;
}

function facetGroup(label, values) {
  const max = Math.max(...Object.values(values));
  return `<div class="facet-group"><strong>${escapeHTML(label)}</strong>${Object.entries(values)
    .map(
      ([key, value]) =>
        `<div><span>${escapeHTML(key)}</span><i style="--bar:${Math.max(8, (value / max) * 100)}%"></i><em>${value}</em></div>`,
    )
    .join('')}</div>`;
}

function renderLogs(data, progress) {
  const operations = progress.moduleOperations.logs;
  return `<section class="module-canvas logs-canvas" data-module="logs">
    <div class="log-query ${operations.queryStatus === 'completed' ? 'is-complete' : ''}"><span>${icon('search')}</span><code>${escapeHTML(data.query)}</code><button type="button" data-run-log-query>${operations.queryStatus === 'completed' ? `${data.patterns.length} PATTERNS · ${operations.resultCount.toLocaleString()} EVENTS` : 'RUN QUERY'}</button></div>
    <div class="logs-layout">
      <article class="viz-panel pattern-panel">
        ${panelTitle('PATTERN CLUSTERS', '从成千上万条日志收敛到可比较模式', `<span class="panel-hint">${data.patterns.reduce((sum, item) => sum + item.count, 0).toLocaleString()} events</span>`)}
        <div class="pattern-table">
          <div class="pattern-table__head"><span>模式</span><span>数量</span><span>变化</span><span>首现</span></div>
          ${data.patterns.map((pattern) => `<button type="button" data-focus-module="logs" data-focus-id="${pattern.id}" class="pattern-row ${(progress.moduleSelections.logs ?? data.patterns[0].id) === pattern.id ? 'is-selected' : ''}"><span><i></i><strong>${escapeHTML(pattern.signature)}</strong><small>${escapeHTML(pattern.id)}</small></span><em>${pattern.count.toLocaleString()}</em><b>${escapeHTML(pattern.delta)}</b><time>${escapeHTML(pattern.firstSeen)}</time></button>`).join('')}
        </div>
      </article>
      <aside class="viz-panel facet-panel">
        ${panelTitle('PATTERN INSPECTOR', '异常集中在哪些维度')}
        ${Object.entries(data.facets)
          .map(([label, values]) => facetGroup(label, values))
          .join('')}
      </aside>
    </div>
    <article class="viz-panel log-samples">
      ${panelTitle('VERIFIABLE SAMPLES', '钉入证据包的原始样本')}
      ${data.samples
        .map((sample) => {
          const pinned = operations.pinnedSampleIds.includes(sample.id);
          return `<div class="log-line ${pinned ? 'is-pinned' : ''}"><time>${escapeHTML(sample.time)}</time><span class="log-level log-level--${sample.level.toLowerCase()}">${escapeHTML(sample.level)}</span><code>${escapeHTML(sample.text)}</code><button type="button" data-pin-log-sample="${escapeHTML(sample.id)}" ${pinned ? 'disabled' : ''}>${pinned ? 'PINNED' : 'PIN'}</button></div>`;
        })
        .join('')}
    </article>
  </section>`;
}

function renderChecks(data, progress) {
  const coverage = data.coverage;
  return `<section class="module-canvas checks-canvas" data-module="checks">
    <div class="checks-overview">
      <article class="coverage-ring-card">
        <div class="coverage-ring" style="--coverage:${coverage.percent * 3.6}deg"><span><strong>${coverage.percent}%</strong><small>证据覆盖</small></span></div>
        <div class="coverage-legend"><span class="passed"><i></i>${coverage.passed} 通过</span><span class="failed"><i></i>${coverage.failed} 失败</span><span class="unknown"><i></i>${coverage.unknown} 未知</span></div>
        ${coverage.unknown ? '<p class="coverage-warning">Unknown 不计入健康，必须进入待处置队列。</p>' : '<p class="coverage-good">所有检查均有新鲜证据。</p>'}
      </article>
      <article class="viz-panel check-definition-panel">
        ${panelTitle('CHECK DEFINITIONS', 'AI 生成候选，人审核后才能运行')}
        <div class="check-table">
          ${data.definitions.map((check) => `<button type="button" data-focus-module="checks" data-focus-id="${check.id}" class="check-row ${progress.moduleSelections.checks === check.id ? 'is-selected' : ''}"><span>${icon(check.source.startsWith('AI') ? 'spark' : 'shield')}</span><span><strong>${escapeHTML(check.name)}</strong><small>${escapeHTML(check.source)}</small></span><em>${escapeHTML(check.gate)}</em>${badge(check.state)}</button>`).join('')}
        </div>
      </article>
    </div>
    <div class="module-two-column">
      <article class="viz-panel run-timeline">
        ${panelTitle('RUN HISTORY', '每次执行都是不可改写的事实快照')}
        ${data.runs.map((run) => `<div class="run-row"><span></span><time>${escapeHTML(run.at)}</time><div><strong>${statusLabel(run.status)}</strong><small>${escapeHTML(run.summary)}</small></div>${badge(run.status)}</div>`).join('')}
      </article>
      <article class="viz-panel finding-list">
        ${panelTitle('FINDING → ACTION → VERIFICATION', '报告不是终点')}
        ${data.findings.map((finding) => `<div class="finding-row"><div><span>${escapeHTML(finding.id)}</span>${badge(finding.severity === 'blocker' ? 'critical' : finding.severity, finding.severity)}</div><strong>${escapeHTML(finding.title)}</strong><small>Owner · ${escapeHTML(finding.owner)}</small><em>${statusLabel(finding.status)}</em></div>`).join('')}
      </article>
    </div>
  </section>`;
}

function renderSynthetics(data, progress) {
  const maxDuration = Math.max(...data.steps.map((step) => step.duration), 1);
  return `<section class="module-canvas synthetics-canvas" data-module="synthetics">
    <div class="synthetic-summary"><span>${icon('radar')}</span><div><p>USER JOURNEY</p><h2>${escapeHTML(data.journey.name)}</h2><small>${escapeHTML(data.journey.device)}</small></div><em>Step ${data.journey.currentStep}/${data.steps.length}</em></div>
    <div class="region-grid">
      ${data.regions.map((region) => `<button type="button" data-focus-module="synthetics" data-focus-id="${region.name}" class="region-card ${(progress.moduleSelections.synthetics ?? data.regions[0].name) === region.name ? 'is-selected' : ''}"><span>${badge(region.status)}</span><strong>${escapeHTML(region.name)}</strong><small>${escapeHTML(region.version)}</small><div><em>${escapeHTML(region.success)}</em><b>${escapeHTML(region.p95)}</b></div></button>`).join('')}
    </div>
    <article class="viz-panel journey-steps-panel">
      ${panelTitle('STEP WATERFALL', '用户究竟在哪一步失败')}
      <div class="journey-steps">
        ${data.steps.map((step, index) => `<div class="journey-node journey-node--${step.status}"><span>${index + 1}</span><strong>${escapeHTML(step.name)}</strong><small>${step.duration ? `${step.duration} ms` : '无数据'}</small>${badge(step.status)}</div>${index < data.steps.length - 1 ? '<i>→</i>' : ''}`).join('')}
      </div>
      <div class="waterfall">
        ${data.steps.map((step) => `<div><span>${escapeHTML(step.name)}</span><i style="--width:${step.duration ? Math.max(8, (step.duration / maxDuration) * 100) : 2}%"></i><em>${step.duration ? `${step.duration} ms` : '—'}</em></div>`).join('')}
      </div>
    </article>
  </section>`;
}

function renderDecision(scenario, progress) {
  const blocked = progress.status === 'blocked';
  const selected = progress.decisionId;
  return `<section class="module-canvas decision-canvas" data-module="decision">
    <div class="decision-hero">
      <span>${icon('shield')}</span><div><p>HUMAN DECISION GATE</p><h2>${escapeHTML(scenario.decisionQuestion)}</h2><small>AI 不能替你签字，也不能绕过现有权限系统。</small></div>
    </div>
    ${blocked ? `<div class="decision-guardrail">${icon('lock')}<div><strong>决策被阻断</strong><p>${escapeHTML(progress.blockReason)}</p></div></div>` : ''}
    <div class="decision-layout">
      <article class="viz-panel decision-evidence">
        ${panelTitle('EVIDENCE PACKAGE', `${progress.evidencePackage.length} 项证据已锁定`)}
        <div>${progress.evidencePackage.map((id) => `<code>${escapeHTML(id)}</code>`).join('')}</div>
        <section><span>复验门槛</span><p>${escapeHTML(scenario.outcomeBlueprint.verificationGate)}</p></section>
      </article>
      <article class="viz-panel decision-options">
        ${panelTitle('YOUR DECISION', '选择一个可追责的下一步')}
        ${scenario.decisions.map((decision) => `<button type="button" class="decision-option decision-option--${decision.tone} ${selected === decision.id ? 'is-selected' : ''}" data-decision-id="${decision.id}"><span>${selected === decision.id ? icon('check') : ''}</span><strong>${escapeHTML(decision.label)}</strong><small>${decision.id}</small></button>`).join('')}
        <button class="primary-action decision-finish" type="button" data-finish-journey ${selected ? '' : 'disabled'}>确认并生成结果 ${icon('arrow')}</button>
      </article>
    </div>
  </section>`;
}

export function renderModule(module, scenario, progress) {
  if (module === 'decision') return renderDecision(scenario, progress);
  const data = scenario.datasets[module];
  if (!data) return `<section class="module-canvas empty-canvas">无可用数据</section>`;
  return {
    metrics: renderMetrics,
    alerts: renderAlerts,
    logs: renderLogs,
    checks: renderChecks,
    synthetics: renderSynthetics,
  }[module](data, progress);
}
