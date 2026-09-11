#!/usr/bin/env bash
set -euo pipefail

# Hostinger start: run the Next.js standalone server built by hostinger-build.sh.
# Runtime does not require pnpm/corepack, just node. Next standalone honors
# $PORT and $HOSTNAME, which Hostinger injects.
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3001}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

exec node apps/cms/.next/standalone/apps/cms/server.js
