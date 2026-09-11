import type { RedisClient } from './redis'
import type { 
  PayloadCacheEntry, 
  CacheResult 
} from './types'
import { CacheKeys, CacheTTL } from './types'

/**
 * PayloadCMS caching utilities
 */
export class PayloadCache {
  private redis: RedisClient

  constructor(redisClient: RedisClient) {
    this.redis = redisClient
  }

  /**
   * Generate cache key for PayloadCMS collection document
   */
  private generateCollectionKey(collection: string, id: string): string {
    return `${CacheKeys.PAYLOAD_COLLECTION}${collection}:${id}`
  }

  /**
   * Generate cache key for PayloadCMS collection query
   */
  private generateQueryKey(collection: string, query: Record<string, any>): string {
    const queryString = JSON.stringify(query)
    const queryHash = this.hashString(queryString)
    return `${CacheKeys.PAYLOAD_COLLECTION}${collection}:query:${queryHash}`
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Cache a PayloadCMS document
   */
  async cacheDocument<T = any>(
    collection: string,
    id: string,
    data: T,
    ttl: number = CacheTTL.MEDIUM
  ): Promise<CacheResult<PayloadCacheEntry<T>>> {
    const key = this.generateCollectionKey(collection, id)
    
    const cacheEntry: PayloadCacheEntry<T> = {
      collection,
      id,
      data,
      cachedAt: Date.now(),
      ttl
    }

    return this.redis.set(key, cacheEntry, ttl)
  }

  /**
   * Get cached PayloadCMS document
   */
  async getDocument<T = any>(
    collection: string, 
    id: string
  ): Promise<CacheResult<PayloadCacheEntry<T>>> {
    const key = this.generateCollectionKey(collection, id)
    return this.redis.get<PayloadCacheEntry<T>>(key)
  }

  /**
   * Cache PayloadCMS query results
   */
  async cacheQuery<T = any>(
    collection: string,
    query: Record<string, any>,
    results: T,
    ttl: number = CacheTTL.SHORT
  ): Promise<CacheResult<any>> {
    const key = this.generateQueryKey(collection, query)
    
    const cacheEntry = {
      collection,
      query,
      results,
      cachedAt: Date.now(),
      ttl
    }

    return this.redis.set(key, cacheEntry, ttl)
  }

  /**
   * Get cached PayloadCMS query results
   */
  async getQuery<T = any>(
    collection: string,
    query: Record<string, any>
  ): Promise<CacheResult<T>> {
    const key = this.generateQueryKey(collection, query)
    const result = await this.redis.get<{
      collection: string
      query: Record<string, any>
      results: T
      cachedAt: number
      ttl: number
    }>(key)

    if (!result.success || !result.hit || !result.data) {
      return { success: true, hit: false }
    }

    // Check if cache is still valid
    const age = (Date.now() - result.data.cachedAt) / 1000
    if (age > result.data.ttl) {
      await this.redis.del(key)
      return { success: true, hit: false }
    }

    return { 
      success: true, 
      data: result.data.results, 
      hit: true 
    }
  }

  /**
   * Invalidate document cache
   */
  async invalidateDocument(
    collection: string, 
    id: string
  ): Promise<CacheResult<boolean>> {
    const key = this.generateCollectionKey(collection, id)
    return this.redis.del(key)
  }

  /**
   * Invalidate all caches for a collection
   */
  async invalidateCollection(collection: string): Promise<CacheResult<number>> {
    try {
      const pattern = `${CacheKeys.PAYLOAD_COLLECTION}${collection}:*`
      const keys = await this.redis.getClient().keys(pattern)
      
      if (keys.length === 0) {
        return { success: true, data: 0 }
      }

      // Remove prefix from keys before deletion
      const keysToDelete = keys.map(key => 
        key.replace(this.redis['config'].keyPrefix || '', '')
      )

      let deletedCount = 0
      for (const key of keysToDelete) {
        const result = await this.redis.del(key)
        if (result.success && result.data) {
          deletedCount++
        }
      }

      return { success: true, data: deletedCount }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Cache merchant data with geospatial information
   */
  async cacheMerchant<T = any>(
    merchantId: string,
    merchantData: T,
    ttl: number = CacheTTL.LONG
  ): Promise<CacheResult<PayloadCacheEntry<T>>> {
    return this.cacheDocument('merchants', merchantId, merchantData, ttl)
  }

  /**
   * Get cached merchant data
   */
  async getMerchant<T = any>(merchantId: string): Promise<CacheResult<PayloadCacheEntry<T>>> {
    return this.getDocument<T>('merchants', merchantId)
  }

  /**
   * Cache address data with geospatial information
   */
  async cacheAddress<T = any>(
    addressId: string,
    addressData: T,
    ttl: number = CacheTTL.LONG
  ): Promise<CacheResult<PayloadCacheEntry<T>>> {
    return this.cacheDocument('addresses', addressId, addressData, ttl)
  }

  /**
   * Get cached address data
   */
  async getAddress<T = any>(addressId: string): Promise<CacheResult<PayloadCacheEntry<T>>> {
    return this.getDocument<T>('addresses', addressId)
  }

  /**
   * Cache merchants by location query
   */
  async cacheMerchantsByLocation(
    latitude: number,
    longitude: number,
    radiusKm: number,
    merchants: any[],
    ttl: number = CacheTTL.MEDIUM
  ): Promise<CacheResult<any>> {
    const query = { latitude, longitude, radiusKm }
    return this.cacheQuery('merchants', query, merchants, ttl)
  }

  /**
   * Get cached merchants by location
   */
  async getMerchantsByLocation(
    latitude: number,
    longitude: number,
    radiusKm: number
  ): Promise<CacheResult<any[]>> {
    const query = { latitude, longitude, radiusKm }
    return this.getQuery<any[]>('merchants', query)
  }

  /**
   * Invalidate merchant-related caches when merchant data changes
   */
  async invalidateMerchantCaches(merchantId: string): Promise<CacheResult<number>> {
    try {
      let totalDeleted = 0

      // Invalidate specific merchant document
      const docResult = await this.invalidateDocument('merchants', merchantId)
      if (docResult.success && docResult.data) {
        totalDeleted++
      }

      // Invalidate location-based queries (simplified approach)
      const locationPattern = `${CacheKeys.PAYLOAD_COLLECTION}merchants:query:*`
      const locationKeys = await this.redis.getClient().keys(locationPattern)
      
      for (const key of locationKeys) {
        const keyWithoutPrefix = key.replace(this.redis['config'].keyPrefix || '', '')
        const result = await this.redis.del(keyWithoutPrefix)
        if (result.success && result.data) {
          totalDeleted++
        }
      }

      return { success: true, data: totalDeleted }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Invalidate address-related caches when address data changes
   */
  async invalidateAddressCaches(addressId: string): Promise<CacheResult<number>> {
    try {
      let totalDeleted = 0

      // Invalidate specific address document
      const docResult = await this.invalidateDocument('addresses', addressId)
      if (docResult.success && docResult.data) {
        totalDeleted++
      }

      // Invalidate related merchant caches since addresses affect merchant locations
      const merchantPattern = `${CacheKeys.PAYLOAD_COLLECTION}merchants:*`
      const merchantKeys = await this.redis.getClient().keys(merchantPattern)
      
      for (const key of merchantKeys) {
        const keyWithoutPrefix = key.replace(this.redis['config'].keyPrefix || '', '')
        const result = await this.redis.del(keyWithoutPrefix)
        if (result.success && result.data) {
          totalDeleted++
        }
      }

      return { success: true, data: totalDeleted }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get cache statistics for PayloadCMS collections
   */
  async getCollectionStats(): Promise<CacheResult<Record<string, number>>> {
    try {
      const pattern = `${CacheKeys.PAYLOAD_COLLECTION}*`
      const keys = await this.redis.getClient().keys(pattern)
      
      const stats: Record<string, number> = {}
      
      for (const key of keys) {
        // Extract collection name from key
        const keyParts = key.split(':')
        if (keyParts.length >= 2) {
          const collection = keyParts[1]
          stats[collection] = (stats[collection] || 0) + 1
        }
      }

      return { success: true, data: stats }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}