/**
 * RED contracts for the frame-report verdict layer (terra review P1/P2).
 *
 * P1: a long cold-start run must NOT whitelist post-launch blank flashes.
 * P2: composer-loss reporting must be reproducible — raw runs plus a named,
 *     gap-tolerant merged-episode policy, never hand-merged claims.
 *
 * Convention: node:test, matching the other scripts/*.test.mjs suites.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildVerdict,
  computeComposerEpisodes,
  computePostLaunchBlankRuns,
  LAUNCH_BOUNDARY_SEC,
} from './f010-frame-report.mjs';

function frame(t, cls, composerPresent = true) {
  return { t, class: cls, blankRatio: cls === 'content' ? 0.5 : 0.95, luma: 200, composerPresent };
}

describe('computePostLaunchBlankRuns (P1)', () => {
  it('clipping a cold-start run at the boundary does not whitelist a later blank run', () => {
    const frames = [
      // cold start: 1.25 → 4.0 blank-dark (crosses the 4s boundary)
      frame(1.25, 'blank-dark'),
      frame(3.75, 'blank-dark'),
      frame(4.0, 'blank-light'),
      frame(4.25, 'content'),
      // real failure: 12.25 → 14.0 blank-light (1.75s)
      frame(12.25, 'blank-light'),
      frame(14.0, 'blank-light'),
      frame(14.25, 'content'),
    ];
    const runs = computePostLaunchBlankRuns(frames, 4, 0.25);
    // The boundary sliver (4.0–4.25s, exactly one frame interval) is recorded
    // but must NOT count as significant; the 1.75s failure run must fail
    // every post-launch verdict.
    assert.equal(runs.length, 2);
    assert.equal(runs[0].start, 4);
    assert.equal(runs[1].start, 12.25);
    assert.equal(runs[1].kind, 'blank-light');

    const verdict = buildVerdict(runs, []);
    assert.equal(verdict.shellNeverBlank, false);
    assert.equal(verdict.longestPostLaunchBlankRunUnder250ms, false);
    assert.ok(verdict.longestPostLaunchBlankRunSec > 0.25);
    assert.equal(verdict.significantBlankRuns.length, 1);
    assert.equal(verdict.significantBlankRuns[0].start, 12.25);
  });

  it('keeps a boundary-crossing failure run clipped to the post-launch part', () => {
    const frames = [frame(3.5, 'blank-light'), frame(4.5, 'blank-light'), frame(4.75, 'content')];
    const runs = computePostLaunchBlankRuns(frames, 4, 0.25);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].start, 4);
    assert.equal(runs[0].end, 4.75);
    assert.ok(Math.abs(runs[0].length - 0.75) < 0.01);
  });

  it('passes a clean post-launch session', () => {
    const frames = [frame(1, 'blank-dark'), frame(4.25, 'content'), frame(8, 'content')];
    const verdict = buildVerdict(computePostLaunchBlankRuns(frames, LAUNCH_BOUNDARY_SEC, 0.25), []);
    assert.equal(verdict.shellNeverBlank, true);
    assert.equal(verdict.longestPostLaunchBlankRunUnder250ms, true);
  });
});

describe('computeComposerEpisodes (P2)', () => {
  it('merges runs within the named gap tolerance and keeps raw counts', () => {
    const raw = [
      { start: 14.75, end: 15.75, length: 1 },
      { start: 16, end: 17.75, length: 1.75 }, // gap 0.25 → merge
      { start: 19, end: 21, length: 2 }, // gap 1.25 → new episode
      { start: 21.5, end: 22, length: 0.5 }, // gap 0.5 → merge
    ];
    const episodes = computeComposerEpisodes(raw, 1);
    assert.equal(episodes.length, 2);
    assert.equal(episodes[0].start, 14.75);
    assert.equal(episodes[0].end, 17.75);
    assert.equal(episodes[0].rawCount, 2);
    assert.ok(Math.abs(episodes[0].length - 3) < 0.01);
    assert.equal(episodes[1].start, 19);
    assert.equal(episodes[1].end, 22);
    assert.equal(episodes[1].rawCount, 2);
  });

  it('keeps isolated runs as single-run episodes', () => {
    const raw = [
      { start: 6.75, end: 7, length: 0.25 },
      { start: 25.5, end: 29.5, length: 4 },
    ];
    const episodes = computeComposerEpisodes(raw, 1);
    assert.equal(episodes.length, 2);
    assert.deepEqual(episodes[1], { start: 25.5, end: 29.5, length: 4, rawCount: 1 });
  });
});
