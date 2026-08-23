import { escapeHtml } from './view-utils.mjs';

function requireShareableRun(run) {
  if (!run?.report || !run.completedAt) throw new TypeError('A completed inspection run is required');
  return run.report;
}

function isoMinute(value) {
  return new Date(value).toISOString().slice(0, 16).replace('T', ' ');
}

export function buildReportShareText(run, taskName) {
  const report = requireShareableRun(run);
  const evidence = report.keyEvidence.slice(0, 2).join('；');
  return [
    `结论：${report.actionLabel}`,
    `时间：${isoMinute(run.completedAt)}`,
    `任务：${String(taskName).trim()}`,
    `关键证据：${evidence}`,
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
  const name = escapeHtml(String(taskName).trim());
  const evidence = report.keyEvidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
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
    .meta{color:#72e6a6;font-size:12px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .pair section{margin:0}.foot{font-size:12px;color:#738aa3;text-align:center;border:0;background:transparent}
    @media(max-width:560px){body{padding:16px 12px}.pair{grid-template-columns:1fr}h1{font-size:24px}}
  </style>
</head>
<body>
  <header><div class="meta">离线巡检报告 · ${escapeHtml(isoMinute(run.completedAt))}</div><h1>${escapeHtml(report.actionLabel)}</h1><p>${escapeHtml(report.title)}</p></header>
  <section><h2>${name}</h2><p>${escapeHtml(report.summary)}</p></section>
  <div class="pair"><section><h2>关键证据</h2><ul>${evidence}</ul></section><section><h2>结论边界</h2><p>${escapeHtml(report.scopeStatement)}</p><h2>残余风险</h2><ul>${risks}</ul></section></div>
  <section class="foot">本报告由 NOVA 巡检 Copilot 离线演示生成 · 数据为 mock</section>
</body>
</html>`;
}
