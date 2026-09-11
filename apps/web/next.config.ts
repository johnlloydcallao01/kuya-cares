import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@encreasl/ui"],
  typedRoutes: false,

  // Image configuration for external domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cms.tap2goph.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Environment variables configuration
  env: {
    // Custom environment variables that should be available at build time
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },




  // Proxy API requests to avoid CORS during development
  async rewrites() {
    return [
      {
        source: '/api/cms/:path*',
        destination: 'https://cms.tap2goph.com/api/:path*',
      },
    ];
  },

  // Security headers for production
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
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },

  turbopack: {
    resolveAlias: {
      "@/*": "./src/*",
    },
  },

  
};

export default nextConfig;
