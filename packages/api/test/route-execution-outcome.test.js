import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RouteExecutionOutcomeTracker } from '../dist/domains/cats/services/agents/invocation/route-execution-outcome.js';

describe('RouteExecutionOutcomeTracker', () => {
  it('keeps error then synthetic done failed', () => {
    const outcome = new RouteExecutionOutcomeTracker();
    outcome.observe({ type: 'error', catId: 'kimi' });
    outcome.observe({ type: 'done', catId: 'kimi' });

    assert.equal(outcome.failed, true);
    assert.equal(outcome.errorCode, 'PROVIDER_EXECUTION_FAILED:kimi');
  });

  it('keeps a mixed multi-cat result successful to avoid duplicate batch retries', () => {
    const outcome = new RouteExecutionOutcomeTracker();
    outcome.observe({ type: 'error', catId: 'kimi' });
    outcome.observe({ type: 'done', catId: 'kimi' });
    outcome.observe({ type: 'text', catId: 'sonnet' });
    outcome.observe({ type: 'done', catId: 'sonnet' });

    assert.equal(outcome.failed, false);
    assert.equal(outcome.errorCode, undefined);
  });

  it('does not treat a synthetic-only sibling completion as usable batch output', () => {
    const outcome = new RouteExecutionOutcomeTracker();
    outcome.observe({ type: 'error', catId: 'kimi' });
    outcome.observe({ type: 'done', catId: 'kimi' });
    outcome.observe({ type: 'done', catId: 'opus' });

    assert.equal(outcome.failed, true);
    assert.equal(outcome.errorCode, 'PROVIDER_EXECUTION_FAILED:kimi');
  });

  it('lets later substantive recovery output restore one cat to success', () => {
    const outcome = new RouteExecutionOutcomeTracker();
    outcome.observe({ type: 'error', catId: 'opus' });
    outcome.observe({ type: 'text', catId: 'opus' });
    outcome.observe({ type: 'done', catId: 'opus' });

    assert.equal(outcome.failed, false);
  });
});
