"use client";

function xAt(index, length, width = 620, left = 42, right = 18) {
  return left + (index / Math.max(1, length - 1)) * (width - left - right);
}

function yAt(value, min, max, height = 220, top = 18, bottom = 30) {
  return top + ((max - value) / (max - min)) * (height - top - bottom);
}

function linePath(values, min, max, width = 620, height = 220) {
  return values
    .map((value, index) => {
      const x = xAt(index, values.length, width);
      const y = yAt(value, min, max, height);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function areaPath(high, low, min, max, width = 620, height = 220) {
  const upper = high.map(
    (value, index) =>
      `${xAt(index, high.length, width).toFixed(1)},${yAt(
        value,
        min,
        max,
        height,
      ).toFixed(1)}`,
  );
  const lower = low
    .map(
      (value, index) =>
        `${xAt(index, low.length, width).toFixed(1)},${yAt(
          value,
          min,
          max,
          height,
        ).toFixed(1)}`,
    )
    .reverse();
  return `M${upper.join(" L")} L${lower.join(" L")} Z`;
}

function Axis({ labels, minLabel, maxLabel }) {
  return (
    <>
      {[0, 1, 2, 3].map((index) => (
        <line
          key={index}
          x1="42"
          x2="602"
          y1={26 + index * 52}
          y2={26 + index * 52}
          className="grid-line"
        />
      ))}
      <text x="6" y="28" className="axis-label">
        {maxLabel}
      </text>
      <text x="6" y="184" className="axis-label">
        {minLabel}
      </text>
      {labels.map((label, index) => (
        <text
          key={label}
          x={42 + index * (560 / Math.max(1, labels.length - 1))}
          y="211"
          textAnchor={
            index === 0
              ? "start"
              : index === labels.length - 1
                ? "end"
                : "middle"
          }
          className="axis-label"
        >
          {label}
        </text>
      ))}
    </>
  );
}

export function ForecastChart({ mission, compact = false }) {
  const history = mission.forecastHistory;
  const median = mission.forecastMedian;
  const fullMedian = [history.at(-1), ...median];
  const fullLow = [history.at(-1), ...mission.forecastLow];
  const fullHigh = [history.at(-1), ...mission.forecastHigh];
  const splitX = 42 + (8 / 14) * 560;
  const capacityY = yAt(220, 80, 245);

  return (
    <div className={`chart-wrap ${compact ? "chart-compact" : ""}`}>
      <div className="chart-legend">
        <span>
          <i className="legend-line actual" />
          Actual RPS
        </span>
        <span>
          <i className="legend-line forecast" />
          Forecast p50
        </span>
        <span>
          <i className="legend-band" />
          90% interval
        </span>
        <span>
          <i className="legend-line threshold" />
          Capacity 220k
        </span>
      </div>
      <svg
        className="chart"
        viewBox="0 0 620 220"
        role="img"
        aria-label="实际流量、预测区间和容量阈值"
      >
        <Axis
          labels={["19:45", "20:00", "20:15", "20:30", "20:45"]}
          minLabel="80k"
          maxLabel="245k"
        />
        <rect
          data-chart-part="forecast-band"
          x={splitX}
          y="18"
          width={602 - splitX}
          height="174"
          className="forecast-window"
        />
        <path
          data-chart-part="forecast-band"
          d={areaPath(fullHigh, fullLow, 80, 245, 310, 220)}
          transform={`translate(${splitX - 42},0) scale(${(602 - splitX) / 250},1)`}
          className="forecast-area"
        />
        <line
          data-chart-part="capacity-threshold"
          x1="42"
          x2="602"
          y1={capacityY}
          y2={capacityY}
          className="threshold-line"
        />
        <path d={linePath(history, 80, 245)} className="series series-actual" />
        <path
          d={linePath(fullMedian, 80, 245, 310, 220)}
          transform={`translate(${splitX - 42},0) scale(${(602 - splitX) / 250},1)`}
          className="series series-forecast"
        />
        <line
          data-chart-part="change-marker"
          x1={splitX}
          x2={splitX}
          y1="18"
          y2="192"
          className="event-marker"
        />
        <text x={splitX + 6} y="30" className="event-label">
          20:18 now
        </text>
        <circle
          data-chart-part="evidence-point"
          cx={splitX}
          cy={yAt(181, 80, 245)}
          r="5"
          className="evidence-dot"
        />
        <g data-chart-part="missing-data-segment" opacity="0">
          <line x1="0" x2="0" y1="0" y2="0" />
        </g>
      </svg>
      <div className="chart-foot">
        <span>输入历史：14d 同星期窗口</span>
        <span>readiness: {mission.forecastReadiness}</span>
        <strong>风险窗口 {mission.forecastWindow}</strong>
      </div>
    </div>
  );
}

export function CanaryControlChart({ change, onEvidence }) {
  const min = 90;
  const max = 160;
  const markerX = xAt(2, change.canarySeries.length);
  const evidenceX = xAt(7, change.canarySeries.length);
  const evidenceY = yAt(change.canarySeries[7], min, max);

  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <span>
          <i className="legend-line canary" />
          canary v3.18.0
        </span>
        <span>
          <i className="legend-line control" />
          control v3.17.4
        </span>
        <span>
          <i className="legend-line threshold" />
          p95 threshold 120ms
        </span>
      </div>
      <svg
        className="chart"
        viewBox="0 0 620 220"
        role="img"
        aria-label="Canary 和 control 延迟对照"
      >
        <Axis
          labels={["19:58", "20:03", "20:08", "20:13", "20:18"]}
          minLabel="90ms"
          maxLabel="160ms"
        />
        <line
          data-chart-part="capacity-threshold"
          x1="42"
          x2="602"
          y1={yAt(120, min, max)}
          y2={yAt(120, min, max)}
          className="threshold-line"
        />
        <path
          data-chart-part="canary-series"
          d={linePath(change.canarySeries, min, max)}
          className="series series-canary"
        />
        <path
          data-chart-part="control-series"
          d={linePath(change.controlSeries, min, max)}
          className="series series-control"
        />
        <line
          data-chart-part="change-marker"
          x1={markerX}
          x2={markerX}
          y1="18"
          y2="192"
          className="event-marker"
        />
        <text x={markerX + 6} y="30" className="event-label">
          deploy
        </text>
        <circle
          data-chart-part="evidence-point"
          cx={evidenceX}
          cy={evidenceY}
          r="7"
          className="evidence-dot clickable-dot"
          onClick={onEvidence}
        />
        <g data-chart-part="forecast-band" opacity="0">
          <path d="M0,0" />
        </g>
        <g data-chart-part="missing-data-segment" opacity="0">
          <line x1="0" x2="0" y1="0" y2="0" />
        </g>
      </svg>
      <div className="chart-foot">
        <span>对照窗口 20m · 同服务同区域</span>
        <strong>异常点可钉入 Investigation</strong>
      </div>
    </div>
  );
}

export function JourneyTrendChart({ onEvidence }) {
  const values = [
    99.94,
    99.92,
    99.9,
    99.88,
    99.82,
    99.72,
    99.69,
    null,
    null,
    99.76,
  ];
  const points = values
    .map((value, index) =>
      value == null
        ? null
        : {
            x: xAt(index, values.length),
            y: yAt(value, 99.5, 100.0),
          },
    )
    .filter(Boolean);
  const beforeGap = points
    .slice(0, 7)
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const afterGap = points
    .slice(7)
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");

  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <span>
          <i className="legend-line actual" />
          成功率
        </span>
        <span>
          <i className="legend-line threshold" />
          SLO 99.85%
        </span>
        <span>
          <i className="legend-gap" />
          cn-south 数据缺口
        </span>
      </div>
      <svg
        className="chart"
        viewBox="0 0 620 220"
        role="img"
        aria-label="旅程成功率与数据缺口"
      >
        <Axis
          labels={["19:45", "20:00", "20:15", "20:30"]}
          minLabel="99.5%"
          maxLabel="100%"
        />
        <line
          data-chart-part="capacity-threshold"
          x1="42"
          x2="602"
          y1={yAt(99.85, 99.5, 100)}
          y2={yAt(99.85, 99.5, 100)}
          className="threshold-line"
        />
        <path d={beforeGap} className="series series-actual" />
        <path d={afterGap} className="series series-actual" />
        <rect
          data-chart-part="missing-data-segment"
          x={xAt(6.7, values.length)}
          y="18"
          width={xAt(8.5, values.length) - xAt(6.7, values.length)}
          height="174"
          className="missing-segment"
        />
        <line
          data-chart-part="change-marker"
          x1={xAt(4, values.length)}
          x2={xAt(4, values.length)}
          y1="18"
          y2="192"
          className="event-marker"
        />
        <circle
          data-chart-part="evidence-point"
          cx={xAt(5, values.length)}
          cy={yAt(99.72, 99.5, 100)}
          r="7"
          className="evidence-dot clickable-dot"
          onClick={onEvidence}
        />
        <g data-chart-part="forecast-band" opacity="0">
          <path d="M0,0" />
        </g>
        <g data-chart-part="canary-series" opacity="0">
          <path d="M0,0" />
        </g>
        <g data-chart-part="control-series" opacity="0">
          <path d="M0,0" />
        </g>
      </svg>
      <div className="chart-foot">
        <span>freshness: cn-east 12s / cn-south stale 6m</span>
        <strong>缺口期间禁止健康结论</strong>
      </div>
    </div>
  );
}

export function MiniBars({ values, labels }) {
  const max = Math.max(...values);
  return (
    <div className="mini-bars" role="img" aria-label="交易漏斗对比">
      {values.map((value, index) => (
        <div className="mini-bar-row" key={labels[index]}>
          <span>{labels[index]}</span>
          <div>
            <i style={{ width: `${(value / max) * 100}%` }} />
          </div>
          <strong>{value}%</strong>
        </div>
      ))}
    </div>
  );
}
