import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const OUTPUT_LIMIT = 16_000;

const REPLACED_ENV_KEYS = new Set([
  'API_SERVER_HOST',
  'API_SERVER_PORT',
  'AUDIT_LOG_DIR',
  'CAT_TEMPLATE_PATH',
  'CHARACTER_VOICE_DIR',
  'CLI_RAW_ARCHIVE_DIR',
  'CONNECTOR_MEDIA_DIR',
  'DOCS_ROOT',
  'EVIDENCE_DB',
  'GENSHIN_VOICE_DIR',
  'LOG_DIR',
  'MEMORY_STORE',
  'NODE_ENV',
  'PROJECT_ALLOWED_ROOTS',
  'PROJECT_ALLOWED_ROOTS_APPEND',
  'PROJECT_DENIED_ROOTS',
  'REDIS_URL',
  'RUNTIME_REPO_PATH',
  'SIGNALS_ROOT_DIR',
  'TRANSCRIPT_DATA_DIR',
  'TTS_CACHE_DIR',
  'UPLOAD_DIR',
  'WEB_PUBLIC_DIR',
  'WORKSPACE_LINKED_ROOTS',
]);

function shouldRemoveInheritedKey(key) {
  return (
    REPLACED_ENV_KEYS.has(key) ||
    /^(ANTHROPIC|CAT_CAFE|DARE|GEMINI|OPENAI)_/.test(key) ||
    /(?:_API_KEY|_TOKEN|_SECRET)$/.test(key)
  );
}

export function buildAcceptanceEnv({ baseEnv = process.env, repoRoot, tempRoot, port }) {
  const env = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    if (value !== undefined && !shouldRemoveInheritedKey(key)) env[key] = value;
  }

  const configRoot = join(tempRoot, 'config');
  const dataRoot = join(tempRoot, 'data');
  Object.assign(env, {
    NODE_ENV: 'test',
    MEMORY_STORE: '1',
    API_SERVER_HOST: '127.0.0.1',
    API_SERVER_PORT: String(port),
    CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT: '1',
    CAT_CAFE_ACCEPTANCE_ROSTER_GATE: '0',
    CAT_CAFE_CONFIG_ROOT: configRoot,
    CAT_CAFE_GLOBAL_CONFIG_ROOT: join(tempRoot, 'global'),
    CAT_CAFE_RUNTIME_ROOT: join(tempRoot, 'runtime'),
    CAT_CAFE_WORKSPACE_ROOT: repoRoot,
    CAT_CAFE_DATA_DIR: dataRoot,
    CAT_CAFE_CALLBACK_OUTBOX_DIR: join(dataRoot, 'callback-outbox'),
    CAT_CAFE_MCP_SERVER_PATH: join(repoRoot, 'packages', 'mcp-server', 'dist', 'index.js'),
    CAT_CAFE_PROVISION_GLOBAL_SIDECAR: '0',
    CAT_TEMPLATE_PATH: join(configRoot, 'cat-template.json'),
    PROJECT_ALLOWED_ROOTS: repoRoot,
    PROJECT_ALLOWED_ROOTS_APPEND: 'true',
    RUNTIME_REPO_PATH: repoRoot,
    DOCS_ROOT: join(repoRoot, 'docs'),
    WEB_PUBLIC_DIR: join(repoRoot, 'packages', 'web', 'public'),
    LOG_DIR: join(tempRoot, 'logs'),
    UPLOAD_DIR: join(dataRoot, 'uploads'),
    AUDIT_LOG_DIR: join(dataRoot, 'audit-logs'),
    CLI_RAW_ARCHIVE_DIR: join(dataRoot, 'cli-raw'),
    TRANSCRIPT_DATA_DIR: join(dataRoot, 'transcripts'),
    TTS_CACHE_DIR: join(dataRoot, 'tts-cache'),
    CONNECTOR_MEDIA_DIR: join(dataRoot, 'connector-media'),
    SIGNALS_ROOT_DIR: join(dataRoot, 'signals'),
    EVIDENCE_DB: join(dataRoot, 'evidence.sqlite'),
    PREVIEW_GATEWAY_ENABLED: '0',
    ANTHROPIC_PROXY_ENABLED: '0',
    ASR_ENABLED: '0',
    TTS_ENABLED: '0',
    LLM_POSTPROCESS_ENABLED: '0',
    EMBED_ENABLED: '0',
    EMBED_MODE: 'off',
  });
  return env;
}

async function allocateLoopbackPort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : null;
  await new Promise((resolveClose, rejectClose) =>
    server.close((error) => (error ? rejectClose(error) : resolveClose())),
  );
  if (!port) throw new Error('Startup acceptance could not allocate a loopback port.');
  return port;
}

async function prepareTempRoot(repoRoot, tempRoot) {
  const directories = [
    'config',
    'global',
    'runtime',
    'data',
    'logs',
    'data/uploads',
    'data/audit-logs',
    'data/cli-raw',
    'data/transcripts',
    'data/tts-cache',
    'data/connector-media',
    'data/signals',
    'data/callback-outbox',
  ];
  await Promise.all(directories.map((directory) => mkdir(join(tempRoot, directory), { recursive: true })));
  await Promise.all([
    copyFile(join(repoRoot, 'cat-template.json'), join(tempRoot, 'config', 'cat-template.json')),
    copyFile(join(repoRoot, 'cat-config.json'), join(tempRoot, 'config', 'cat-config.json')),
  ]);
}

function appendOutput(current, chunk) {
  return `${current}${chunk.toString()}`.slice(-OUTPUT_LIMIT);
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function waitForChildExit(child, timeoutMs) {
  return new Promise((resolveExit) => {
    let settled = false;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off('exit', onExit);
      resolveExit(exited);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once('exit', onExit);
    if (child.exitCode !== null || child.signalCode !== null) finish(true);
  });
}

async function stopExactChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const graceful = await waitForChildExit(child, 5_000);
  if (!graceful && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await waitForChildExit(child, 5_000);
  }
}

function assertChildStillStarting({ spawnError, exit, output }) {
  if (spawnError) throw new Error(`Startup acceptance could not spawn API: ${spawnError.message}`);
  if (exit) {
    throw new Error(
      `API exited before health (code=${exit.code ?? 'null'}, signal=${exit.signal ?? 'none'}). Child output:\n${output.trim() || '(none)'}`,
    );
  }
}

async function waitForHealthyChild({ port, timeoutMs, readExit, readSpawnError, readOutput }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    assertChildStillStarting({ spawnError: readSpawnError(), exit: readExit(), output: readOutput() });
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(Math.min(1_000, Math.max(1, deadline - Date.now()))),
      });
      if (response.ok) {
        const health = await response.json();
        if (health?.status === 'ok') return health;
      }
    } catch {
      // The child may still be starting; bounded polling continues until the deadline.
    }
    await delay(100);
  }

  throw new Error(
    `API did not become healthy within ${timeoutMs}ms. Child output:\n${readOutput().trim() || '(none)'}`,
  );
}

export async function runStartupAcceptance({
  repoRoot = DEFAULT_ROOT,
  apiEntry = join(repoRoot, 'packages', 'api', 'dist', 'index.js'),
  timeoutMs = 30_000,
} = {}) {
  const resolvedRoot = resolve(repoRoot);
  const resolvedEntry = resolve(apiEntry);
  const tempRoot = await mkdtemp(join(tmpdir(), 'cat-cafe-public-startup-'));
  let child = null;

  try {
    const port = await allocateLoopbackPort();
    await prepareTempRoot(resolvedRoot, tempRoot);
    const env = buildAcceptanceEnv({ baseEnv: process.env, repoRoot: resolvedRoot, tempRoot, port });
    let output = '';
    let exit = null;
    let spawnError = null;
    child = spawn(process.execPath, [resolvedEntry], {
      cwd: resolvedRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    child.stdout.on('data', (chunk) => {
      output = appendOutput(output, chunk);
    });
    child.stderr.on('data', (chunk) => {
      output = appendOutput(output, chunk);
    });
    child.once('error', (error) => {
      spawnError = error;
    });
    child.once('exit', (code, signal) => {
      exit = { code, signal };
    });

    const health = await waitForHealthyChild({
      port,
      timeoutMs,
      readExit: () => exit,
      readSpawnError: () => spawnError,
      readOutput: () => output,
    });
    return { status: 'passed', health, childPid: child.pid, port };
  } finally {
    await stopExactChild(child);
    await rm(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    const result = await runStartupAcceptance();
    process.stdout.write(`Startup acceptance: passed (pid=${result.childPid}, port=${result.port})\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  }
}
