import { badge, escapeHTML, icon, statusLabel } from './view-utils.mjs';

const capabilities = [
  ['Observe', '感知', '指标 · 日志 · 告警 · 拨测'],
  ['Contextualize', '定界', '服务 · 拓扑 · 变更 · Owner'],
  ['Detect', '发现', '规则 · 基线 · 异常 · 覆盖'],
  ['Correlate', '归并', '时间 · 依赖 · 版本 · 用户影响'],
  ['Investigate', '调查', '证据 · 假设 · 反证 · 缺口'],
  ['Decide', '决策', 'Finding · 风险 · 人工确认'],
  ['Act', '治理', 'Owner · Runbook · SLA · 审批'],
  ['Verify', '复验学习', '重跑 · 报告 · 反馈 · 基线'],
];

const modules = [
  ['metrics', '监控', '是否偏离 SLO 与基线？', 'pulse'],
  ['alerts', '告警', '哪些信号属于同一事件？', 'bell'],
  ['logs', '日志', '哪个模式能解释异常？', 'lines'],
  ['checks', '巡检', '覆盖是否足够且可治理？', 'check'],
  ['synthetics', '拨测', '用户究竟在哪一步失败？', 'radar'],
];

function productHeader({ compact = false } = {}) {
  return `<header class="product-header ${compact ? 'product-header--compact' : ''}">
    <button class="brand" type="button" data-go-home aria-label="返回 NOVA Ops 首页">
      <span class="brand__mark">N</span><span><strong>NOVA Ops</strong><small>AI OPERATIONS WORKBENCH</small></span>
    </button>
    <div class="product-header__meta">
      <span class="live-dot"><i></i>LIVE DATA · MOCK</span>
      <span class="operator-chip">${icon('user')} 林澈 · On-call</span>
    </div>
  </header>`;
}

function progressSummary(state) {
  const completed = Object.values(state.scenarioProgress).filter((item) => item.status === 'completed').length;
  return `<div class="home-status">
    <div><span class="home-status__label">TODAY / 09:42</span><strong>3</strong><small>项需要人工决策</small></div>
    <div><span class="home-status__label">EVIDENCE GAPS</span><strong class="text-amber">2</strong><small>项未知不得标绿</small></div>
    <div><span class="home-status__label">JOURNEYS PROVEN</span><strong>${completed}/3</strong><small>条场景已完成演示</small></div>
  </div>`;
}

function scenarioCard(scenario, progress) {
  const started = progress.status !== 'not_started';
  return `<article class="scenario-card scenario-card--${scenario.accent}">
    <div class="scenario-card__top"><span class="scenario-card__number">${scenario.number}</span>${badge(progress.status)}</div>
    <p class="scenario-card__role">FOR ${escapeHTML(scenario.role).toUpperCase()}</p>
    <h2>${escapeHTML(scenario.title)}</h2>
    <p class="scenario-card__trigger">${escapeHTML(scenario.trigger)}</p>
    <div class="scenario-card__question"><span>要做的判断</span><strong>${escapeHTML(scenario.decisionQuestion)}</strong></div>
    <p class="scenario-card__value">${icon('spark')} ${escapeHTML(scenario.valuePromise)}</p>
    <button class="scenario-card__action" type="button" data-scenario-id="${scenario.id}">
      ${started ? '重新进入旅程' : '开始这条旅程'} ${icon('arrow')}
    </button>
  </article>`;
}

export function renderHome(state) {
  const cards = state.scenarioOrder.map((id) => scenarioCard(state.scenarios[id], state.scenarioProgress[id])).join('');
  return `<div class="home-shell">
    ${productHeader()}
    <main class="home-main">
      <section class="home-hero">
        <div class="home-hero__copy">
          <p class="eyebrow"><span>AI OPERATIONS</span> · EVIDENCE BEFORE ANSWERS</p>
          <h1>不是看见更多信号，<br /><em>而是更快做出可信决策。</em></h1>
          <p>把监控、告警、日志、巡检与拨测组织成三条真实工作旅程。AI 负责归并、解释和补缺，人负责最终判断与生产动作。</p>
          <button class="outline-action" type="button" data-toggle-capabilities>${icon('layers')} 查看系统原子能力</button>
        </div>
        ${progressSummary(state)}
      </section>

      <section class="capability-map ${state.capabilityMapOpen ? 'is-open' : ''}" aria-label="AI 运维原子能力地图">
        <div class="section-kicker"><span>01</span><div><p>PRODUCT ANATOMY</p><h2>八项原子能力，一条责任清晰的链</h2></div></div>
        <div class="capability-chain">
          ${capabilities.map(([en, zh, detail], index) => `<div class="capability-node"><span>${String(index + 1).padStart(2, '0')}</span><strong>${en}</strong><em>${zh}</em><small>${detail}</small></div>`).join('')}
        </div>
        <div class="responsibility-line">
          <span><i class="dot dot--fact"></i><strong>规则 / 遥测</strong>提供事实</span>
          <span><i class="dot dot--ai"></i><strong>AI</strong>归并、解释、提出候选</span>
          <span><i class="dot dot--human"></i><strong>人</strong>确认、审批、承担责任</span>
        </div>
      </section>

      <section class="scenario-section">
        <div class="section-kicker"><span>02</span><div><p>ROLE-BASED JOURNEYS</p><h2>从“谁要做什么判断”进入系统</h2></div></div>
        <div class="scenario-grid">${cards}</div>
      </section>

      <section class="module-anatomy">
        <div class="section-kicker"><span>03</span><div><p>PROFESSIONAL MODULES</p><h2>统一上下文，不抹平专业工作面</h2></div></div>
        <div class="module-anatomy__grid">
          ${modules.map(([id, name, question, iconName]) => `<div class="module-anatomy__item"><span>${icon(iconName)}</span><div><strong>${name}</strong><small>${question}</small></div><em>${id.toUpperCase()}</em></div>`).join('')}
        </div>
      </section>
    </main>
  </div>`;
}

function journeyRail(state, scenario, progress) {
  const items = scenario.steps
    .map((step, index) => {
      const complete = progress.completedStepIds.includes(step.id);
      const active = index === state.activeStepIndex;
      const stateName = complete ? 'complete' : active ? 'active' : 'pending';
      return `<button class="journey-step is-${stateName}" type="button" data-step-index="${index}">
      <span class="journey-step__index">${complete ? icon('check') : String(index + 1).padStart(2, '0')}</span>
      <span><small>${escapeHTML(step.module.toUpperCase())}</small><strong>${escapeHTML(step.navLabel)}</strong></span>
      ${active ? '<i></i>' : ''}
    </button>`;
    })
    .join('');
  return `<aside class="journey-rail ${state.mobileJourneyOpen ? 'is-mobile-open' : ''}">
    <div class="journey-rail__header"><p>${escapeHTML(scenario.role)}</p><strong>${escapeHTML(scenario.roleName)}</strong><button type="button" data-toggle-mobile-journey>${icon('close')}</button></div>
    <div class="journey-rail__question"><span>本次要回答</span><strong>${escapeHTML(scenario.decisionQuestion)}</strong></div>
    <nav>${items}</nav>
    <div class="journey-rail__value"><span>旅程价值</span><p>${escapeHTML(scenario.valuePromise)}</p></div>
  </aside>`;
}

function contextStrip(scenario) {
  return `<section class="context-strip">
    <span class="context-strip__lock">${icon('lock')} CONTEXT LOCKED</span>
    <span><small>SERVICE</small><strong>${escapeHTML(scenario.context.service)}</strong></span>
    <span><small>ENVIRONMENT</small><strong>${escapeHTML(scenario.context.env)}</strong></span>
    <span><small>TIME WINDOW</small><strong>${escapeHTML(scenario.context.timeRange)}</strong></span>
    <span class="context-strip__change"><small>CHANGE / TRIGGER</small><strong>${escapeHTML(scenario.context.change)}</strong></span>
  </section>`;
}

function moduleNav(state) {
  return `<nav class="module-nav" aria-label="专业模块深链">
    ${modules.map(([id, name, , iconName]) => `<button type="button" data-module="${id}" class="${state.activeModule === id ? 'is-active' : ''}">${icon(iconName)}<span>${name}</span></button>`).join('')}
  </nav>`;
}

export function renderWorkbenchShell(state, content, aiContent) {
  const scenario = state.scenarios[state.activeScenarioId];
  const progress = state.scenarioProgress[state.activeScenarioId];
  return `<div class="workbench-shell workbench-shell--${scenario.accent}">
    ${productHeader({ compact: true })}
    ${contextStrip(scenario)}
    ${moduleNav(state)}
    <button class="mobile-journey-trigger" type="button" data-toggle-mobile-journey>${icon('grid')} 旅程 ${state.activeStepIndex + 1}/${scenario.steps.length}</button>
    <div class="workbench-layout">
      ${journeyRail(state, scenario, progress)}
      <main class="stage" id="stage">${content}</main>
      <aside class="ai-inspector ${state.aiPanelOpen ? 'is-open' : ''}" id="ai-inspector">${aiContent}</aside>
    </div>
    <button class="mobile-ai-trigger" type="button" data-toggle-ai>${icon('spark')} AI 调查员</button>
    <div class="mobile-backdrop" data-toggle-ai></div>
  </div>`;
}

export function renderStageHeader(state) {
  const scenario = state.scenarios[state.activeScenarioId];
  const step = scenario.steps[state.activeStepIndex];
  const progress = state.scenarioProgress[scenario.id];
  const complete = progress.completedStepIds.includes(step.id);
  return `<header class="stage-header">
    <div class="stage-header__meta"><span>JOURNEY ${scenario.number}</span><span>STEP ${String(state.activeStepIndex + 1).padStart(2, '0')} / ${String(scenario.steps.length).padStart(2, '0')}</span>${badge(complete ? 'completed' : 'active')}</div>
    <h1>${escapeHTML(step.title)}</h1>
    <p>${escapeHTML(step.intent)}</p>
    <div class="decision-contract">
      <div><span>${icon('spark')} AI 负责</span><p>${escapeHTML(step.aiContribution)}</p></div>
      <div><span>${icon('user')} 人必须决定</span><p>${escapeHTML(step.humanDecision)}</p></div>
    </div>
  </header>`;
}

export function renderStageAction(state) {
  const scenario = state.scenarios[state.activeScenarioId];
  const step = scenario.steps[state.activeStepIndex];
  const progress = state.scenarioProgress[scenario.id];
  const complete = progress.completedStepIds.includes(step.id);
  const evidence = progress.evidencePackage.length;
  if (complete)
    return `<footer class="stage-action stage-action--complete"><span>${icon('check')} 本步已完成 · 证据包 ${evidence} 项</span>${state.activeStepIndex === scenario.steps.length - 1 ? '<small>请在上方选择最终人工决策</small>' : '<small>旅程已进入下一步</small>'}</footer>`;
  return `<footer class="stage-action">
    <div><small>执行后系统状态变化</small><strong>完成「${escapeHTML(step.navLabel)}」并将 ${step.evidenceIds.length} 项证据写入旅程</strong></div>
    <button class="primary-action" type="button" data-complete-step="${escapeHTML(step.requiredAction)}">${escapeHTML(step.actionLabel)} ${icon('arrow')}</button>
  </footer>`;
}

export function renderDeepModuleHeader(state) {
  const module = modules.find(([id]) => id === state.activeModule);
  return `<header class="deep-module-header">
    <button type="button" data-return-to-journey>${icon('back')} 回到用户旅程</button>
    <div><p>PROFESSIONAL MODULE / ${module[0].toUpperCase()}</p><h1>${module[1]}专业工作面</h1><span>${module[2]}</span></div>
  </header>`;
}

export function renderOutcomeShell(scenario, progress) {
  const decision = scenario.decisions.find((item) => item.id === progress.outcome?.decision);
  const artifactLabels = {
    release_gate: '发布门禁决策包',
    incident_handoff: '事故处置交接包',
    governance_report: '健康治理报告',
  };
  return `<section class="journey-outcome">
    <div class="journey-outcome__seal">${icon('check')} JOURNEY COMPLETE</div>
    <p class="eyebrow">${scenario.role.toUpperCase()} · ${scenario.title}</p>
    <h1>${escapeHTML(decision?.label ?? progress.outcome?.decision)}</h1>
    <p>这不是 AI 自动结论，而是由 ${escapeHTML(progress.outcome.owner)} 基于 ${progress.outcome.evidencePackage.length} 项证据确认的人工决策。</p>
    <div class="outcome-grid">
      <article><span>输出物</span><strong>${artifactLabels[progress.outcome.artifactType] ?? statusLabel(progress.outcome.artifactType)}</strong><small>${escapeHTML(progress.outcome.artifactType)}</small></article>
      <article><span>复验门槛</span><strong>已锁定</strong><small>${escapeHTML(progress.outcome.verificationGate)}</small></article>
      <article><span>避免跨系统跳转</span><strong>${progress.outcome.value.manualJumpsAvoided} 次</strong><small>以本次旅程操作计数，不是行业 ROI</small></article>
      <article><span>形成结论</span><strong>${escapeHTML(progress.outcome.value.timeToConclusion)}</strong><small>${escapeHTML(progress.outcome.value.evidenceCoverage)}</small></article>
    </div>
    <div class="evidence-package"><span>证据包</span>${progress.outcome.evidencePackage.map((id) => `<code>${escapeHTML(id)}</code>`).join('')}</div>
    <div class="outcome-actions"><button class="outline-action" type="button" data-go-home>${icon('grid')} 返回场景首页</button><button class="primary-action" type="button" data-scenario-id="${scenario.id}">重新演示这条旅程 ${icon('arrow')}</button></div>
  </section>`;
}
