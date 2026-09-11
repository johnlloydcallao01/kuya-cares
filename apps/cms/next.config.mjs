import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withPayload } from '@payloadcms/next/withPayload'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Workspace TS package consumed as raw source (main: ./src/index.ts) —
  // transpile it into the CMS bundle like web-admin does for client-services.
  transpilePackages: ['@encreasl/cache'],
  // Monorepo: trace from repo root so pnpm hoisted deps resolve deterministically.
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  // Force-trace the SWC runtime helpers. They are required by compiled
  // next/dist server chunks (e.g. require('@swc/helpers/_/_interop_require_default'))
  // but are only a transitive dep of `next`, so @vercel/nft intermittently
  // omits them from the standalone tree on fresh pnpm installs (Next 16.3.x
  // pnpm regression). Declared explicitly in package.json + included here.
  outputFileTracingIncludes: {
    '/*': ['../../node_modules/@swc/helpers/**/*', './node_modules/@swc/helpers/**/*'],
  },
  allowedDevOrigins: [
    'localhost',
    'localhost:3001',
    'localhost:8081',
    'api-dev.kuyacares.com',
    'cms-dev.kuyacares.com',
    'dev.kuyacares.com',
  ],
  // Redirect root path to admin
  async redirects() {
    return [
      {
        source: '/',
        destination: '/admin',
        permanent: false,
      },
    ]
  },
  // Security headers and CORS configuration
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,PATCH,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization,X-Requested-With' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
  // Enable Turbopack (Next.js 16 default)
  turbopack: {},
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
