/**
 * @file apps/web/src/server/utils/rate-limit.ts
 * @description Rate limiting utilities for server actions
 */

import 'server-only';
import { headers } from 'next/headers';
import type { RateLimitConfig } from '../types/server-types';

// Re-export for external use
export type { RateLimitConfig };

// ========================================
// RATE LIMITING
// ========================================

// In-memory store for rate limiting (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limit result
 */
export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
};

/**
 * Check rate limit for a given key
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const headersList = await headers();
  const clientIp = headersList.get('x-forwarded-for') || 
                   headersList.get('x-real-ip') || 
                   'unknown';
  
  const rateLimitKey = `${key}:${clientIp}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  // Clean up expired entries
  cleanupExpiredEntries(windowStart);
  
  const current = rateLimitStore.get(rateLimitKey);
  
  if (!current || current.resetTime <= now) {
    // First request or window has reset
    rateLimitStore.set(rateLimitKey, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }
  
  if (current.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime,
      retryAfter: Math.ceil((current.resetTime - now) / 1000),
    };
  }
  
  // Increment count
  current.count++;
  rateLimitStore.set(rateLimitKey, current);
  
  return {
    allowed: true,
    remaining: config.maxRequests - current.count,
    resetTime: current.resetTime,
  };
}

/**
 * Create a rate limiter function
 */
export function createRateLimiter(config: RateLimitConfig) {
  return (key: string) => checkRateLimit(key, config);
}

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(cutoffTime: number): void {
  const entries = Array.from(rateLimitStore.entries());
  for (const [key, value] of entries) {
    if (value.resetTime <= cutoffTime) {
      rateLimitStore.delete(key);
    }
  }
}

// ========================================
// PREDEFINED RATE LIMITERS
// ========================================

/**
 * Strict rate limiter for sensitive operations
 */
export const strictRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3,
});

/**
 * Standard rate limiter for normal operations
 */
export const standardRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 10,
});

/**
 * Lenient rate limiter for frequent operations
 */
export const lenientRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 30,
});

// ========================================
// RATE LIMIT MIDDLEWARE
// ========================================

/**
 * Rate limit middleware for server actions
 */
export function withRateLimit<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  key: string,
  config: RateLimitConfig
) {
  return async (...args: T): Promise<R> => {
    const rateLimitResult = await checkRateLimit(key, config);
    
    if (!rateLimitResult.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`);
    }
    
    return fn(...args);
  };
}
