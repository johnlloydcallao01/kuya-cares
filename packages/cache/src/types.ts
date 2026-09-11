/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Default TTL in seconds */
  defaultTTL?: number
  /** Key prefix for namespacing */
  keyPrefix?: string
  /** Enable/disable caching */
  enabled?: boolean
}

/**
 * Cache operation result
 */
export interface CacheResult<T = any> {
  /** Whether the operation was successful */
  success: boolean
  /** The cached data (if any) */
  data?: T
  /** Error message (if any) */
  error?: string
  /** Whether data was found in cache */
  hit?: boolean
}

/**
 * Geospatial cache entry
 */
export interface GeospatialCacheEntry {
  /** Merchant or address data */
  data: any
  /** Latitude coordinate */
  latitude: number
  /** Longitude coordinate */
  longitude: number
  /** Cached timestamp */
  cachedAt: number
  /** TTL in seconds */
  ttl: number
}

/**
 * Geospatial query parameters
 */
export interface GeospatialQuery {
  /** Center latitude */
  latitude: number
  /** Center longitude */
  longitude: number
  /** Radius in kilometers */
  radiusKm: number
  /** Maximum number of results */
  limit?: number
  /** Additional filters */
  filters?: Record<string, any>
}

/**
 * PayloadCMS cache entry
 */
export interface PayloadCacheEntry<T = any> {
  /** Collection name */
  collection: string
  /** Document ID */
  id: string
  /** Document data */
  data: T
  /** Cached timestamp */
  cachedAt: number
  /** TTL in seconds */
  ttl: number
}

/**
 * Cache key patterns
 */
export enum CacheKeys {
  MERCHANT_BY_ID = 'merchant:id:',
  MERCHANT_BY_LOCATION = 'merchant:location:',
  ADDRESS_BY_ID = 'address:id:',
  GEOSPATIAL_QUERY = 'geo:query:',
  PAYLOAD_COLLECTION = 'payload:collection:',
}

/**
 * Cache TTL constants (in seconds)
 */
export enum CacheTTL {
  SHORT = 300,      // 5 minutes
  MEDIUM = 1800,    // 30 minutes
  LONG = 3600,      // 1 hour
  VERY_LONG = 86400 // 24 hours
}