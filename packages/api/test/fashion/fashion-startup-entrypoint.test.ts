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
  options.onSandboxCreated?.(sandbox.root);
  assertSandboxedEnvironment(sandbox);

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

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
  'base64',
);

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
    png,
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

  it(
    'persists an uploaded design through actual API and owned Redis restarts',
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
      firstApi = await startApiInSandbox(sandbox);
      const thread = await createThread(firstApi.origin);
      const uploaded = await uploadDesign(firstApi.origin, thread.id);
      assert.ok(uploaded.id);
      assert.ok(uploaded.sourceAssetIdsByView.front);

      await redis.save();
      await firstApi.stop();
      await redis.stop();

      redis = await startOwnedRedis(sandbox, port);
      secondApi = await startApiInSandbox(sandbox);
      const response = await fetch(`${secondApi.origin}/api/fashion-designs/${uploaded.id}`, {
        headers: { 'x-cat-cafe-user': 'entrypoint-owner' },
      });
      const body = (await response.json()) as {
        design?: { id: string; threadId: string; sourceAssetIdsByView: { front: string } };
      };
      assert.equal(response.status, 200, secondApi.output());
      assert.equal(body.design?.id, uploaded.id);
      assert.equal(body.design?.threadId, thread.id);
      assert.equal(body.design?.sourceAssetIdsByView.front, uploaded.sourceAssetIdsByView.front);
    },
  );
});
