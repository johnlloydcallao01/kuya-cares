import type { RedisClient } from './redis'
import type { 
  GeospatialCacheEntry, 
  GeospatialQuery, 
  CacheResult 
} from './types'
import { CacheKeys, CacheTTL } from './types'

/**
 * Geospatial caching utilities
 */
export class GeospatialCache {
  private redis: RedisClient

  constructor(redisClient: RedisClient) {
    this.redis = redisClient
  }

  /**
   * Generate cache key for geospatial query
   */
  private generateGeoKey(query: GeospatialQuery): string {
    const { latitude, longitude, radiusKm, limit = 50 } = query
    const filters = query.filters ? JSON.stringify(query.filters) : ''
    return `${CacheKeys.GEOSPATIAL_QUERY}${latitude}_${longitude}_${radiusKm}_${limit}_${filters}`
  }

  /**
   * Generate cache key for merchant by location
   */
  private generateMerchantLocationKey(merchantId: string): string {
    return `${CacheKeys.MERCHANT_BY_LOCATION}${merchantId}`
  }

  /**
   * Cache geospatial query results
   */
  async cacheGeoQuery(
    query: GeospatialQuery, 
    results: any[], 
    ttl: number = CacheTTL.MEDIUM
  ): Promise<CacheResult<{ query: GeospatialQuery; results: any[]; cachedAt: number; ttl: number }>> {
    const key = this.generateGeoKey(query)
    const cacheEntry = {
      query,
      results,
      cachedAt: Date.now(),
      ttl
    }

    return this.redis.set(key, cacheEntry, ttl)
  }

  /**
   * Get cached geospatial query results
   */
  async getGeoQuery(query: GeospatialQuery): Promise<CacheResult<any[]>> {
    const key = this.generateGeoKey(query)
    const result = await this.redis.get<{
      query: GeospatialQuery
      results: any[]
      cachedAt: number
      ttl: number
    }>(key)

    if (!result.success || !result.hit || !result.data) {
      return { success: true, hit: false }
    }

    // Check if cache is still valid (additional validation)
    const age = (Date.now() - result.data.cachedAt) / 1000
    if (age > result.data.ttl) {
      // Cache expired, delete it
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
   * Cache merchant location data
   */
  async cacheMerchantLocation(
    merchantId: string,
    merchantData: any,
    ttl: number = CacheTTL.LONG
  ): Promise<CacheResult<GeospatialCacheEntry>> {
    const key = this.generateMerchantLocationKey(merchantId)
    
    const cacheEntry: GeospatialCacheEntry = {
      data: merchantData,
      latitude: merchantData.merchant_latitude || merchantData.latitude,
      longitude: merchantData.merchant_longitude || merchantData.longitude,
      cachedAt: Date.now(),
      ttl
    }

    return this.redis.set(key, cacheEntry, ttl)
  }

  /**
   * Get cached merchant location data
   */
  async getMerchantLocation(merchantId: string): Promise<CacheResult<GeospatialCacheEntry>> {
    const key = this.generateMerchantLocationKey(merchantId)
    return this.redis.get<GeospatialCacheEntry>(key)
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(
    lat1: number, 
    lon1: number, 
    lat2: number, 
    lon2: number
  ): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  /**
   * Filter cached merchants by distance
   */
  async filterMerchantsByDistance(
    centerLat: number,
    centerLon: number,
    radiusKm: number,
    merchantIds: string[]
  ): Promise<CacheResult<GeospatialCacheEntry[]>> {
    try {
      const results: GeospatialCacheEntry[] = []
      
      for (const merchantId of merchantIds) {
        const cached = await this.getMerchantLocation(merchantId)
        
        if (cached.success && cached.hit && cached.data) {
          const distance = this.calculateDistance(
            centerLat,
            centerLon,
            cached.data.latitude,
            cached.data.longitude
          )
          
          if (distance <= radiusKm) {
            results.push({
              ...cached.data,
              data: {
                ...cached.data.data,
                distance
              }
            })
          }
        }
      }

      // Sort by distance
      results.sort((a, b) => (a.data.distance || 0) - (b.data.distance || 0))

      return { success: true, data: results }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Invalidate geospatial caches for a specific area
   */
  async invalidateAreaCache(
    centerLat: number,
    centerLon: number,
    radiusKm: number
  ): Promise<CacheResult<number>> {
    try {
      // This is a simplified implementation
      // In a production system, you might want to use Redis geospatial commands
      // or maintain a spatial index of cache keys
      
      const pattern = `${CacheKeys.GEOSPATIAL_QUERY}*`
      const keys = await this.redis.getClient().keys(pattern)
      
      let deletedCount = 0
      
      for (const key of keys) {
        // Parse the key to extract coordinates
        const keyParts = key.split('_')
        if (keyParts.length >= 3) {
          const keyLat = parseFloat(keyParts[1])
          const keyLon = parseFloat(keyParts[2])
          
          if (!isNaN(keyLat) && !isNaN(keyLon)) {
            const distance = this.calculateDistance(centerLat, centerLon, keyLat, keyLon)
            
            if (distance <= radiusKm) {
              const result = await this.redis.del(key.replace(this.redis['config'].keyPrefix || '', ''))
              if (result.success && result.data) {
                deletedCount++
              }
            }
          }
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
   * Clear all geospatial caches
   */
  async clearAllGeoCache(): Promise<CacheResult<number>> {
    try {
      const geoPattern = `${CacheKeys.GEOSPATIAL_QUERY}*`
      const merchantPattern = `${CacheKeys.MERCHANT_BY_LOCATION}*`
      
      const geoKeys = await this.redis.getClient().keys(geoPattern)
      const merchantKeys = await this.redis.getClient().keys(merchantPattern)
      
      const allKeys = [...geoKeys, ...merchantKeys]
      
      if (allKeys.length === 0) {
        return { success: true, data: 0 }
      }

      // Remove prefix from keys before deletion
      const keysToDelete = allKeys.map(key => 
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
}