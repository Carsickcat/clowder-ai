#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Pre-merge gate requires a clean worktree." >&2
  git status --short >&2
  exit 1
fi

git fetch origin main
git rebase origin/main

GATE_HEAD="$(git rev-parse HEAD)"

pnpm build
pnpm test
pnpm lint
pnpm check

if [[ "$(git rev-parse HEAD)" != "$GATE_HEAD" ]]; then
  echo "HEAD changed while the pre-merge gate was running." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Pre-merge gate left the worktree dirty." >&2
  git status --short >&2
  exit 1
fi

printf 'Command: pnpm gate\nHEAD: %s\nBase: origin/main\nStatus: passed\n' "$GATE_HEAD"
