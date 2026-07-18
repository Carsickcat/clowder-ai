#!/usr/bin/env node
/**
 * F010 acceptance-env Tailscale serve guard.
 *
 * Why: on 2026-07-19 the phone-side mention picker, socket and session all
 * broke when the client depended on a second 8444 TLS listener that had been
 * silently dropped during repeated `tailscale serve` reconfigurations. The
 * terminal client fix keeps HTTPS traffic on 8443; this script asserts those
 * same-origin mappings and repairs missing ones idempotently.
 *
 * Usage: node scripts/f010-tailscale-serve-guard.mjs
 * Exit 0: all required mappings present (after repair if needed).
 * Exit 1: tailscale CLI failed or mappings still missing after repair.
 */
import { execFileSync } from 'node:child_process';
import { findMissingF010ServeMappings } from './lib/f010-tailscale-serve-status.mjs';

const TAILSCALE = process.env.TAILSCALE_BIN ?? 'C:\\Program Files\\Tailscale\\tailscale.exe';

function serveStatus() {
  return execFileSync(TAILSCALE, ['serve', 'status'], { encoding: 'utf8' });
}

function main() {
  let status = serveStatus();
  const missing = findMissingF010ServeMappings(status);
  if (missing.length === 0) {
    console.log('OK: all F010 acceptance serve mappings present (8443 web/api/socket.io).');
    return 0;
  }
  for (const entry of missing) {
    console.log(`REPAIRED: ${entry.repair.join(' ')}`);
    execFileSync(TAILSCALE, entry.repair, { stdio: 'inherit' });
  }
  status = serveStatus();
  const stillMissing = findMissingF010ServeMappings(status);
  if (stillMissing.length > 0) {
    console.error(`FAIL: ${stillMissing.length} mapping(s) still missing after repair.`);
    return 1;
  }
  console.log(`OK: repaired ${missing.length} missing mapping(s); all required mappings now present.`);
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`FAIL: tailscale CLI error: ${error.message}`);
  process.exit(1);
}
