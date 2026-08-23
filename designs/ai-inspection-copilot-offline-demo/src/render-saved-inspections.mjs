import { escapeHtml } from './view-utils.mjs';

function differenceList(differences) {
  return `<ul class="saved-refresh-differences">${differences
    .map((difference) => `<li>${escapeHtml(difference.summary ?? difference.id)}</li>`)
    .join('')}</ul>`;
}

export function renderSavedInspectionRefresh(savedInspection) {
  const refresh = savedInspection?.refresh;
  const definition = savedInspection?.activeDefinition;
  if (!refresh || !definition || refresh.status === 'exact') return '';
  if (refresh.status === 'minor-drift') {
    return `<section class="saved-refresh reconciliation is-expanded" data-testid="saved-refresh" data-refresh-status="minor-drift">
      <span>已刷新当前事实</span>
      <h2>当前事实有差异</h2>
      <p>${escapeHtml(definition.name)} 的检查结构仍可执行，请先确认差异。</p>
      ${differenceList(refresh.differences)}
      <button class="compile-button" data-action="SAVED_INSPECTION_RUN_CONFIRMED" type="button"><span>仍要执行</span><b>→</b></button>
    </section>`;
  }
  return `<section class="saved-refresh reconciliation is-blocked" data-testid="saved-refresh" data-refresh-status="major-drift">
    <span>已刷新当前事实</span>
    <h2>当前结构已变化，不能直跑</h2>
    <p>${escapeHtml(definition.name)} 仅作参考；重新描述后会生成新任务。</p>
    ${differenceList(refresh.differences)}
    <button class="compile-button" data-action="SAVED_INSPECTION_REGENERATED" type="button"><span>回到对话重新生成</span><b>→</b></button>
  </section>`;
}

export function renderSavedExecutionStatus(savedInspection) {
  if (savedInspection?.refresh?.status !== 'exact' || !savedInspection.activeDefinition) return '';
  return `<div class="saved-execution-status reconciliation is-exact" data-testid="saved-refresh" data-refresh-status="exact">
    <span>当前事实</span><strong>一致，已直接执行</strong>
    <p>${escapeHtml(savedInspection.activeDefinition.name)} · 新任务 ${escapeHtml(savedInspection.currentRun?.taskInstanceId ?? '执行中')}</p>
  </div>`;
}

export function renderSelectedContextResults(run) {
  if (!run?.selectedContextResults?.length) return '';
  return `<section class="report-context-results" data-testid="selected-context-results">
    <h3>本次选择的巡检结果</h3>
    <div class="report-context-grid">${run.selectedContextResults
      .map(
        (item) =>
          `<article><span>${escapeHtml(item.kind)}</span><strong>${escapeHtml(item.label)}</strong><small>✓ ${escapeHtml(item.status)}</small></article>`,
      )
      .join('')}</div>
  </section>`;
}

function suggestedName(vm) {
  const entity = vm.workspace?.declaredChange?.entities?.[0] ?? '服务';
  return `${entity} 巡检`;
}

function renderPersonalSave(vm) {
  const saved = vm.savedInspection;
  if (saved.activeDefinition) return '';
  if (saved.savedDefinitionId) {
    return `<p class="save-toast" role="status">${escapeHtml(saved.toast ?? '已保存，下次可从首页直接执行')}</p>`;
  }
  return `<section class="personal-save" aria-labelledby="personal-save-title">
    <div><h3 id="personal-save-title">保存这次巡检</h3><p>保存后下次可从首页直接执行</p></div>
    <form data-save-inspection-form>
      <input name="saved-inspection-name" required value="${escapeHtml(suggestedName(vm))}" aria-label="巡检名称" />
      <button type="submit">保存</button>
    </form>
  </section>`;
}

export function renderReportJourneyDetails(vm) {
  const run = vm.savedInspection.currentRun;
  return `${renderSelectedContextResults(run)}
    <section class="model-risk-summary">
      <h3>模型风险总结</h3>
      <ul>${vm.report.residualRisks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join('')}</ul>
    </section>
    ${renderPersonalSave(vm)}`;
}
