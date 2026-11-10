import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { describe, it, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';
import sharp from 'sharp';
import { parseShimFile, resolveWindowsShimSpawn } from '../../src/utils/cli-spawn-win.js';
import { garment } from './fixtures.js';

const API_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const WORKTREE_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const STARTUP_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const FORCE_SHUTDOWN_TIMEOUT_MS = 5_000;

type Sandbox = {
  environment: NodeJS.ProcessEnv;
  root: string;
  workspace: string;
};

type StartedApi = Sandbox & {
  child: ChildProcess;
  origin: string;
  output: () => string;
  stop: () => Promise<void>;
};

type StartedRedis = {
  child: ChildProcess;
  save: () => Promise<void>;
  stop: () => Promise<void>;
  url: string;
};

type StartOptions = {
  environment?: Record<string, string>;
  onSandboxCreated?: (root: string) => void;
  prepareSandbox?: (sandbox: Sandbox) => Promise<void>;
};

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

function waitsForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (hasExited(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      child.off('exit', onExit);
      resolve(false);
    }, timeoutMs);
    child.once('exit', onExit);
  });
}

async function stopOwnedChild(child: ChildProcess): Promise<void> {
  if (hasExited(child)) return;
  try {
    child.kill('SIGTERM');
  } catch (error) {
    if (!hasExited(child)) throw error;
  }
  if (await waitsForExit(child, SHUTDOWN_TIMEOUT_MS)) return;

  // This ChildProcess was created by this test. Escalation is deliberately
  // scoped to its exact PID after the graceful, bounded shutdown timed out.
  try {
    child.kill('SIGKILL');
  } catch (error) {
    if (!hasExited(child)) throw error;
  }
  if (await waitsForExit(child, FORCE_SHUTDOWN_TIMEOUT_MS)) return;
  throw new Error(`Timed out stopping owned F317 entrypoint child pid=${child.pid ?? 'unknown'}`);
}

function isInside(root: string, target: string): boolean {
  const remainder = relative(root, target);
  return remainder === '' || (!remainder.startsWith('..') && !isAbsolute(remainder));
}

function runtimeEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  // Use a small OS allowlist instead of inheriting process.env. In particular,
  // the parent runtime may hold production Redis, workspace and credential paths.
  for (const key of [
    'COMSPEC',
    'NUMBER_OF_PROCESSORS',
    'OS',
    'PATH',
    'PATHEXT',
    'PROCESSOR_ARCHITECTURE',
    'ProgramData',
    'ProgramFiles',
    'ProgramFiles(x86)',
    'SystemRoot',
    'TEMP',
    'TMP',
    'WINDIR',
  ]) {
    const value = process.env[key];
    if (value !== undefined) environment[key] = value;
  }
  return environment;
}

async function reserveLoopbackPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string', 'test port reservation did not return a TCP address');
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function createSandbox(overrides: Record<string, string> = {}): Promise<Sandbox> {
  const root = await mkdtemp(join(tmpdir(), 'f317-entrypoint-'));
  const workspace = join(root, 'workspace');
  const data = join(root, 'data');
  const databases = join(root, 'databases');
  const home = join(root, 'home');
  const appData = join(root, 'appdata');
  const localAppData = join(root, 'localappdata');
  const globalConfig = join(root, 'global-config');
  const templatePath = join(workspace, 'cat-template.json');
  const docsRoot = join(workspace, 'docs');
  const uploads = join(data, 'uploads');
  const logs = join(data, 'logs');
  const auditLogs = join(data, 'audit-logs');
  const cliArchive = join(data, 'cli-raw-archive');
  const connectorMedia = join(data, 'connector-media');
  const transcripts = join(data, 'transcripts');

  await Promise.all([
    mkdir(join(workspace, 'packages', 'api', 'src', 'plugins'), { recursive: true }),
    mkdir(join(workspace, 'cat-cafe-skills'), { recursive: true }),
    mkdir(join(docsRoot, 'markers'), { recursive: true }),
    mkdir(data, { recursive: true }),
    mkdir(databases, { recursive: true }),
    mkdir(home, { recursive: true }),
    mkdir(appData, { recursive: true }),
    mkdir(localAppData, { recursive: true }),
    mkdir(globalConfig, { recursive: true }),
    mkdir(uploads, { recursive: true }),
    mkdir(logs, { recursive: true }),
    mkdir(auditLogs, { recursive: true }),
    mkdir(cliArchive, { recursive: true }),
    mkdir(connectorMedia, { recursive: true }),
    mkdir(transcripts, { recursive: true }),
  ]);
  await Promise.all([
    copyFile(join(WORKTREE_ROOT, 'cat-template.json'), templatePath),
    writeFile(join(workspace, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n'),
  ]);

  const environment: NodeJS.ProcessEnv = {
    ...runtimeEnvironment(),
    API_SERVER_HOST: '127.0.0.1',
    API_SERVER_PORT: '0',
    APPDATA: appData,
    AUDIT_LOG_DIR: auditLogs,
    CAT_CAFE_AGENT_KEY_ALLOW_MEMORY_SIDECAR: '0',
    CAT_CAFE_AGENT_KEY_SIDECAR_DISABLED: '1',
    CAT_CAFE_DATA_DIR: data,
    CAT_CAFE_GLOBAL_CONFIG_ROOT: globalConfig,
    CAT_CAFE_GPT_PRO_AGENT_KEY_FILE: join(data, 'agent-keys', 'gpt-pro.secret'),
    CAT_CAFE_INVOCATION_REGISTRY: 'memory',
    CAT_CAFE_PROVISION_GLOBAL_SIDECAR: '0',
    CAT_CAFE_RUNTIME_ROOT: workspace,
    CAT_CAFE_SKIP_HOMEDIR_MIGRATION: '1',
    // Guard-only reference used by test-config-write-guard. It is never an
    // output location; HOME/USERPROFILE above are the sandboxed user profile.
    CAT_CAFE_TEST_REAL_HOME: homedir(),
    CAT_CAFE_TEST_SANDBOX: '1',
    CAT_CAFE_USER_ID: 'entrypoint-owner',
    CAT_CAFE_WORKSPACE_ROOT: workspace,
    CAT_TEMPLATE_PATH: templatePath,
    CLI_RAW_ARCHIVE_DIR: cliArchive,
    CONNECTOR_GATEWAY_AUTOSTART: '0',
    CONNECTOR_MEDIA_DIR: connectorMedia,
    DOCS_ROOT: docsRoot,
    EMBED_MODE: 'off',
    EVENT_MEMORY_DB: join(databases, 'event-memory.sqlite'),
    EVIDENCE_DB: join(databases, 'evidence.sqlite'),
    GLOBAL_KNOWLEDGE_DB: join(databases, 'global-knowledge.sqlite'),
    HOME: home,
    LISTEN_MODE_DB: join(databases, 'listen-mode.sqlite'),
    LOCALAPPDATA: localAppData,
    LOG_DIR: logs,
    MEMORY_STORE: '1',
    NODE_ENV: 'test',
    OTEL_SDK_DISABLED: 'true',
    PREVIEW_GATEWAY_ENABLED: '0',
    TASK_OUTCOME_DB: join(databases, 'task-outcomes.sqlite'),
    TRANSCRIPT_DATA_DIR: transcripts,
    TTS_CACHE_DIR: join(data, 'tts'),
    UPLOAD_DIR: uploads,
    USERPROFILE: home,
    WORLD_DB: join(databases, 'world.sqlite'),
    ...overrides,
  };

  return { environment, root, workspace };
}

function assertSandboxedEnvironment(sandbox: Sandbox): void {
  const redisUrl = sandbox.environment.REDIS_URL;
  if (redisUrl) {
    const endpoint = new URL(redisUrl);
    assert.equal(endpoint.hostname, '127.0.0.1', 'entrypoint Redis must be an owned loopback process');
    assert.notEqual(endpoint.port, '6399', 'entrypoint test must never target production Redis');
  } else {
    assert.equal(redisUrl, undefined, 'entrypoint test must never inherit Redis');
  }
  assert.equal(sandbox.environment.REDIS_PORT, undefined, 'entrypoint test must never inherit a Redis port');
  assert.equal(sandbox.environment.CAT_CAFE_TEST_SANDBOX, '1');
  assert.equal(sandbox.environment.CAT_CAFE_AGENT_KEY_SIDECAR_DISABLED, '1');
  assert.equal(sandbox.environment.CAT_CAFE_PROVISION_GLOBAL_SIDECAR, '0');
  assert.equal(sandbox.environment.CAT_CAFE_AGENT_KEY_ALLOW_MEMORY_SIDECAR, '0');

  for (const key of [
    'APPDATA',
    'AUDIT_LOG_DIR',
    'CAT_CAFE_DATA_DIR',
    'CAT_CAFE_GLOBAL_CONFIG_ROOT',
    'CAT_CAFE_GPT_PRO_AGENT_KEY_FILE',
    'CAT_CAFE_RUNTIME_ROOT',
    'CAT_CAFE_WORKSPACE_ROOT',
    'CAT_TEMPLATE_PATH',
    'CLI_RAW_ARCHIVE_DIR',
    'CONNECTOR_MEDIA_DIR',
    'DOCS_ROOT',
    'EVENT_MEMORY_DB',
    'EVIDENCE_DB',
    'GLOBAL_KNOWLEDGE_DB',
    'HOME',
    'LISTEN_MODE_DB',
    'LOCALAPPDATA',
    'LOG_DIR',
    'TASK_OUTCOME_DB',
    'TRANSCRIPT_DATA_DIR',
    'TTS_CACHE_DIR',
    'UPLOAD_DIR',
    'USERPROFILE',
    'WORLD_DB',
  ]) {
    const value = sandbox.environment[key];
    assert.ok(value, `${key} must be explicit in the entrypoint test environment`);
    assert.ok(isInside(sandbox.root, value), `${key} escapes test sandbox: ${value}`);
  }
}

async function startOwnedRedis(sandbox: Sandbox, port: number): Promise<StartedRedis> {
  const directory = join(sandbox.root, 'redis');
  await mkdir(directory, { recursive: true });
  const child = spawn(
    process.env.FASHION_REDIS_SERVER ?? 'redis-server',
    [
      '--bind',
      '127.0.0.1',
      '--port',
      String(port),
      '--save',
      '',
      '--appendonly',
      'no',
      '--dir',
      directory,
      '--dbfilename',
      'f317-entrypoint.rdb',
    ],
    { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );
  let logs = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    logs += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    logs += chunk.toString();
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Owned Redis did not start on ${port}:\n${logs}`)),
        STARTUP_TIMEOUT_MS,
      );
      const finish = (action: () => void) => {
        clearTimeout(timer);
        child.off('error', onError);
        child.off('exit', onExit);
        child.stdout?.off('data', onData);
        child.stderr?.off('data', onData);
        action();
      };
      const onData = () => {
        if (logs.includes('Ready to accept connections')) finish(resolve);
      };
      const onError = (error: Error) => finish(() => reject(error));
      const onExit = (code: number | null, signal: NodeJS.Signals | null) =>
        finish(() => reject(new Error(`Owned Redis exited before ready (code=${code}, signal=${signal}):\n${logs}`)));
      child.once('error', onError);
      child.once('exit', onExit);
      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
      onData();
    });
    const url = `redis://127.0.0.1:${port}/15`;
    const redis = new Redis(url, { maxRetriesPerRequest: 0, retryStrategy: () => null });
    // ioredis emits an error event after a deliberate shutdown; it is not an
    // unhandled test failure because this test owns the server and socket.
    redis.on('error', () => undefined);
    await redis.ping();
    let stopped = false;
    return {
      child,
      url,
      save: async () => {
        await redis.save();
      },
      stop: async () => {
        if (stopped) return;
        stopped = true;
        try {
          await redis.shutdown('NOSAVE');
        } catch {
          // Redis closes the connection while acknowledging SHUTDOWN.
        } finally {
          redis.disconnect();
        }
        await stopOwnedChild(child);
      },
    };
  } catch (error) {
    await stopOwnedChild(child).catch(() => undefined);
    throw error;
  }
}

function waitForListening(child: ChildProcess, output: () => string): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.off('error', onError);
      child.off('exit', onExit);
      child.stdout?.off('data', onData);
      child.stderr?.off('data', onData);
      action();
    };
    const onData = () => {
      const match = output().match(/Server running on (http:\/\/127\.0\.0\.1:\d+)/);
      const origin = match?.[1];
      if (origin !== undefined) settle(() => resolve(origin));
    };
    const onError = (error: Error) => settle(() => reject(error));
    const onExit = (code: number | null, signal: NodeJS.Signals | null) =>
      settle(() =>
        reject(new Error(`API entrypoint exited before listening (code=${code}, signal=${signal}):\n${output()}`)),
      );
    const timeout = setTimeout(
      () => settle(() => reject(new Error(`API entrypoint did not start:\n${output()}`))),
      STARTUP_TIMEOUT_MS,
    );

    child.once('error', onError);
    child.once('exit', onExit);
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    onData();
  });
}

async function startMemoryApi(t: TestContext, options: StartOptions = {}): Promise<StartedApi> {
  const sandbox = await createSandbox(options.environment);
  let child: ChildProcess | undefined;
  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    if (child) await stopOwnedChild(child);
    await rm(sandbox.root, { force: true, recursive: true });
    cleaned = true;
  };
  // Register cleanup before spawn/listening awaits so a failed startup cannot
  // leak either the process or its isolated data directory.
  t.after(cleanup);

  try {
    await options.prepareSandbox?.(sandbox);
    options.onSandboxCreated?.(sandbox.root);
    assertSandboxedEnvironment(sandbox);
    const startedChild = spawn(process.execPath, [join(API_ROOT, 'dist', 'index.js')], {
      cwd: sandbox.workspace,
      env: sandbox.environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child = startedChild;
    let logs = '';
    startedChild.stdout?.on('data', (chunk: Buffer) => {
      logs += chunk.toString();
    });
    startedChild.stderr?.on('data', (chunk: Buffer) => {
      logs += chunk.toString();
    });
    const origin = await waitForListening(startedChild, () => logs);
    return { ...sandbox, child: startedChild, origin, output: () => logs, stop: () => stopOwnedChild(startedChild) };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function installDeterministicCodexTransport(sandbox: Sandbox): Promise<void> {
  const bin = join(sandbox.root, 'fake-codex-bin');
  // Keep fixture inputs beside the executable. CodexAgentService intentionally
  // constructs a constrained child environment, so arbitrary parent-only test
  // variables are not a reliable transport contract.
  const domainsPath = join(bin, 'recorded-domains.json');
  const generatedFixturePath = join(bin, 'generated-preview.png');
  const scriptPath = join(bin, 'f317-fake-codex.mjs');
  const commandPath = join(bin, 'codex.cmd');
  const domains = garment();
  const firstPocket = domains.pocket.components[0];
  assert.ok(firstPocket, 'the recorded garment must include a pocket fixture');
  const sourcePocket = structuredClone(firstPocket);
  sourcePocket.partId = 'pocket-left';
  sourcePocket.label = 'image-left pocket';
  sourcePocket.attributes = { ...sourcePocket.attributes, side: 'left' };
  const siblingPocket = structuredClone(sourcePocket);
  siblingPocket.partId = 'pocket-right';
  siblingPocket.label = 'image-right pocket';
  siblingPocket.attributes = { ...siblingPocket.attributes, side: 'right' };
  domains.pocket.components = [sourcePocket, siblingPocket];

  await mkdir(bin, { recursive: true });
  await writeFile(domainsPath, JSON.stringify(domains));
  await writeFile(generatedFixturePath, await validPng());
  await writeFile(
    scriptPath,
    String.raw`import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const prompt = await new Promise((resolve, reject) => {
  let text = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { text += chunk; });
  process.stdin.once('end', () => resolve(text));
  process.stdin.once('error', reject);
});
const marker = '\nINPUT_JSON\n';
const index = prompt.lastIndexOf(marker);
if (index === -1) throw new Error('missing INPUT_JSON');
const input = JSON.parse(prompt.slice(index + marker.length));
const emit = (event) => process.stdout.write(JSON.stringify(event) + '\n');
const replaceSourceAsset = (value, assetId) => {
  if (Array.isArray(value)) return value.map((item) => replaceSourceAsset(item, assetId));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceSourceAsset(item, assetId)]));
  }
  return value === 'source-front' ? assetId : value;
};
const sessionId = prompt.includes('TASK: PREVIEW')
  ? 'f317-transport-preview'
  : prompt.includes('TASK: VALIDATE_PREVIEW')
    ? 'f317-transport-validation'
    : 'f317-transport-analysis';
emit({ type: 'thread.started', thread_id: sessionId });

let result;
if (prompt.includes('TASK: ANALYZE')) {
  const fixture = JSON.parse(await readFile(new URL('./recorded-domains.json', import.meta.url), 'utf8'));
  result = replaceSourceAsset(fixture, input.sources[0].assetId);
} else if (prompt.includes('TASK: PREVIEW')) {
  result = {
    components: input.targetDomain.components.map((part) =>
      input.targetPartIds.includes(part.partId)
        ? { ...part, attributes: { ...part.attributes, color: 'cobalt blue' } }
        : part,
    ),
    affectedPartIds: input.targetPartIds,
    protectedDriftPartIds: [],
  };
  const imageDir = join(process.env.USERPROFILE, '.codex', 'generated_images', sessionId);
  await mkdir(imageDir, { recursive: true });
  await writeFile(
    join(imageDir, 'generated.png'),
    await readFile(new URL('./generated-preview.png', import.meta.url)),
  );
} else if (prompt.includes('TASK: VALIDATE_PREVIEW')) {
  result = { affectedPartIds: input.targetPartIds, protectedDriftPartIds: [] };
} else {
  throw new Error('unexpected fashion task');
}

emit({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(result) } });
emit({ type: 'turn.completed', status: 'completed' });
`,
  );
  // Use the npm-shim `%~dp0\\script` convention so the Windows spawn layer
  // resolves this test-only .cmd to its Node script and never shell-parses the
  // production prompt.
  await writeFile(commandPath, `@echo off\r\n"${process.execPath}" "%~dp0\\f317-fake-codex.mjs" %*\r\n`);
  assert.equal(parseShimFile(commandPath), scriptPath, 'the fake Codex shim must resolve without a shell');
  assert.ok(resolveWindowsShimSpawn(commandPath, []), 'the fake Codex shim needs a direct Node spawn plan');
  // A fresh runtime catalog seeds exactly one configured breed. Select the
  // OpenAI member for this transport fixture so the real root composition
  // constructs the Codex service instead of returning provider_unavailable.
  sandbox.environment.DEFAULT_CAT_ID = 'codex';
  sandbox.environment.PATH = `${bin};${sandbox.environment.PATH ?? ''}`;
}

async function installSandboxCliConfigFixture(sandbox: Sandbox): Promise<void> {
  const capabilitiesDir = join(sandbox.workspace, '.cat-cafe');
  const claudeConfigPath = join(sandbox.root, 'home', '.claude.json');
  await mkdir(capabilitiesDir, { recursive: true });
  await writeFile(
    join(capabilitiesDir, 'capabilities.json'),
    JSON.stringify({
      version: 1,
      capabilities: [
        {
          id: 'resolver-backed',
          type: 'mcp',
          enabled: true,
          source: 'external',
          mcpServer: { command: 'node', args: ['resolver.js'], resolver: 'test-resolver' },
        },
      ],
    }),
  );
  await writeFile(
    claudeConfigPath,
    JSON.stringify({
      projects: {
        [sandbox.workspace]: {
          mcpServers: {
            'resolver-backed': { command: 'stale-resolver', args: [] },
            preserved: { command: 'keep', args: [] },
          },
        },
      },
    }),
  );
}

async function startApiInSandbox(sandbox: Sandbox): Promise<StartedApi> {
  assertSandboxedEnvironment(sandbox);
  let child: ChildProcess | undefined;
  try {
    const startedChild = spawn(process.execPath, [join(API_ROOT, 'dist', 'index.js')], {
      cwd: sandbox.workspace,
      env: sandbox.environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child = startedChild;
    let logs = '';
    startedChild.stdout?.on('data', (chunk: Buffer) => {
      logs += chunk.toString();
    });
    startedChild.stderr?.on('data', (chunk: Buffer) => {
      logs += chunk.toString();
    });
    const origin = await waitForListening(startedChild, () => logs);
    return { ...sandbox, child: startedChild, origin, output: () => logs, stop: () => stopOwnedChild(startedChild) };
  } catch (error) {
    if (child) await stopOwnedChild(child).catch(() => undefined);
    throw error;
  }
}

const malformedPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
  'base64',
);

async function validPng(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 8, channels: 4, background: { r: 200, g: 200, b: 200, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

async function createThread(origin: string): Promise<{ id: string }> {
  const response = await fetch(`${origin}/api/threads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cat-cafe-user': 'entrypoint-owner' },
    body: JSON.stringify({ title: 'F317 durable entrypoint' }),
  });
  const text = await response.text();
  assert.equal(response.status, 201, text);
  return JSON.parse(text) as { id: string };
}

async function uploadDesign(
  origin: string,
  threadId: string,
): Promise<{ id: string; sourceAssetIdsByView: { front: string } }> {
  const boundary = 'f317-entrypoint-upload-boundary';
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="threadId"\r\n\r\n${threadId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nDurable jacket\r\n--${boundary}\r\nContent-Disposition: form-data; name="front"; filename="jacket.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    await validPng(),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await fetch(`${origin}/api/fashion-designs`, {
    method: 'POST',
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'x-cat-cafe-user': 'entrypoint-owner',
    },
    body,
  });
  const text = await response.text();
  assert.equal(response.status, 201, text);
  return (JSON.parse(text) as { design: { id: string; sourceAssetIdsByView: { front: string } } }).design;
}

async function expectJson<T>(response: Response, status: number, logs: string): Promise<T> {
  const text = await response.text();
  assert.equal(response.status, status, `${text}\n${logs}`);
  return JSON.parse(text) as T;
}

async function pollProposal(
  origin: string,
  designId: string,
  proposalId: string,
  logs: () => string,
): Promise<{ candidateVersionId?: string; status: string }> {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const result = await expectJson<{ candidateVersionId?: string; status: string }>(
      await fetch(`${origin}/api/fashion-designs/${designId}/edit-proposals/${proposalId}`, {
        headers: { 'x-cat-cafe-user': 'entrypoint-owner' },
      }),
      200,
      logs(),
    );
    if (result.status !== 'queued' && result.status !== 'generating') return result;
    if (Date.now() >= deadline) throw new Error(`F317 preview did not settle:\n${logs()}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

type F317Journey = {
  designId: string;
  flatArtifactId: string;
  restoredVersionId: string;
  snapshotId: string;
  threadId: string;
};

/**
 * Exercise the product through the compiled API composition root. The model
 * transport may be deterministic, but every HTTP route, worker, store,
 * publication and renderer is the production implementation.
 */
async function runF317Journey(api: StartedApi): Promise<F317Journey> {
  const thread = await createThread(api.origin);
  const design = await uploadDesign(api.origin, thread.id);
  const headers = { 'content-type': 'application/json', 'x-cat-cafe-user': 'entrypoint-owner' };
  const baseUrl = `${api.origin}/api/fashion-designs/${design.id}`;

  const analyzed = await expectJson<{
    version: { id: string; domains: Record<string, { components: Array<{ partHash: string; partId: string }> }> };
  }>(await fetch(`${baseUrl}/analysis`, { method: 'POST', headers, body: '{}' }), 201, api.output());
  const original = analyzed.version;
  const confirmation = await expectJson<{ version: { id: string } }>(
    await fetch(`${baseUrl}/confirmations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        baseVersionId: original.id,
        parts: Object.values(original.domains).flatMap((domain) =>
          domain.components.map((part) => ({
            partId: part.partId,
            partHash: part.partHash,
            evidenceOrigin: 'photo',
          })),
        ),
      }),
    }),
    200,
    api.output(),
  );
  const confirmed = confirmation.version;

  const created = await expectJson<{ proposalId: string }>(
    await fetch(`${baseUrl}/edit-proposals`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        baseVersionId: confirmed.id,
        targetDomainId: 'pocket',
        targetPartIds: ['pocket-left'],
        instruction: 'Make only the image-left pocket cobalt blue',
        idempotencyKey: 'f317-entrypoint-left-pocket',
      }),
    }),
    202,
    api.output(),
  );
  const preview = await pollProposal(api.origin, design.id, created.proposalId, api.output);
  assert.equal(preview.status, 'ready', api.output());
  assert.ok(preview.candidateVersionId);

  const candidateState = await expectJson<{
    versions: Record<
      string,
      { domains: { pocket: { components: Array<{ attributes: Record<string, unknown>; partId: string }> } } }
    >;
  }>(await fetch(baseUrl, { headers: { 'x-cat-cafe-user': 'entrypoint-owner' } }), 200, api.output());
  const candidatePockets = candidateState.versions[preview.candidateVersionId].domains.pocket.components;
  assert.equal(candidatePockets.find((part) => part.partId === 'pocket-left')?.attributes.color, 'cobalt blue');
  assert.equal(candidatePockets.find((part) => part.partId === 'pocket-right')?.attributes.color, undefined);

  const adopted = await expectJson<{ version: { id: string } }>(
    await fetch(`${baseUrl}/edit-proposals/${created.proposalId}/decision`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ baseVersionId: confirmed.id, decision: 'accept' }),
    }),
    200,
    api.output(),
  );
  const restored = await expectJson<{ version: { id: string; restoredFromVersionId: string } }>(
    await fetch(`${baseUrl}/restore`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ baseVersionId: adopted.version.id, sourceVersionId: confirmed.id }),
    }),
    200,
    api.output(),
  );
  assert.equal(restored.version.restoredFromVersionId, confirmed.id);

  const snapshot = await expectJson<{ snapshot: { id: string; versionId: string } }>(
    await fetch(`${baseUrl}/confirmed-snapshots`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ baseVersionId: restored.version.id, view: 'front' }),
    }),
    201,
    api.output(),
  );
  assert.equal(snapshot.snapshot.versionId, restored.version.id);
  const flat = await expectJson<{ artifact: { id: string; pngAssetId: string; svgAssetId: string } }>(
    await fetch(`${baseUrl}/technical-flats`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirmedSnapshotId: snapshot.snapshot.id }),
    }),
    201,
    api.output(),
  );
  assert.ok(flat.artifact.pngAssetId);
  assert.ok(flat.artifact.svgAssetId);
  return {
    designId: design.id,
    flatArtifactId: flat.artifact.id,
    restoredVersionId: restored.version.id,
    snapshotId: snapshot.snapshot.id,
    threadId: thread.id,
  };
}

describe('F317 application entrypoint storage modes', () => {
  it(
    'registers fashion routes in explicit degraded memory mode without inherited runtime state',
    { timeout: 45_000 },
    async (t) => {
      const api = await startMemoryApi(t);
      const response = await fetch(`${api.origin}/api/fashion-designs/missing-design`, {
        headers: { 'x-cat-cafe-user': 'entrypoint-owner' },
      });
      const body = (await response.json()) as { error?: string; message?: string };

      assert.equal(response.status, 404, api.output());
      assert.equal(body.error, 'not_found', api.output());
      assert.equal(body.message, undefined, api.output());
    },
  );

  it(
    'rejects a PNG with a valid signature but undecodable payload at the upload boundary',
    { timeout: 45_000 },
    async (t) => {
      const api = await startMemoryApi(t);
      const thread = await createThread(api.origin);
      const boundary = 'f317-malformed-upload-boundary';
      const body = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="threadId"\r\n\r\n${thread.id}\r\n--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nMalformed jacket\r\n--${boundary}\r\nContent-Disposition: form-data; name="front"; filename="malformed.png"\r\nContent-Type: image/png\r\n\r\n`,
        ),
        malformedPng,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      const response = await fetch(`${api.origin}/api/fashion-designs`, {
        method: 'POST',
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          'x-cat-cafe-user': 'entrypoint-owner',
        },
        body,
      });
      const result = (await response.json()) as { error?: string };
      assert.equal(response.status, 400, api.output());
      assert.equal(result.error, 'invalid_image_content', api.output());
    },
  );

  it('keeps startup CLI configuration writes inside its explicit sandbox profile', { timeout: 45_000 }, async (t) => {
    const api = await startMemoryApi(t, { prepareSandbox: installSandboxCliConfigFixture });
    const claudeConfigPath = join(api.root, 'home', '.claude.json');
    const deadline = Date.now() + 10_000;
    for (;;) {
      const config = JSON.parse(await (await import('node:fs/promises')).readFile(claudeConfigPath, 'utf8')) as {
        projects: Record<string, { mcpServers: Record<string, unknown> }>;
      };
      if (config.projects[api.workspace]?.mcpServers['resolver-backed'] === undefined) {
        assert.deepEqual(config.projects[api.workspace]?.mcpServers.preserved, { command: 'keep', args: [] });
        break;
      }
      if (Date.now() >= deadline) {
        throw new Error(`sandbox CLI config cleanup did not complete:\n${api.output()}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  });

  it('cleans its owned child and sandbox when startup fails', { timeout: 45_000 }, async (t) => {
    let sandboxRoot: string | undefined;
    await assert.rejects(
      () =>
        startMemoryApi(t, {
          environment: { CAT_CAFE_USER_ID: ' ' },
          onSandboxCreated: (root) => {
            sandboxRoot = root;
          },
        }),
      /CAT_CAFE_USER_ID must not be blank/,
    );
    assert.ok(sandboxRoot, 'the test must create its own sandbox before startup');
    assert.equal(existsSync(sandboxRoot), false, 'failed startup must clean its sandbox immediately');
  });

  it('cleans its sandbox when setup fails before a child process is spawned', { timeout: 45_000 }, async (t) => {
    let sandboxRoot: string | undefined;
    t.after(async () => {
      // The assertion below is intentionally red until startMemoryApi registers
      // its own cleanup before executing the setup callback. This fallback only
      // removes the sandbox created by this test if the regression is present.
      if (sandboxRoot) await rm(sandboxRoot, { force: true, recursive: true });
    });

    await assert.rejects(
      () =>
        startMemoryApi(t, {
          onSandboxCreated: (root) => {
            sandboxRoot = root;
            throw new Error('intentional setup failure');
          },
        }),
      /intentional setup failure/,
    );
    assert.ok(sandboxRoot, 'the test must create its own sandbox before setup');
    assert.equal(existsSync(sandboxRoot), false, 'setup failure must clean its sandbox immediately');
  });

  it(
    'persists a complete F317 journey through actual API and owned Redis restarts',
    { skip: process.env.FASHION_REDIS_TEST !== '1', timeout: 90_000 },
    async (t) => {
      const port = await reserveLoopbackPort();
      const sandbox = await createSandbox({
        CAT_CAFE_INVOCATION_REGISTRY: 'redis',
        MEMORY_STORE: '0',
        REDIS_URL: `redis://127.0.0.1:${port}/15`,
      });
      assertSandboxedEnvironment(sandbox);

      let redis: StartedRedis | undefined;
      let firstApi: StartedApi | undefined;
      let secondApi: StartedApi | undefined;
      // This owns only children and paths created above. It is deliberately
      // registered before either service starts, including failure paths.
      t.after(async () => {
        await secondApi?.stop().catch(() => undefined);
        await firstApi?.stop().catch(() => undefined);
        await redis?.stop().catch(() => undefined);
        await rm(sandbox.root, { force: true, recursive: true });
      });

      redis = await startOwnedRedis(sandbox, port);
      await installDeterministicCodexTransport(sandbox);
      firstApi = await startApiInSandbox(sandbox);
      const journey = await runF317Journey(firstApi);

      await redis.save();
      await firstApi.stop();
      await redis.stop();

      redis = await startOwnedRedis(sandbox, port);
      secondApi = await startApiInSandbox(sandbox);
      const response = await fetch(`${secondApi.origin}/api/fashion-designs/${journey.designId}`, {
        headers: { 'x-cat-cafe-user': 'entrypoint-owner' },
      });
      const body = (await response.json()) as {
        design?: { activeVersionId: string | null; id: string; threadId: string };
        snapshots?: Record<string, { id: string; versionId: string }>;
        technicalFlats?: Record<string, { confirmedSnapshotId: string; id: string }>;
      };
      assert.equal(response.status, 200, secondApi.output());
      assert.equal(body.design?.id, journey.designId);
      assert.equal(body.design?.threadId, journey.threadId);
      assert.equal(body.design?.activeVersionId, journey.restoredVersionId);
      assert.equal(body.snapshots?.[journey.snapshotId]?.versionId, journey.restoredVersionId);
      assert.equal(body.technicalFlats?.[journey.flatArtifactId]?.confirmedSnapshotId, journey.snapshotId);
    },
  );

  it(
    'runs the full F317 journey through the real application entrypoint with an isolated Codex transport fixture',
    { timeout: 90_000 },
    async (t) => {
      const api = await startMemoryApi(t, { prepareSandbox: installDeterministicCodexTransport });
      await runF317Journey(api);
    },
  );
});
