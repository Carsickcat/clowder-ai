'use client';

import type { ConnectionLevel } from '@/hooks/useConnectionStatus';

interface ConnectionStatusBarProps {
  api: ConnectionLevel;
  socket: ConnectionLevel;
  upstream: ConnectionLevel;
  isReadonly: boolean;
  checkedAt: number | null;
  isOfflineSnapshot: boolean;
}

const LEVEL_LABEL: Record<ConnectionLevel, string> = {
  online: '畅通',
  degraded: '降级',
  offline: '离线',
};

const LEVEL_CLASS: Record<ConnectionLevel, string> = {
  online: 'border-codex-light bg-codex-bg text-codex-dark',
  degraded: 'border-[var(--console-border-soft)] bg-[var(--console-hover-bg)] text-cafe-secondary',
  offline: 'border-[var(--console-border-soft)] bg-cafe-surface-sunken text-cafe-muted',
};

const LEVEL_DOT_COLOR: Record<ConnectionLevel, string> = {
  online: 'var(--color-codex-primary)',
  degraded: 'var(--conn-amber-text)',
  offline: 'var(--cafe-text-muted)',
};

function formatCheckTime(checkedAt: number | null): string {
  if (!checkedAt) return '等待探测中';
  return new Date(checkedAt).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function StatusPill({ label, level }: { label: string; level: ConnectionLevel }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${LEVEL_CLASS[level]}`}>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: LEVEL_DOT_COLOR[level] }} />
        <span className="text-xs font-medium tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-sm font-semibold">{LEVEL_LABEL[level]}</p>
    </div>
  );
}

export function ConnectionStatusBar({
  api,
  socket,
  upstream,
  isReadonly,
  checkedAt,
  isOfflineSnapshot,
}: ConnectionStatusBarProps) {
  const hasIssue = api !== 'online' || socket !== 'online' || upstream !== 'online';
  if (!hasIssue && !isOfflineSnapshot) return null;
  const issueSummary = [
    ['本地 API', api],
    ['Socket', socket],
    ['上游模型', upstream],
  ]
    .filter(([, level]) => level !== 'online')
    .map(([label, level]) => `${label} ${LEVEL_LABEL[level as ConnectionLevel]}`)
    .join(' · ');

  return (
    <section
      className="mx-auto mb-3 w-full max-w-3xl rounded-2xl bg-[var(--console-card-bg)] p-3 shadow-[0_8px_22px_rgba(43,33,26,0.04)] backdrop-blur"
      data-testid="connection-status-bar"
    >
      <details className="sm:hidden">
        <summary className="min-h-11 cursor-pointer list-none rounded-xl px-2 py-3 text-sm font-medium text-cafe-secondary">
          连接{issueSummary ? ` · ${issueSummary}` : ' · 离线快照'}
        </summary>
        <div className="grid grid-cols-1 gap-2 pt-2">
          <StatusPill label="本地 API" level={api} />
          <StatusPill label="Socket" level={socket} />
          <StatusPill label="上游模型" level={upstream} />
        </div>
        {(isOfflineSnapshot || isReadonly) && (
          <div className="mt-2 rounded-xl border border-[var(--console-border-soft)] bg-[var(--console-hover-bg)] px-3 py-2 text-xs text-cafe-secondary">
            {isReadonly
              ? '当前网络不可用，输入区已切换为只读模式。恢复连接后可继续发送消息。'
              : '当前展示的是本地离线快照（最后一次成功缓存的消息）。'}
          </div>
        )}
      </details>

      <div className="hidden flex-wrap items-center justify-between gap-2 sm:flex">
        <p className="text-xs font-medium text-cafe-secondary">连接状态 · Steam & Brew</p>
        <p className="text-xs text-cafe-muted">最近探测 {formatCheckTime(checkedAt)}</p>
      </div>

      <div className="mt-2 hidden sm:grid grid-cols-1 gap-2 sm:grid-cols-3">
        <StatusPill label="本地 API" level={api} />
        <StatusPill label="Socket" level={socket} />
        <StatusPill label="上游模型" level={upstream} />
      </div>

      {(isOfflineSnapshot || isReadonly) && (
        <div className="mt-2 hidden sm:block rounded-xl border border-[var(--console-border-soft)] bg-[var(--console-hover-bg)] px-3 py-2 text-xs text-cafe-secondary">
          {isReadonly
            ? '当前网络不可用，输入区已切换为只读模式。恢复连接后可继续发送消息。'
            : '当前展示的是本地离线快照（最后一次成功缓存的消息）。'}
        </div>
      )}
    </section>
  );
}
