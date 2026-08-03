import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer';

const baseUrl = process.env.NOVA_ACCEPTANCE_URL ?? 'http://127.0.0.1:5184';
const evidenceDir = resolve(process.env.NOVA_ACCEPTANCE_EVIDENCE_DIR ?? 'data/nova-acceptance-evidence');
const userId = process.env.NOVA_ACCEPTANCE_USER_ID;

if (!userId) throw new Error('NOVA_ACCEPTANCE_USER_ID is required for deterministic video evidence');

await mkdir(evidenceDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--disable-gpu', '--no-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/observability/inspections?userId=${encodeURIComponent(userId)}`, {
    waitUntil: 'networkidle0',
  });
  await page.waitForSelector('[data-testid="report-intelligence"]');

  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const steps = Array.from({ length: 15 }, (_, index) => index / 14);
  const journey = [...steps, ...steps.slice().reverse()];
  const frames = [];

  for (const progress of journey) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), scrollHeight * progress);
    frames.push((await page.screenshot({ encoding: 'base64' })).toString());
  }

  const recorderPage = await browser.newPage();
  await recorderPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await recorderPage.setContent('<canvas width="1440" height="900"></canvas>');
  const recording = await recorderPage.evaluate(async (encodedFrames) => {
    const canvas = document.querySelector('canvas');
    const context = canvas.getContext('2d');
    const chunks = [];
    const recorder = new MediaRecorder(canvas.captureStream(4), {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 2_500_000,
    });
    const stopped = new Promise((resolveStopped) => {
      recorder.addEventListener('stop', resolveStopped, { once: true });
    });
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    recorder.start();

    for (const frame of encodedFrames) {
      const image = new Image();
      image.src = `data:image/png;base64,${frame}`;
      await image.decode();
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      await new Promise((resolveFrame) => setTimeout(resolveFrame, 500));
    }

    recorder.stop();
    await stopped;
    const bytes = new Uint8Array(await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return { base64: btoa(binary), mimeType: recorder.mimeType };
  }, frames);

  const outputPath = resolve(evidenceDir, 'nova-connected-runtime-15s.webm');
  await writeFile(outputPath, Buffer.from(recording.base64, 'base64'));
  process.stdout.write(
    `${JSON.stringify({ outputPath, mimeType: recording.mimeType, frames: frames.length, durationSeconds: 15 })}\n`,
  );
} finally {
  await browser.close();
}
