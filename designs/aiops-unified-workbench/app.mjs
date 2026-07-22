import { createInitialState, reduceWorkbench } from './domain.mjs';
import { renderApp } from './views.mjs';

let state = createInitialState();
let toastTimer;

const app = document.querySelector('#app');
const toast = document.querySelector('#toast');

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function render() {
  app.innerHTML = renderApp(state);
  document.body.dataset.screen = state.screen;
}

function dispatch(action, message) {
  state = reduceWorkbench(state, action);
  render();
  if (message) showToast(message);
}

function handleNavigation(target) {
  if (target.closest('[data-go-home]')) {
    dispatch({ type: 'go_home' }, '已返回场景入口。');
    return true;
  }
  const scenario = target.closest('[data-scenario-id]');
  if (scenario) {
    dispatch(
      { type: 'start_scenario', scenarioId: scenario.dataset.scenarioId },
      '已锁定角色、服务、环境、时间窗和触发事件。',
    );
    return true;
  }
  const step = target.closest('[data-step-index]');
  if (step) {
    dispatch({ type: 'go_to_step', stepIndex: Number(step.dataset.stepIndex) });
    return true;
  }
  const module = target.closest('[data-module]');
  if (module?.matches('button')) {
    dispatch({ type: 'open_module', module: module.dataset.module }, '已进入专业工作面，场景上下文保持不变。');
    return true;
  }
  if (target.closest('[data-return-to-journey]')) {
    dispatch({ type: 'return_to_journey' }, '已回到同一条用户旅程。');
    return true;
  }
  return false;
}

function handleJourney(target) {
  const action = target.closest('[data-complete-step]');
  if (action) {
    dispatch(
      { type: 'complete_current_step', actionId: action.dataset.completeStep },
      '本步人工判断已记录，证据与旅程状态同步更新。',
    );
    return true;
  }
  const decision = target.closest('[data-decision-id]');
  if (decision) {
    dispatch({ type: 'choose_decision', decisionId: decision.dataset.decisionId }, '人工决策已选择，尚未正式提交。');
    return true;
  }
  if (target.closest('[data-finish-journey]')) {
    const scenarioId = state.activeScenarioId;
    dispatch({ type: 'complete_journey' });
    const progress = state.scenarioProgress[scenarioId];
    showToast(progress.status === 'blocked' ? progress.blockReason : '旅程完成：决策、证据包与复验门槛已生成。');
    return true;
  }
  return false;
}

function handleAI(target) {
  if (target.closest('[data-toggle-ai]')) {
    dispatch({ type: 'toggle_ai' });
    return true;
  }
  const verdict = target.closest('[data-ai-verdict]');
  if (verdict) {
    dispatch(
      { type: 'review_ai', insightId: verdict.dataset.insightId, verdict: verdict.dataset.aiVerdict },
      '反馈已写入具体 AI 工件，不会模糊成一次点赞。',
    );
    return true;
  }
  return false;
}

function handleUtility(target) {
  const focus = target.closest('[data-focus-module]');
  if (focus) {
    dispatch(
      { type: 'focus_module_item', module: focus.dataset.focusModule, artifactId: focus.dataset.focusId },
      `已聚焦 ${focus.dataset.focusId}，场景上下文保持不变。`,
    );
    return true;
  }
  if (target.closest('[data-toggle-capabilities]')) {
    dispatch({ type: 'toggle_capability_map' });
    document.querySelector('.capability-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }
  if (target.closest('[data-toggle-mobile-journey]')) {
    dispatch({ type: 'toggle_mobile_journey' });
    return true;
  }
  if (target.closest('[data-run-log-query]')) {
    dispatch({ type: 'run_log_query' }, '查询已执行，模式数量与事件总量已写入当前场景。');
    return true;
  }
  const pin = target.closest('[data-pin-log-sample]');
  if (pin) {
    dispatch(
      { type: 'pin_log_sample', sampleId: pin.dataset.pinLogSample },
      '原始日志样本已钉入场景证据包，切换页面后仍会保留。',
    );
    return true;
  }
  return false;
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (handleNavigation(target)) return;
  if (handleJourney(target)) return;
  if (handleAI(target)) return;
  handleUtility(target);
});

render();
