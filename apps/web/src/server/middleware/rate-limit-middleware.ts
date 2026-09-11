/**
 * @file apps/web/src/server/middleware/rate-limit-middleware.ts
 * @description Rate limiting middleware for server actions
 */

import 'server-only';
import { checkRateLimit, type RateLimitConfig } from '../utils/rate-limit';
import type { ServerActionResult } from '../types/server-types';

// ========================================
// TYPES
// ========================================

export type RateLimitOptions = RateLimitConfig & {
  keyGenerator?: (...args: unknown[]) => string;
  skipCondition?: (...args: unknown[]) => boolean;
  onLimitExceeded?: (retryAfter: number) => Error;
};

// ========================================
// RATE LIMIT MIDDLEWARE
// ========================================

/**
 * Rate limiting middleware for server actions
 */
export function withRateLimit<T extends unknown[], R>(
  key: string,
  config: RateLimitConfig
) {
  return (fn: (...args: T) => Promise<R>) => {
    return async (...args: T): Promise<R> => {
      const rateLimitResult = await checkRateLimit(key, config);
      
      if (!rateLimitResult.allowed) {
        const error = new Error(
          `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`
        );
        error.name = 'RateLimitError';
        throw error;
      }
      
      return fn(...args);
    };
  };
}

/**
 * Advanced rate limiting middleware with custom options
 */
export function withAdvancedRateLimit<T extends unknown[], R>(
  baseKey: string,
  options: RateLimitOptions
) {
  return (fn: (...args: T) => Promise<R>) => {
    return async (...args: T): Promise<R> => {
      // Check skip condition
      if (options.skipCondition && options.skipCondition(...args)) {
        return fn(...args);
      }
      
      // Generate dynamic key
      const key = options.keyGenerator 
        ? options.keyGenerator(...args)
        : baseKey;
      
      const rateLimitResult = await checkRateLimit(key, options);
      
      if (!rateLimitResult.allowed) {
        const error = options.onLimitExceeded 
          ? options.onLimitExceeded(rateLimitResult.retryAfter || 60)
          : new Error(`Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`);
        
        error.name = 'RateLimitError';
        throw error;
      }
      
      return fn(...args);
    };
  };
}

/**
 * Rate limiting middleware that returns ServerActionResult
 */
export function withRateLimitResult<T extends unknown[], R>(
  key: string,
  config: RateLimitConfig
) {
  return (fn: (...args: T) => Promise<ServerActionResult<R>>) => {
    return async (...args: T): Promise<ServerActionResult<R>> => {
      const rateLimitResult = await checkRateLimit(key, config);
      
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
            details: {
              retryAfter: rateLimitResult.retryAfter,
              limit: config.maxRequests,
              window: config.windowMs,
            },
            timestamp: new Date().toISOString(),
          },
        };
      }
      
      return fn(...args);
    };
  };
}

// ========================================
// PREDEFINED RATE LIMITERS
// ========================================

/**
 * Contact form rate limiter
 */
export const withContactFormRateLimit = <T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
) => withRateLimit('contact-form', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3, // Max 3 submissions per 15 minutes
})(fn as any) as (...args: T) => Promise<R>;

/**
 * Newsletter subscription rate limiter
 */
export const withNewsletterRateLimit = <T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
) => withRateLimit('newsletter', {
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 2, // Max 2 subscriptions per 5 minutes
})(fn as any) as (...args: T) => Promise<R>;

/**
 * Analytics tracking rate limiter
 */
export const withAnalyticsRateLimit = <T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
) => withRateLimit('analytics', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // Max 100 events per minute
})(fn as any) as (...args: T) => Promise<R>;

/**
 * General API rate limiter
 */
export const withApiRateLimit = <T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
) => withRateLimit('api', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // Max 60 requests per minute
})(fn as any) as (...args: T) => Promise<R>;

// ========================================
// IP-BASED RATE LIMITING
// ========================================

/**
 * IP-based rate limiting middleware
 */
export function withIpRateLimit<T extends unknown[], R>(
  baseKey: string,
  config: RateLimitConfig
) {
  return withAdvancedRateLimit<T, R>(baseKey, {
    ...config,
    keyGenerator: () => {
      // In a real implementation, extract IP from headers
      // const headers = await headers();
      // const ip = headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown';
      // return `${baseKey}:${ip}`;
      return `${baseKey}:unknown-ip`;
    },
  });
}

/**
 * User-based rate limiting middleware
 */
export function withUserRateLimit<T extends unknown[], R>(
  baseKey: string,
  config: RateLimitConfig
) {
  return withAdvancedRateLimit<T, R>(baseKey, {
    ...config,
    keyGenerator: (..._args) => {
      // Extract user ID from arguments or auth context
      // This would typically be injected by auth middleware
      const userId = 'anonymous'; // Placeholder
      return `${baseKey}:user:${userId}`;
    },
  });
}

// ========================================
// COMPOSITE MIDDLEWARE
// ========================================

/**
 * Combine multiple rate limiters
 */
export function withMultipleRateLimits<T extends unknown[], R>(
  limiters: Array<(fn: (...args: T) => Promise<R>) => (...args: T) => Promise<R>>
) {
  return (fn: (...args: T) => Promise<R>) => {
    return limiters.reduce((wrappedFn, limiter) => limiter(wrappedFn), fn);
  };
}
