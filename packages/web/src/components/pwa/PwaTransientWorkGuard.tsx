'use client';

import { useEffect } from 'react';
import { PWA_BEFORE_RELOAD_EVENT } from '@/lib/pwa-lifecycle';
import { useApprovalHubStore } from '@/stores/approvalHubStore';
import { flushThreadDraftsToStorage, flushThreadReplyDraftsToStorage, threadImageDrafts } from '../thread-drafts';

function hasPendingAttachments(): boolean {
  return [...threadImageDrafts.values()].some((files) => files.length > 0);
}

function hasPendingApprovalWork(): boolean {
  const { selectedIds, deciding } = useApprovalHubStore.getState();
  return selectedIds.size > 0 || Object.values(deciding).some(Boolean);
}

/** AppShell-owned guard for transient work that can outlive its current surface. */
export function PwaTransientWorkGuard() {
  useEffect(() => {
    const protectTransientWork = (event: Event) => {
      const textSaved = flushThreadDraftsToStorage();
      const repliesSaved = flushThreadReplyDraftsToStorage();
      if (!textSaved || !repliesSaved || hasPendingAttachments() || hasPendingApprovalWork()) {
        event.preventDefault();
      }
    };

    window.addEventListener(PWA_BEFORE_RELOAD_EVENT, protectTransientWork);
    return () => window.removeEventListener(PWA_BEFORE_RELOAD_EVENT, protectTransientWork);
  }, []);

  return null;
}
