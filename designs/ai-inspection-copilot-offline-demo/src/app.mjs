import { inspectionExamples } from '../lib/compiler.mjs';
import { createDemoSession, demoReducer } from '../lib/reducer.mjs';
import { selectViewModel } from '../lib/selectors.mjs';
import { renderApp } from './render.mjs';
import { buildReportFilename, buildReportShareText, buildStandaloneReportHtml } from './report-share.mjs';
import { createInspectionLibraryStorage, INSPECTION_LIBRARY_STORAGE_KEY } from './storage.mjs';

const root = document.querySelector('#app');
const libraryStorage = createInspectionLibraryStorage(window.localStorage);
const actorId = window.crypto.randomUUID();
const hydratedLibrary = libraryStorage.loadWithDiagnostics();
let state = demoReducer(createDemoSession({ actorId }), {
  type: 'LIBRARY_HYDRATED',
  library: hydratedLibrary.library,
  diagnostics: hydratedLibrary.diagnostics,
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

async function copyOfflineText(text) {
  if (window.location.protocol !== 'file:' && window.navigator.clipboard?.writeText) {
    try {
      await window.navigator.clipboard.writeText(text);
      return;
    } catch {
      // Non-file origins can still deny clipboard permission; retain the local DOM fallback.
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand?.('copy');
  textarea.remove();
  if (!copied) throw new Error('copy-unavailable');
}

function downloadOfflineReport(html, filename) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function shareCurrentReport(action) {
  const vm = selectViewModel(state);
  const run = vm.savedInspection.currentRun;
  if (!run) return;
  const taskName =
    vm.savedInspection.reportDefinition?.name ?? `${vm.workspace?.declaredChange?.entities?.[0] ?? '服务'} 巡检`;
  try {
    if (action === 'copy') {
      await copyOfflineText(buildReportShareText(run, taskName));
      dispatch({ type: 'SHARE_FEEDBACK_SET', message: '摘要已复制' });
      return;
    }
    downloadOfflineReport(buildStandaloneReportHtml(run, taskName), buildReportFilename(run, taskName));
    dispatch({ type: 'SHARE_FEEDBACK_SET', message: '离线报告已导出' });
  } catch {
    dispatch({ type: 'SHARE_FEEDBACK_SET', message: '分享失败，请重试' });
  }
}

window.addEventListener('storage', (event) => {
  if (event.key !== INSPECTION_LIBRARY_STORAGE_KEY || typeof event.newValue !== 'string') return;
  const merged = libraryStorage.merge(state.library, event.newValue);
  dispatch({ type: 'LIBRARY_MERGED', library: merged.library, diagnostics: merged.diagnostics });
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

  const shareButton = event.target.closest('[data-share-action]');
  if (shareButton) {
    void shareCurrentReport(shareButton.dataset.shareAction);
    return;
  }

  const evidenceButton = event.target.closest('[data-evidence-target]');
  if (evidenceButton) {
    const target = [...root.querySelectorAll('[data-evidence-id]')].find(
      (item) => item.dataset.evidenceId === evidenceButton.dataset.evidenceTarget,
    );
    if (!target) return;
    for (const item of root.querySelectorAll('.evidence-card.is-highlighted')) item.classList.remove('is-highlighted');
    target.classList.add('is-highlighted');
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  if (['SAVED_INSPECTION_RUN_REQUESTED', 'SAVED_INSPECTION_HISTORY_OPENED'].includes(action)) {
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
