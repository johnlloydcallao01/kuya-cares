/**
 * Simple in-memory cache for API data
 * Prevents unnecessary refetching when navigating between pages in SPA
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class DataCache {
  private cache = new Map<string, CacheEntry<any>>();
  
  /**
   * Set data in cache with TTL
   */
  set<T>(key: string, data: T, ttlMinutes: number = 5): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000, // Convert minutes to milliseconds
    };
    
    this.cache.set(key, entry);
  }
  
  /**
   * Get data from cache if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if cache entry has expired
    const now = Date.now();
    const isExpired = (now - entry.timestamp) > entry.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  /**
   * Check if data exists in cache and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  /**
   * Clear specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      const isExpired = (now - entry.timestamp) > entry.ttl;
      if (isExpired) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const dataCache = new DataCache();

// Cache keys constants
export const CACHE_KEYS = {
  PRODUCT_CATEGORIES: 'product-categories',
  MERCHANTS: 'merchants',
  MERCHANTS_BY_ID: (id: string) => `merchant-${id}`,
  ADDRESSES: 'addresses',
  ACTIVE_ADDRESS: (userId: string | number) => `active-address-${userId}`,
} as const;

// Default TTL values (in minutes)
export const CACHE_TTL = {
  PRODUCT_CATEGORIES: 10, // 10 minutes
  MERCHANTS: 5, // 5 minutes
  MERCHANT_DETAILS: 15, // 15 minutes
  ADDRESSES: 5, // 5 minutes
  ACTIVE_ADDRESS: 10, // 10 minutes
} as const;
