export function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function icon(name, className = '') {
  const paths = {
    arrow: '<path d="m8 5 7 7-7 7"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 3 7 3 7H3s3-1 3-7Zm4 11h4"/>',
    check: '<path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="10"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    lines: '<path d="M4 6h16M4 12h10M4 18h16"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    pulse: '<path d="M3 12h4l2-7 5 14 2-7h5"/>',
    radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 18 6M12 3v18M3 12h18"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    shield: '<path d="M12 2 20 5v6c0 5-3.4 9.5-8 11-4.6-1.5-8-6-8-11V5l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
    spark:
      '<path d="m12 2 1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2Zm7 13 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/>',
  };
  return `<svg class="icon ${className}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] ?? paths.grid}</svg>`;
}

export function statusLabel(status) {
  const labels = {
    active: '进行中',
    blocked: '受阻',
    completed: '已完成',
    critical: '严重',
    failed: '失败',
    healthy: '正常',
    not_started: '未开始',
    partial: '部分完成',
    passed: '通过',
    recovering: '恢复中',
    scheduled: '待运行',
    unknown: '未知',
    warning: '关注',
    review: '待审核',
    approved: '已批准',
    assigned: '已分派',
    new: '新增',
    confirmed: '已确认',
  };
  return labels[status] ?? status;
}

export function badge(status, label = statusLabel(status)) {
  return `<span class="status-badge status-badge--${escapeHTML(status)}"><i></i>${escapeHTML(label)}</span>`;
}

export function polylinePoints(values, width = 720, height = 190, padding = 14) {
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = padding + (index / (values.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function evidenceCount(progress) {
  return progress?.evidencePackage?.length ?? 0;
}
