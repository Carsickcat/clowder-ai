import { renderConversationComposer, renderIntake } from './render-intake.mjs';
import { renderInspectionPlan } from './render-plan.mjs';
import { renderPlaybookMatch, renderPlaybookReference } from './render-playbook.mjs';
import { renderCurrentReport } from './render-report.mjs';
import { renderSavedExecutionStatus, renderSavedInspectionRefresh } from './render-saved-inspections.mjs';
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
      <p class="single-line-note" title="${escapeHtml(source.detail)}">${escapeHtml(source.detail)}</p>
      <small>更新 · ${escapeHtml(source.freshness)}</small>
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
      <header><h3 id="impact-title">影响面</h3></header>
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
          <div><h2 id="context-title">变更信息</h2></div>
          <span class="source-status">等待输入</span>
        </header>
        <div class="context-placeholder"><strong>等待巡检目标</strong></div>
      </section>`;
  }
  const visible = phaseIndex(state.phase) >= 1;
  return `
    <section class="panel context-panel" aria-labelledby="context-title">
      <header class="panel-heading">
        <div><h2 id="context-title">变更信息</h2></div>
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
              <span>变化对账</span>
              <strong>${scope.status}</strong>
              <p>${scope.status === 'Exact' ? '声明与运行时事实一致。' : `发现 ${scope.addedEntities.length} 个声明外实体，已扩大巡检范围。`}</p>
            </div>
            <ul class="entity-cloud">${scope.entities.map((entity) => `<li>${escapeHtml(entity)}</li>`).join('')}</ul>`
          : ''
      }
    </section>`;
}

function renderScope(vm) {
  const savedRefresh = renderSavedInspectionRefresh(vm.savedInspection);
  if (savedRefresh) return savedRefresh;
  return `
    <div class="scope-stage">
      ${renderPlaybookMatch(vm.playbook)}
      <h2 data-stage-title>确认巡检范围</h2>
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
      ${renderSavedExecutionStatus(vm.savedInspection)}
      <header class="stage-heading"><div><h2 data-stage-title>执行检查</h2></div><span class="live-dot">● MOCK</span></header>
      <ol class="execution-list">
        ${vm.execution
          .map(
            (step, index) => `<li class="execution-item ${step.progress} ${step.status.toLowerCase()}">
              <span class="execution-number">${String(index + 1).padStart(2, '0')}</span>
              <div><strong>${escapeHtml(step.label)}</strong><p class="single-line-note" title="${step.progress === 'complete' ? escapeHtml(step.fact) : ''}">${step.progress === 'complete' ? escapeHtml(step.fact) : step.progress === 'active' ? '等待结果' : '排队'}</p></div>
              <code>${step.progress === 'complete' ? step.status : step.progress}</code>
            </li>`,
          )
          .join('')}
      </ol>
    </div>`;
}

function renderStage(vm) {
  const renderers = {
    intake: renderIntake,
    context: renderScope,
    plan: renderInspectionPlan,
    execution: renderExecution,
    report: renderCurrentReport,
  };
  return renderers[vm.state.phase](vm);
}

function primaryAction(vm) {
  if (!vm.workspace) return '';
  if (vm.state.phase === 'intake') return '';
  if (vm.state.phase === 'plan') return '';
  if (vm.state.phase === 'context' && (vm.playbook.match || vm.savedInspection.refresh)) return '';
  const actions = {
    context: ['SCOPE_ACCEPTED', '生成任务'],
    execution: [
      'EXECUTION_ADVANCED',
      vm.state.executionStep + 1 >= vm.workspace.execution.length - 1 ? '生成报告' : '运行下一项',
    ],
    report: ['RESET', '新建巡检工作区'],
  };
  const [action, label] = actions[vm.state.phase];
  return `<button class="primary-action" data-action="${action}" type="button"><span>${escapeHtml(label)}</span><b>→</b></button>`;
}

function renderCopilot(vm) {
  const status = !vm.workspace
    ? '等待输入'
    : {
        intake: '待确认',
        context: vm.playbook.match ? '方案待选择' : '范围待确认',
        plan: vm.readiness.status === 'ready' ? '可以开始' : '有建议待确认',
        execution: '执行中',
        report: '报告已生成',
      }[vm.state.phase];
  return `
    <aside class="panel copilot-panel" aria-label="巡检对话">
      <header><span class="copilot-mark">✦</span><div><strong>巡检对话</strong></div><span class="online" aria-label="离线演示已就绪" title="离线演示已就绪">●</span></header>
      <div class="copilot-status"><span>状态</span><strong>${escapeHtml(status)}</strong></div>
      ${renderPlaybookReference(vm.playbook)}
      ${renderConversationComposer(vm)}
      ${primaryAction(vm)}
    </aside>`;
}

export function renderApp(vm) {
  const workspaceId = vm.workspace?.id ?? 'new';
  return `
    <div class="app-shell" data-phase="${vm.state.phase}" data-workspace="${escapeHtml(workspaceId)}">
      <header class="app-header">
        <a class="brand" href="#main"><span>N</span><div><strong>NOVA</strong><small>巡检工作台</small></div></a>
        <div class="title-lockup"><h1>AI 巡检 Copilot</h1></div>
        <div class="offline-badge"><span>●</span> 离线演示</div>
      </header>
      ${vm.workspace ? `<ol class="phase-rail" aria-label="工作阶段">${renderProgress(vm.state)}</ol>` : ''}
      <main id="main" class="workspace ${vm.workspace ? '' : 'is-home'}">
        ${vm.workspace ? renderContext(vm) : ''}
        <section class="panel stage-panel" aria-live="polite">${renderStage(vm)}</section>
        ${renderCopilot(vm)}
      </main>
      <footer class="app-footer"><span>NOVA 巡检 Copilot · v0.3</span><strong><span class="info-tip" title="离线演示不连接生产数据源">ⓘ</span> 所有数据均为 mock，不会触发真实生产动作</strong></footer>
    </div>`;
}
