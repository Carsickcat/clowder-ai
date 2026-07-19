#!/usr/bin/env node
/**
 * F010 frame-report: machine-readable verification for reporting-iPhone recordings.
 *
 * Why: every previous acceptance round ended in subjective "looks better / still
 * broken" debates because nobody could state the verdict as numbers. This tool
 * extracts frames from a recording and emits pixel-level assertions: whole-app
 * blank flashes (light or dark), header visibility, and blank-run durations.
 * It does NOT judge style; it answers one question — did the app shell leave
 * the visible area, when, and for how long.
 *
 * Usage:
 *   node scripts/f010-frame-report.mjs <video.mp4> [--fps=4] [--out=report.json]
 *
 * ffmpeg resolution order: FFMPEG_BIN env → acceptance-box fallback path
 * (this operator machine's temp tools install) → PATH.
 * Requires `sharp` (already a repo dependency, used via next/image).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

export const TOOL_VERSION = '1.1.0';
/** One explicit launch boundary. Cold-start paint belongs before it; every
 *  verdict reads only runs clipped to t >= boundary (P1 fix: the global
 *  longest run may not whitelist later failures). */
export const LAUNCH_BOUNDARY_SEC = 4;

/** App band: below iOS status bar, above the form-assistant/keyboard zone. */
const BAND = { left: 0.0, top: 0.05, width: 1.0, height: 0.5 };
const BLANK_SHARE_THRESHOLD = 0.75; // mode-bucket share: content ≤0.61, blank ≥0.82 on reference footage
const DARK_LUMA_THRESHOLD = 60;
/** Composer detection: the cafe-amber border/send affordance (~rgb 160,72,8).
 *  Reference footage: ~211 amber pixels when the composer is visible, ~38
 *  scattered (ME badges etc.) when it is hidden under the keyboard. */
const COMPOSER_BAND = { left: 0.0, top: 0.4, width: 1.0, height: 0.56 };
const COMPOSER_AMBER_MIN_PIXELS = 100;
/** Runs separated by at most this gap merge into one composer-loss episode. */
export const COMPOSER_EPISODE_GAP_SEC = 1;

function countAmberPixels(data, channels) {
  let count = 0;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= 140 && r <= 230 && g >= 60 && g <= 180 && b <= 130 && r - b > 50 && r - g > 30) count += 1;
  }
  return count;
}

async function analyzeFrame(file) {
  const image = sharp(file);
  const meta = await image.metadata();
  const region = {
    left: Math.round(meta.width * BAND.left),
    top: Math.round(meta.height * BAND.top),
    width: Math.round(meta.width * BAND.width),
    height: Math.round(meta.height * BAND.height),
  };
  const { data, info } = await image
    .extract(region)
    .resize(48, 96, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Mode color via 4-bit-per-channel quantization. A mean would sit between
  // beige background, white bubbles and dark keyboard and match nothing; the
  // mode separates "one region covers nearly everything" (blank) from
  // "several regions share the band" (real content).
  const pixels = info.width * info.height;
  const frequency = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    frequency.set(key, (frequency.get(key) ?? 0) + 1);
  }
  let best = 0;
  let bestKey = 0;
  for (const [key, count] of frequency) {
    if (count > best) {
      best = count;
      bestKey = key;
    }
  }
  const blankRatio = best / pixels;
  const luma = Math.round(
    0.2126 * (((bestKey >> 8) & 15) * 16 + 8) +
      0.7152 * (((bestKey >> 4) & 15) * 16 + 8) +
      0.0722 * ((bestKey & 15) * 16 + 8),
  );
  const composerRegion = {
    left: Math.round(meta.width * COMPOSER_BAND.left),
    top: Math.round(meta.height * COMPOSER_BAND.top),
    width: Math.round(meta.width * COMPOSER_BAND.width),
    height: Math.round(meta.height * COMPOSER_BAND.height),
  };
  // Raw resolution for the composer band: a 1-2px amber border is washed out
  // by downscaling, and the signal band spans the composer's possible travel
  // range (bottom when browsing, ridden up when composing).
  const composerPixels = await sharp(file).extract(composerRegion).raw().toBuffer({ resolveWithObject: true });
  const amberPixels = countAmberPixels(composerPixels.data, composerPixels.info.channels);
  return { blankRatio, luma, dominant: bestKey, amberPixels };
}

function classify({ blankRatio, luma }) {
  if (blankRatio < BLANK_SHARE_THRESHOLD) return 'content';
  return luma < DARK_LUMA_THRESHOLD ? 'blank-dark' : 'blank-light';
}

/** Merge consecutive same-kind frames into runs; clip every run at the launch
 *  boundary and keep only the post-boundary part. Zero-length clips dropped. */
export function computePostLaunchBlankRuns(frames, boundarySec = LAUNCH_BOUNDARY_SEC, frameIntervalSec = 0.25) {
  const runs = [];
  let run = null;
  const close = (endT) => {
    if (!run) return;
    const clipped = { start: Math.max(run.start, boundarySec), end: endT, kind: run.kind };
    if (clipped.end > clipped.start) {
      runs.push({ ...clipped, length: +(clipped.end - clipped.start).toFixed(2) });
    }
    run = null;
  };
  for (const frame of frames) {
    if (frame.class !== 'content' && !run) run = { start: frame.t, kind: frame.class };
    if (frame.class === 'content' && run) close(frame.t);
  }
  if (run && frames.length > 0) close(+(frames[frames.length - 1].t + frameIntervalSec).toFixed(2));
  return runs;
}

/** Merge raw composer-absent runs into named episodes (gap-tolerant). */
export function computeComposerEpisodes(rawRuns, gapSec = COMPOSER_EPISODE_GAP_SEC) {
  const episodes = [];
  for (const run of rawRuns) {
    const last = episodes[episodes.length - 1];
    if (last && run.start - last.end <= gapSec) {
      last.end = run.end;
      last.length = +(last.end - last.start).toFixed(2);
      last.rawCount += 1;
    } else {
      episodes.push({ start: run.start, end: run.end, length: run.length, rawCount: 1 });
    }
  }
  return episodes;
}

export const BLANK_RUN_TOLERANCE_SEC = 0.25;

export function buildVerdict(postLaunchBlankRuns, composerAbsentRuns, toleranceSec = BLANK_RUN_TOLERANCE_SEC) {
  // Both booleans read the SAME collection: a run only counts as a shell
  // failure when it outlasts the shared tolerance, so a boundary sliver
  // (e.g. cold start ending 0.25s past the launch line) can neither
  // false-pass a real failure nor false-fail a clean session.
  const significant = postLaunchBlankRuns.filter((run) => run.length > toleranceSec);
  const longestPostLaunch = postLaunchBlankRuns.reduce((max, run) => Math.max(max, run.length), 0);
  return {
    shellNeverBlank: significant.length === 0,
    significantBlankRuns: significant,
    longestPostLaunchBlankRunSec: +longestPostLaunch.toFixed(2),
    longestPostLaunchBlankRunUnder250ms: longestPostLaunch <= toleranceSec,
    composerNeverLostOver1sPostLaunch: composerAbsentRuns.every((run) => run.length <= 1),
  };
}

function computeRawComposerAbsentRuns(frames, boundarySec = LAUNCH_BOUNDARY_SEC, frameIntervalSec = 0.25) {
  const runs = [];
  let start = null;
  const close = (endT) => {
    if (start === null) return;
    if (endT > start) runs.push({ start, end: endT, length: +(endT - start).toFixed(2) });
    start = null;
  };
  for (const frame of frames) {
    if (frame.t < boundarySec) continue;
    const absent = frame.class === 'content' && !frame.composerPresent;
    if (absent && start === null) start = frame.t;
    if (!absent && start !== null) close(frame.t);
  }
  if (start !== null && frames.length > 0) close(+(frames[frames.length - 1].t + frameIntervalSec).toFixed(2));
  return runs;
}

async function run(videoPath, fps, outPath) {
  const FFMPEG_CANDIDATES = [
    process.env.FFMPEG_BIN,
    'C:\\Users\\myh_1\\AppData\\Local\\Temp\\f010-video-tools\\node_modules\\ffmpeg-static\\ffmpeg.exe',
    'ffmpeg',
  ].filter(Boolean);
  const ffmpeg = FFMPEG_CANDIDATES.find((candidate) => candidate === 'ffmpeg' || existsSync(candidate));
  if (!ffmpeg) {
    console.error('FAIL: no ffmpeg found (set FFMPEG_BIN)');
    process.exit(1);
  }
  const inputSha256 = createHash('sha256').update(readFileSync(videoPath)).digest('hex');

  const workDir = join(tmpdir(), `f010-frame-report-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });
  execFileSync(ffmpeg, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    resolve(videoPath),
    '-vf',
    `fps=${fps},scale=296:-2`,
    join(workDir, 'frame-%05d.png'),
  ]);
  const files = readdirSync(workDir)
    .filter((f) => f.endsWith('.png'))
    .sort();

  const frames = [];
  for (const [index, file] of files.entries()) {
    const metrics = await analyzeFrame(join(workDir, file));
    frames.push({
      t: +(index / fps).toFixed(2),
      class: classify(metrics),
      blankRatio: +metrics.blankRatio.toFixed(3),
      luma: metrics.luma,
      composerPresent: metrics.amberPixels >= COMPOSER_AMBER_MIN_PIXELS,
    });
  }
  rmSync(workDir, { recursive: true, force: true });

  const frameIntervalSec = 1 / fps;
  const postLaunchBlankRuns = computePostLaunchBlankRuns(frames, LAUNCH_BOUNDARY_SEC, frameIntervalSec);
  const blankFrames = frames.filter((f) => f.class !== 'content');
  const composerAbsentRuns = computeRawComposerAbsentRuns(frames, LAUNCH_BOUNDARY_SEC, frameIntervalSec);
  const composerAbsentEpisodes = computeComposerEpisodes(composerAbsentRuns);

  const report = {
    toolVersion: TOOL_VERSION,
    video: resolve(videoPath),
    inputSha256,
    launchBoundarySec: LAUNCH_BOUNDARY_SEC,
    composerEpisodeGapSec: COMPOSER_EPISODE_GAP_SEC,
    fps,
    frameCount: frames.length,
    durationSec: +(frames.length / fps).toFixed(2),
    classes: {
      content: frames.filter((f) => f.class === 'content').length,
      'blank-light': frames.filter((f) => f.class === 'blank-light').length,
      'blank-dark': frames.filter((f) => f.class === 'blank-dark').length,
    },
    blankFrames: blankFrames.map((f) => ({ t: f.t, kind: f.class, blankRatio: f.blankRatio, luma: f.luma })),
    postLaunchBlankRuns,
    composerAbsentRuns,
    composerAbsentEpisodes,
    composerAbsentTotalSec: +composerAbsentRuns.reduce((sum, run) => sum + run.length, 0).toFixed(2),
    verdict: buildVerdict(postLaunchBlankRuns, composerAbsentRuns),
  };

  if (outPath) writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        ...report,
        blankFrames: `see ${outPath ?? '--out'} ( ${blankFrames.length} frames )`,
      },
      null,
      2,
    ),
  );
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const args = process.argv.slice(2);
  const video = args.find((a) => !a.startsWith('--'));
  const fps = Number(args.find((a) => a.startsWith('--fps='))?.split('=')[1] ?? 4);
  const outPath = args.find((a) => a.startsWith('--out='))?.split('=')[1] ?? null;
  if (!video || !existsSync(video)) {
    console.error('usage: node scripts/f010-frame-report.mjs <video.mp4> [--fps=4] [--out=report.json]');
    process.exit(2);
  }
  await run(video, fps, outPath);
}
