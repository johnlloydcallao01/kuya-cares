/**
 * @file apps/cms/src/utils/membershipRateLimit.ts
 * @description In-memory token-bucket rate limits for membership endpoints.
 * Same approach as src/payload.config.ts (swap to @upstash/redis for
 * multi-instance later).
 */

import type { NextRequest } from 'next/server'

export interface RateCheck {
  allowed: boolean
  retryAfterMs: number
}

/** Sliding-window check over per-key hit timestamps. */
export function checkRate(
  map: Map<string, number[]>,
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateCheck {
  const cutoff = now - windowMs
  const hits = (map.get(key) ?? []).filter((t) => t > cutoff)
  if (hits.length >= limit) {
    const oldest = Math.min(...hits)
    return { allowed: false, retryAfterMs: Math.max(0, oldest + windowMs - now) }
  }
  hits.push(now)
  map.set(key, hits)
  return { allowed: true, retryAfterMs: 0 }
}

/** Best-effort client IP for rate-limit keys (x-forwarded-for first). */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'unknown'
}

const vendorRegisterBuckets = new Map<string, number[]>()
const checkoutBuckets = new Map<string, number[]>()
const webhookBuckets = new Map<string, number[]>()

/** Public vendor registration: 10/hr per IP. */
export function vendorRegisterLimiter(ip: string, now?: number): RateCheck {
  return checkRate(vendorRegisterBuckets, ip, 10, 60 * 60 * 1000, now)
}

/** Vendor checkout/mutate: 20/hr per vendor. */
export function checkoutLimiter(vendorId: string, now?: number): RateCheck {
  return checkRate(checkoutBuckets, vendorId, 20, 60 * 60 * 1000, now)
}

/** Membership webhooks: 300/min per IP. */
export function webhookLimiter(ip: string, now?: number): RateCheck {
  return checkRate(webhookBuckets, ip, 300, 60 * 1000, now)
}
