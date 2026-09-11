#!/usr/bin/env bash
set -euo pipefail

# Hostinger CMS build (monorepo root as application root).
#
# Background / why this script looks the way it does:
# - Hostinger Node.js hosting runs its own automatic "install dependencies"
#   step BEFORE this build script, auto-detecting pnpm from pnpm-lock.yaml.
#   That step currently resolves pnpm@11.23.0 through Corepack
#   (~/.cache/node/corepack/v1/pnpm/11.23.0/bin/pnpm.cjs).
# - pnpm >= 11 is ESM-only and crashes on Node 20 (CloudLinux alt-nodejs20)
#   with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`, so the install phase fails
#   with "ERROR: Failed to install dependencies" and this script never runs.
# - Fix: set the Hostinger panel Node.js version to 22.x (see .nvmrc = 22.17.0
#   and HOSTINGER.md). pnpm 11 runs fine on Node 22, so the platform install
#   succeeds; this script then reinstalls deterministically with the
#   repo-pinned pnpm@9.12.3 via npx, bypassing Corepack entirely.

echo "Node: $(node --version)"
echo "npm: $(npm --version)"

# Never let incidental corepack shims jump to pnpm@latest inside this script.
export COREPACK_ENABLE=0
export COREPACK_DEFAULT_TO_LATEST=0
export NEXT_TELEMETRY_DISABLED=1

# Fail fast with a clear message: Payload/Next evaluates payload.config.ts
# during `next build`, so these must be set in Hostinger env vars already.
if [ -z "${DATABASE_URI:-}" ]; then
  echo "ERROR: DATABASE_URI is not set. Add it in Hostinger environment settings before building." >&2
  exit 1
fi
if [ -z "${PAYLOAD_SECRET:-}" ]; then
  echo "ERROR: PAYLOAD_SECRET is not set. Add it in Hostinger environment settings before building." >&2
  exit 1
fi

# Bare `pnpm` MUST resolve for child processes: Next's SWC fallback
# downloader runs `pnpm config get registry`, and without it the build dies
# with `pnpm: command not found` (this host has no pnpm outside Corepack).
# A npx-backed shim always works here (npx downloads are proven on this
# host); a real user-local install is preferred when permitted (faster).
HOSTINGER_BIN="$HOME/.hostinger-bin"
mkdir -p "$HOSTINGER_BIN"
printf '#!/bin/sh\nexec npx --yes pnpm@9.12.3 "$@"\n' > "$HOSTINGER_BIN/pnpm"
chmod +x "$HOSTINGER_BIN/pnpm"
export PATH="$HOSTINGER_BIN:$PATH"
NPM_GLOBAL="$HOME/.npm-global"
mkdir -p "$NPM_GLOBAL"
if npm install -g --prefix="$NPM_GLOBAL" pnpm@9.12.3 >"$HOME/.cache/pnpm-global-install.log" 2>&1; then
  export PATH="$NPM_GLOBAL/bin:$HOSTINGER_BIN:$PATH"
fi
PNPM="pnpm"
echo "pnpm resolved: $(command -v pnpm)"
pnpm --version
$PNPM install --frozen-lockfile --prod=false
$PNPM --filter @encreasl/cms run build

# Next places the standalone server under the workspace package path. Include
# the static assets it expects beside that server.
STANDALONE_DIR="apps/cms/.next/standalone/apps/cms"
STANDALONE_PARENT="apps/cms/.next/standalone/node_modules"
rm -rf "$STANDALONE_DIR/.next/static"
rm -rf "$STANDALONE_DIR/public"
mkdir -p "$STANDALONE_DIR/.next"
cp -R apps/cms/.next/static "$STANDALONE_DIR/.next/static"
cp -R apps/cms/public "$STANDALONE_DIR/public"

# Self-contain the runnable subtree (react/react-dom live in the parent
# standalone/node_modules; Hostinger snapshots only the app dir). Single
# implementation in apps/cms/scripts/self-contain-standalone.mjs — also wired
# into apps/cms `build`, so direct apps/cms panel builds get it too.
node apps/cms/scripts/self-contain-standalone.mjs

echo "Hostinger build complete. Start with: bash hostinger-start.sh"
