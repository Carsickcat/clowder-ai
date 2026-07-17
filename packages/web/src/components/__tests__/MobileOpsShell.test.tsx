import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PWA_RECOVERY_EVENT } from '@/lib/pwa-lifecycle';
import { useApprovalHubStore } from '@/stores/approvalHubStore';
import { useChatStore } from '@/stores/chatStore';

const { apiFetch } = vi.hoisted(() => ({
  apiFetch: vi.fn(async (path: string) => ({
    ok: true,
    status: 200,
    json: async () => (path.includes('task-progress') ? { taskProgress: {} } : { tasks: [] }),
  })),
}));

vi.mock('@/utils/api-client', () => ({ apiFetch }));
vi.mock('../PlanBoardPanel', () => ({ PlanBoardPanel: () => <div data-testid="plan-panel" /> }));
vi.mock('../TaskBoardPanel', () => ({ TaskBoardPanel: () => <div data-testid="task-panel" /> }));
vi.mock('../ArtifactsPanel', () => ({ ArtifactsPanel: () => <div data-testid="artifacts-panel" /> }));
vi.mock('../ApprovalPanel', () => ({ ApprovalPanel: () => <div data-testid="approval-panel" /> }));

import { MobileOpsShell, type MobileOpsSurface } from '../MobileOpsShell';

function Harness() {
  const [surface, setSurface] = useState<MobileOpsSurface>('chat');
  return (
    <MobileOpsShell
      surface={surface}
      onSurfaceChange={setSurface}
      threadId="thread-1"
      catInvocations={{}}
      socketConnected={false}
      hasActiveInvocation={false}
    />
  );
}

describe('MobileOpsShell', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useChatStore.setState({
      currentThreadId: 'thread-1',
      catInvocations: {},
      _taskProgressSnapshotStartedAtByThread: {},
    });
    useApprovalHubStore.setState({ count: 3, fetchPending: vi.fn(async () => {}) });
    apiFetch.mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('keeps four mobile entry points and opens work, files, and approval surfaces', async () => {
    await act(async () => root.render(<Harness />));

    const buttons = [...container.querySelectorAll('nav button')];
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['对话', '工作', '产物', '审批3']);
    expect(container.querySelector('[data-testid="mobile-ops-surface"]')).toBeNull();

    await act(async () => buttons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector('[data-testid="mobile-work-surface"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="plan-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="task-panel"]')).not.toBeNull();

    await act(async () => buttons[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector('[data-testid="artifacts-panel"]')).not.toBeNull();

    await act(async () => buttons[3]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector('[data-testid="approval-panel"]')).not.toBeNull();
  });

  it('reconciles task and progress snapshots before presenting stale mobile state', async () => {
    await act(async () => root.render(<Harness />));
    const workButton = [...container.querySelectorAll('nav button')].find((button) => button.textContent === '工作');

    await act(async () => {
      workButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(apiFetch).toHaveBeenCalledWith('/api/tasks?threadId=thread-1&kind=work');
    expect(apiFetch).toHaveBeenCalledWith('/api/threads/thread-1/task-progress');
  });

  it('reconciles authoritative snapshots after the app returns to the foreground', async () => {
    await act(async () => root.render(<Harness />));
    apiFetch.mockClear();

    await act(async () => {
      window.dispatchEvent(new Event(PWA_RECOVERY_EVENT));
      await Promise.resolve();
    });

    expect(apiFetch).toHaveBeenCalledWith('/api/tasks?threadId=thread-1&kind=work');
    expect(apiFetch).toHaveBeenCalledWith('/api/threads/thread-1/task-progress');
  });

  it('removes stale task progress when the authoritative thread snapshot is empty', async () => {
    useChatStore.setState({
      currentThreadId: 'thread-1',
      catInvocations: {
        opus: {
          invocationId: 'inv-old',
          taskProgress: {
            tasks: [{ id: 'old', subject: 'stale work', status: 'in_progress' }],
            snapshotStatus: 'running',
            lastUpdate: 1,
          },
        },
      },
    });

    await act(async () => root.render(<Harness />));
    const workButton = [...container.querySelectorAll('nav button')].find((button) => button.textContent === '工作');
    await act(async () => {
      workButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(useChatStore.getState().catInvocations.opus?.invocationId).toBe('inv-old');
    expect(useChatStore.getState().catInvocations.opus?.taskProgress).toBeUndefined();
  });

  it('uses the same safe-area-aware height for the fixed navigation footprint', async () => {
    await act(async () => root.render(<Harness />));
    const nav = container.querySelector('[data-testid="mobile-ops-nav"]');
    expect(nav?.classList.contains('h-[calc(4rem+env(safe-area-inset-bottom))]')).toBe(true);
  });

  it('preserves task progress delivered after an older snapshot request began', () => {
    useChatStore.setState({
      currentThreadId: 'thread-1',
      catInvocations: {
        opus: {
          taskProgress: {
            tasks: [{ id: 'live', subject: 'new work', status: 'in_progress' }],
            snapshotStatus: 'running',
            lastUpdate: 200,
          },
        },
      },
    });

    useChatStore.getState().reconcileThreadTaskProgress('thread-1', {}, 100);

    expect(useChatStore.getState().catInvocations.opus?.taskProgress?.tasks[0]?.id).toBe('live');
  });
});
