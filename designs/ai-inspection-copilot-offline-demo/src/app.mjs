import { inspectionExamples } from '../lib/compiler.mjs';
import { createDemoSession, demoReducer } from '../lib/reducer.mjs';
import { selectViewModel } from '../lib/selectors.mjs';
import { renderApp } from './render.mjs';

const root = document.querySelector('#app');
let state = createDemoSession();

function render() {
  root.innerHTML = renderApp(selectViewModel(state));
}

function dispatch(action) {
  const next = demoReducer(state, action);
  if (next !== state) {
    state = next;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

root.addEventListener('click', (event) => {
  const exampleButton = event.target.closest('[data-example-id]');
  if (exampleButton) {
    const example = inspectionExamples.find((item) => item.id === exampleButton.dataset.exampleId);
    const form = root.querySelector('[data-intent-form]');
    if (!example || !form) return;
    form.elements.namedItem('inspection-intent').value = example.prompt;
    form.elements.namedItem('target-service').value = example.targetService;
    form.elements.namedItem('context-reference').value = example.contextReference;
    form.elements.namedItem('inspection-intent').focus();
    return;
  }

  const actionButton = event.target.closest('[data-action]');
  if (!actionButton || actionButton.disabled) return;
  const { action } = actionButton.dataset;
  if (action === 'CANDIDATE_DISPOSED') {
    dispatch({
      type: action,
      candidateId: actionButton.dataset.candidateId,
      disposition: actionButton.dataset.disposition,
      reason: actionButton.dataset.reason,
    });
    return;
  }
  dispatch({ type: action });
});

root.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-intent-form]');
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  dispatch({
    type: 'INTENT_SUBMITTED',
    request: {
      prompt: data.get('inspection-intent'),
      targetService: data.get('target-service'),
      contextReference: data.get('context-reference'),
    },
  });
});

render();
