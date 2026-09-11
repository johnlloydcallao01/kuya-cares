import type { NextConfig } from "next";

// Next.js automatically loads .env files in the following order:
// 1. .env.local (always loaded, should be gitignored)
// 2. .env.development (loaded when NODE_ENV is development)
// 3. .env (always loaded)
// No need for manual dotenv configuration
const nextConfig: NextConfig = {
  transpilePackages: [
    "@encreasl/ui",
    "@encreasl/auth",
    "@encreasl/client-services",
    "@encreasl/env",
    "@payloadcms/ui",
    "@payloadcms/richtext-lexical",
    "payload",
    "echarts",
    "zrender"
  ],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'cms.tap2goph.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },

  serverExternalPackages: ['@react-pdf/renderer'],

  // Next.js automatically exposes NEXT_PUBLIC_ environment variables to the client
  // No need to explicitly define them in the env object

  turbopack: {
    resolveAlias: {
      "@/*": "./src/*",
    },
  },

  // Proxy API requests to CMS to avoid CORS issues (consistent with apps/web)
  async rewrites() {
    return [
      {
        source: '/api/cms/:path*',
        destination: 'https://cms.tap2goph.com/api/:path*',
      },
    ];
  },

  // Redirect legacy dashboard/analytics/reports URLs to their new semantic
  // locations under /dashboard/* (Dashboard & Analytics group)
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/dashboard/overview',
        permanent: true,
      },
      {
        source: '/analytics',
        destination: '/dashboard/analytics',
        permanent: true,
      },
      {
        source: '/reports',
        destination: '/dashboard/reports',
        permanent: true,
      },
    ];
  },

  // Merchant-specific security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Explicitly disable typed routes (moved from experimental)
  typedRoutes: false,

  typescript: {
    // Temporarily ignore build errors for React 19 compatibility
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
