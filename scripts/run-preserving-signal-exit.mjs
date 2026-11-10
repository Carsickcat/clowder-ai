#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: node scripts/run-preserving-signal-exit.mjs <cmd> [...args]');
  process.exit(64);
}

const signalExitCodes = { SIGINT: 130, SIGTERM: 143 };
let forwardedSignal = null;

function resolveLocalWindowsNodeShim(name) {
  if (process.platform !== 'win32' || name.includes('/') || name.includes('\\')) return undefined;
  const candidate = join(process.cwd(), 'node_modules', '.bin', `${name}.cmd`);
  if (!existsSync(candidate)) return undefined;

  // pnpm/npm Windows bins are batch files. Node cannot execute a .cmd directly
  // without a shell, but its standard shim contains the Node script it would
  // invoke. Resolve that target and preserve argument boundaries without a
  // shell, so package-script arguments cannot become command interpolation.
  const match = readFileSync(candidate, 'utf8').match(/\bnode(?:\.exe)?\s+"%~dp0\\([^"\r\n]+)"\s+%\*/i);
  if (!match) return undefined;
  const script = resolve(dirname(candidate), match[1].replaceAll('\\', sep));
  return existsSync(script) ? { args: [script, ...args], command: process.execPath } : undefined;
}

const localWindowsNodeShim = resolveLocalWindowsNodeShim(command);
const child = spawn(localWindowsNodeShim?.command ?? command, localWindowsNodeShim?.args ?? args, {
  env: process.env,
  stdio: 'inherit',
  windowsHide: process.platform === 'win32',
});

for (const signal of Object.keys(signalExitCodes)) {
  process.on(signal, () => {
    forwardedSignal = signal;
    console.error(`[signal-exit] forwarding ${signal} to ${command}; preserving ${signalExitCodes[signal]}`);
    child.kill(signal);
  });
}

child.once('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.once('exit', (code, signal) => {
  if (forwardedSignal) process.exit(signalExitCodes[forwardedSignal]);
  if (signal) process.exit(signalExitCodes[signal] ?? 1);
  process.exit(code ?? 1);
});
