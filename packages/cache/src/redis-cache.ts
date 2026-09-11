import { Redis } from '@upstash/redis'

const CACHE_TIMEOUT_MS = 1500

let redis: Redis | null | undefined

function cleanEnvValue(value: string | undefined): string | undefined {
  const cleaned = value?.trim()
  if (!cleaned) return undefined
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    return cleaned.slice(1, -1).trim()
  }
  return cleaned
}

function getRedis(): Redis | null {
  if (redis !== undefined) return redis

  const url = cleanEnvValue(process.env.UPSTASH_REDIS_REST_URL)
  const token = cleanEnvValue(process.env.UPSTASH_REDIS_REST_TOKEN)
  if (!url || !token || !/^https:\/\//i.test(url)) {
    redis = null
    return redis
  }

  try {
    redis = new Redis({ url, token, enableTelemetry: false })
  } catch (error) {
    console.error('[RedisCache] Invalid Upstash configuration; caching disabled:', error instanceof Error ? error.message : error)
    redis = null
  }
  return redis
}

function withTimeout<T>(operation: Promise<T>): Promise<T | null> {
  return Promise.race([
    operation,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), CACHE_TIMEOUT_MS)),
  ]).catch(() => null)
}

export async function getCached<T>(key: string): Promise<T | null> {
  const client = getRedis()
  if (!client) return null
  return withTimeout(client.get<T>(key))
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const client = getRedis()
  if (!client) return
  await withTimeout(client.set(key, value, { ex: ttlSeconds }))
}

export async function deleteCached(key: string): Promise<void> {
  const client = getRedis()
  if (!client) return
  await withTimeout(client.del(key))
}

/**
 * Best-effort prefix bust (e.g. `admin:vendors:` after a vendor mutation).
 * SCAN-based so it never blocks Redis like KEYS would; each round-trip is
 * timeout-guarded and failures are swallowed — worst case the entries
 * converge when their TTL expires.
 */
export async function deleteCachedByPrefix(prefix: string): Promise<void> {
  const client = getRedis()
  if (!client) return
  try {
    let cursor = '0'
    do {
      const scanned = await withTimeout(client.scan(cursor, { match: `${prefix}*`, count: 100 }))
      if (!scanned) break
      const [next, keys] = scanned as unknown as [string | number, string[]]
      cursor = String(next)
      if (keys.length) await withTimeout(client.del(...keys))
    } while (cursor !== '0')
  } catch {
    // best-effort only
  }
}
