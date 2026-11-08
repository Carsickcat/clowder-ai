import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startAtelierAcceptance } from '../../../api/test/fashion/browser-server.ts';
import { realSurfaceApiResponse } from './f307-real-surface-fixtures.mjs';

const web = fileURLToPath(new URL('../../', import.meta.url));
const api = await startAtelierAcceptance();
const dist = path.basename(await mkdtemp(path.join(web, '.next-test-f317-')));
const config = `tsconfig.${dist.slice(1)}.json`;
await writeFile(
  path.join(web, config),
  JSON.stringify({
    extends: './tsconfig.json',
    compilerOptions: { noEmit: true },
    include: ['next-env.d.ts', 'src/**/*.ts', 'src/**/*.tsx', `${dist}/types/**/*.ts`],
    exclude: ['node_modules'],
  }),
);
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
probe.close();
await once(probe, 'close');
spawnSync(process.execPath, [path.join(web, 'scripts/sync-vendor-assets.mjs')], { cwd: web, windowsHide: true });
const server = spawn(
  process.execPath,
  [path.resolve(web, '../../node_modules/next/dist/bin/next'), 'dev', '-H', '127.0.0.1', '-p', String(port)],
  {
    cwd: web,
    windowsHide: true,
    env: {
      ...process.env,
      API_SERVER_PORT: new URL(api.url).port,
      NEXT_PUBLIC_API_URL: api.url,
      CAT_CAFE_WEB_TEST_DIST_DIR: dist,
      CAT_CAFE_WEB_TEST_TSCONFIG: config,
      NEXT_TELEMETRY_DISABLED: '1',
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
const output = [];
server.stdout.on('data', (b) => output.push(b.toString()));
server.stderr.on('data', (b) => output.push(b.toString()));
const url = `http://127.0.0.1:${port}/atelier?from=atelier-test`;
const evidence = await mkdtemp(path.join(tmpdir(), 'f317-ui-evidence-'));
console.log(JSON.stringify({ url, evidence, api: api.url, uploads: api.uploadDir }));
let browser;
let failure;
let page;
try {
  let ready = false;
  for (let i = 0; i < 180; i++) {
    try {
      if ((await fetch(url)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(ready, output.join(''));
  browser = await chromium.launch({
    headless: true,
    ...(process.env.FASHION_BROWSER_CHANNEL ? { channel: process.env.FASHION_BROWSER_CHANNEL } : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.error('BROWSER:', e.message);
  });
  // Unrelated Hub services are not under test. Fashion, session and uploads use the real HTTP server.
  await page.route('**/api/**', (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p.startsWith('/api/fashion-designs') || p === '/api/session' || p === '/api/threads') return route.continue();
    const fixture = realSurfaceApiResponse(route.request(), false);
    return route.fulfill({
      status: fixture?.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture?.body ?? {}),
    });
  });
  const shots = [];
  async function capture(name) {
    for (const theme of ['light', 'dark']) {
      const viewport = page.viewportSize();
      if (viewport.width < 760) await page.setViewportSize({ width: 1440, height: 1000 });
      await page.getByRole('button', { name: '主题', exact: true }).click();
      await page.getByRole('button', { name: theme === 'light' ? 'Light' : 'Dark', exact: true }).click();
      if (viewport.width < 760) await page.setViewportSize(viewport);
      await page.evaluate(() => {
        const root = document.querySelector('.atelier');
        root.scrollTop = 0;
        root.parentElement.scrollTop = 0;
      });
      await page.screenshot({ path: path.join(evidence, `${name}-${theme}.png`), fullPage: true });
      shots.push(`${name}-${theme}.png`);
      console.log('Captured', name, theme);
    }
  }
  await page.goto(url);
  await page.getByRole('heading', { name: '把灵感，变成可确认的设计。' }).waitFor();
  await capture('01-empty');
  await page.getByLabel('款式名称').fill('秋日夹克');
  await page.getByLabel('正面照片', { exact: true }).setInputFiles(path.join(api.fixtureDir, 'jacket.png'));
  await page.getByRole('button', { name: '上传并创建设计' }).click();
  await page.getByRole('button', { name: '分析设计点', exact: true }).waitFor();
  api.control.delay = 1400;
  await page.getByRole('button', { name: '分析设计点', exact: true }).click();
  await page.getByRole('button', { name: '分析中，可安全刷新页面' }).waitFor();
  await capture('02-analyzing');
  await page.reload();
  await page.getByRole('heading', { name: /设计点/ }).waitFor();
  assert.equal(api.control.analysisCalls, 1);
  api.control.delay = 60;
  const id = new URL(page.url()).searchParams.get('design');
  assert.ok(id);
  const state = await api.service.get('owner', id);
  const draft = Object.values(state.versions)[0];
  await capture('03-unconfirmed');
  // Confirm every actual instance through its UI form, including independent left/right pockets.
  for (const [domainId, domain] of Object.entries(draft.domains)) {
    const labels = {
      silhouette: '廓形',
      collar: '领型',
      sleeve: '袖型',
      'body-panel': '衣身结构',
      closure: '门襟',
      pocket: '口袋',
      hem: '下摆',
      fabric: '面料与辅料',
    };
    await page.locator('.atelier-domain-list section>button').filter({ hasText: labels[domainId] }).click();
    for (const part of domain.components) {
      await page.getByRole('checkbox', { name: new RegExp(part.label) }).check();
      await page.getByRole('button', { name: '确认此设计点', exact: true }).click();
      await page.getByRole('button', { name: '重新确认此设计点' }).waitFor();
      await page.getByRole('checkbox', { name: new RegExp(part.label) }).uncheck();
    }
  }
  await page.locator('.atelier-domain-list section>button').filter({ hasText: '口袋' }).click();
  const pocket = draft.domains.pocket.components[0];
  await page.getByRole('checkbox', { name: new RegExp(pocket.label) }).check();
  await page.locator('.atelier-composer textarea').fill('将左口袋改成蓝色，保留右口袋');
  await capture('04-editing');
  api.control.delay = 1200;
  await page.getByRole('button', { name: '生成局部预览' }).click();
  await page.getByText('正在生成预览', { exact: true }).waitFor();
  await capture('05-generating');
  await page.reload();
  await page.getByRole('button', { name: '采用此候选' }).waitFor({ timeout: 30000 });
  await capture('06-candidate');
  await page.getByRole('button', { name: '采用此候选' }).click();
  await page.getByText('已采用这个候选', { exact: true }).waitFor();
  api.control.delay = 60;
  await page.locator('.atelier-domain-list section>button').filter({ hasText: '口袋' }).click();
  await page.getByRole('checkbox', { name: new RegExp(pocket.label) }).check();
  await page.getByLabel('设计说明', { exact: true }).fill('我指定左口袋采用蓝色');
  await page.getByRole('button', { name: '重新确认此设计点', exact: true }).click();
  await page.getByRole('button', { name: '重新确认此设计点' }).waitFor();
  await page.getByRole('button', { name: '冻结并生成款式线稿', exact: true }).click();
  await page.getByRole('link', { name: '下载 SVG' }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: `溯源 ${pocket.label}`, exact: true }).click();
  await capture('07-blueprint');
  const before = await api.service.get('owner', id);
  const snapshot = Object.values(before.snapshots)[0];
  const bytes = await (
    await fetch(`${api.url}${before.design.assets[Object.values(before.technicalFlats)[0].svgAssetId].urlPath}`)
  ).text();
  assert.ok(bytes.includes(snapshot.snapshotHash));
  await page.getByRole('tab', { name: '胚样', exact: true }).click();
  api.control.mode = 'drift';
  await page.locator('.atelier-composer textarea').fill('漂移阻断验收');
  await page.getByRole('button', { name: '生成局部预览' }).click();
  await page.getByText(/锁定部位有变化/).waitFor();
  assert.equal(await page.getByRole('button', { name: '采用此候选' }).isDisabled(), true);
  await capture('08-drift');
  api.control.mode = 'fail';
  await page.locator('.atelier-composer textarea').fill('失败与重试验收');
  await page.getByRole('button', { name: '生成局部预览' }).click();
  await page.getByRole('button', { name: '重试预览' }).waitFor();
  await capture('09-failure');
  api.control.mode = 'valid';
  await page.getByRole('button', { name: '重试预览' }).click();
  await page.getByRole('button', { name: '采用此候选' }).waitFor();
  // Another browser session updates the active version: accepting the old candidate must conflict.
  const concurrent = await api.service.get('owner', id);
  const active = concurrent.design.activeVersionId;
  await api.service.restore('owner', id, active, active);
  await page.getByRole('button', { name: '采用此候选' }).click();
  await page.getByRole('button', { name: '读取新版，保留输入' }).waitFor();
  assert.equal(await page.locator('.atelier-composer textarea').inputValue(), '失败与重试验收');
  await capture('10-conflict');
  await page.getByRole('button', { name: '读取新版，保留输入' }).click();
  await page.getByRole('tab', { name: '图纸', exact: true }).click();
  await page.getByRole('button', { name: '冻结新快照', exact: true }).waitFor();
  assert.equal(JSON.stringify((await api.service.get('owner', id)).snapshots[snapshot.id]), JSON.stringify(snapshot));
  await page.setViewportSize({ width: 390, height: 844 });
  await capture('11-mobile-blueprint');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('tab', { name: '胚样', exact: true }).click();
  await page.getByRole('tab', { name: '背面 · 缺照片' }).click();
  await page.getByRole('heading', { name: '还没有背面照片' }).waitFor();
  await capture('12-missing-back');
  await page.goto(url + '&design=foreign');
  await page.getByText('这个款式不存在，或你没有访问权限。', { exact: true }).waitFor();
  await capture('13-no-access');
  await page.goto(`${url}&design=${id}`);
  await page.getByRole('heading', { name: /设计点/ }).waitFor();
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(evidence, 'verdict.json'),
    JSON.stringify(
      {
        pass: true,
        realHttp: true,
        provider: 'recorded analysis + deterministic native-image protocol fixture',
        id,
        shots,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(`PASS Atelier golden path + recovery/conflict/drift + ${shots.length} screenshots`);
} catch (e) {
  failure = e;
  console.error(e);
  if (page) {
    await page.screenshot({ path: path.join(evidence, 'failure.png'), fullPage: true });
    console.error((await page.locator('body').innerText()).slice(0, 5000));
  }
  await writeFile(path.join(evidence, 'server.log'), output.join(''));
} finally {
  if (browser) await browser.close();
  if (process.env.FASHION_KEEP_PREVIEW === '1' && !failure) {
    console.log('Preview remains available');
    await new Promise(() => {});
  }
  server.kill('SIGTERM');
  await api.pipeline.previewWorker.whenIdle();
  await api.app.close();
}
if (failure) process.exitCode = 1;
