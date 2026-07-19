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
 * ffmpeg resolution order: FFMPEG_BIN env → repo-local temp tools → PATH.
 * Requires `sharp` (already a repo dependency, used via next/image).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const video = args.find((a) => !a.startsWith('--'));
const fps = Number(args.find((a) => a.startsWith('--fps='))?.split('=')[1] ?? 4);
const outPath = args.find((a) => a.startsWith('--out='))?.split('=')[1] ?? null;
if (!video || !existsSync(video)) {
  console.error('usage: node scripts/f010-frame-report.mjs <video.mp4> [--fps=4] [--out=report.json]');
  process.exit(2);
}

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

const workDir = join(tmpdir(), `f010-frame-report-${Date.now()}`);
mkdirSync(workDir, { recursive: true });

/** App band: below iOS status bar, above the form-assistant/keyboard zone. */
const BAND = { left: 0.0, top: 0.05, width: 1.0, height: 0.5 };
const BLANK_SHARE_THRESHOLD = 0.75; // mode-bucket share: content ≤0.61, blank ≥0.82 on reference footage
const DARK_LUMA_THRESHOLD = 60;

async function analyzeFrame(file) {
  const image = sharp(file);
  const meta = await image.metadata();
  const region = {
    left: Math.round(meta.width * BAND.left),
    top: Math.round(meta.height * BAND.top),
    width: Math.round(meta.width * BAND.width),
    height: Math.round(meta.height * BAND.height),
  };
  const { data, info } = await image.extract(region).resize(48, 96, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
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
  return { blankRatio, luma, dominant: bestKey };
}

function classify({ blankRatio, luma }) {
  if (blankRatio < BLANK_SHARE_THRESHOLD) return 'content';
  return luma < DARK_LUMA_THRESHOLD ? 'blank-dark' : 'blank-light';
}

function main() {
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', resolve(video), '-vf', `fps=${fps},scale=296:-2`, join(workDir, 'frame-%05d.png')]);
  const files = readdirSync(workDir).filter((f) => f.endsWith('.png')).sort();
  return files;
}

const files = main();
const frames = [];
for (const [index, file] of files.entries()) {
  const metrics = await analyzeFrame(join(workDir, file));
  frames.push({ t: +(index / fps).toFixed(2), class: classify(metrics), blankRatio: +metrics.blankRatio.toFixed(3), luma: metrics.luma });
}
rmSync(workDir, { recursive: true, force: true });

const blankFrames = frames.filter((f) => f.class !== 'content');
let longestRun = { start: 0, end: 0, length: 0 };
let runStart = null;
for (const frame of frames) {
  if (frame.class !== 'content' && runStart === null) runStart = frame.t;
  if (frame.class === 'content' && runStart !== null) {
    if (frame.t - runStart > longestRun.length) longestRun = { start: runStart, end: frame.t, length: +(frame.t - runStart).toFixed(2) };
    runStart = null;
  }
}
if (runStart !== null && frames.length > 0) {
  const end = frames[frames.length - 1].t + 1 / fps;
  if (end - runStart > longestRun.length) longestRun = { start: runStart, end: +end.toFixed(2), length: +(end - runStart).toFixed(2) };
}

const report = {
  video: resolve(video),
  fps,
  frameCount: frames.length,
  durationSec: +(frames.length / fps).toFixed(2),
  classes: {
    content: frames.filter((f) => f.class === 'content').length,
    'blank-light': frames.filter((f) => f.class === 'blank-light').length,
    'blank-dark': frames.filter((f) => f.class === 'blank-dark').length,
  },
  blankFrames: blankFrames.map((f) => ({ t: f.t, kind: f.class, blankRatio: f.blankRatio, luma: f.luma })),
  longestBlankRunSec: longestRun,
  verdict: {
    shellNeverBlank: blankFrames.filter((f) => f.t > 3).length === 0, // ignore cold-start band
    longestBlankRunUnder250msPostLaunch: longestRun.length <= 0.25 || longestRun.start < 3,
  },
};

if (outPath) writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, blankFrames: `see ${outPath ?? '--out'} ( ${blankFrames.length} frames )` }, null, 2));
