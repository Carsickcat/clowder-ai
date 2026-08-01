import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const GATE_SCRIPT_PATH = resolve(ROOT, 'scripts/pre-merge-check.sh');

function assertFullGateContract(script) {
  assert.match(script, /^#!\/usr\/bin\/env bash\nset -euo pipefail\n/);

  const phases = [
    'git fetch origin main',
    'git rebase origin/main',
    'pnpm build',
    'pnpm test',
    'pnpm lint',
    'pnpm check',
  ];
  let previousIndex = -1;
  for (const phase of phases) {
    const phaseIndex = script.indexOf(phase);
    assert.ok(phaseIndex > previousIndex, `expected ordered gate phase: ${phase}`);
    previousIndex = phaseIndex;
  }

  assert.equal(
    script.match(/git status --porcelain/g)?.length,
    2,
    'the gate must fail closed on dirty state both before and after verification',
  );
  assert.match(script, /Command: pnpm gate\\nHEAD: %s\\nBase: origin\/main\\nStatus: passed/);
}

describe('public pre-merge gate', () => {
  it('keeps the package gate entry backed by a repository script', () => {
    assert.equal(PACKAGE_JSON.scripts.gate, 'bash ./scripts/pre-merge-check.sh');
    assert.equal(
      existsSync(GATE_SCRIPT_PATH),
      true,
      'package.json must not expose a gate command whose script is absent',
    );
  });

  it('runs the latest-main full verification in fail-fast order', () => {
    assertFullGateContract(readFileSync(GATE_SCRIPT_PATH, 'utf8'));
  });

  it('detects a gate implementation that silently skips the test phase', () => {
    const weakenedGate = readFileSync(GATE_SCRIPT_PATH, 'utf8').replace('pnpm test', 'pnpm --version');
    assert.throws(() => assertFullGateContract(weakenedGate), /pnpm test/);
  });
});
