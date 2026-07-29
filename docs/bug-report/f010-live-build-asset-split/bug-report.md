# F010 live build asset split

Date: 2026-07-29

## Reporter

The operator reported that the public F010 PWA at `:8443` opened its shell but
remained on `正在加载可用成员…`. The reporting-iPhone screenshot showed a rendered
mobile shell with no member data.

## Reproduction

1. Open `https://desktop-9o1va3o.tail58c13e.ts.net:8443/`.
2. Observe that the shell renders but member loading never completes.
3. In a clean headless mobile browser, observe
   `/_next/static/chunks/1811-730d09a651b52616.js` fail with HTTP 400.

Expected: all scripts referenced by the live HTML return 200 and React hydrates
the member state.

Actual: the HTML referenced one JavaScript chunk that was no longer present in
the build directory, so hydration never completed even though `/api/session`,
`/api/cats`, and `/api/config/cat-order` all returned 200.

## Root cause

Web PID `37656` had served port 4310 continuously since 2026-07-20. A later
production build overwrote the same mutable `packages/web/.next` directory
without replacing that live process. The old process continued emitting its
in-memory HTML/manifests while static asset lookup used the newer directory.
This split left exactly one HTML-referenced chunk absent on disk and returning
HTTP 400.

The existing `f010-tailscale-serve-guard.mjs` only checked Tailscale route
mappings. It could report healthy mappings while the public Web artifact was
not hydratable.

## Fix

1. Rebuilt current reviewed HEAD `b0bd9a1` with `API_SERVER_PORT=4311`,
   `FRONTEND_PORT=4310`, and viewport trace disabled.
2. Verified BUILD_ID `xzJCH4vrDcF_suYMZVflV` on canary port 4312: all 28
   HTML-referenced scripts returned 200 and `/api/cats` returned five members.
3. Replaced only stale Web PID `37656` with PID `59708` on port 4310.
   API 4311, Redis, production 443, and runtime configuration were untouched.
4. Extended the existing F010 serve guard with a public runtime probe. The
   guard now fails if the HTML contains no same-origin scripts, any referenced
   script is non-200 or not served with a JavaScript media type, a probe request
   redirects, or `/api/cats` has no available members.

## Verification

- Public root, manifest, service worker, all 28 scripts, session, and member API:
  HTTP 200.
- Public member count: 5.
- Clean 390x844 mobile browser, first load and reload: member loading completed;
  historical messages rendered; no page error or failed JavaScript request.
- The remaining `/api/debug/callback-auth` HTTP 403 is the intentional remote
  callback-auth safety boundary and does not block member loading or chat.
- Unit tests:
  `node --test test/scripts/f010-public-runtime-health.test.mjs test/scripts/f010-tailscale-serve-status.test.mjs`
  — 7/7 passed.
- Live guard:
  `node scripts/f010-tailscale-serve-guard.mjs`
  — mappings present; public runtime hydrated with 28 scripts and 5 members.

[丢丢/gpt-5.6-sol🐾]
