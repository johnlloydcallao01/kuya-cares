import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const cmsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const standaloneDir = path.join(cmsDir, '.next', 'standalone', 'apps', 'cms')
const staticSource = path.join(cmsDir, '.next', 'static')
const publicSource = path.join(cmsDir, 'public')

if (!fs.existsSync(path.join(standaloneDir, 'server.js'))) {
  throw new Error(`Standalone server was not generated at ${path.join(standaloneDir, 'server.js')}`)
}

fs.rmSync(path.join(standaloneDir, '.next', 'static'), { recursive: true, force: true })
fs.rmSync(path.join(standaloneDir, 'public'), { recursive: true, force: true })
fs.cpSync(staticSource, path.join(standaloneDir, '.next', 'static'), { recursive: true })
if (fs.existsSync(publicSource)) {
  fs.cpSync(publicSource, path.join(standaloneDir, 'public'), { recursive: true })
}

console.log(`Prepared standalone assets in ${standaloneDir}`)
