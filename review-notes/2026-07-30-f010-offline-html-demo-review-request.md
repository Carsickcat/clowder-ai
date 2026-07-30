# F010 standalone offline HTML demo — review request

Review-Target-ID: `f010`
Branch: `feat/f010-mobile-pwa`
Implementation SHA: `99009b7cadcc84ad45cd94e485db5bfae821ec23`
Author: `[丢丢/gpt-5.6-sol🐾]`

## What

Adds one self-contained HTML file that reproduces the F010 chat experience with
inline CSS, inline JavaScript, and bundled mock conversations. It opens through
`file://` on another computer and requires no repository clone, Node, Redis,
API, account, or network connection.

Files in scope:

- `project-evidence/f010-mobile-pwa/f010-mobile-pwa-offline-demo.html`
- `test/scripts/f010-mobile-pwa-offline-demo.test.mjs`
- `project-evidence/f010-mobile-pwa/README.md`

## Why / original requirement

Source: co-creator message in thread `thread_mrogfco44bos1sgn`, 2026-07-30.

> “我想在另外一台电脑上仅看html就行，数据你可以直接给我mock，我也不需要做二次开发，你直接给我生成一个html吧”

Please review against that experience: download exactly one file, double-click
it, and get a useful responsive preview without setup.

## Tradeoffs

- This is deliberately a design/interaction demo, not a static export of live
  user data.
- Sending a message appends a local user message and simulated cat reply;
  refreshing restores the bundled examples.
- No runtime source under `packages/` and no live 4310/4311 process is changed.

## Architecture ownership

- Architecture cell: F010 evidence / portable review artifact
- Map delta: none
- Why: the file does not add a runtime store, router, adapter, API, or
  deployment boundary.

## Self-check evidence

- RED first: focused test initially failed with `ENOENT`.
- GREEN: `node --test test/scripts/f010-mobile-pwa-offline-demo.test.mjs`
  → 1/1 pass.
- Targeted Biome: HTML + test clean.
- Inline JavaScript parsed with `new Function(...)`.
- `git diff --check` clean.
- Chrome headless `file://` rendering:
  - 1440×900 desktop: three-column layout rendered;
  - 390 CSS px mobile: single-column conversation, composer, and all four
    bottom-nav items rendered without horizontal clipping.
- HTML SHA-256:
  `DFADD2CA1CC4BA9A289CC9CF9F2AA8FDE9153CB019AEA0F817686B5C628F0901`.
- Root artifact hygiene: no root-level media/design artifacts.
- Matching `.pen` design: none.

Repository-wide `pnpm test` is not green on this Windows checkout because the
existing API package test command crosses the Windows/POSIX script boundary:
PowerShell reports the inline env assignment as unknown; forcing Git Bash then
fails in `with-test-home.sh` with `/c/Program Files/nodejs/node: Argument list
too long`. Before that boundary, finance is 12/12 and shared is 85/85. This
artifact's focused contract remains green and the change does not touch package
runtime code.

## Review focus

1. Confirm the HTML has no external resource or network dependency.
2. Confirm desktop/mobile layout and primary local interactions are usable.
3. Confirm mock/offline boundaries are visible and cannot be mistaken for live
   Clowder AI data.
4. Check for any P1/P2 accessibility, security, or provenance issue.

## Open questions

None.
