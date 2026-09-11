import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// Makes Next's standalone runnable subtree self-contained.
//
// Background: Next's standalone trace hoists shared deps (react, react-dom,
// ...) to `.next/standalone/node_modules`, and the app server only resolves
// them by walking UP from `.next/standalone/apps/cms/server.js`. Hostinger
// snapshots just the app subtree into its version dir (dropping that parent),
// and Render runs `node .next/standalone/apps/cms/server.js` from apps/cms,
// so `require('react')` from react-dom's server bundle dies at boot with
// "Error: Cannot find module 'react'" -> 503 from the edge.
//
// This runs as part of `apps/cms` build (see package.json), so it executes
// under EVERY Hostinger panel configuration (repo-root router build and
// direct apps/cms build alike) and on Render. It is idempotent and portable
// (no bash).
//
// Steps: merge every parent entry missing from the app dir down into it
// (never overwriting traced versions, except for the @swc/helpers repair
// below which deep-merges missing files), materialize symlinks to real files
// (pnpm links dangle after hosts copy the subtree), strip staged
// `.env*` (would shadow panel env vars via dotenv and leak secrets), then
// fail fast unless react/react-dom/next/@swc/helpers resolve from the staged
// server.

const cmsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appDir = path.join(cmsDir, '.next', 'standalone', 'apps', 'cms')
const parentModules = path.join(cmsDir, '.next', 'standalone', 'node_modules')
const serverFile = path.join(appDir, 'server.js')

if (!fs.existsSync(serverFile)) {
  throw new Error(`Standalone server was not generated at ${serverFile}`)
}

const appModules = path.join(appDir, 'node_modules')
const installedModules = path.join(cmsDir, 'node_modules')
const workspaceModules = path.resolve(cmsDir, '..', '..', 'node_modules')
fs.mkdirSync(appModules, { recursive: true })

const copyIfMissing = (name, sourceRoot) => {
  const src = path.join(sourceRoot, name)
  const dest = path.join(appModules, name)
  if (fs.existsSync(dest) || !fs.existsSync(src)) return false
  fs.cpSync(src, dest, { recursive: true, dereference: true })
  console.log(`self-contain: merged ${name} from ${path.relative(cmsDir, sourceRoot)}`)
  return true
}

// Recursively copy only files missing in dest (non-destructive deep merge).
// Used for scoped packages like @swc where the staged dir may exist but be
// missing the helpers subpackage.
const copyMissingRecursive = (srcDir, destDir) => {
  let copied = 0
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name)
    const dest = path.join(destDir, entry.name)
    let destStat = null
    try {
      destStat = fs.lstatSync(dest)
    } catch {
      destStat = null
    }
    if (entry.isSymbolicLink() || entry.isFile()) {
      if (destStat) continue
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.cpSync(src, dest, { recursive: true, dereference: true, force: false })
      copied += 1
    } else if (entry.isDirectory()) {
      if (!destStat) {
        fs.mkdirSync(dest, { recursive: true })
      } else if (!destStat.isDirectory()) {
        continue
      }
      copied += copyMissingRecursive(src, dest)
    }
  }
  return copied
}

if (fs.existsSync(parentModules)) {
  for (const name of fs.readdirSync(parentModules)) {
    if (name === '.bin') continue
    // Scoped dirs need a deep merge: a staged `@swc` containing only
    // `@swc/counter` must not block merging `@swc/helpers` from the parent.
    if (name.startsWith('@')) {
      const srcScope = path.join(parentModules, name)
      const destScope = path.join(appModules, name)
      if (!fs.existsSync(destScope)) {
        copyIfMissing(name, parentModules)
      } else {
        try {
          const stat = fs.lstatSync(srcScope)
          if (stat.isDirectory() && !stat.isSymbolicLink()) {
            const n = copyMissingRecursive(srcScope, destScope)
            if (n > 0) console.log(`self-contain: deep-merged ${n} file(s) under ${name}/ from .next/standalone/node_modules`)
          }
        } catch {
          // best-effort; validation below will fail fast with details
        }
      }
      continue
    }
    copyIfMissing(name, parentModules)
  }
}

// Resolve any package dir across every supported install layout (hoisted
// flat, app-local, pnpm isolated .pnpm virtual store, npm flat).
// require.resolve follows symlinks, so it works regardless of node-linker
// and pnpm version drift between local dev and Cloud Run / Render.
const resolvePackageDir = (name) => {
  const candidates = []
  const requirers = []
  try {
    requirers.push(createRequire(path.join(cmsDir, 'package.json')))
  } catch {}
  try {
    requirers.push(createRequire(serverFile))
  } catch {}
  try {
    const nextPkg = requirers[0]?.resolve?.('next/package.json')
    if (nextPkg) requirers.push(createRequire(nextPkg))
  } catch {}
  for (const req of requirers) {
    try {
      const pkgFile = req.resolve(`${name}/package.json`)
      candidates.push(path.dirname(fs.realpathSync(pkgFile)))
    } catch {}
  }
  // Hard-path fallbacks (hoisted root, app-local, traced parent).
  for (const dir of [
    path.join(workspaceModules, name),
    path.join(installedModules, name),
    path.join(parentModules, name),
  ]) {
    candidates.push(dir)
  }
  const seen = new Set()
  for (const dir of candidates) {
    if (!dir || seen.has(dir)) continue
    seen.add(dir)
    try {
      if (fs.existsSync(path.join(dir, 'package.json'))) return dir
    } catch {}
  }
  return null
}

// Resolve the canonical @swc/helpers source (kept as a named wrapper for
// log continuity; delegates to the generic resolver).
const resolveSwcHelpersDir = () => resolvePackageDir('@swc/helpers')

const stagedSwcHelpers = path.join(appModules, '@swc', 'helpers')
const swcSource = resolveSwcHelpersDir()
if (swcSource) {
  fs.mkdirSync(path.dirname(stagedSwcHelpers), { recursive: true })
  if (!fs.existsSync(stagedSwcHelpers)) {
    fs.cpSync(swcSource, stagedSwcHelpers, { recursive: true, dereference: true })
    console.log(`self-contain: repaired @swc/helpers from ${path.relative(cmsDir, swcSource)}`)
  } else {
    const n = copyMissingRecursive(swcSource, stagedSwcHelpers)
    console.log(
      n > 0
        ? `self-contain: repaired @swc/helpers (${n} missing file(s) from ${path.relative(cmsDir, swcSource)})`
        : `self-contain: @swc/helpers already complete (source ${path.relative(cmsDir, swcSource)})`,
    )
  }
} else {
  console.log(
    `self-contain: WARNING @swc/helpers source not found (checked cms require.resolve, workspace ${path.relative(cmsDir, path.join(workspaceModules, '@swc', 'helpers'))}, app-local, traced parent)`,
  )
}

// Some hosts flatten or regenerate the standalone tree and omit modules that
// Next traced into its parent directory. Seed the critical runtime packages
// from the CMS install as a fallback before validating the staged server.
for (const name of ['react', 'react-dom', 'next', 'scheduler', 'use-sync-external-store']) {
  copyIfMissing(name, installedModules)
}

// Materialize any remaining symlinks/junctions inside the app tree.
// Tolerates dangling links (broken pnpm store targets on a fresh host):
// they are removed so validation reports the real missing package instead
// of crashing with ENOENT from realpathSync.
const materialize = (dir) => {
  let entries = []
  try {
    entries = fs.readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    const p = path.join(dir, name)
    let stat
    try {
      stat = fs.lstatSync(p)
    } catch {
      continue
    }
    if (stat.isSymbolicLink()) {
      let target = null
      try {
        target = fs.realpathSync(p)
      } catch {
        fs.rmSync(p, { recursive: true, force: true })
        console.log(`self-contain: removed dangling link ${path.relative(appModules, p)}`)
        continue
      }
      try {
        fs.rmSync(p, { recursive: true, force: true })
        fs.cpSync(target, p, { recursive: true, dereference: true })
        console.log(`self-contain: materialized link ${path.relative(appModules, p)}`)
      } catch (err) {
        console.log(`self-contain: WARNING could not materialize ${path.relative(appModules, p)}: ${err?.message ?? err}`)
      }
    } else if (stat.isDirectory()) {
      materialize(p)
    }
  }
}
materialize(appModules)

// Next's own runtime deps (@next/env, styled-jsx, ...) are required by
// next/dist server chunks at boot (e.g. config.js requires @next/env) but
// file-tracing intermittently drops them from fresh-install standalone trees
// (seen on Cloud Run: MODULE_NOT_FOUND @next/env from server.js). The staged
// `next` dir exists so the generic merge above skips it — ensure each of its
// dependencies is physically present in the staged tree, repairing best-effort
// from any install layout.
//
// NOTE: presence is checked ONLY inside the standalone subtree. A bare
// require.resolve from server.js also sees ancestor node_modules
// (apps/cms/node_modules, repo root), which do NOT ship in the container —
// trusting it is exactly how @next/env passed build validation locally but
// crashed Cloud Run.
const stagedHas = (rel) => {
  try {
    return fs.existsSync(path.join(appModules, rel))
  } catch {
    return false
  }
}

// Huge staged dirs must never be deep-merged from the full source (that
// would bloat standalone with the entire next/react payloads). Only presence
// is repaired for them; missing files inside them mean a broken trace.
const NEVER_MERGE = new Set(['next', 'react', 'react-dom'])

const ensureStagedDep = (name, seen = new Set(), merge = true) => {
  if (seen.has(name)) return true
  seen.add(name)
  const dest = path.join(appModules, name)
  const hasStaged = stagedHas(path.join(name, 'package.json'))
  const src = resolvePackageDir(name)
  if (!hasStaged && src) {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.cpSync(src, dest, { recursive: true, dereference: true })
    console.log(`self-contain: repaired ${name} from ${path.relative(cmsDir, src)}`)
  } else if (hasStaged && src && merge && !NEVER_MERGE.has(name)) {
    const n = copyMissingRecursive(src, dest)
    if (n > 0) {
      console.log(`self-contain: repaired ${name} (${n} missing file(s) from ${path.relative(cmsDir, src)})`)
    }
  } else if (!hasStaged) {
    console.log(`self-contain: WARNING no source found for ${name}, skipping`)
    return false
  }
  // Recurse into required deps to close the runtime loop (e.g. postcss ->
  // nanoid/picocolors). Peer/optional gaps are tolerated by the libs.
  let deps = {}
  const readDeps = (pkgFile) => {
    try {
      return JSON.parse(fs.readFileSync(pkgFile, 'utf8')).dependencies ?? {}
    } catch {
      return null
    }
  }
  deps = readDeps(path.join(dest, 'package.json')) ?? (src ? readDeps(path.join(src, 'package.json')) : null) ?? {}
  for (const sub of Object.keys(deps)) {
    ensureStagedDep(sub, seen, !NEVER_MERGE.has(sub))
  }
  return true
}

let nextDirectDeps = []
try {
  nextDirectDeps = Object.keys(
    JSON.parse(fs.readFileSync(path.join(appModules, 'next', 'package.json'), 'utf8')).dependencies ?? {},
  )
} catch {
  console.log('self-contain: WARNING staged next/package.json unreadable, skipping dep repair')
}
{
  const seen = new Set()
  for (const dep of nextDirectDeps) {
    ensureStagedDep(dep, seen, !NEVER_MERGE.has(dep))
  }
}

// Never ship local secrets: a staged .env would shadow Hostinger panel env
// vars at runtime (dotenv loads .env from CWD) and leak credentials.
for (const f of fs.readdirSync(appDir)) {
  if (f === '.env' || f.startsWith('.env.')) {
    fs.rmSync(path.join(appDir, f), { force: true })
    console.log(`self-contain: removed staged ${f}`)
  }
}

// Fail fast with a clear message instead of a crash-loop at boot.
// Scoped to the staged subtree ONLY (see NOTE above): ancestor leakage made
// the old bare-resolve check pass at build time while the container crashed.
const missing = []
for (const mod of ['react', 'react-dom', 'next', '@next/env', 'styled-jsx']) {
  if (!stagedHas(path.join(mod, 'package.json'))) missing.push(mod)
}
for (const dep of nextDirectDeps) {
  if (!stagedHas(path.join(dep, 'package.json'))) missing.push(dep)
}
// Pinned @swc/helpers@0.5.23 layout: CJS (used by server.js require) + ESM.
for (const f of ['cjs/_interop_require_default.cjs', 'esm/_interop_require_default.js']) {
  if (!stagedHas(path.join('@swc/helpers', f))) missing.push(`@swc/helpers/${f}`)
}
if (missing.length > 0) {
  const uniq = [...new Set(missing)]
  let stagedNextVersion = 'missing'
  try {
    stagedNextVersion = JSON.parse(fs.readFileSync(path.join(appModules, 'next', 'package.json'), 'utf8')).version
  } catch {}
  throw new Error(
    `self-contain: standalone validation failed, ${uniq.length} file(s) missing from the staged subtree:\n` +
      uniq.map((m) => `  - node_modules/${m}`).join('\n') +
      `\n  server: ${serverFile}\n` +
      `  staged next version: ${stagedNextVersion}\n` +
      `  hint: ensure dependencies are installed with the pinned pnpm (\`pnpm install --frozen-lockfile\`) and that postinstall materialized peers.`,
  )
}
console.log('self-contain: standalone resolve ok (react, react-dom, next, @swc/helpers, @next/env, styled-jsx)')
