/**
 * @encreasl/cache - Enterprise-level caching utilities with Upstash Redis
 * 
 * This package provides a comprehensive caching solution for the Encreasl monorepo,
 * including Redis client management, geospatial caching, and PayloadCMS integration.
 */

// Core Redis client
export { RedisClient, createRedisClient } from './redis'

// Fail-open Upstash helpers (getCached/setCached/deleteCached/deleteCachedByPrefix)
// used by CMS admin BFF routes — same behavior as the former apps/cms/src/utils/redisCache.ts
export { getCached, setCached, deleteCached, deleteCachedByPrefix } from './redis-cache'

// Specialized cache utilities
export { GeospatialCache } from './geospatial'
export { PayloadCache } from './payloadcms'

// Types
export type {
  CacheConfig,
  CacheResult,
  GeospatialCacheEntry,
  GeospatialQuery,
  PayloadCacheEntry
} from './types'

// Enums and constants
export { CacheKeys, CacheTTL } from './types'

/**
 * Convenience function to create a complete cache setup
 */
export async function createCacheManager(
  url?: string,
  token?: string,
  config?: import('./types').CacheConfig
) {
  const { createRedisClient } = await import('./redis')
  const { GeospatialCache } = await import('./geospatial')
  const { PayloadCache } = await import('./payloadcms')
  
  const redis = createRedisClient(url, token, config)
  const geospatial = new GeospatialCache(redis)
  const payload = new PayloadCache(redis)

  return {
    redis,
    geospatial,
    payload
  }
}

/**
 * Default cache configuration
 */
export const defaultCacheConfig: import('./types').CacheConfig = {
  defaultTTL: 3600, // 1 hour
  keyPrefix: 'encreasl:',
  enabled: true
}

/**
 * Environment-based cache factory
 */
export async function createEnvironmentCache() {
  const isProduction = process.env.NODE_ENV === 'production'
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  const config: import('./types').CacheConfig = {
    ...defaultCacheConfig,
    // Disable caching in test environment
    enabled: process.env.NODE_ENV !== 'test',
    // Shorter TTL in development
    defaultTTL: isDevelopment ? 300 : 3600, // 5 min dev, 1 hour prod
    // Environment-specific key prefix
    keyPrefix: `encreasl:${process.env.NODE_ENV || 'dev'}:`
  }

  return createCacheManager(undefined, undefined, config)
}