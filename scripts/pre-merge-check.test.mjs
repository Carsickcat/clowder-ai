import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const GATE_SCRIPT_PATH = resolve(ROOT, 'scripts/pre-merge-check.sh');
const CI_WORKFLOW_PATH = resolve(ROOT, '.github/workflows/ci.yml');
const WINDOWS_WORKFLOW_PATH = resolve(ROOT, '.github/workflows/windows-smoke.yml');

function assertPublicGateContract(script) {
  assert.match(script, /^#!\/usr\/bin\/env bash\nset -euo pipefail\n/);

  const phases = [
    'git fetch origin main',
    'git rebase origin/main',
    'pnpm check',
    'pnpm lint',
    'pnpm build',
    'pnpm test:startup',
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
  assert.match(script, /MINGW\*\|MSYS\*\|CYGWIN\*/);
  assert.match(script, /node --test packages\/api\/test\/cli-spawn-win\.test\.js/);
  assert.match(script, /node --test packages\/api\/test\/process-liveness-probe\.test\.js/);
  assert.match(script, /pnpm --filter @cat-cafe\/api run test:public/);
  assert.match(script, /Remote required: Test \(Public\)/);
  assert.match(script, /Command: pnpm gate\\nHEAD: %s\\nBase: origin\/main\\nStatus: passed/);
}

function assertRemotePublicTestContract(ciWorkflow) {
  assert.match(ciWorkflow, /name: Test \(Public\)/);
  assert.match(ciWorkflow, /runs-on: ubuntu-latest/);
  assert.match(ciWorkflow, /pnpm --filter @cat-cafe\/api run test:public/);
}

function assertWindowsSmokeContract(windowsWorkflow) {
  assert.match(windowsWorkflow, /runs-on: windows-latest/);
  assert.match(windowsWorkflow, /node --test packages\/api\/test\/cli-spawn-win\.test\.js/);
  assert.match(windowsWorkflow, /node --test packages\/api\/test\/process-liveness-probe\.test\.js/);
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

  it('runs the latest-main public verification in fail-fast order', () => {
    assert.equal(PACKAGE_JSON.scripts['test:startup'], 'node scripts/public-startup-acceptance.mjs');
    assertPublicGateContract(readFileSync(GATE_SCRIPT_PATH, 'utf8'));
  });

  it('binds the platform branches to the checked-in remote and Windows workflows', () => {
    assertRemotePublicTestContract(readFileSync(CI_WORKFLOW_PATH, 'utf8'));
    assertWindowsSmokeContract(readFileSync(WINDOWS_WORKFLOW_PATH, 'utf8'));
  });

  it('detects a gate implementation that silently skips either platform test phase', () => {
    const script = readFileSync(GATE_SCRIPT_PATH, 'utf8');
    const withoutLinuxSuite = script.replace('pnpm --filter @cat-cafe/api run test:public', 'pnpm --version');
    const withoutWindowsSuite = script.replace('node --test packages/api/test/cli-spawn-win.test.js', 'pnpm --version');
    assert.throws(() => assertPublicGateContract(withoutLinuxSuite), /test:public/);
    assert.throws(() => assertPublicGateContract(withoutWindowsSuite), /cli-spawn-win/);
  });
});
