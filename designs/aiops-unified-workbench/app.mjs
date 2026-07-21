import { createInitialState, reduceWorkbench } from './domain.mjs';
import {
  activeEvent,
  lensNames,
  renderAI,
  renderContext,
  renderEventQueue,
  renderFinding,
  renderGuardrail,
  renderIncidentHeader,
  renderLensContent,
  renderLensTabs,
  renderModuleNav,
  renderTimeline,
  renderWorkflow,
} from './views.mjs';

let state = createInitialState();
let toastTimer;

const elements = {
  aiContent: document.querySelector('#ai-content'),
  aiPanel: document.querySelector('#ai-panel'),
  context: document.querySelector('#context-chips'),
  eventCount: document.querySelector('#event-count'),
  eventList: document.querySelector('#event-list'),
  finding: document.querySelector('#finding-card'),
  guardrail: document.querySelector('#guardrail'),
  incident: document.querySelector('#incident-header'),
  lensContent: document.querySelector('#lens-content'),
  lensTabs: document.querySelector('#lens-tabs'),
  pinnedCount: document.querySelector('#pinned-count'),
  timeline: document.querySelector('#timeline'),
  toast: document.querySelector('#toast'),
  workflow: document.querySelector('#workflow'),
};

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 2400);
}

function render() {
  const event = activeEvent(state);
  elements.eventList.innerHTML = renderEventQueue(state);
  elements.eventCount.textContent = Object.values(state.events).filter(
    (item) => state.eventQueueFilter === 'all' || item.severity === state.eventQueueFilter,
  ).length;
  elements.context.innerHTML = renderContext(state);
  elements.incident.innerHTML = renderIncidentHeader(state);
  const guardrail = renderGuardrail(state);
  elements.guardrail.innerHTML = guardrail.html;
  elements.guardrail.classList.toggle('is-visible', guardrail.visible);
  elements.workflow.innerHTML = renderWorkflow(state);
  elements.timeline.innerHTML = renderTimeline(state);
  elements.finding.innerHTML = renderFinding(state);
  elements.lensTabs.innerHTML = renderLensTabs(state);
  elements.lensContent.innerHTML = renderLensContent(state);
  elements.pinnedCount.textContent = `${event.pinnedEvidenceIds.length} 条已钉入`;
  elements.aiContent.innerHTML = renderAI(state);
  elements.aiPanel.classList.toggle('is-open', state.aiPanelOpen);
  document
    .querySelectorAll('.ai-toggle')
    .forEach((button) => button.setAttribute('aria-pressed', String(state.aiPanelOpen)));
  document
    .querySelectorAll('[data-filter]')
    .forEach((button) => button.classList.toggle('is-active', button.dataset.filter === state.eventQueueFilter));
  renderModuleNav(state);
}

function dispatch(action, message) {
  state = reduceWorkbench(state, action);
  render();
  if (message) showToast(message);
}

function recommendedEvidenceIds(eventId) {
  return (
    {
      'HE-1042': ['log-timeout-01', 'log-config-01'],
      'HE-1045': ['drift-log-01', 'drift-check-01'],
      'HE-1047': ['gap-alert-01', 'gap-check-01'],
    }[eventId] ?? []
  );
}

function handleWorkflow(action) {
  const handlers = {
    confirm_finding: () => dispatch({ type: 'confirm_finding' }, 'Finding 已确认，并保留完整证据引用。'),
    assign_action: () => dispatch({ type: 'assign_action', owner: '陈曦' }, '整改已分派给陈曦。'),
    start_action: () => dispatch({ type: 'start_action' }, '整改开始；生产动作仍需既有权限系统执行。'),
    start_verification: () => dispatch({ type: 'start_verification' }, '复验已启动：发布检查 + 结算拨测。'),
    complete_verification: () => dispatch({ type: 'complete_verification' }, '复验通过，事件进入恢复观察。'),
  };
  handlers[action]?.();
}

document.addEventListener('click', (event) => {
  const eventCard = event.target.closest('[data-event-id]');
  if (eventCard) {
    dispatch(
      { type: 'select_event', eventId: eventCard.dataset.eventId },
      `已进入 ${eventCard.dataset.eventId}，调查上下文已锁定。`,
    );
    return;
  }

  const filter = event.target.closest('[data-filter]');
  if (filter) {
    dispatch({ type: 'set_queue_filter', filter: filter.dataset.filter });
    return;
  }

  const lens = event.target.closest('[data-lens]');
  if (lens) {
    dispatch(
      { type: 'switch_lens', lens: lens.dataset.lens },
      `已切换到${lensNames[lens.dataset.lens]}，HealthEvent 与时间窗保持不变。`,
    );
    return;
  }

  const moduleButton = event.target.closest('[data-module]');
  if (moduleButton) {
    const module = moduleButton.dataset.module;
    dispatch(
      { type: 'open_module', module },
      module === 'investigations' ? '返回事件调查层。' : `从专业模块深链到${lensNames[module]}，保留当前事件上下文。`,
    );
    document.querySelector('#lens-content')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const pin = event.target.closest('[data-evidence-id]');
  if (pin) {
    const alreadyPinned = activeEvent(state).pinnedEvidenceIds.includes(pin.dataset.evidenceId);
    if (alreadyPinned) showToast('这条证据已在调查中，不会重复计数。');
    else
      dispatch(
        { type: 'pin_evidence', evidenceId: pin.dataset.evidenceId },
        '证据已钉入，并同步写入时间线与 Finding。 ',
      );
    return;
  }

  const workflow = event.target.closest('[data-workflow-action]');
  if (workflow) {
    handleWorkflow(workflow.dataset.workflowAction);
    return;
  }

  if (event.target.closest("[data-ai-action='pin_recommended']")) {
    for (const evidenceId of recommendedEvidenceIds(state.activeEventId)) {
      state = reduceWorkbench(state, { type: 'pin_evidence', evidenceId });
    }
    render();
    showToast('AI 推荐证据已钉入；请人工检查后确认 Finding。 ');
    return;
  }

  if (event.target.closest('.ai-toggle')) {
    dispatch({ type: 'toggle_ai' }, state.aiPanelOpen ? 'AI 调查员已收起。' : 'AI 调查员已展开。 ');
    return;
  }

  if (event.target.closest('#context-lock-button')) {
    const button = document.querySelector('#context-lock-button');
    const pressed = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-pressed', String(!pressed));
    button.textContent = pressed ? '允许调整' : '保持继承';
    showToast(pressed ? '原型允许调整；跨 Lens 仍会继承上下文。' : '上下文已重新锁定。 ');
    return;
  }

  if (event.target.closest('.service-map-button')) {
    showToast('健康地图是筛选入口；选择服务后仍回到 HealthEvent 工作队列。 ');
  }
});

render();
