import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PWA_BEFORE_RELOAD_EVENT } from '@/lib/pwa-lifecycle';
import { useApprovalHubStore } from '@/stores/approvalHubStore';
import { PwaTransientWorkGuard } from '../pwa/PwaTransientWorkGuard';
import { type DraftReplyContext, threadDrafts, threadImageDrafts, threadReplyDrafts } from '../thread-drafts';

const REPLY: DraftReplyContext = {
  id: 'message-1',
  content: 'quoted',
  senderCatId: 'sonnet',
  threadId: 'thread-a',
};

describe('PwaTransientWorkGuard', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    sessionStorage.clear();
    threadDrafts.clear();
    threadImageDrafts.clear();
    threadReplyDrafts.clear();
    useApprovalHubStore.setState({ selectedIds: new Set<string>(), deciding: {} });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<PwaTransientWorkGuard />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    sessionStorage.clear();
    threadDrafts.clear();
    threadImageDrafts.clear();
    threadReplyDrafts.clear();
    useApprovalHubStore.setState({ selectedIds: new Set<string>(), deciding: {} });
    vi.restoreAllMocks();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  function requestReload(): Event {
    const event = new Event(PWA_BEFORE_RELOAD_EVENT, { cancelable: true });
    window.dispatchEvent(event);
    return event;
  }

  it('blocks a reload for attachments belonging to any unmounted thread', () => {
    threadImageDrafts.set('thread-a', [new File(['image'], 'draft.png', { type: 'image/png' })]);

    expect(requestReload().defaultPrevented).toBe(true);
  });

  it('flushes every text and reply draft even when no composer is mounted', () => {
    threadDrafts.set('thread-a', 'unsent text');
    threadReplyDrafts.set('thread-b', REPLY);

    expect(requestReload().defaultPrevented).toBe(false);
    expect(sessionStorage.getItem('cat-cafe:thread-drafts')).toContain('unsent text');
    expect(sessionStorage.getItem('cat-cafe:thread-reply-drafts')).toContain('message-1');
  });

  it('blocks when pending drafts cannot be persisted', () => {
    threadDrafts.set('thread-a', 'cannot save');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });

    expect(requestReload().defaultPrevented).toBe(true);
  });

  it.each([
    ['a selected approval', { selectedIds: new Set(['proposal-1']), deciding: {} }],
    [
      'an in-flight approval decision',
      { selectedIds: new Set<string>(), deciding: { 'proposal-1': 'approving' as const } },
    ],
  ])('blocks a reload for %s outside the approval surface', (_label, state) => {
    useApprovalHubStore.setState(state);

    expect(requestReload().defaultPrevented).toBe(true);
  });
});
