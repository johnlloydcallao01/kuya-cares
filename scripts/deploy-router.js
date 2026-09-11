#!/usr/bin/env node

/**
 * Deploy router for the root `build` / `start` scripts.
 *
 * Hostinger's Node.js panel locks the build step to `pnpm run build` at the
 * repo root, but this monorepo's full `turbo run build` (16 workspace
 * projects) is too heavy for shared hosting and would build every app.
 * Setting the env var HOSTINGER_APP=cms in Hostinger's environment settings
 * routes the locked commands to the CMS-only build/start instead:
 *
 *   pnpm run build  (+ HOSTINGER_APP=cms)  ->  bash hostinger-build.sh
 *   pnpm start      (+ HOSTINGER_APP=cms)  ->  bash hostinger-start.sh
 *
 * Without the env var, behaviour is exactly as before (local / Render /
 * Vercel / CI unaffected):
 *
 *   pnpm run build  ->  turbo run build
 *   pnpm start      ->  cd apps/web && pnpm start
 *
 * Usage:
 *   node scripts/deploy-router.js <build|start>
 */

const { execSync } = require('child_process');

const mode = process.argv[2];
const target = (process.env.HOSTINGER_APP || '').trim().toLowerCase();

function sh(cmd) {
  execSync(cmd, { stdio: 'inherit', shell: true });
}

if (target === 'cms') {
  console.log(`[deploy-router] HOSTINGER_APP=cms -> ${mode} CMS only`);
  if (mode === 'start') {
    sh('bash hostinger-start.sh');
  } else if (mode === 'build') {
    sh('bash hostinger-build.sh');
  } else {
    console.error('Usage: node scripts/deploy-router.js <build|start>');
    process.exit(1);
  }
} else if (mode === 'build') {
  sh('turbo run build');
} else if (mode === 'start') {
  sh('cd apps/web && pnpm start');
} else {
  console.error('Usage: node scripts/deploy-router.js <build|start>');
  process.exit(1);
}
