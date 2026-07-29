# F010 public runtime health — quality gate

Date: 2026-07-29

## Verdict

**PASS for the public-runtime recovery and guard slice.** The public 8443 PWA
loads its complete reviewed artifact and member state. Formal cross-individual
review remains required before this guard change is merged or pushed.

## Original operator experience

> 8443这个pwa我访问又有问题了，请排查一下吧

The reporting-iPhone screenshot showed the mobile shell permanently stuck at
`正在加载可用成员…`. Source: thread message
`0001785330733285-000016-912ed031`; detailed reproduction:
`docs/bug-report/f010-live-build-asset-split/bug-report.md`.

## Root cause and recovery

- API 4311, CORS, Socket.IO, public member and session endpoints were healthy.
- Clean mobile Chromium identified one HTML-referenced Next.js chunk returning
  HTTP 400.
- Web PID `37656` predated the mutable `.next` directory on disk. A later build
  had replaced the directory without replacing the process, splitting
  in-memory HTML from static assets.
- Current reviewed HEAD `b0bd9a1` was rebuilt with API rewrites targeting 4311
  and viewport trace disabled.
- BUILD_ID `xzJCH4vrDcF_suYMZVflV` passed a temporary 4312 canary before only
  Web 4310 was replaced with PID `59708`.
- API 4311, Redis, production 443 and runtime configuration were untouched.

## Product and architecture contract

- Public health requires all same-origin scripts referenced by live HTML to be
  loadable JavaScript responses, the root document to be served as HTML, and
  `/api/cats` to contain available members.
- Probe requests do not follow redirects; a same-origin URL cannot silently
  leave the public-origin boundary.
- Architecture cell: F010 release-acceptance and deployment harness.
- Map delta: none.
- Why: the existing Tailscale serve guard remains the canonical F010 acceptance
  guard; this change extends its observable contract without adding a Store,
  Queue, Router, Adapter, Dispatcher or Binding.

## RED → GREEN

- Missing runtime probe: test initially failed with module-not-found, then
  passed after the probe module was introduced.
- Missing chunk: HTTP 400 remains a covered failure.
- Scriptless HTML: covered failure.
- Fresh-context FC-1: a `200 text/html; nosniff` chunk initially produced
  “Missing expected rejection”; it now fails the JavaScript media-type check.
- Fresh-context FC-2: a same-origin script URL initially followed an off-origin
  redirect; all requests now use `redirect: manual`, and HTTP 302 fails.
- Formal-review P2: a `200 text/plain; nosniff` root containing script tags
  initially produced “Missing expected rejection”; it now fails the HTML
  media-type check before the body is parsed.

Focused suite:

```text
node --test test/scripts/f010-public-runtime-health.test.mjs test/scripts/f010-tailscale-serve-status.test.mjs
8/8 passed
```

Additional gates:

- targeted Biome: 3/3 files clean;
- `node --check`: both runtime scripts pass;
- `git diff --check`: no errors; only the checkout's existing LF→CRLF warning;
- Web production build: success, BUILD_ID `xzJCH4vrDcF_suYMZVflV`;
- root artifact scan: clean;
- matching F010/mobile/PWA `.pen`: none; there is no UI or design delta.

Root `pnpm check` was run twice and is transparently baseline-red in its first
Biome step: 3,779 formatting errors across committed, untouched files in this
old CRLF checkout, including `.dir-exceptions.json`, `biome.json`, and multiple
package manifests. The three changed JavaScript/test files pass the same Biome
checker when selected directly. No baseline file was bulk-reformatted.

## Real public dogfood

`node scripts/f010-tailscale-serve-guard.mjs` reports:

```text
OK: all F010 acceptance serve mappings present (8443 web/api/socket.io).
OK: public F010 runtime is hydrated (28 scripts, 5 members).
```

Public root, manifest, service worker, all 28 HTML-referenced scripts, session
and member API return HTTP 200. Clean 390×844 Chromium completes member loading
and renders historical messages on first load and reload. The remaining remote
`/api/debug/callback-auth` HTTP 403 is the intentional safety boundary and does
not block chat or member hydration.

## Fresh-context scan

Terra found two P2s: accepting a 200 HTML fallback as JavaScript and following
a script redirect off origin. Both were fixed Red→Green and independently
confirmed closed; no new finding was reported. This was not a formal review
verdict.

[丢丢/gpt-5.6-sol🐾]
