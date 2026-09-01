import { escapeHtml } from './view-utils.mjs';

export function renderTrendChart(measurement) {
  const series = Array.isArray(measurement?.series)
    ? measurement.series.filter((point) => Number.isFinite(point?.value))
    : [];
  if (measurement?.kind !== 'numeric' || series.length < 2) return '';
  const threshold = measurement.gate?.value;
  const values = series.map((point) => point.value);
  if (Number.isFinite(threshold)) values.push(threshold);
  let minimum = Math.min(...values);
  let maximum = Math.max(...values);
  if (minimum === maximum) {
    const padding = Math.abs(minimum) * 0.05 || 1;
    minimum -= padding;
    maximum += padding;
  }
  const left = 16;
  const right = 304;
  const top = 12;
  const bottom = 76;
  const x = (index) => left + (index * (right - left)) / (series.length - 1);
  const y = (value) => bottom - ((value - minimum) / (maximum - minimum)) * (bottom - top);
  const points = series.map((point, index) => `${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
  const thresholdLine = Number.isFinite(threshold)
    ? `<line class="trend-threshold-line" x1="${left}" y1="${y(threshold).toFixed(1)}" x2="${right}" y2="${y(threshold).toFixed(1)}"></line><text class="trend-threshold-label" x="${right}" y="${Math.max(10, y(threshold) - 4).toFixed(1)}" text-anchor="end">门禁 ${escapeHtml(measurement.gate.displayValue)}</text>`
    : '';
  const dots = series
    .map(
      (point, index) =>
        `<circle cx="${x(index).toFixed(1)}" cy="${y(point.value).toFixed(1)}" r="2.5"><title>${escapeHtml(point.label)} ${escapeHtml(point.value)}${escapeHtml(measurement.unit ?? '')}</title></circle>`,
    )
    .join('');
  return `<svg class="trend-chart" data-trend-metric-id="${escapeHtml(measurement.metricId ?? measurement.id)}" role="img" aria-label="${escapeHtml(measurement.label)}趋势" viewBox="0 0 320 96" preserveAspectRatio="none">
    <line class="trend-axis" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}"></line>
    ${thresholdLine}
    <polyline class="trend-series-line" points="${points}"></polyline>${dots}
    <text class="trend-time-label" x="${left}" y="91">${escapeHtml(series[0].label)}</text><text class="trend-time-label" x="${right}" y="91" text-anchor="end">${escapeHtml(series.at(-1).label)}</text>
  </svg>`;
}
