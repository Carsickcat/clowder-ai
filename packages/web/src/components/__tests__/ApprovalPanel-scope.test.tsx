import type { ApprovalItem } from '@cat-cafe/shared';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApprovalHubStore } from '@/stores/approvalHubStore';

vi.mock('../ApprovalItemCard', () => ({
  ApprovalItemCard: ({ item }: { item: ApprovalItem }) => (
    <div data-testid={`approval-card-${item.proposalId}`}>{item.summary}</div>
  ),
}));

import { ApprovalPanel } from '../ApprovalPanel';

const ITEMS: ApprovalItem[] = [
  {
    proposalId: 'proposal-current',
    sourceFeatureId: 'F193',
    sourceThreadId: 'thread-current',
    requesterCatId: 'sonnet',
    ownerUserId: 'user-1',
    status: 'pending',
    summary: 'Current thread proposal',
    detail: {},
    inlineApprovable: true,
    createdAt: 1,
  },
  {
    proposalId: 'proposal-other',
    sourceFeatureId: 'F128',
    sourceThreadId: 'thread-other',
    requesterCatId: 'opus',
    ownerUserId: 'user-1',
    status: 'pending',
    summary: 'Other thread proposal',
    detail: {},
    inlineApprovable: false,
    createdAt: 2,
  },
];

describe('F010 Approval Hub scope', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useApprovalHubStore.setState({
      items: ITEMS,
      count: ITEMS.length,
      isLoading: false,
      error: null,
      selectedIds: new Set(['proposal-current']),
      batchResults: [],
      settledItems: [],
      settledIsLoading: false,
      settledError: null,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('defaults to the global list and keeps the badge global while filtering to the current thread', async () => {
    await act(async () => root.render(<ApprovalPanel currentThreadId="thread-current" />));

    expect(container.querySelector('[data-testid="approval-card-proposal-current"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="approval-card-proposal-other"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="approval-tab-pending"]')?.textContent).toContain('2');

    const currentThreadButton = container.querySelector(
      '[data-testid="approval-scope-current-thread"]',
    ) as HTMLButtonElement;
    await act(async () => currentThreadButton.click());

    expect(container.querySelector('[data-testid="approval-card-proposal-current"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="approval-card-proposal-other"]')).toBeNull();
    expect(container.querySelector('[data-testid="approval-tab-pending"]')?.textContent).toContain('2');
    expect(useApprovalHubStore.getState().selectedIds.size).toBe(0);

    const allButton = container.querySelector('[data-testid="approval-scope-all"]') as HTMLButtonElement;
    await act(async () => allButton.click());
    expect(container.querySelector('[data-testid="approval-card-proposal-other"]')).not.toBeNull();
  });
});
