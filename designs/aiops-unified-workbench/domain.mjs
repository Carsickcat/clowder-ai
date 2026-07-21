import { createMockEvents } from './mock-data.mjs';

export const LENSES = Object.freeze(['metrics', 'alerts', 'logs', 'checks', 'synthetics']);

export function createInitialState() {
  return {
    activeEventId: 'HE-1042',
    activeLens: 'metrics',
    activeModule: 'investigations',
    aiPanelOpen: true,
    contextLocked: true,
    eventQueueFilter: 'all',
    hypothesisTreeExpanded: false,
    serviceFilter: 'all',
    serviceMapOpen: false,
    events: createMockEvents(),
  };
}

export function deriveHealthState(event) {
  if (event.coverageState === 'unknown' || event.freshnessState === 'stale' || event.baselineState === 'drifted') {
    return 'unknown';
  }
  if (event.verification.status === 'passed') return 'recovering';
  return event.healthState;
}

export function verificationBlockReason(event) {
  if (event.coverageState === 'unknown') return '检查覆盖仍不完整';
  if (event.freshnessState === 'stale') return '证据新鲜度仍未恢复';
  if (event.baselineState === 'drifted') return '可比基线仍未重建';
  return null;
}

export function getEvidence(event, evidenceId) {
  return Object.values(event.evidence)
    .flat()
    .find((item) => item.id === evidenceId);
}

function updateActiveEvent(state, updater) {
  const active = state.events[state.activeEventId];
  return {
    ...state,
    events: {
      ...state.events,
      [state.activeEventId]: updater(active),
    },
  };
}

function appendTimeline(event, entry) {
  if (event.timeline.some((item) => item.id === entry.id)) return event.timeline;
  return [...event.timeline, entry];
}

export function reduceWorkbench(state, action) {
  switch (action.type) {
    case 'select_event':
      if (!state.events[action.eventId]) return state;
      return {
        ...state,
        activeEventId: action.eventId,
        activeLens: 'metrics',
        hypothesisTreeExpanded: false,
      };
    case 'switch_lens':
      if (!LENSES.includes(action.lens)) return state;
      return { ...state, activeLens: action.lens, activeModule: 'investigations' };
    case 'open_module':
      if (action.module === 'investigations') {
        return { ...state, activeModule: 'investigations' };
      }
      if (!LENSES.includes(action.module)) return state;
      return { ...state, activeModule: action.module, activeLens: action.module };
    case 'toggle_ai':
      return { ...state, aiPanelOpen: !state.aiPanelOpen };
    case 'set_queue_filter':
      return { ...state, eventQueueFilter: action.filter };
    case 'toggle_hypothesis_tree':
      return { ...state, hypothesisTreeExpanded: !state.hypothesisTreeExpanded };
    case 'toggle_service_map':
      return { ...state, serviceMapOpen: !state.serviceMapOpen };
    case 'select_service': {
      const nextEvent = Object.values(state.events).find((event) => event.context.service === action.service);
      return {
        ...state,
        activeEventId: nextEvent?.id ?? state.activeEventId,
        activeLens: nextEvent ? 'metrics' : state.activeLens,
        serviceFilter: action.service,
        serviceMapOpen: false,
      };
    }
    case 'toggle_context_lock':
      return { ...state, contextLocked: !state.contextLocked };
    case 'set_time_range':
      if (state.contextLocked || typeof action.timeRange !== 'string') return state;
      return updateActiveEvent(state, (event) => ({
        ...event,
        context: { ...event.context, timeRange: action.timeRange },
      }));
    case 'pin_evidence':
      return updateActiveEvent(state, (event) => {
        const evidence = getEvidence(event, action.evidenceId);
        if (!evidence || event.pinnedEvidenceIds.includes(action.evidenceId)) return event;
        return {
          ...event,
          pinnedEvidenceIds: [...event.pinnedEvidenceIds, action.evidenceId],
          timeline: appendTimeline(event, {
            id: `tl-pin-${action.evidenceId}`,
            time: evidence.timestamp,
            kind: 'evidence',
            title: `证据已钉入 · ${evidence.title}`,
            detail: evidence.source,
          }),
          finding: {
            ...event.finding,
            confidence: event.pinnedEvidenceIds.length >= 1 ? '高 · 证据互相印证' : '中 · 已补入首条证据',
            evidenceIds: [...event.finding.evidenceIds, action.evidenceId],
          },
        };
      });
    case 'confirm_finding':
      return updateActiveEvent(state, (event) => {
        if (event.finding.evidenceIds.length === 0) return event;
        return {
          ...event,
          finding: { ...event.finding, status: 'confirmed' },
          timeline: appendTimeline(event, {
            id: 'tl-finding',
            time: '现在',
            kind: 'finding',
            title: 'Finding 已由人工确认',
            detail: event.finding.title,
          }),
        };
      });
    case 'assign_action':
      return updateActiveEvent(state, (event) => {
        if (event.finding.status !== 'confirmed') return event;
        return {
          ...event,
          finding: { ...event.finding, owner: action.owner },
          action: { status: 'assigned', owner: action.owner },
        };
      });
    case 'start_action':
      return updateActiveEvent(state, (event) => {
        if (event.action.status !== 'assigned') return event;
        return {
          ...event,
          action: { ...event.action, status: 'in_progress' },
          timeline: appendTimeline(event, {
            id: 'tl-action',
            time: '现在',
            kind: 'action',
            title: '整改已开始',
            detail: `${event.action.owner} 正在执行受控处置`,
          }),
        };
      });
    case 'start_verification':
      return updateActiveEvent(state, (event) => {
        if (event.action.status !== 'in_progress') return event;
        return {
          ...event,
          verification: { status: 'running', startedAt: '现在', completedAt: null },
          timeline: appendTimeline(event, {
            id: 'tl-verify',
            time: '现在',
            kind: 'verification',
            title: '复验运行中',
            detail: '重跑相关检查与用户旅程拨测',
          }),
        };
      });
    case 'complete_verification':
      return updateActiveEvent(state, (event) => {
        if (event.verification.status !== 'running') return event;
        const blockReason = verificationBlockReason(event);
        if (blockReason) {
          return {
            ...event,
            verification: {
              ...event.verification,
              status: 'blocked',
              completedAt: null,
              blockReason,
            },
            timeline: appendTimeline(event, {
              id: 'tl-verify-blocked',
              time: '现在',
              kind: 'gap',
              title: '复验受阻 · 仍不可判定',
              detail: `${blockReason}；不得写入健康或恢复结论`,
            }),
          };
        }
        return {
          ...event,
          verification: { ...event.verification, status: 'passed', completedAt: '现在' },
          timeline: appendTimeline(event, {
            id: 'tl-verify-pass',
            time: '现在',
            kind: 'positive',
            title: '复验通过 · 进入恢复观察',
            detail: '关键指标回归基线，所有检查重新通过',
          }),
        };
      });
    default:
      return state;
  }
}
