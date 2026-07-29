# Review Request: F010 public runtime artifact health

Review-Target-ID: f010

Branch: `feat/f010-mobile-pwa`

Implementation commit: `cd57b8a7` (`fix(f010): verify public runtime artifacts`)

## What

- Extend `scripts/f010-tailscale-serve-guard.mjs` beyond route-map presence to
  check the real public PWA artifact and member API.
- Add a reusable public-runtime probe that requires same-origin HTML scripts,
  HTTP success, JavaScript/ECMAScript media types, no redirects, and at least
  one available member.
- Add seven focused route/probe tests, including the observed missing-chunk
  failure, a 200 HTML fallback, an off-origin redirect, and a scriptless shell.
- Record the incident, runtime recovery and quality-gate evidence.

## Why

The public 8443 shell rendered but stayed on `正在加载可用成员…`. API, CORS,
Socket.IO and member endpoints were healthy; one HTML-referenced Next.js chunk
returned HTTP 400. The live Web process and its mutable `.next` directory came
from different builds. The former guard only checked Tailscale mappings and
therefore falsely reported this split artifact as healthy.

## Original Requirements

> 8443这个pwa我访问又有问题了，请排查一下吧

The attached reporting-iPhone screenshot shows the mobile shell permanently
stuck while loading available members.

- Source: thread message `0001785330733285-000016-912ed031`
- Reproduction: `docs/bug-report/f010-live-build-asset-split/bug-report.md`
- Please judge whether the guard would detect the operator-visible failure
  rather than merely proving that proxy routes exist.

## Tradeoff

The probe is intentionally strict:

- redirects for root, script or member requests are unhealthy;
- every HTML-referenced same-origin script must declare a JavaScript media type;
- one bad script fails the whole health check.

This may reject a server that relies on redirects or incorrect static MIME
configuration, but such a server does not satisfy the PWA's executable
same-origin artifact contract. The change does not loosen CORS, Socket.IO,
callback-auth or Tailscale security boundaries and does not touch API/Redis
state.

## Architecture Ownership

Architecture cell: F010 release-acceptance and deployment harness

Map delta: none

Why: the existing F010 Tailscale serve guard remains canonical; this extends
its observed contract without adding a Store, Queue, Router, Adapter,
Dispatcher or Binding.

Please reviewer check:

- the diff is consistent with `Map delta: none`;
- no parallel lifecycle owner or deployment abstraction was introduced;
- the request boundary cannot leave the intended public origin;
- media-type validation accepts the live Next.js response without accepting an
  HTML fallback.

## Open Questions

### Technical OQ

- Is the JavaScript/ECMAScript media-type predicate appropriately bounded?
- Does `redirect: manual` close the external-request path without masking a
  legitimate health state?
- Are Promise concurrency, error attribution and the injected-fetch tests
  sufficient for 28 current scripts?

### Value OQ

None. This is a reversible validation change with no product-policy choice.

## Fresh-Context Findings

Agent: `[山本/gpt-5.6-terra🐾]`

SHA scanned: `b0bd9a1` + working-tree delta

Total findings: 2 (0 P1, 2 P2, 0 P3)

| # | Finding | Author disposition | Status |
|---|---|---|---|
| FC-1 | HTTP 200 HTML fallback was accepted as a script | fixed in `cd57b8a`; RED missing rejection → MIME rejection → 7/7 | closed |
| FC-2 | native fetch could follow a script redirect off origin | fixed in `cd57b8a`; RED missing rejection → `redirect: manual` → 7/7 | closed |

Terra independently confirmed both findings closed and reported no new
fresh-context finding. This was not a formal verdict.

Reviewer delta tracking: please tag formal findings `[FC:covered]`, `[FC:new]`
or `[FC:N/A]`.

## Next Action

Please independently inspect exact commit `cd57b8a7`, rerun the focused suite
and whichever public-boundary cases you consider high risk, then return
`APPROVE` or `REQUEST_CHANGES` with P1/P2/P3 counts. Do not rely on the author's
live-health claim without rerunning the read-only guard.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f010/opus`
- Start command: not required for this Node harness-only delta; if a full
  product sandbox is desired, use `pnpm review:start`.
- Ports: `web=N/A`, `api=N/A`; the review can use dependency-injected unit
  responses and the read-only public 8443 probe. Do not replace live processes.

Sandbox bootstrap when creating a clean checkout:

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
```

No package build is required for the two `.mjs` test suites.

## Self-check Evidence

### Spec compliance

- The original stuck-member state is reproduced and its real missing chunk
  owner is covered.
- The public recovery used a canary before replacing only stale Web 4310.
- API 4311, Redis, production 443 and runtime configuration were untouched.
- Detailed gate:
  `review-notes/2026-07-29-f010-public-runtime-health-quality-gate.md`.

### Test results

```text
node --test test/scripts/f010-public-runtime-health.test.mjs test/scripts/f010-tailscale-serve-status.test.mjs
7 tests passed, 0 failed

pnpm exec biome check scripts/f010-tailscale-serve-guard.mjs scripts/lib/f010-public-runtime-health.mjs test/scripts/f010-public-runtime-health.test.mjs
3 files clean

node --check scripts/f010-tailscale-serve-guard.mjs
node --check scripts/lib/f010-public-runtime-health.mjs
both passed

git diff --check
no errors; checkout-level LF→CRLF warnings only

node scripts/f010-tailscale-serve-guard.mjs
28 scripts, 5 members
```

Web production build succeeded with BUILD_ID `xzJCH4vrDcF_suYMZVflV`.
Clean 390×844 Chromium first load and reload completed member hydration and
rendered messages. Root artifact scan is clean; no matching F010/mobile/PWA
`.pen` exists, and this change has no UI/design delta.

Full root `pnpm check` is not reported green. It stops in the first Biome step
on 3,779 committed CRLF formatting errors across untouched files in this old
snapshot. The changed code/test files pass the same checker when selected
directly; no baseline file was bulk-reformatted.

## Relevant Documents

- Incident: `docs/bug-report/f010-live-build-asset-split/bug-report.md`
- Evidence: `project-evidence/f010-mobile-pwa/README.md`
- Feature: `docs/features/F010-mobile-cat.md`
- Quality gate:
  `review-notes/2026-07-29-f010-public-runtime-health-quality-gate.md`

[丢丢/gpt-5.6-sol🐾]
