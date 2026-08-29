import { inspectionExamples } from '../lib/compiler.mjs';
import { renderHistoricalReportSnapshot } from './render-report.mjs';
import { escapeHtml } from './view-utils.mjs';

const CONTEXT_GROUPS = [
  ['change', '近期变更'],
  ['service', '关联服务与依赖'],
  ['signal', '可用信号'],
];

function renderExamples() {
  return inspectionExamples
    .map(
      (example) => `
        <button class="example-fill" data-example-id="${example.id}" type="button">
          <span>填入示例</span>
          <strong>${escapeHtml(example.label)}</strong>
          <small>${escapeHtml(example.prompt)}</small>
        </button>`,
    )
    .join('');
}

function formatRunTime(value) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
}

function runTone(run) {
  return ['Pause', 'Rollback'].includes(run?.report?.action) ? 'pause' : run ? 'proceed' : 'empty';
}

function renderMiniRunHistory(runs, diagnostics) {
  if (diagnostics?.status === 'degraded') return '<p class="run-history-unavailable">历史暂不可用</p>';
  if (!runs.length) return '<p class="run-history-empty">还没有执行记录</p>';
  const recent = runs.slice(0, 10).reverse();
  return `<div class="run-history-mini" aria-label="最近 ${recent.length} 次执行">${recent
    .map((run) => {
      const action = run.report?.actionLabel ?? run.report?.action ?? '未知结论';
      return `<span class="run-history-dot is-${runTone(run)}" title="${escapeHtml(formatRunTime(run.completedAt))} · ${escapeHtml(action)}"></span>`;
    })
    .join('')}<small>最近 ${recent.length} 次</small></div>`;
}

function renderSavedCard(card, diagnostics) {
  const { definition, runs, latestRun: run } = card;
  const action = run?.report?.actionLabel ?? run?.report?.action ?? '尚未执行';
  const completedAt = formatRunTime(run?.completedAt);
  return `<article class="saved-inspection-card" data-testid="saved-inspection-card">
    <button class="saved-inspection-copy" data-action="SAVED_INSPECTION_HISTORY_OPENED" data-definition-id="${escapeHtml(definition.id)}" type="button">
      <span class="readiness">本地 mock</span>
      <h3>${escapeHtml(definition.name)}</h3>
      <p>上次：${escapeHtml(action)} · ${escapeHtml(completedAt)}</p>
      ${renderMiniRunHistory(runs, diagnostics)}
    </button>
    <button class="saved-run-button" data-action="SAVED_INSPECTION_RUN_REQUESTED" data-definition-id="${escapeHtml(definition.id)}" type="button">直跑 <b>▶</b></button>
  </article>`;
}

function renderSavedInspectionHome(vm) {
  const { cards, historyDiagnostics, storageError } = vm.savedInspection;
  return `<section class="saved-inspection-home" data-testid="saved-inspection-home" aria-labelledby="saved-title">
    <header class="saved-inspection-heading">
      <div><h2 id="saved-title" data-stage-title>已保存巡检</h2><p>个人任务保存在当前浏览器</p></div>
      <span class="readiness">本地 mock</span>
    </header>
    ${storageError ? `<p class="storage-warning" role="status">${escapeHtml(storageError)}</p>` : ''}
    ${
      cards.length
        ? `<div class="saved-inspection-list">${cards.map((card) => renderSavedCard(card, historyDiagnostics)).join('')}</div>`
        : '<p class="saved-inspection-empty">还没有保存的巡检，从右侧对话开始 →</p>'
    }
  </section>`;
}

function renderHistoryEntry(run, taskName) {
  const action = run.report?.actionLabel ?? run.report?.action ?? '未知结论';
  return `<details class="saved-history-entry" data-run-id="${escapeHtml(run.id)}">
    <summary><span class="run-history-dot is-${runTone(run)}"></span><time>${escapeHtml(formatRunTime(run.completedAt))}</time><strong>${escapeHtml(action)}</strong><small>${escapeHtml(run.report?.summary ?? '')}</small></summary>
    ${renderHistoricalReportSnapshot(run, taskName)}
  </details>`;
}

function renderSavedInspectionHistory(vm) {
  const { historyDefinition: definition, historyRuns: runs, historyDiagnostics } = vm.savedInspection;
  const recent = runs.slice(0, 20);
  const earlier = runs.slice(20);
  return `<section class="saved-inspection-history" data-testid="saved-inspection-history" aria-labelledby="history-title">
    <header class="saved-history-heading">
      <div><button class="history-back" data-action="SAVED_INSPECTION_HISTORY_CLOSED" type="button">← 返回</button><h2 id="history-title" data-stage-title>${escapeHtml(definition.name)}</h2><p>创建于 ${escapeHtml(formatRunTime(definition.createdAt))} · 共执行 ${runs.length} 次</p></div>
      <button class="saved-run-button" data-action="SAVED_INSPECTION_RUN_REQUESTED" data-definition-id="${escapeHtml(definition.id)}" type="button">直跑 <b>▶</b></button>
    </header>
    <h3 class="saved-history-title">运行历史</h3>
    ${historyDiagnostics?.status === 'degraded' ? '<p class="storage-warning" role="status">历史暂不可用：已隔离损坏记录，仍可直跑</p>' : ''}
    ${recent.length ? `<div class="saved-history-list">${recent.map((run) => renderHistoryEntry(run, definition.name)).join('')}</div>` : '<p class="saved-inspection-empty">还没有执行记录</p>'}
    ${earlier.length ? `<details class="saved-history-earlier"><summary>显示更早（${earlier.length}）</summary>${earlier.map((run) => renderHistoryEntry(run, definition.name)).join('')}</details>` : ''}
  </section>`;
}

function renderContextGroup(options, kind, title) {
  const items = options.filter((item) => item.kind === kind);
  if (!items.length) return '';
  return `<section class="context-option-group" aria-labelledby="context-${kind}">
    <header><h3 id="context-${kind}">${title}</h3><span>${items.filter((item) => item.selected).length}/${items.length}</span></header>
    <div class="context-option-list">
      ${items
        .map(
          (
            item,
          ) => `<button class="context-option ${item.selected ? 'is-selected' : ''}" data-action="CONTEXT_ITEM_TOGGLED" data-context-id="${escapeHtml(item.id)}" aria-pressed="${item.selected}" type="button">
            <span class="context-check">${item.selected ? '✓' : '+'}</span>
            <span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span>
          </button>`,
        )
        .join('')}
    </div>
  </section>`;
}

function renderContextSelection(vm) {
  return `<section class="context-selection" data-testid="context-selection" aria-labelledby="context-selection-title">
    <header class="stage-heading">
      <div><h2 id="context-selection-title" data-stage-title>确认巡检信息</h2><p>勾选本次要验证的范围</p></div>
      <button class="edit-intent" data-action="RESET" type="button">重新描述</button>
    </header>
    <div class="context-option-groups">
      ${CONTEXT_GROUPS.map(([kind, title]) => renderContextGroup(vm.savedInspection.contextOptions, kind, title)).join('')}
    </div>
    <button class="compile-button context-confirm" data-action="INPUT_CONFIRMED" type="button"><span>生成任务草案</span><b>→</b></button>
  </section>`;
}

export function renderConversationComposer(vm) {
  const prefill = vm.savedInspection.composerPrefill ?? {};
  const conversation = vm.savedInspection.conversation;
  const busy = Boolean(vm.workspace);
  return `<div class="conversation-shell">
    <div class="conversation-log" aria-live="polite">
      ${
        conversation.length
          ? conversation
              .map((message) => `<p class="conversation-message ${message.role}">${escapeHtml(message.text)}</p>`)
              .join('')
          : '<p class="conversation-empty">描述要巡检的服务或变更</p>'
      }
    </div>
    <form class="conversation-form" data-intent-form>
      <textarea name="inspection-intent" rows="3" required ${busy ? 'disabled' : ''} placeholder="例如：巡检 payment-api 本周配置变更">${escapeHtml(prefill.prompt ?? '')}</textarea>
      <details class="conversation-details" ${prefill.targetService || prefill.contextReference ? 'open' : ''}>
        <summary>补充服务或电子流</summary>
        <input name="target-service" ${busy ? 'disabled' : ''} value="${escapeHtml(prefill.targetService ?? '')}" placeholder="目标服务（可选）" />
        <input name="context-reference" ${busy ? 'disabled' : ''} value="${escapeHtml(prefill.contextReference ?? '')}" placeholder="电子流 / 发布单（可选）" />
      </details>
      <button class="conversation-send" type="submit" ${busy ? 'disabled' : ''}>${busy ? '当前巡检进行中' : '发送'}</button>
    </form>
    ${!busy ? `<details class="conversation-examples"><summary>填入示例</summary><div class="example-grid">${renderExamples()}</div></details>` : ''}
  </div>`;
}

export function renderIntake(vm) {
  if (vm.savedInspection.historyDefinition) return renderSavedInspectionHistory(vm);
  return vm.workspace ? renderContextSelection(vm) : renderSavedInspectionHome(vm);
}
