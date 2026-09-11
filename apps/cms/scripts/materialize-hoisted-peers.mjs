import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// Hostinger builds/snapshots from root_directory=apps/cms. pnpm keeps hoisted
// peer packages (react, react-dom, ...) as symlinks pointing at the repo-root
// store OUTSIDE that boundary, so whatever runtime tree Hostinger assembles
// ends up without real react files and boot dies with
// "Cannot find module 'react'" from react-dom's server bundle
// (react-dom-server-legacy.node.production.js:36 does require('react')).
//
// This materializes the boot-critical peers as REAL directories inside
// apps/cms/node_modules. Byte-identical copies: behavior-preserving,
// idempotent, portable (Windows junctions included). Runs on postinstall AND
// in the build chain, so it executes no matter which panel configuration or
// install flags Hostinger uses.

const cmsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localModules = path.join(cmsDir, 'node_modules')
const requireFromCms = createRequire(path.join(cmsDir, 'package.json'))

const PEERS = ['react', 'react-dom', 'scheduler', 'use-sync-external-store', '@swc/helpers', '@next/env', 'styled-jsx']

for (const name of PEERS) {
  let resolved
  try {
    resolved = requireFromCms.resolve(`${name}/package.json`)
  } catch {
    console.log(`materialize: ${name} not installed, skipping`)
    continue
  }
  const realDir = path.dirname(fs.realpathSync(resolved))
  const destDir = path.join(localModules, name)
  fs.mkdirSync(path.dirname(destDir), { recursive: true })
  let alreadyReal = false
  try {
    alreadyReal = !fs.lstatSync(destDir).isSymbolicLink() && fs.realpathSync(destDir) === realDir
  } catch {
    alreadyReal = false
  }
  if (alreadyReal) {
    console.log(`materialize: ${name} already real`)
    continue
  }
  fs.rmSync(destDir, { recursive: true, force: true })
  fs.cpSync(realDir, destDir, { recursive: true, dereference: true })
  console.log(`materialize: ${name} materialized as real directory`)
}

const verifyFromCms = createRequire(path.join(cmsDir, 'package.json'))
for (const name of ['react', 'react-dom']) {
  verifyFromCms.resolve(name)
}
console.log('materialize: hoisted peers ok (react, react-dom)')
