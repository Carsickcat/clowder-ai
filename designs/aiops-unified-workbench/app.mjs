import { createInitialState, reduceWorkbench } from './domain.mjs';
import {
  activeEvent,
  filteredEvents,
  lensNames,
  renderAI,
  renderContext,
  renderContextEditor,
  renderEventQueue,
  renderFinding,
  renderGuardrail,
  renderIncidentHeader,
  renderLensContent,
  renderLensTabs,
  renderModuleNav,
  renderServiceMap,
  renderTimeline,
  renderWorkflow,
} from './views.mjs';

let state = createInitialState();
let toastTimer;

const elements = {
  aiContent: document.querySelector('#ai-content'),
  aiPanel: document.querySelector('#ai-panel'),
  context: document.querySelector('#context-chips'),
  contextEditor: document.querySelector('#context-editor'),
  contextLockButton: document.querySelector('#context-lock-button'),
  contextLockLabel: document.querySelector('#context-lock-label'),
  eventCount: document.querySelector('#event-count'),
  eventList: document.querySelector('#event-list'),
  finding: document.querySelector('#finding-card'),
  guardrail: document.querySelector('#guardrail'),
  incident: document.querySelector('#incident-header'),
  hypothesisToggle: document.querySelector('#hypothesis-toggle'),
  lensContent: document.querySelector('#lens-content'),
  lensTabs: document.querySelector('#lens-tabs'),
  pinnedCount: document.querySelector('#pinned-count'),
  serviceMap: document.querySelector('#service-map'),
  serviceMapButton: document.querySelector('.service-map-button'),
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
  elements.eventCount.textContent = filteredEvents(state).length;
  elements.context.innerHTML = renderContext(state);
  elements.contextEditor.innerHTML = renderContextEditor(state);
  elements.contextLockButton.setAttribute('aria-pressed', String(state.contextLocked));
  elements.contextLockButton.textContent = state.contextLocked ? '保持继承' : '完成并锁定';
  elements.contextLockLabel.textContent = state.contextLocked ? '上下文已锁定' : '正在调整上下文';
  elements.incident.innerHTML = renderIncidentHeader(state);
  const guardrail = renderGuardrail(state);
  elements.guardrail.innerHTML = guardrail.html;
  elements.guardrail.classList.toggle('is-visible', guardrail.visible);
  elements.workflow.innerHTML = renderWorkflow(state);
  elements.timeline.innerHTML = renderTimeline(state);
  elements.hypothesisToggle.setAttribute('aria-expanded', String(state.hypothesisTreeExpanded));
  elements.hypothesisToggle.textContent = state.hypothesisTreeExpanded ? '收起假设树' : '展开假设树';
  elements.finding.innerHTML = renderFinding(state);
  elements.lensTabs.innerHTML = renderLensTabs(state);
  elements.lensContent.innerHTML = renderLensContent(state);
  elements.pinnedCount.textContent = `${event.pinnedEvidenceIds.length} 条已钉入`;
  elements.serviceMap.innerHTML = renderServiceMap(state);
  elements.serviceMapButton.setAttribute('aria-expanded', String(state.serviceMapOpen));
  elements.aiContent.innerHTML = renderAI(state);
  elements.aiPanel.classList.toggle('is-open', state.aiPanelOpen);
  document.querySelectorAll('.ai-toggle').forEach((button) => {
    button.setAttribute('aria-pressed', String(state.aiPanelOpen));
  });
  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.filter === state.eventQueueFilter);
  });
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
    complete_verification: () => {
      dispatch({ type: 'complete_verification' });
      const verification = activeEvent(state).verification;
      showToast(
        verification.status === 'blocked'
          ? `复验受阻：${verification.blockReason}，状态保持 unknown。`
          : '复验通过，事件进入恢复观察。',
      );
    },
  };
  handlers[action]?.();
}

function handleQueueAndNavigation(target) {
  const eventCard = target.closest('[data-event-id]');
  if (eventCard) {
    dispatch(
      { type: 'select_event', eventId: eventCard.dataset.eventId },
      `已进入 ${eventCard.dataset.eventId}，调查上下文已锁定。`,
    );
    return true;
  }

  const filter = target.closest('[data-filter]');
  if (filter) {
    dispatch({ type: 'set_queue_filter', filter: filter.dataset.filter });
    return true;
  }

  const lens = target.closest('[data-lens]');
  if (lens) {
    dispatch(
      { type: 'switch_lens', lens: lens.dataset.lens },
      `已切换到${lensNames[lens.dataset.lens]}，HealthEvent 与时间窗保持不变。`,
    );
    return true;
  }

  const moduleButton = target.closest('[data-module]');
  if (moduleButton) {
    const module = moduleButton.dataset.module;
    dispatch(
      { type: 'open_module', module },
      module === 'investigations' ? '返回事件调查层。' : `从专业模块深链到${lensNames[module]}，保留当前事件上下文。`,
    );
    document.querySelector('#lens-content')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }
  return false;
}

function handleEvidence(target) {
  const pin = target.closest('[data-evidence-id]');
  if (pin) {
    const alreadyPinned = activeEvent(state).pinnedEvidenceIds.includes(pin.dataset.evidenceId);
    if (alreadyPinned) showToast('这条证据已在调查中，不会重复计数。');
    else
      dispatch(
        { type: 'pin_evidence', evidenceId: pin.dataset.evidenceId },
        '证据已钉入，并同步写入时间线与 Finding。 ',
      );
    return true;
  }

  const workflow = target.closest('[data-workflow-action]');
  if (workflow) {
    handleWorkflow(workflow.dataset.workflowAction);
    return true;
  }
  return false;
}

function handleAi(target) {
  if (target.closest("[data-ai-action='pin_recommended']")) {
    for (const evidenceId of recommendedEvidenceIds(state.activeEventId)) {
      state = reduceWorkbench(state, { type: 'pin_evidence', evidenceId });
    }
    render();
    showToast('AI 推荐证据已钉入；请人工检查后确认 Finding。 ');
    return true;
  }

  if (target.closest('.ai-toggle')) {
    dispatch({ type: 'toggle_ai' }, state.aiPanelOpen ? 'AI 调查员已收起。' : 'AI 调查员已展开。 ');
    return true;
  }
  return false;
}

function handleUtility(target) {
  if (target.closest('#hypothesis-toggle')) {
    dispatch(
      { type: 'toggle_hypothesis_tree' },
      state.hypothesisTreeExpanded ? '假设树已展开，可核对证据与验证条件。' : '假设树已收起。',
    );
    return true;
  }

  if (target.closest('#context-lock-button')) {
    dispatch(
      { type: 'toggle_context_lock' },
      state.contextLocked ? '上下文已重新锁定并将跨 Lens 继承。' : '上下文已解锁，可调整调查时间窗。',
    );
    return true;
  }

  const timeRange = target.closest('[data-time-range]');
  if (timeRange) {
    dispatch(
      { type: 'set_time_range', timeRange: timeRange.dataset.timeRange },
      `调查时间窗已更新为${timeRange.dataset.timeRange}；切换 Lens 后继续继承。`,
    );
    return true;
  }

  if (target.closest('.service-map-button')) {
    dispatch({ type: 'toggle_service_map' }, state.serviceMapOpen ? '业务健康地图已展开。' : '业务健康地图已收起。');
    return true;
  }

  const service = target.closest('[data-service]');
  if (service) {
    dispatch(
      { type: 'select_service', service: service.dataset.service },
      service.dataset.service === 'all'
        ? '已清除服务筛选。'
        : `已从健康地图进入 ${service.dataset.service} 的 HealthEvent。`,
    );
    return true;
  }
  return false;
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (handleQueueAndNavigation(target)) return;
  if (handleEvidence(target)) return;
  if (handleAi(target)) return;
  handleUtility(target);
});

render();
