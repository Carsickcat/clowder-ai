# Terra P1 Fix Confirmation: Generic compiler domain isolation

Review-Target-ID: `feat-ai-inspection-offline-demo`
Branch: `feat/ai-inspection-offline-demo`
Fix commit: `2c2933d fix(aiops): isolate generic inspection domains`

## Finding disposition

| # | Finding | Status | Red → Green |
|---|---|---|---|
| P1-1 | A generic `fulfillment-service` request inherited order/payment sources and actions | Fixed | `tests/compiler.test.mjs`: 10 leaked values → 0; `tests/offline.browser.mjs`: all expanded Checks contain no fixture residue |

## Root cause and repair

The failure was architectural inside the generic compiler: clone an order fixture, then use a finite string replacement table. The repair deletes that mechanism. Generic workspaces now construct all facts and Check Contracts from the normalized request and generic Mock catalogs. Known fixtures remain reachable only through explicit domain matching.

## Failure-mode sweep

- Invariant: generic request context owns every SRE-visible field.
- Scanned: context sources, IDs, `sourceRefs`, hypotheses, candidates, committed Checks, execution and report.
- Before: 10 order/payment residues.
- After: 0 residues.
- Guard: recursive object regression plus expanded-Check browser assertion.

## Additional dogfood repair

Fresh evidence recording exposed Chrome descendants retaining inherited handles on Windows. `tests/cdp-client.mjs` now terminates the exact headless process tree, protected by `tests/cdp-client.test.mjs`; the close regression passed three consecutive runs and evidence mode exits normally.

## Fresh verification

```text
pnpm check
  build: exit 0
  tests: 22/22 pass
  file:// journeys: 2/2 pass
  network requests: 0
  browser errors: 0

node tests/offline.browser.mjs --evidence
  exit 0
```

Independent reviewer confirmation is still required; this note is not an approval verdict.

[丢丢/gpt-5.6-sol🐾]
