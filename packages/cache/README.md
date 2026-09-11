# @encreasl/cache

Enterprise-level caching utilities with Upstash Redis for the Encreasl monorepo.

## Features

- 🚀 **High-Performance Redis Caching** with Upstash
- 🌍 **Geospatial Caching** for location-based queries
- 📊 **PayloadCMS Integration** for collection data caching
- 🔧 **TypeScript Support** with full type safety
- 🏗️ **Monorepo Ready** for shared usage across apps
- ⚡ **Environment-Aware** configuration

## Installation

This package is already installed as part of the monorepo. To use it in your app:

```bash
pnpm add @encreasl/cache
```

## Environment Variables

Set these environment variables in your app:

```env
UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"
```

## Quick Start

### Basic Usage

```typescript
import { createCacheManager } from '@encreasl/cache'

// Create cache manager with environment variables
const cache = createCacheManager()

// Basic caching
await cache.redis.set('user:123', userData, 3600) // 1 hour TTL
const user = await cache.redis.get('user:123')
```

### Geospatial Caching

```typescript
import { createCacheManager, CacheTTL } from '@encreasl/cache'

const cache = createCacheManager()

// Cache merchants by location
const merchants = [/* merchant data */]
await cache.geospatial.cacheGeoQuery(
  {
    latitude: 14.5995,
    longitude: 120.9842,
    radiusKm: 5,
    limit: 20
  },
  merchants,
  CacheTTL.MEDIUM
)

// Get cached results
const cachedMerchants = await cache.geospatial.getGeoQuery({
  latitude: 14.5995,
  longitude: 120.9842,
  radiusKm: 5,
  limit: 20
})
```

### PayloadCMS Integration

```typescript
import { createCacheManager } from '@encreasl/cache'

const cache = createCacheManager()

// Cache PayloadCMS documents
await cache.payload.cacheMerchant('merchant-id', merchantData)
await cache.payload.cacheAddress('address-id', addressData)

// Get cached documents
const merchant = await cache.payload.getMerchant('merchant-id')
const address = await cache.payload.getAddress('address-id')

// Cache query results
await cache.payload.cacheMerchantsByLocation(
  14.5995, 120.9842, 5, merchants
)
```

## API Reference

### RedisClient

Core Redis operations with automatic key prefixing and error handling.

```typescript
class RedisClient {
  async set<T>(key: string, value: T, ttl?: number): Promise<CacheResult<T>>
  async get<T>(key: string): Promise<CacheResult<T>>
  async del(key: string): Promise<CacheResult<boolean>>
  async exists(key: string): Promise<CacheResult<boolean>>
  async expire(key: string, ttl: number): Promise<CacheResult<boolean>>
  async clear(): Promise<CacheResult<number>>
}
```

### GeospatialCache

Location-based caching utilities.

```typescript
class GeospatialCache {
  async cacheGeoQuery(query: GeospatialQuery, results: any[], ttl?: number)
  async getGeoQuery(query: GeospatialQuery)
  async cacheMerchantLocation(merchantId: string, merchantData: any, ttl?: number)
  async getMerchantLocation(merchantId: string)
  async filterMerchantsByDistance(centerLat: number, centerLon: number, radiusKm: number, merchantIds: string[])
}
```

### PayloadCache

PayloadCMS-specific caching utilities.

```typescript
class PayloadCache {
  async cacheDocument<T>(collection: string, id: string, data: T, ttl?: number)
  async getDocument<T>(collection: string, id: string)
  async cacheQuery<T>(collection: string, query: Record<string, any>, results: T, ttl?: number)
  async getQuery<T>(collection: string, query: Record<string, any>)
  async invalidateCollection(collection: string)
}
```

## Cache Keys

The package uses structured cache keys:

- `merchant:id:{id}` - Individual merchant data
- `merchant:location:{id}` - Merchant location data
- `address:id:{id}` - Individual address data
- `geo:query:{params}` - Geospatial query results
- `payload:collection:{collection}:{id}` - PayloadCMS documents

## TTL Constants

```typescript
enum CacheTTL {
  SHORT = 300,      // 5 minutes
  MEDIUM = 1800,    // 30 minutes
  LONG = 3600,      // 1 hour
  VERY_LONG = 86400 // 24 hours
}
```

## Environment Configuration

```typescript
// Automatic environment-based setup
const cache = createEnvironmentCache()

// Custom configuration
const cache = createCacheManager(url, token, {
  defaultTTL: 3600,
  keyPrefix: 'myapp:',
  enabled: true
})
```

## Error Handling

All cache operations return a `CacheResult<T>` object:

```typescript
interface CacheResult<T> {
  success: boolean
  data?: T
  error?: string
  hit?: boolean // For get operations
}

// Usage
const result = await cache.redis.get('key')
if (result.success && result.hit) {
  console.log('Cache hit:', result.data)
} else if (result.success && !result.hit) {
  console.log('Cache miss')
} else {
  console.error('Cache error:', result.error)
}
```

## Best Practices

1. **Use appropriate TTL values** based on data volatility
2. **Handle cache misses gracefully** with fallback to database
3. **Invalidate caches** when underlying data changes
4. **Use structured cache keys** for easy management
5. **Monitor cache hit rates** for optimization

## Integration Examples

### Next.js API Route

```typescript
import { createEnvironmentCache } from '@encreasl/cache'

const cache = createEnvironmentCache()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const merchantId = searchParams.get('id')
  
  // Try cache first
  const cached = await cache.payload.getMerchant(merchantId)
  if (cached.success && cached.hit) {
    return Response.json(cached.data)
  }
  
  // Fallback to database
  const merchant = await fetchMerchantFromDB(merchantId)
  
  // Cache for future requests
  await cache.payload.cacheMerchant(merchantId, merchant)
  
  return Response.json(merchant)
}
```

### PayloadCMS Hook

```typescript
import { createEnvironmentCache } from '@encreasl/cache'

const cache = createEnvironmentCache()

export const merchantAfterChange = async ({ doc, operation }) => {
  if (operation === 'update' || operation === 'create') {
    // Cache the updated merchant
    await cache.payload.cacheMerchant(doc.id, doc)
    
    // Invalidate location-based caches
    await cache.geospatial.invalidateAreaCache(
      doc.merchant_latitude,
      doc.merchant_longitude,
      10 // 10km radius
    )
  }
}
```