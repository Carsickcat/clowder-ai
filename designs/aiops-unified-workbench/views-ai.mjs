import { escapeHTML, icon } from './view-utils.mjs';

const sections = [
  ['facts', '事实', 'FACTS', 'fact'],
  ['hypotheses', '假设', 'HYPOTHESES', 'hypothesis'],
  ['gaps', '证据缺口', 'EVIDENCE GAPS', 'gap'],
  ['recommendations', '建议', 'RECOMMENDATIONS', 'recommendation'],
];

function sourceLine(item) {
  if (item.sourceIds?.length)
    return `<span class="ai-source">来源 · ${item.sourceIds.map(escapeHTML).join(' · ')}</span>`;
  return `<span class="ai-source ai-source--gap">验证动作 · ${escapeHTML(item.verifyAction)}</span>`;
}

function insightCard(type, item, verdict) {
  return `<article class="ai-insight ai-insight--${type}">
    <div class="ai-insight__top"><span>${type.toUpperCase()}</span>${item.confidence ? `<em>${item.confidence}%</em>` : ''}</div>
    <p>${escapeHTML(item.text)}</p>
    ${sourceLine(item)}
    <div class="ai-verdicts">
      <button type="button" class="${verdict === 'accepted' ? 'is-active' : ''}" data-insight-id="${item.id}" data-ai-verdict="accepted">${icon('check')} 接纳</button>
      <button type="button" class="${verdict === 'rejected' ? 'is-active' : ''}" data-insight-id="${item.id}" data-ai-verdict="rejected">反驳</button>
      <button type="button" class="${verdict === 'needs_evidence' ? 'is-active' : ''}" data-insight-id="${item.id}" data-ai-verdict="needs_evidence">补证据</button>
    </div>
  </article>`;
}

export function renderAIInspector(state) {
  const scenario = state.scenarios[state.activeScenarioId];
  const progress = state.scenarioProgress[scenario.id];
  return `<header class="ai-inspector__header">
      <div><span class="ai-orb">${icon('spark')}</span><p>AI INVESTIGATOR</p><h2>证据调查员</h2></div>
      <button type="button" data-toggle-ai aria-label="收起 AI 调查员">${icon('close')}</button>
    </header>
    <div class="ai-scope"><span>${icon('lock')} SCOPE</span><strong>${escapeHTML(scenario.context.service)}</strong><small>${escapeHTML(scenario.context.timeRange)}</small></div>
    <div class="ai-inspector__body">
      ${sections.map(([key, zh, en, type]) => `<section class="ai-section"><div class="ai-section__title"><span>${en}</span><strong>${zh}</strong><em>${scenario.ai[key].length}</em></div>${scenario.ai[key].map((item) => insightCard(type, item, progress.aiVerdicts[item.id])).join('')}</section>`).join('')}
    </div>
    <footer class="ai-disclaimer">${icon('shield')} AI 只生成候选与解释；最终判断、权限与生产动作由人负责。</footer>`;
}
