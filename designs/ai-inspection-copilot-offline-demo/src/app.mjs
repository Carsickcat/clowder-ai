import { inspectionExamples } from '../lib/compiler.mjs';
import { createDemoSession, demoReducer } from '../lib/reducer.mjs';
import { selectViewModel } from '../lib/selectors.mjs';
import { renderApp } from './render.mjs';
import { INSPECTION_LIBRARY_STORAGE_KEY, createInspectionLibraryStorage } from './storage.mjs';

const root = document.querySelector('#app');
const libraryStorage = createInspectionLibraryStorage(window.localStorage);
let state = demoReducer(createDemoSession(), {
  type: 'LIBRARY_HYDRATED',
  library: libraryStorage.load(),
});

function render() {
  root.innerHTML = renderApp(selectViewModel(state));
}

function dispatch(action) {
  const next = demoReducer(state, action);
  if (next !== state) {
    const libraryChanged = next.library !== state.library;
    state = next;
    if (libraryChanged) {
      const saved = libraryStorage.save(state.library);
      if (!saved.ok) {
        state = demoReducer(state, {
          type: 'LIBRARY_SAVE_FAILED',
          message: '无法写入本地保存；本页内仍可继续使用',
        });
      }
    }
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

window.addEventListener('storage', (event) => {
  if (event.key !== INSPECTION_LIBRARY_STORAGE_KEY || typeof event.newValue !== 'string') return;
  dispatch({ type: 'LIBRARY_MERGED', library: libraryStorage.merge(state.library, event.newValue) });
});

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
  if (action === 'CONTEXT_ITEM_TOGGLED') {
    dispatch({ type: action, contextId: actionButton.dataset.contextId });
    return;
  }
  if (action === 'SAVED_INSPECTION_RUN_REQUESTED') {
    dispatch({ type: action, definitionId: actionButton.dataset.definitionId });
    return;
  }
  dispatch({ type: action });
});

root.addEventListener('submit', (event) => {
  const saveForm = event.target.closest('[data-save-inspection-form]');
  if (saveForm) {
    event.preventDefault();
    const data = new FormData(saveForm);
    dispatch({ type: 'SAVED_INSPECTION_CREATED', name: data.get('saved-inspection-name') });
    return;
  }
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
