const TREND_LABELS = Object.freeze(['-15m', '-12m', '-9m', '-6m', '-3m', '现在']);

export function createTrendSeries(...values) {
  if (values.length !== TREND_LABELS.length || values.some((value) => !Number.isFinite(value))) {
    throw new TypeError('Trend evidence requires six finite values');
  }
  return TREND_LABELS.map((label, index) => ({ label, value: values[index] }));
}
