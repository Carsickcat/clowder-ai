import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { launchOfflineChrome } from './cdp-client.mjs';

const rootDirectory = path.resolve(import.meta.dirname, '..');
const artifactPath = path.join(rootDirectory, 'index.html');
const outputPath = path.join(rootDirectory, 'evidence', '06-user-directed-risk-walkthrough-15s.webm');

async function click(session, selector) {
  const clicked = await session.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element || element.disabled) return false;
    element.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Expected clickable element ${selector}`);
}

async function captureFrame(session) {
  const result = await session.send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: 72,
    captureBeyondViewport: false,
  });
  return result.data;
}

async function composeWebm(session, frames) {
  return session.evaluate(`(async () => {
    const frameData = ${JSON.stringify(frames)};
    const canvas = document.createElement("canvas");
    canvas.width = 1440;
    canvas.height = 1000;
    const context = canvas.getContext("2d");
    const images = await Promise.all(frameData.map((data) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = "data:image/jpeg;base64," + data;
    })));
    const stream = canvas.captureStream(10);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_000_000 });
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });
    const startedAt = performance.now();
    recorder.start(1000);
    for (let index = 0; index < images.length; index += 1) {
      const current = images[index];
      context.globalAlpha = 1;
      context.drawImage(current, 0, 0, canvas.width, canvas.height);
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    recorder.stop();
    await Promise.race([
      stopped,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("MediaRecorder stop timed out")), 5000),
      ),
    ]);
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: mimeType });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return {
      base64: btoa(binary),
      elapsedMs: Math.round(performance.now() - startedAt),
      mimeType,
      size: bytes.length,
    };
  })()`);
}

async function main() {
  await readFile(artifactPath);
  const browser = await launchOfflineChrome();
  const { session } = browser;
  try {
    await Promise.all([
      session.send('Page.enable'),
      session.send('Runtime.enable'),
      session.send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      }),
    ]);
    const loaded = session.once('Page.loadEventFired');
    await session.send('Page.navigate', {
      url: pathToFileURL(artifactPath).href,
    });
    await loaded;

    const frames = [];
    await click(session, '[data-example-id="payment-config"]');
    await session.evaluate('document.querySelector("[data-intent-form]").requestSubmit()');
    frames.push(await captureFrame(session));
    await click(session, '[data-action="INPUT_CONFIRMED"]');
    frames.push(await captureFrame(session));
    await click(session, '[data-action="PLAYBOOK_DIFF_CONFIRMED"]');
    frames.push(await captureFrame(session));
    await click(session, '[data-action="CANDIDATE_DISPOSED"][data-disposition="accepted"]');
    frames.push(await captureFrame(session));
    await click(session, '[data-action="PLAN_CONFIRMED"]');
    for (let index = 0; index < 4; index += 1) {
      await click(session, '[data-action="EXECUTION_ADVANCED"]');
    }
    frames.push(await captureFrame(session));
    await click(session, '[data-action="RC_TOGGLED"]');
    frames.push(await captureFrame(session));

    const recording = await composeWebm(session, frames);
    assert.ok(recording.elapsedMs >= 14_500, 'recording must be at least 14.5 seconds');
    assert.ok(recording.size > 10_000, `recording must contain meaningful frames (received ${recording.size} bytes)`);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from(recording.base64, 'base64'));
    process.stdout.write(
      `Recorded ${outputPath} (${recording.elapsedMs}ms, ${recording.size} bytes, ${recording.mimeType}).\n`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
