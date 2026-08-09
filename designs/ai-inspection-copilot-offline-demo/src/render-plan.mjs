import { escapeHtml } from "./view-utils.mjs";

function renderCandidate(candidate, disposition) {
  const accepted = disposition?.status === "accepted";
  const rejected = disposition?.status === "rejected";
  const status = accepted
    ? "已纳入正式计划"
    : rejected
      ? "已拒绝并记录理由"
      : "待处置";
  return `
    <article class="candidate-card ${accepted ? "is-accepted" : ""} ${rejected ? "is-rejected" : ""}">
      <header><span>待确认 · ${escapeHtml(candidate.criticality)} criticality</span><strong>${status}</strong></header>
      <h4>${escapeHtml(candidate.purpose)}</h4>
      <p>${escapeHtml(candidate.rationale)}</p>
      <code>${escapeHtml(candidate.metric)}</code>
      ${
        !accepted && !rejected
          ? `<div class="candidate-actions">
              <button data-action="CANDIDATE_DISPOSED" data-candidate-id="${candidate.id}" data-disposition="accepted" type="button">纳入计划</button>
              <button class="button-ghost" data-action="CANDIDATE_DISPOSED" data-candidate-id="${candidate.id}" data-disposition="rejected" data-reason="专家确认该风险不属于本次变更边界" type="button">拒绝并留痕</button>
            </div>`
          : rejected
            ? `<small>拒绝理由：${escapeHtml(disposition.reason)}</small>`
            : ""
      }
    </article>`;
}

function renderSourceRefs(check, contextSources) {
  const sourceById = new Map(contextSources.map((source) => [source.id, source]));
  return check.sourceRefs
    .map((sourceId) => {
      const source = sourceById.get(sourceId);
      return `<li><span>${escapeHtml(source?.kind ?? "未知来源")}</span><strong>${escapeHtml(source?.label ?? sourceId)}</strong></li>`;
    })
    .join("");
}

function renderCheck(check, isCandidate, contextSources) {
  return `
    <details class="check-card ${isCandidate ? "is-candidate-check" : ""}">
      <summary>
        <span class="check-index">${check.priority === "required" ? "必" : "荐"}</span>
        <span class="check-summary">
          <span>${escapeHtml(check.severity)}</span>
          <strong>${escapeHtml(check.purpose)}</strong>
          <code>${escapeHtml(check.metric)}</code>
        </span>
        <span class="check-toggle">来源与判定依据⌄</span>
      </summary>
      <div class="check-body">
        <p>${escapeHtml(check.rationale)}</p>
        <dl>
          <div><dt>目标实体</dt><dd>${escapeHtml(check.entity)}</dd></div>
          <div><dt>执行能力</dt><dd>${escapeHtml(check.capability)}</dd></div>
          <div><dt>判定规则</dt><dd>${escapeHtml(check.rule)}</dd></div>
          <div><dt>时间与基线</dt><dd>${escapeHtml(check.window)} · ${escapeHtml(check.baseline)}</dd></div>
          <div><dt>失败动作</dt><dd>${escapeHtml(check.failureAction)}</dd></div>
          <div class="check-sources"><dt>事实来源</dt><dd><ul>${renderSourceRefs(check, contextSources)}</ul></dd></div>
        </dl>
      </div>
    </details>`;
}

function renderPlanStats(summary) {
  return `
    <div class="plan-stats" aria-label="任务草案分级统计">
      <div data-testid="plan-stat-required"><span>必查</span><strong>${summary.required}</strong></div>
      <div data-testid="plan-stat-recommended"><span>建议</span><strong>${summary.recommended}</strong></div>
      <div data-testid="plan-stat-pending"><span>待确认</span><strong>${summary.pending}</strong></div>
      <div><span>已忽略</span><strong>${summary.rejected}</strong></div>
    </div>`;
}

export function renderInspectionPlan(vm) {
  const disposition = vm.state.candidateDisposition;
  const candidates = vm.scenario.candidateChecks
    .map((candidate) => renderCandidate(candidate, disposition[candidate.id]))
    .join("");
  const acceptedIds = new Set(
    Object.entries(disposition)
      .filter(([, item]) => item.status === "accepted")
      .map(([id]) => id),
  );
  return `
    <div class="plan-stage" data-testid="inspection-plan">
      <header class="stage-heading">
        <div><span class="module-tag">Module 03 · Plan compiler</span><h2>可审阅的 InspectionPlan</h2></div>
        <span class="readiness ${vm.readiness.status}">${vm.readiness.status === "ready" ? "Ready · 可确认" : "Blocked · 候选待处置"}</span>
      </header>
      <p class="stage-lead">模板保底，多源约束，AI 只补洞。待确认项被接受前不属于正式 Check，也没有门禁权。</p>
      ${renderPlanStats(vm.planSummary)}
      <section class="plan-section" aria-labelledby="pending-title">
        <h3 id="pending-title">待确认项</h3>
        <div class="candidate-stack">${candidates}</div>
      </section>
      <section class="plan-section" aria-labelledby="formal-title">
        <h3 id="formal-title">正式检查</h3>
        <div class="check-stack">
          ${vm.committedChecks
            .map((check) =>
              renderCheck(
                check,
                acceptedIds.has(check.id),
                vm.scenario.contextSources,
              ),
            )
            .join("")}
        </div>
      </section>
    </div>`;
}
