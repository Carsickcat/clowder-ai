import { escapeHtml } from './view-utils.mjs';

const STATUS_COPY = {
  exact: {
    stateLabel: '精准匹配',
    action: 'PLAYBOOK_EXECUTION_STARTED',
    actionLabel: '按方案直跑',
  },
  'minor-drift': {
    stateLabel: '需确认差异',
    action: 'PLAYBOOK_DIFF_CONFIRMED',
    actionLabel: '确认差异并继续',
  },
  'major-drift': {
    stateLabel: '禁止直跑',
    action: 'PLAYBOOK_REGENERATED',
    actionLabel: '重新生成（参考旧方案）',
  },
};

function renderMatchTitle(match) {
  if (match.status === 'exact') {
    return `命中方案：${escapeHtml(match.title)} · v${match.playbookRef.version}`;
  }
  if (match.status === 'major-drift') {
    return `方案 v${match.playbookRef.version} 不适用：${match.differences.length} 项重大差异`;
  }
  return '确认方案差异';
}

const DIRECTION_LABELS = {
  added: '新增',
  changed: '变更',
  removed: '失效',
};

function renderValidation(validation) {
  return `<li class="${escapeHtml(validation.status)}"><span>${escapeHtml(validation.label)}</span><strong>${escapeHtml(validation.detail)}</strong></li>`;
}

function renderDifferences(match) {
  return `<ul class="playbook-difference-list">
    ${match.differences
      .map(
        (
          difference,
        ) => `<li data-difference-dimension="${escapeHtml(difference.dimension)}" class="${escapeHtml(difference.severity)}">
          <span>${escapeHtml(difference.label)} · ${escapeHtml(DIRECTION_LABELS[difference.direction])}</span>
          <strong>${escapeHtml(difference.summary)}</strong>
        </li>`,
      )
      .join('')}
  </ul>`;
}

function renderDriftReview(match, driftReviewed) {
  if (match.status !== 'major-drift') return '';
  return driftReviewed
    ? '<p class="playbook-reviewed">✓ 已确认看完全部当前差异</p>'
    : `<button class="playbook-review-drift" data-action="PLAYBOOK_DRIFT_REVIEWED" type="button">确认已查看 ${match.differences.length} 项差异</button>`;
}

function renderMatchDetails(match, driftReviewed) {
  if (match.status === 'exact') {
    return `<details class="playbook-validation">
      <summary>五项校验通过 <span>查看详情</span></summary>
      <ul>${match.validations.map(renderValidation).join('')}</ul>
    </details>`;
  }
  const content = `${renderDifferences(match)}${renderDriftReview(match, driftReviewed)}`;
  return `<div class="playbook-differences-desktop">${content}</div>
    <details class="playbook-drawer">
      <summary>查看 ${match.differences.length} 项当前差异</summary>
      <div class="playbook-drawer-body">${content}</div>
    </details>`;
}

function renderMatchActions(match, driftReviewed) {
  const copy = STATUS_COPY[match.status];
  const disabled = match.status === 'major-drift' && !driftReviewed;
  const secondary =
    match.status === 'major-drift'
      ? ''
      : '<button class="playbook-dismiss" data-action="PLAYBOOK_DISMISSED" type="button">不用方案，重新生成</button>';
  return `<div class="playbook-actions">
    <button class="compile-button playbook-primary" data-action="${copy.action}" ${disabled ? 'disabled' : ''} type="button">
      <span>${disabled ? '看完差异后可重新生成' : copy.actionLabel}</span><b>→</b>
    </button>
    ${secondary}
  </div>`;
}

export function renderPlaybookMatch(playbookView) {
  const match = playbookView?.match;
  if (!match) return '';
  const copy = STATUS_COPY[match.status];
  return `<section class="playbook-match ${match.status}" data-testid="playbook-match" data-match-status="${match.status}" aria-labelledby="playbook-match-title">
    <header class="playbook-match-header">
      <div><span class="match-state">${copy.stateLabel}</span><h2 id="playbook-match-title">${renderMatchTitle(match)}</h2></div>
      <div class="playbook-signals"><span class="readiness">匹配 ${match.score}%</span><span class="readiness">${escapeHtml(match.lastUsedLabel)}</span><span class="readiness">${match.differences.length} 项差异</span></div>
    </header>
    ${
      match.status === 'exact'
        ? '<div class="playbook-structure-note"><span class="info-tip" tabindex="0" aria-label="复用检查结构，证据重新采集" title="复用检查结构，证据重新采集">ⓘ</span><span>检查结构</span></div>'
        : `<div class="playbook-identity"><span>巡检方案</span><strong>${escapeHtml(match.title)} · v${match.playbookRef.version}</strong></div>`
    }
    ${match.status === 'minor-drift' ? `<p class="playbook-summary single-line-note" title="${escapeHtml(match.summary)}">${escapeHtml(match.summary)}</p>` : ''}
    ${renderMatchDetails(match, playbookView.driftReviewed)}
    ${renderMatchActions(match, playbookView.driftReviewed)}
  </section>`;
}

export function renderPlaybookReference(playbookView) {
  const reference = playbookView?.reference;
  if (!reference) return '';
  return `<section class="playbook-reference" data-testid="playbook-reference">
    <span>旧方案仅作参考</span>
    <strong>${escapeHtml(reference.playbookRef.id)} · v${reference.playbookRef.version}</strong>
    <p>${escapeHtml(reference.summary)}</p>
  </section>`;
}

export function renderPlaybookProposal(playbookView) {
  const task = playbookView?.taskInstance;
  if (!task || task.status !== 'locked') return '';
  const proposal = playbookView.proposal;
  const source = task.sourcePlaybookRef;
  const targetVersion = source ? source.version + 1 : 1;
  return `<section class="playbook-proposal" data-testid="playbook-proposal">
    <div><h3>保存方案</h3></div>
    <p class="single-line-note" title="历史任务 ${escapeHtml(task.id)} 已锁定">历史实例不受影响</p>
    ${
      proposal
        ? `<div class="playbook-proposal-status"><span>${proposal.kind === 'update' ? '方案更新' : '新方案'} v${proposal.targetVersion} · 待审批</span><strong>审批通过后，下次匹配才会生效</strong></div>`
        : `<button class="playbook-proposal-action" data-action="PLAYBOOK_PROPOSAL_SUBMITTED" type="button">${
            source ? `提交方案更新 → v${targetVersion}` : `保存为新方案 v${targetVersion}`
          }</button>`
    }
  </section>`;
}
