import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatContainer } from '@/components/ChatContainer';
import { WIDE_SHELL_QUERY } from '@/lib/responsive-breakpoints';
import { useSidebarStore } from '@/stores/sidebarStore';

const mockAuthorizationState = vi.hoisted(() => ({ pending: [] as Array<{ requestId: string }> }));

const mockStoreState = () => ({
  messages: [],
  isLoading: false,
  hasActiveInvocation: false,
  intentMode: null,
  targetCats: [],
  catStatuses: {},
  catInvocations: {},
  activeInvocations: {},
  addMessage: vi.fn(),
  removeMessage: vi.fn(),
  setLoading: vi.fn(),
  setHasActiveInvocation: vi.fn(),
  setIntentMode: vi.fn(),
  setTargetCats: vi.fn(),
  clearCatStatuses: vi.fn(),
  setCurrentThread: vi.fn(),
  updateThreadTitle: vi.fn(),
  setCurrentGame: vi.fn(),
  currentGame: null,

  viewMode: 'single' as const,
  setViewMode: vi.fn(),
  clearUnread: vi.fn(),
  confirmUnreadAck: vi.fn(),
  armUnreadSuppression: vi.fn(),
  splitPaneThreadIds: [],
  setSplitPaneThreadIds: vi.fn(),
  setSplitPaneTarget: vi.fn(),
  threads: [],
});

vi.mock('@/stores/chatStore', () => {
  const hook = (selector?: (s: ReturnType<typeof mockStoreState>) => unknown) => {
    const state = mockStoreState();
    return selector ? selector(state) : state;
  };
  return { useChatStore: hook };
});

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/stores/taskStore', () => ({
  useTaskStore: () => ({ tasks: [], addTask: vi.fn(), updateTask: vi.fn(), clearTasks: vi.fn() }),
}));
vi.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({ cancelInvocation: vi.fn(), syncRooms: vi.fn() }),
}));
vi.mock('@/hooks/useAgentMessages', () => ({
  useAgentMessages: () => ({
    handleAgentMessage: vi.fn(),
    handleStop: vi.fn(),
    resetRefs: vi.fn(),
    resetTimeout: vi.fn(),
  }),
}));
vi.mock('@/hooks/useChatHistory', () => ({
  useChatHistory: () => ({
    handleScroll: vi.fn(),
    scrollContainerRef: { current: null },
    messagesEndRef: { current: null },
    isLoadingHistory: false,
    hasMore: false,
  }),
}));
vi.mock('@/hooks/useSendMessage', () => ({
  useSendMessage: () => ({ handleSend: vi.fn() }),
}));
vi.mock('@/hooks/useAuthorization', () => ({
  useAuthorization: () => ({
    pending: mockAuthorizationState.pending,
    respond: vi.fn(),
    handleAuthRequest: vi.fn(),
    handleAuthResponse: vi.fn(),
  }),
}));
vi.mock('@/hooks/useSplitPaneKeys', () => ({ useSplitPaneKeys: vi.fn() }));
vi.mock('@/hooks/useChatSocketCallbacks', () => ({
  useChatSocketCallbacks: () => ({}),
}));

// Stub child components to isolate ChatContainer behavior
vi.mock('../ChatMessage', () => ({ ChatMessage: () => null }));
vi.mock('../ChatInput', () => ({
  ChatInput: (props: { onComposerFocus?: () => void }) =>
    React.createElement(
      'div',
      { 'data-chat-input-composer': true },
      React.createElement('textarea', {
        'data-testid': 'composer-textarea',
        onFocus: props.onComposerFocus,
      }),
    ),
}));
vi.mock('../ChatContainerHeader', () => ({
  ChatContainerHeader: (props: { onToggleSidebar: () => void; onOpenMobileStatus: () => void }) =>
    React.createElement(
      'div',
      { 'data-testid': 'header' },
      React.createElement('button', {
        type: 'button',
        'data-testid': 'sidebar-toggle',
        onClick: props.onToggleSidebar,
      }),
      React.createElement('button', {
        type: 'button',
        'data-testid': 'mobile-status-trigger',
        onClick: props.onOpenMobileStatus,
      }),
    ),
}));
vi.mock('../RightStatusPanel', () => ({ RightStatusPanel: () => null }));
vi.mock('../MobileStatusSheet', () => ({
  MobileStatusSheet: (props: { open: boolean; authorizationContent?: React.ReactNode }) =>
    React.createElement(
      'div',
      { 'data-testid': 'mobile-status', 'data-open': String(props.open) },
      props.authorizationContent,
    ),
}));
vi.mock('../ParallelStatusBar', () => ({ ParallelStatusBar: () => null }));
vi.mock('../ThinkingIndicator', () => ({ ThinkingIndicator: () => null }));
vi.mock('../MessageNavigator', () => ({ MessageNavigator: () => null }));
vi.mock('../MessageActions', () => ({
  MessageActions: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../SplitPaneView', () => ({ SplitPaneView: () => null }));
vi.mock('../AuthorizationCard', () => ({
  AuthorizationCard: ({ request }: { request: { requestId: string } }) =>
    React.createElement('div', { 'data-testid': 'authorization-card', 'data-request-id': request.requestId }),
}));

describe('ChatContainer mobile interactions', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  function mockMatchMedia(desktopMatch: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: desktopMatch && query === WIDE_SHELL_QUERY,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  beforeEach(() => {
    useSidebarStore.setState({ isOpen: false });
    mockAuthorizationState.pending = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockMatchMedia(false); // default: mobile
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('sidebar is closed by default on mobile', () => {
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'test-thread' }));
    });
    expect(container.querySelector('[data-testid="sidebar"]')).toBeNull();
    expect(useSidebarStore.getState().isOpen).toBe(false);
  });

  it('delegates the mobile drawer state to AppShell when the header toggle is clicked', () => {
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'test-thread' }));
    });
    const toggleBtn = container.querySelector('[data-testid="sidebar-toggle"]') as HTMLButtonElement;
    act(() => {
      toggleBtn.click();
    });
    expect(useSidebarStore.getState().isOpen).toBe(true);
    expect(container.querySelector('[data-testid="sidebar"]')).toBeNull();
  });

  it('closes the AppShell-owned drawer state when the header toggle is clicked again', () => {
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'test-thread' }));
    });
    // Open sidebar
    const toggleBtn = container.querySelector('[data-testid="sidebar-toggle"]') as HTMLButtonElement;
    act(() => {
      toggleBtn.click();
    });
    act(() => {
      toggleBtn.click();
    });
    expect(useSidebarStore.getState().isOpen).toBe(false);
  });

  it('mobile status sheet starts closed and opens on trigger', () => {
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'test-thread' }));
    });
    const statusSheet = container.querySelector('[data-testid="mobile-status"]') as HTMLElement;
    expect(statusSheet.getAttribute('data-open')).toBe('false');

    const triggerBtn = container.querySelector('[data-testid="mobile-status-trigger"]') as HTMLButtonElement;
    act(() => {
      triggerBtn.click();
    });

    const statusSheetAfter = container.querySelector('[data-testid="mobile-status"]') as HTMLElement;
    expect(statusSheetAfter.getAttribute('data-open')).toBe('true');
  });

  it('dismisses the software keyboard before opening mobile status', () => {
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'test-thread' }));
    });

    const textarea = container.querySelector('[data-testid="composer-textarea"]') as HTMLTextAreaElement;
    act(() => {
      textarea.focus();
    });
    expect(document.activeElement).toBe(textarea);

    const triggerBtn = container.querySelector('[data-testid="mobile-status-trigger"]') as HTMLButtonElement;
    act(() => {
      triggerBtn.click();
    });

    expect(document.activeElement).not.toBe(textarea);
    expect(container.querySelector('[data-testid="mobile-status"]')?.getAttribute('data-open')).toBe('true');
  });

  it('gives the status sheet exclusive interaction ownership while it is open', () => {
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'test-thread' }));
    });

    const triggerBtn = container.querySelector('[data-testid="mobile-status-trigger"]') as HTMLButtonElement;
    act(() => {
      triggerBtn.click();
    });

    const chatSurface = container.querySelector('[data-chat-primary-surface]');
    expect(chatSurface?.hasAttribute('inert')).toBe(true);
    expect(chatSurface?.getAttribute('aria-hidden')).toBe('true');
  });

  it('closes the complete status journey when composer focus wins', () => {
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'test-thread' }));
    });

    const triggerBtn = container.querySelector('[data-testid="mobile-status-trigger"]') as HTMLButtonElement;
    act(() => {
      triggerBtn.click();
    });
    expect(container.querySelector('[data-testid="mobile-status"]')?.getAttribute('data-open')).toBe('true');

    const textarea = container.querySelector('[data-testid="composer-textarea"]') as HTMLTextAreaElement;
    act(() => {
      textarea.focus();
    });

    expect(container.querySelector('[data-testid="mobile-status"]')?.getAttribute('data-open')).toBe('false');
  });

  it('does not carry a transient status sheet into a newly selected thread', () => {
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'thread-one' }));
    });
    const triggerBtn = container.querySelector('[data-testid="mobile-status-trigger"]') as HTMLButtonElement;
    act(() => {
      triggerBtn.click();
    });
    expect(container.querySelector('[data-testid="mobile-status"]')?.getAttribute('data-open')).toBe('true');

    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'thread-two' }));
    });

    expect(container.querySelector('[data-testid="mobile-status"]')?.getAttribute('data-open')).toBe('false');
  });

  it('routes pending authorization into the mobile status surface instead of keyboard-hidden chrome', () => {
    mockAuthorizationState.pending = [{ requestId: 'auth-1' }];
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'test-thread' }));
    });

    const authorization = container.querySelector('[data-testid="authorization-card"]');
    expect(authorization).not.toBeNull();
    expect(authorization?.closest('[data-testid="mobile-status"]')).not.toBeNull();
    expect(authorization?.closest('.mobile-keyboard-secondary-chrome')).toBeNull();
  });

  it('consumes the single mobile Dock reserve below the input', () => {
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'test-thread' }));
    });
    const bottomChrome = [...container.querySelectorAll('div')].find(
      (element) => element.classList.contains('lg:pb-0') && element.className.includes('mobile-chat-bottom-reserve'),
    );
    expect(bottomChrome?.classList.contains('pb-[var(--mobile-chat-bottom-reserve)]')).toBe(true);
  });

  it('auto-opens sidebar store on desktop but does not render mobile overlay', () => {
    mockMatchMedia(true);
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'test-thread' }));
    });
    // Desktop: sidebar store is open (AppShell renders the desktop sidebar)
    expect(useSidebarStore.getState().isOpen).toBe(true);
    // Mobile overlay must NOT mount — desktop sidebar lives in AppShell
    expect(container.querySelector('[data-testid="sidebar"]')).toBeNull();
  });
});
