import { inspectionExamples } from '../lib/compiler.mjs';
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

function latestRunFor(definition, runs) {
  return [...runs]
    .filter((run) => run.definitionId === definition.id || run.id === definition.sourceRunId)
    .sort((left, right) => String(right.completedAt).localeCompare(String(left.completedAt)))[0] ?? null;
}

function renderSavedCard(definition, runs) {
  const run = latestRunFor(definition, runs);
  const action = run?.report?.actionLabel ?? run?.report?.action ?? '尚未执行';
  const completedAt = run?.completedAt ? new Date(run.completedAt).toLocaleString('zh-CN', { hour12: false }) : '—';
  return `<article class="saved-inspection-card" data-testid="saved-inspection-card">
    <div class="saved-inspection-copy">
      <span class="readiness">本地 mock</span>
      <h3>${escapeHtml(definition.name)}</h3>
      <p>上次：${escapeHtml(action)} · ${escapeHtml(completedAt)}</p>
    </div>
    <button class="saved-run-button" data-action="SAVED_INSPECTION_RUN_REQUESTED" data-definition-id="${escapeHtml(definition.id)}" type="button">直跑 <b>▶</b></button>
  </article>`;
}

function renderSavedInspectionHome(vm) {
  const { definitions, runs, storageError } = vm.savedInspection;
  return `<section class="saved-inspection-home" data-testid="saved-inspection-home" aria-labelledby="saved-title">
    <header class="saved-inspection-heading">
      <div><h2 id="saved-title" data-stage-title>已保存巡检</h2><p>个人任务保存在当前浏览器</p></div>
      <span class="readiness">本地 mock</span>
    </header>
    ${
      storageError
        ? `<p class="storage-warning" role="status">${escapeHtml(storageError)}</p>`
        : ''
    }
    ${
      definitions.length
        ? `<div class="saved-inspection-list">${definitions.map((definition) => renderSavedCard(definition, runs)).join('')}</div>`
        : '<p class="saved-inspection-empty">还没有保存的巡检，从右侧对话开始 →</p>'
    }
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
          (item) => `<button class="context-option ${item.selected ? 'is-selected' : ''}" data-action="CONTEXT_ITEM_TOGGLED" data-context-id="${escapeHtml(item.id)}" aria-pressed="${item.selected}" type="button">
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
  return vm.workspace ? renderContextSelection(vm) : renderSavedInspectionHome(vm);
}
