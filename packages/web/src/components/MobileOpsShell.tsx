'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApprovalHubStore } from '@/stores/approvalHubStore';
import type { CatInvocationInfo, TaskProgressState } from '@/stores/chat-types';
import { nextTaskProgressSnapshotStartedAt, useChatStore } from '@/stores/chatStore';
import { useTaskStore } from '@/stores/taskStore';
import { apiFetch } from '@/utils/api-client';
import { ApprovalPanel } from './ApprovalPanel';
import { ArtifactsPanel } from './ArtifactsPanel';
import { PlanBoardPanel } from './PlanBoardPanel';
import { TaskBoardPanel } from './TaskBoardPanel';

export type MobileOpsSurface = 'chat' | 'work' | 'files' | 'approval';

interface MobileOpsShellProps {
  surface: MobileOpsSurface;
  onSurfaceChange: (surface: MobileOpsSurface) => void;
  threadId: string;
  catInvocations: Record<string, CatInvocationInfo>;
  socketConnected: boolean;
  hasActiveInvocation: boolean;
}

const SURFACES: Array<{ id: MobileOpsSurface; label: string; icon: string }> = [
  { id: 'chat', label: '对话', icon: 'chat' },
  { id: 'work', label: '工作', icon: 'work' },
  { id: 'files', label: '产物', icon: 'files' },
  { id: 'approval', label: '审批', icon: 'approval' },
];

function SurfaceIcon({ name }: { name: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    focusable: false,
  };
  if (name === 'work') {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <path d="m3 6 1.2 1.2L6.5 4.8M3 12l1.2 1.2 2.3-2.4M3 18l1.2 1.2 2.3-2.4" />
      </svg>
    );
  }
  if (name === 'files') {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M3 7.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        <path d="M3 7.5V5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v2.5" />
      </svg>
    );
  }
  if (name === 'approval') {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M9 3h6l1 2h3v16H5V5h3Z" />
        <path d="m8 13 2.5 2.5L16 10" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" {...common}>
      <path d="M4 5h16v11H8l-4 4Z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  );
}

function normalizeTaskStatus(status: string): 'pending' | 'in_progress' | 'completed' {
  if (status === 'in_progress') return 'in_progress';
  if (status === 'completed') return 'completed';
  return 'pending';
}

export function MobileOpsShell({
  surface,
  onSurfaceChange,
  threadId,
  catInvocations,
  socketConnected,
  hasActiveInvocation,
}: MobileOpsShellProps) {
  const approvalCount = useApprovalHubStore((state) => state.count);
  const fetchPending = useApprovalHubStore((state) => state.fetchPending);
  const setTasks = useTaskStore((state) => state.setTasks);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [artifactRefreshKey, setArtifactRefreshKey] = useState(0);
  const generationRef = useRef(0);

  const reconcile = useCallback(async () => {
    const generation = ++generationRef.current;
    setSyncState('syncing');

    const refreshTasks = async () => {
      const response = await apiFetch(`/api/tasks?threadId=${encodeURIComponent(threadId)}&kind=work`);
      if (!response.ok) throw new Error(`tasks snapshot failed (${response.status})`);
      const data = (await response.json()) as { tasks?: Parameters<typeof setTasks>[0] };
      if (generationRef.current !== generation || useChatStore.getState().currentThreadId !== threadId) return;
      setTasks(data.tasks ?? []);
    };

    const refreshProgress = async () => {
      const snapshotStartedAt = nextTaskProgressSnapshotStartedAt();
      const response = await apiFetch(`/api/threads/${encodeURIComponent(threadId)}/task-progress`);
      if (!response.ok) throw new Error(`task progress snapshot failed (${response.status})`);
      const data = (await response.json()) as {
        taskProgress?: Record<
          string,
          {
            tasks: Array<{ id: string; subject: string; status: string; activeForm?: string }>;
            status?: 'running' | 'completed' | 'interrupted';
            updatedAt?: number;
            lastInvocationId?: string;
            interruptReason?: string;
          }
        >;
      };
      if (generationRef.current !== generation || useChatStore.getState().currentThreadId !== threadId) return;
      const snapshot: Record<string, TaskProgressState> = {};
      for (const [catId, progress] of Object.entries(data.taskProgress ?? {})) {
        snapshot[catId] = {
          tasks: progress.tasks.map((task) => ({
            id: task.id,
            subject: task.subject,
            status: normalizeTaskStatus(task.status),
            ...(task.activeForm ? { activeForm: task.activeForm } : {}),
          })),
          snapshotStatus: progress.status,
          lastUpdate: progress.updatedAt ?? Date.now(),
          lastInvocationId: progress.lastInvocationId,
          interruptReason: progress.interruptReason,
        };
      }
      useChatStore.getState().reconcileThreadTaskProgress(threadId, snapshot, snapshotStartedAt);
    };

    const results = await Promise.allSettled([refreshTasks(), refreshProgress(), fetchPending()]);
    if (generationRef.current !== generation) return;
    setArtifactRefreshKey((value) => value + 1);
    setSyncState(results.some((result) => result.status === 'rejected') ? 'error' : 'idle');
  }, [fetchPending, setTasks, threadId]);

  useEffect(() => {
    if (surface !== 'chat') void reconcile();
  }, [surface, reconcile]);

  useEffect(() => {
    if (!socketConnected) return;
    void reconcile();
  }, [socketConnected, reconcile]);

  useEffect(() => {
    const handleForeground = () => {
      if (document.visibilityState === 'visible') void reconcile();
    };
    const handleOnline = () => void reconcile();
    document.addEventListener('visibilitychange', handleForeground);
    window.addEventListener('online', handleOnline);
    return () => {
      generationRef.current += 1;
      document.removeEventListener('visibilitychange', handleForeground);
      window.removeEventListener('online', handleOnline);
    };
  }, [reconcile]);

  const title = surface === 'work' ? '工作进度' : surface === 'files' ? '产物' : '审批';

  return (
    <>
      {surface !== 'chat' && (
        <section
          className="fixed inset-0 z-30 flex flex-col bg-cafe-surface text-cafe lg:hidden"
          aria-label={title}
          data-testid="mobile-ops-surface"
        >
          <header className="flex min-h-14 items-center gap-3 border-b border-cafe px-4 pt-[env(safe-area-inset-top)]">
            <button
              type="button"
              onClick={() => onSurfaceChange('chat')}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-cafe-secondary hover:bg-cafe-surface-sunken"
              aria-label="返回对话"
            >
              ←
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold">{title}</h2>
              <p className="truncate text-micro text-cafe-muted">
                {syncState === 'syncing'
                  ? '正在同步…'
                  : syncState === 'error'
                    ? '部分数据同步失败'
                    : '服务端状态已对账'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void reconcile()}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sm text-cafe-secondary hover:bg-cafe-surface-sunken"
              aria-label="刷新工作台"
            >
              ↻
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))]">
            {surface === 'work' && (
              <div className="space-y-3 p-3" data-testid="mobile-work-surface">
                <section className="rounded-lg border border-cafe bg-[var(--console-card-bg)] p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{socketConnected ? '实时连接正常' : '当前离线，等待重连'}</span>
                    <span className="text-xs text-cafe-muted">{hasActiveInvocation ? '任务执行中' : '当前空闲'}</span>
                  </div>
                </section>
                <PlanBoardPanel threadId={threadId} catInvocations={catInvocations} />
                <section className="min-h-[360px] overflow-hidden rounded-lg border border-cafe">
                  <TaskBoardPanel />
                </section>
              </div>
            )}
            {surface === 'files' && (
              <div className="flex min-h-full" data-testid="mobile-files-surface">
                <ArtifactsPanel key={`${threadId}:${artifactRefreshKey}`} threadId={threadId} />
              </div>
            )}
            {surface === 'approval' && (
              <div className="flex min-h-full" data-testid="mobile-approval-surface">
                <ApprovalPanel currentThreadId={threadId} />
              </div>
            )}
          </div>
        </section>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-[45] grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-4 border-t border-cafe bg-cafe-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="手机工作台"
        data-testid="mobile-ops-nav"
      >
        {SURFACES.map((item) => {
          const active = surface === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSurfaceChange(item.id)}
              className={`relative flex min-h-11 flex-col items-center justify-center gap-0.5 text-micro transition-colors ${
                active ? 'text-cafe-interactive' : 'text-cafe-muted hover:text-cafe-secondary'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <SurfaceIcon name={item.icon} />
              <span>{item.label}</span>
              {item.id === 'approval' && approvalCount > 0 && (
                <span className="absolute right-[24%] top-1.5 min-w-4 rounded-full bg-[var(--semantic-warning)] px-1 text-[10px] font-bold leading-4 text-[var(--cafe-accent-foreground)]">
                  {approvalCount > 99 ? '99+' : approvalCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
