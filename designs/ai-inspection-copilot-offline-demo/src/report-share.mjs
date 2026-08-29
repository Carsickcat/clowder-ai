import {
  formatReportMetadata,
  projectInterpretation,
  projectReportChecks,
  projectReportEvidence,
  REPORT_STATUS_COPY,
} from './report-model.mjs';
import { escapeHtml } from './view-utils.mjs';

function requireShareableRun(run) {
  if (!run?.report || !run.completedAt) throw new TypeError('A completed inspection run is required');
  return run.report;
}

export function buildReportShareText(run, taskName) {
  const report = requireShareableRun(run);
  const metadata = formatReportMetadata(run, taskName);
  const evidence = projectReportEvidence(report)
    .slice(0, 2)
    .map((item) => `${item.label} ${item.displayValue}`)
    .join('；');
  return [
    `结论：${report.actionLabel}`,
    `报告：${metadata.line}`,
    `关键证据：${evidence}`,
    `AI 解读：${projectInterpretation(report)[0].text}`,
    `结论边界：${report.scopeStatement}`,
  ].join('\n');
}

export function buildReportFilename(run, taskName) {
  requireShareableRun(run);
  const safeName = [...String(taskName).trim()]
    .map((character) => (character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? '-' : character))
    .join('')
    .replace(/-+/g, '-')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 80);
  const [date, time] = new Date(run.completedAt).toISOString().slice(0, 16).split('T');
  const stamp = `${date.replaceAll('-', '')}-${time.replace(':', '')}`;
  return `${safeName || '巡检报告'}-${stamp}.html`;
}

export function buildStandaloneReportHtml(run, taskName) {
  const report = requireShareableRun(run);
  const metadata = formatReportMetadata(run, taskName);
  const name = escapeHtml(String(taskName).trim());
  const reportEvidence = projectReportEvidence(report);
  const evidenceTargets = new Map(
    reportEvidence.map((item, index) => [item.id, { id: `evidence-${index + 1}`, label: `证据 ${index + 1}` }]),
  );
  const evidence = reportEvidence
    .map((item, index) => {
      const status = REPORT_STATUS_COPY[item.status] ?? REPORT_STATUS_COPY.NotEvaluated;
      return `<article id="evidence-${index + 1}" class="evidence ${status.tone}"><div><strong>${escapeHtml(item.label)}</strong><span>${status.symbol} ${status.label}</span></div><small>${escapeHtml(item.entity)} · 证据 ${index + 1}</small><p>当前值 ${escapeHtml(item.displayValue)} · 门禁 ${escapeHtml(item.gateDisplayValue)}</p></article>`;
    })
    .join('');
  const checks = projectReportChecks(run)
    .map((item) => {
      const status = REPORT_STATUS_COPY[item.status] ?? REPORT_STATUS_COPY.NotEvaluated;
      return `<tr><td>${status.symbol} ${status.label}</td><td>${escapeHtml(item.check.purpose)}</td><td>${escapeHtml(item.check.entity)}</td><td>${escapeHtml(item.actualDisplay)} / ${escapeHtml(item.gateDisplay)}</td></tr>`;
    })
    .join('');
  const interpretation = projectInterpretation(report)
    .map((item) => {
      const references = item.evidenceIds
        .map((evidenceId) => evidenceTargets.get(evidenceId))
        .filter(Boolean)
        .map((target) => `<a href="#${target.id}">${target.label}</a>`)
        .join('');
      return `<article><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.text)}</p><footer>${references || '<small>证据不足</small>'}</footer></article>`;
    })
    .join('');
  const risks = report.residualRisks.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const doctype = '<!' + 'doctype html>';
  return `${doctype}
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${name} · 巡检报告</title>
  <style>
    :root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#07101f;color:#edf6ff}
    body{max-width:920px;margin:0 auto;padding:32px 20px;background:#07101f}
    header,section{border:1px solid #29415f;border-radius:16px;background:#0e1d33;padding:22px;margin-bottom:14px}
    header{border-color:#397462;background:linear-gradient(145deg,#153b37,#0e1d33)}
    h1{font-size:30px;margin:8px 0}h2{font-size:16px;margin:0 0 12px}p,li{line-height:1.7;color:#b9cadc}
    .meta{color:#72e6a6;font-size:12px}.pair,.evidence-grid,.interpretation{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .evidence{padding:14px;border:1px solid #29415f;border-radius:12px;background:#07101f}.evidence>div{display:flex;justify-content:space-between;gap:12px}.evidence.violated{border-color:#a94456}.evidence.unresolved{border-color:#8d6b35}.evidence small{color:#738aa3}
    table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #29415f;text-align:left;color:#b9cadc}
    .interpretation article{padding:14px;border:1px solid #29415f;border-radius:12px;background:#07101f}.interpretation footer{display:flex;flex-wrap:wrap;gap:8px}.interpretation a{color:#72e6a6;text-decoration:none;border:1px solid #397462;border-radius:999px;padding:3px 8px;font-size:12px}.interpretation small{color:#738aa3}
    .pair section{margin:0}.foot{font-size:12px;color:#738aa3;text-align:center;border:0;background:transparent}
    @media(max-width:560px){body{padding:16px 12px}.pair,.evidence-grid,.interpretation{grid-template-columns:1fr}h1{font-size:24px}table{font-size:12px}}
  </style>
</head>
<body>
  <header><div class="meta">${escapeHtml(metadata.line)}</div><h1>${escapeHtml(report.actionLabel)}</h1><p>${escapeHtml(report.title)}</p></header>
  <section><h2>${name}</h2><p>${escapeHtml(report.summary)}</p></section>
  <section><h2>证据仪表盘</h2><div class="evidence-grid">${evidence}</div></section>
  <section><h2>检查结果</h2><table><thead><tr><th>状态</th><th>检查</th><th>对象</th><th>实际 / 门禁</th></tr></thead><tbody>${checks}</tbody></table></section>
  <section><h2>AI 解读</h2><div class="interpretation">${interpretation}</div></section>
  <div class="pair"><section><h2>结论边界</h2><p>${escapeHtml(report.scopeStatement)}</p></section><section><h2>残余风险</h2><ul>${risks}</ul></section></div>
  <section class="foot">本报告由 NOVA 巡检 Copilot 离线演示生成 · 数据为 mock</section>
</body>
</html>`;
}
