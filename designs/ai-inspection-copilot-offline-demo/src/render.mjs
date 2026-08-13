import { renderIntake } from './render-intake.mjs';
import { renderInspectionPlan } from './render-plan.mjs';
import { renderPlaybookMatch, renderPlaybookProposal, renderPlaybookReference } from './render-playbook.mjs';
import { escapeHtml } from './view-utils.mjs';

const PHASES = [
  ['intake', '输入理解', '01'],
  ['context', '范围对账', '02'],
  ['plan', '任务草案', '03'],
  ['execution', '执行取证', '04'],
  ['report', '行动报告', '05'],
];

function phaseIndex(phase) {
  return PHASES.findIndex(([id]) => id === phase);
}

function renderProgress(state) {
  const current = phaseIndex(state.phase);
  return PHASES.map(
    ([id, label, number], index) => `
      <li class="phase-step ${index < current ? 'is-done' : ''} ${id === state.phase ? 'is-current' : ''}">
        <span>${index < current ? '✓' : number}</span>
        <strong>${label}</strong>
      </li>`,
  ).join('');
}

function renderSource(source) {
  return `
    <li class="source-card">
      <span class="source-kind">${escapeHtml(source.kind)}</span>
      <strong>${escapeHtml(source.label)}</strong>
      <p>${escapeHtml(source.detail)}</p>
      <small>新鲜度 · ${escapeHtml(source.freshness)}</small>
    </li>`;
}

const IMPACT_LABELS = {
  businessJourney: ['业务场景', '用户结果'],
  goldenMetrics: ['黄金指标', '业务门禁'],
  traceDependencies: ['Trace 直接依赖', '运行时事实'],
  middleware: ['中间件', '资源依赖'],
};

function renderImpactMatrix(impactDimensions) {
  return `
    <section class="impact-block" aria-labelledby="impact-title">
      <header><span>Blast radius</span><h3 id="impact-title">本次影响面四维视图</h3></header>
      <div class="impact-matrix" data-testid="impact-matrix">
        ${Object.entries(impactDimensions)
          .map(([dimension, values]) => {
            const [label, hint] = IMPACT_LABELS[dimension];
            return `<article><span>${label}</span><strong>${values.map(escapeHtml).join(' · ')}</strong><small>${hint}</small></article>`;
          })
          .join('')}
      </div>
    </section>`;
}

function renderContext(vm) {
  const { workspace, scope, state } = vm;
  if (!workspace) {
    return `
      <section class="panel context-panel context-empty" aria-labelledby="context-title">
        <header class="panel-heading">
          <div><span class="module-tag">Module 01 · Input compiler</span><h2 id="context-title">输入与变更理解</h2></div>
          <span class="source-status">等待输入</span>
        </header>
        <div class="context-placeholder"><span>01</span><strong>由用户定义巡检目标</strong><p>提交后，这里会展示实体理解、声明变化、运行时对账和证据边界。</p></div>
      </section>`;
  }
  const visible = phaseIndex(state.phase) >= 1;
  return `
    <section class="panel context-panel" aria-labelledby="context-title">
      <header class="panel-heading">
        <div><span class="module-tag">Module 01 · Input compiler</span><h2 id="context-title">输入与变更理解</h2></div>
        <span class="source-status ${visible ? 'is-ready' : ''}">${visible ? '已确认' : '待确认'}</span>
      </header>
      <div class="prompt-card">
        <span>${workspace.entryKind === 'combined-context' ? '用户意图 + 外部上下文' : '用户巡检意图'}</span>
        <p>“${escapeHtml(workspace.prompt)}”</p>
      </div>
      <dl class="change-facts">
        <div><dt>声明对象</dt><dd>${escapeHtml(workspace.declaredChange.summary)}</dd></div>
        <div><dt>声明指纹</dt><dd><code>${escapeHtml(workspace.declaredChange.fingerprint)}</code></dd></div>
        <div><dt>实际变化</dt><dd>${visible ? escapeHtml(workspace.observedChange.summary) : '等待运行时事实对账'}</dd></div>
        <div><dt>实际指纹</dt><dd><code>${visible ? escapeHtml(workspace.observedChange.fingerprint) : '—'}</code></dd></div>
      </dl>
      ${
        visible
          ? `<div class="reconciliation ${scope.status === 'Exact' ? 'is-exact' : 'is-expanded'}">
              <span>Change Reconciliation</span>
              <strong>${scope.status}</strong>
              <p>${scope.status === 'Exact' ? '声明与运行时事实一致。' : `发现 ${scope.addedEntities.length} 个声明外实体，已扩大巡检范围。`}</p>
            </div>
            <ul class="entity-cloud">${scope.entities.map((entity) => `<li>${escapeHtml(entity)}</li>`).join('')}</ul>`
          : ''
      }
    </section>`;
}

function renderScope(vm) {
  return `
    <div class="scope-stage">
      ${renderPlaybookMatch(vm.playbook)}
      <span class="module-tag">Module 02 · Scope resolver</span>
      <h2>多源事实已经对齐</h2>
      <p>不是把图谱上的所有关系塞进任务，而是用业务目标、运行时 Trace 和已注册能力收敛检查范围。</p>
      ${renderImpactMatrix(vm.workspace.impactDimensions)}
      <ul class="source-list">${vm.workspace.contextSources.map(renderSource).join('')}</ul>
      <div class="hypothesis-block">
        <span>本次要证伪的风险假设</span>
        <ol>${vm.workspace.hypotheses.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
      </div>
    </div>`;
}

function renderExecution(vm) {
  return `
    <div class="execution-stage">
      <header class="stage-heading"><div><span class="module-tag">Deterministic execution</span><h2>现有巡检引擎正在取证</h2></div><span class="live-dot">● MOCK LIVE</span></header>
      <p class="stage-lead">页面只播放确定性 mock；每一步都绑定 Check Contract，不生成生产查询。</p>
      <ol class="execution-list">
        ${vm.execution
          .map(
            (step, index) => `<li class="execution-item ${step.progress} ${step.status.toLowerCase()}">
              <span class="execution-number">${String(index + 1).padStart(2, '0')}</span>
              <div><strong>${escapeHtml(step.label)}</strong><p>${step.progress === 'complete' ? escapeHtml(step.fact) : step.progress === 'active' ? '等待运行下一步 mock 证据' : '排队等待前置检查'}</p></div>
              <code>${step.progress === 'complete' ? step.status : step.progress}</code>
            </li>`,
          )
          .join('')}
      </ol>
    </div>`;
}

function renderReport(vm) {
  const report = vm.report;
  return `
    <div class="report-stage ${report.action.toLowerCase()}" data-testid="final-report">
      <div class="decision-hero">
        <span>Action first · ${report.action}</span>
        <h2>${escapeHtml(report.actionLabel)}</h2>
        <p>${escapeHtml(report.title)}</p>
      </div>
      <div class="semantic-pair">
        <div><span>证据结论</span><code>${report.evidenceVerdict}</code><small>系统知道了什么</small></div>
        <div><span>行动决策</span><code>${report.action}</code><small>SRE 现在该做什么</small></div>
      </div>
      <div class="evidence-badges">
        <span class="verified">✓ ${report.evidenceCounts.verified} 已验证</span>
        <span class="violated">! ${report.evidenceCounts.violated} 违例</span>
        <span class="unresolved">? ${report.evidenceCounts.unresolved} 未决</span>
      </div>
      <p class="report-summary">${escapeHtml(report.summary)}</p>
      <div class="report-columns">
        <section><h3>关键证据</h3><ul>${report.keyEvidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>
        <section><h3>结论边界</h3><p>${escapeHtml(report.scopeStatement)}</p><h3>残余风险</h3><ul>${report.residualRisks.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>
      </div>
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

function renderStage(vm) {
  const renderers = {
    intake: renderIntake,
    context: renderScope,
    plan: renderInspectionPlan,
    execution: renderExecution,
    report: renderReport,
  };
  return renderers[vm.state.phase](vm);
}

function primaryAction(vm) {
  if (!vm.workspace) return '';
  if (vm.state.phase === 'context' && vm.playbook.match) return '';
  const actions = {
    intake: ['INPUT_CONFIRMED', '确认理解结果'],
    context: ['SCOPE_ACCEPTED', '接受范围并生成任务'],
    plan: ['PLAN_CONFIRMED', vm.readiness.status === 'ready' ? '确认任务并开始执行' : '请先处置高风险候选'],
    execution: [
      'EXECUTION_ADVANCED',
      vm.state.executionStep + 1 >= vm.workspace.execution.length - 1 ? '完成执行并生成报告' : '运行下一步 mock 检查',
    ],
    report: ['RESET', '新建巡检工作区'],
  };
  const [action, label] = actions[vm.state.phase];
  const disabled = vm.state.phase === 'plan' && vm.readiness.status !== 'ready';
  return `<button class="primary-action" data-action="${action}" ${disabled ? 'disabled' : ''} type="button"><span>${escapeHtml(label)}</span><b>→</b></button>`;
}

function renderCopilot(vm) {
  if (!vm.workspace) {
    return `
      <aside class="panel copilot-panel" aria-label="Copilot 解释">
        <header><span class="copilot-mark">✦</span><div><small>NOVA COPILOT</small><strong>可信任务编译器</strong></div><span class="online">READY</span></header>
        <div class="copilot-message"><span>产品边界</span><h3>由用户决定如何使用</h3><p>输入目标、服务和可选上下文；系统据此编译工作区，而不是让你先选一个固定场景。</p></div>
        <div class="copilot-principles"><span>护栏</span><ul><li>示例不是产品模式</li><li>电子流只是可选事实来源</li><li>不会触发真实生产动作</li></ul></div>
      </aside>`;
  }
  const copy = {
    intake: ['先确认我理解得对不对', '实体不唯一或缺少版本时，我不会静默猜测。'],
    context: ['范围不是知识图谱全展开', '我只保留业务目标、运行时事实与可执行能力共同支持的关系。'],
    plan: [
      '候选不是正式任务',
      vm.readiness.status === 'ready' ? '当前计划已满足确认条件。' : '高关键度候选仍未处置，计划不能确认。',
    ],
    execution: ['执行与解释分开', '确定性引擎产生证据；Copilot 只组织理由和下一步。'],
    report: ['结论有边界', vm.report?.scopeStatement ?? '报告尚未生成'],
  }[vm.state.phase];
  return `
    <aside class="panel copilot-panel" aria-label="Copilot 解释">
      <header><span class="copilot-mark">✦</span><div><small>NOVA COPILOT</small><strong>可信任务编译器</strong></div><span class="online">ONLINE</span></header>
      <div class="copilot-message"><span>当前判断</span><h3>${escapeHtml(copy[0])}</h3><p>${escapeHtml(copy[1])}</p></div>
      <div class="copilot-principles"><span>护栏</span><ul><li>不生成任意生产查询</li><li>不把缺失证据写成正常</li><li>不代替 SRE 执行发布动作</li></ul></div>
      ${renderPlaybookReference(vm.playbook)}
      ${primaryAction(vm)}
    </aside>`;
}

export function renderApp(vm) {
  const eyebrow = vm.workspace?.eyebrow ?? 'User-defined inspection workspace';
  const workspaceId = vm.workspace?.id ?? 'new';
  return `
    <div class="app-shell" data-phase="${vm.state.phase}" data-workspace="${escapeHtml(workspaceId)}">
      <header class="app-header">
        <a class="brand" href="#main"><span>N</span><div><strong>NOVA</strong><small>OPS INTELLIGENCE</small></div></a>
        <div class="title-lockup"><span>${escapeHtml(eyebrow)}</span><h1>AI 巡检任务生成与解读 Copilot</h1></div>
        <div class="offline-badge"><span>●</span> OFFLINE · MOCK ONLY</div>
      </header>
      <ol class="phase-rail" aria-label="工作阶段">${renderProgress(vm.state)}</ol>
      <main id="main" class="workspace">
        ${renderContext(vm)}
        <section class="panel stage-panel" aria-live="polite">${renderStage(vm)}</section>
        ${renderCopilot(vm)}
      </main>
      <footer class="app-footer"><span>AI Inspection Copilot · Offline Product Demo v0.3</span><strong>所有数据均为 mock，不会触发真实生产动作</strong></footer>
    </div>`;
}
