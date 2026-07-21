import assert from 'node:assert/strict';
import test from 'node:test';

import { createInitialState, deriveHealthState, reduceWorkbench } from '../domain.mjs';

test('switching evidence lenses preserves the investigation context', () => {
  const initial = createInitialState();
  const contextBefore = initial.events[initial.activeEventId].context;

  const next = reduceWorkbench(initial, { type: 'switch_lens', lens: 'logs' });

  assert.equal(next.activeLens, 'logs');
  assert.deepEqual(next.events[next.activeEventId].context, contextBefore);
  assert.equal(next.events[next.activeEventId].id, initial.activeEventId);
});

test('opening a professional module deep-links to its lens without losing the HealthEvent', () => {
  const initial = createInitialState();
  const contextBefore = initial.events[initial.activeEventId].context;

  const next = reduceWorkbench(initial, { type: 'open_module', module: 'logs' });

  assert.equal(next.activeModule, 'logs');
  assert.equal(next.activeLens, 'logs');
  assert.equal(next.activeEventId, initial.activeEventId);
  assert.deepEqual(next.events[next.activeEventId].context, contextBefore);
});

test('pinning evidence is idempotent and appends one timeline entry', () => {
  const initial = createInitialState();
  const eventBefore = initial.events[initial.activeEventId];
  const evidenceId = 'log-timeout-01';

  const once = reduceWorkbench(initial, { type: 'pin_evidence', evidenceId });
  const twice = reduceWorkbench(once, { type: 'pin_evidence', evidenceId });
  const eventAfter = twice.events[twice.activeEventId];

  assert.deepEqual(eventAfter.pinnedEvidenceIds, [evidenceId]);
  assert.equal(eventAfter.timeline.length, eventBefore.timeline.length + 1);
  assert.deepEqual(eventAfter.finding.evidenceIds, [evidenceId]);
});

test('a confirmed finding can move through owner, action, and verification', () => {
  let state = createInitialState();
  state = reduceWorkbench(state, {
    type: 'pin_evidence',
    evidenceId: 'log-timeout-01',
  });
  state = reduceWorkbench(state, { type: 'confirm_finding' });
  state = reduceWorkbench(state, { type: 'assign_action', owner: '陈曦' });
  state = reduceWorkbench(state, { type: 'start_action' });
  state = reduceWorkbench(state, { type: 'start_verification' });
  state = reduceWorkbench(state, { type: 'complete_verification' });

  const event = state.events[state.activeEventId];
  assert.equal(event.finding.status, 'confirmed');
  assert.equal(event.action.owner, '陈曦');
  assert.equal(event.action.status, 'in_progress');
  assert.equal(event.verification.status, 'passed');
  assert.equal(deriveHealthState(event), 'recovering');
});

test('unknown coverage or a drifted baseline never derives healthy', () => {
  const initial = createInitialState();
  const unknownEvent = initial.events['HE-1047'];
  const driftedEvent = initial.events['HE-1045'];

  assert.equal(deriveHealthState(unknownEvent), 'unknown');
  assert.notEqual(deriveHealthState(unknownEvent), 'healthy');
  assert.equal(deriveHealthState(driftedEvent), 'unknown');
  assert.notEqual(deriveHealthState(driftedEvent), 'healthy');
});

test('verification is blocked while coverage, freshness, or baseline gates are unresolved', () => {
  let state = createInitialState();
  state = reduceWorkbench(state, { type: 'select_event', eventId: 'HE-1047' });
  state = reduceWorkbench(state, { type: 'pin_evidence', evidenceId: 'gap-alert-01' });
  state = reduceWorkbench(state, { type: 'confirm_finding' });
  state = reduceWorkbench(state, { type: 'assign_action', owner: '陈曦' });
  state = reduceWorkbench(state, { type: 'start_action' });
  state = reduceWorkbench(state, { type: 'start_verification' });
  state = reduceWorkbench(state, { type: 'complete_verification' });

  const event = state.events[state.activeEventId];
  assert.equal(event.verification.status, 'blocked');
  assert.equal(deriveHealthState(event), 'unknown');
  assert.equal(event.timeline.at(-1).kind, 'gap');
  assert.doesNotMatch(event.timeline.at(-1).detail, /所有检查重新通过/);
});

test('hypothesis tree, service map, and context controls change domain state', () => {
  let state = createInitialState();

  state = reduceWorkbench(state, { type: 'toggle_hypothesis_tree' });
  assert.equal(state.hypothesisTreeExpanded, true);

  state = reduceWorkbench(state, { type: 'toggle_service_map' });
  assert.equal(state.serviceMapOpen, true);
  state = reduceWorkbench(state, { type: 'select_service', service: 'member-service' });
  assert.equal(state.serviceFilter, 'member-service');
  assert.equal(state.serviceMapOpen, false);

  state = reduceWorkbench(state, { type: 'toggle_context_lock' });
  assert.equal(state.contextLocked, false);
  state = reduceWorkbench(state, { type: 'set_time_range', timeRange: '最近 2 小时' });
  state = reduceWorkbench(state, { type: 'switch_lens', lens: 'logs' });
  assert.equal(state.events[state.activeEventId].context.timeRange, '最近 2 小时');
});
