export function Status({ state, children }) {
  return (
    <span className={`status status-${state}`} data-status={state}>
      <span className="status-dot" aria-hidden="true" />
      {children ?? state}
    </span>
  );
}

export function Panel({ title, eyebrow, action, className = "", children }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <header className="panel-header">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h2>{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeading({ eyebrow, title, description, meta, actions }) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-heading-side">
        {meta}
        {actions && <div className="button-row">{actions}</div>}
      </div>
    </header>
  );
}

export function Metric({ label, value, detail, tone = "neutral" }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export function Icon({ name }) {
  const paths = {
    pulse: "M3 12h4l2-6 4 12 2-6h6",
    shield: "M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z",
    branch: "M6 3v12a4 4 0 004 4h8M6 8h6a4 4 0 004-4V3",
    wand: "M4 20L17 7M14 4l3 3M7 4v3M5.5 5.5h3M18 15v5M15.5 17.5h5",
    search: "M11 18a7 7 0 100-14 7 7 0 000 14zm5-2l5 5",
    report: "M6 3h9l3 3v15H6zM9 10h6M9 14h6M9 18h4",
    grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    metric: "M4 18l4-5 4 2 5-8 3 3",
    alert: "M12 3L2 21h20L12 3zm0 6v5m0 3v1",
    logs: "M4 6h16M4 12h16M4 18h10",
    trace: "M4 6h4l3 6 3-6h6M4 18h16",
    synthetic: "M5 5h14v10H5zM9 19h6M12 15v4",
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name] ?? paths.pulse} />
    </svg>
  );
}
