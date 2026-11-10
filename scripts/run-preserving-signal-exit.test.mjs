import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const runner = resolve('scripts/run-preserving-signal-exit.mjs');

function runNode(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, stderr, stdout }));
  });
}

test(
  'runs a local Windows package-bin shim without relying on inherited PATH',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const sandbox = await mkdtemp(join(tmpdir(), 'run-preserving-signal-exit-'));
    t.after(async () => rm(sandbox, { force: true, recursive: true }));

    const bin = join(sandbox, 'node_modules', '.bin');
    await mkdir(bin, { recursive: true });
    await writeFile(join(bin, 'local-tool.mjs'), 'process.stdout.write(JSON.stringify(process.argv.slice(2)));\n');
    await writeFile(join(bin, 'local-tool.cmd'), '@echo off\r\nnode "%~dp0\\local-tool.mjs" %*\r\n');

    const result = await runNode([runner, 'local-tool', 'argument with spaces'], {
      cwd: sandbox,
      env: {
        ...process.env,
        PATH: process.env.SystemRoot ? join(process.env.SystemRoot, 'System32') : process.env.PATH,
      },
    });

    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.signal, null);
    assert.equal(result.stdout, '["argument with spaces"]');
  },
);
