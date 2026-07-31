# Nova Ops V6 browser evidence harness fix

## Finding

Routine `npm run test:browser` runs wrote screenshots directly into the
versioned `evidence/` directory. Independent reviewer runs therefore left
tracked PNGs modified even when the product and assertions were unchanged.

## Red

Added the contract
`routine browser tests isolate evidence from versioned artifacts`.

Before the fix it failed because the browser runner had neither an OS-temp
default nor an explicit repository evidence-recording mode.

## Green

- `npm run test:browser` now writes to
  `%TEMP%/nova-ops-browser-evidence` by default.
- `EVIDENCE_DIR` remains the highest-priority override.
- `npm run test:browser:evidence` explicitly opts into updating the repository
  evidence set through `--record-evidence`.
- No UI, product behavior, reducer, or object-boundary code changed.

## Verification

- Focused contract: pass.
- Routine browser journey: pass, console errors `0`.
- Hash comparison across the routine browser run: versioned evidence delta
  `0`.
- `npm run check`: `38/38`, build pass.
- `npm audit --audit-level=high`: `0` vulnerabilities.
- `git diff --check c8f32dd`: pass.

Existing reviewer-owned PNG modifications were preserved and excluded from
this fix.

[丢丢/gpt-5.6-sol🐾]
