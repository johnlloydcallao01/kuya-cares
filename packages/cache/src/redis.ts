import { Redis } from '@upstash/redis'
import type { CacheConfig, CacheResult } from './types'

/**
 * Redis client configuration
 */
interface RedisConfig {
  url: string
  token: string
}

/**
 * Upstash Redis client wrapper
 */
export class RedisClient {
  private client: Redis
  private config: CacheConfig

  constructor(redisConfig: RedisConfig, cacheConfig: CacheConfig = {}) {
    this.client = new Redis({
      url: redisConfig.url,
      token: redisConfig.token,
    })

    this.config = {
      defaultTTL: 3600, // 1 hour default
      keyPrefix: 'encreasl:',
      enabled: true,
      ...cacheConfig,
    }
  }

  /**
   * Generate cache key with prefix
   */
  private generateKey(key: string): string {
    return `${this.config.keyPrefix}${key}`
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<CacheResult<T>> {
    if (!this.config.enabled) {
      return { success: false, error: 'Caching is disabled' }
    }

    try {
      const cacheKey = this.generateKey(key)
      const cacheTTL = ttl || this.config.defaultTTL!
      
      await this.client.setex(cacheKey, cacheTTL, JSON.stringify(value))
      
      return { success: true, data: value }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<CacheResult<T>> {
    if (!this.config.enabled) {
      return { success: false, error: 'Caching is disabled' }
    }

    try {
      const cacheKey = this.generateKey(key)
      const result = await this.client.get(cacheKey)
      
      if (result === null) {
        return { success: true, hit: false }
      }

      const data = typeof result === 'string' ? JSON.parse(result) : result
      return { success: true, data, hit: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Delete a value from cache
   */
  async del(key: string): Promise<CacheResult<boolean>> {
    if (!this.config.enabled) {
      return { success: false, error: 'Caching is disabled' }
    }

    try {
      const cacheKey = this.generateKey(key)
      const result = await this.client.del(cacheKey)
      
      return { success: true, data: result > 0 }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<CacheResult<boolean>> {
    if (!this.config.enabled) {
      return { success: false, error: 'Caching is disabled' }
    }

    try {
      const cacheKey = this.generateKey(key)
      const result = await this.client.exists(cacheKey)
      
      return { success: true, data: result > 0 }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Set TTL for an existing key
   */
  async expire(key: string, ttl: number): Promise<CacheResult<boolean>> {
    if (!this.config.enabled) {
      return { success: false, error: 'Caching is disabled' }
    }

    try {
      const cacheKey = this.generateKey(key)
      const result = await this.client.expire(cacheKey, ttl)
      
      return { success: true, data: result > 0 }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Clear all keys with the configured prefix
   */
  async clear(): Promise<CacheResult<number>> {
    if (!this.config.enabled) {
      return { success: false, error: 'Caching is disabled' }
    }

    try {
      // Get all keys with our prefix
      const keys = await this.client.keys(`${this.config.keyPrefix}*`)
      
      if (keys.length === 0) {
        return { success: true, data: 0 }
      }

      // Delete all keys
      const result = await this.client.del(...keys)
      
      return { success: true, data: result }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheResult<{ keyCount: number; memoryUsage?: string }>> {
    try {
      const keys = await this.client.keys(`${this.config.keyPrefix}*`)
      
      return { 
        success: true, 
        data: { 
          keyCount: keys.length 
        } 
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get the underlying Redis client for advanced operations
   */
  getClient(): Redis {
    return this.client
  }
}

/**
 * Create a Redis client instance with Upstash configuration
 */
export function createRedisClient(
  url: string = process.env.UPSTASH_REDIS_REST_URL!,
  token: string = process.env.UPSTASH_REDIS_REST_TOKEN!,
  config: CacheConfig = {}
): RedisClient {
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables are required')
  }

  return new RedisClient({ url, token }, config)
}