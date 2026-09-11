/**
 * @file apps/web/src/server/middleware/index.ts
 * @description Middleware exports for the Web App server
 */

// ========================================
// RATE LIMITING MIDDLEWARE
// ========================================

export {
  withRateLimit,
  withAdvancedRateLimit,
  withRateLimitResult,
  withContactFormRateLimit,
  withNewsletterRateLimit,
  withAnalyticsRateLimit,
  withApiRateLimit,
  withIpRateLimit,
  withUserRateLimit,
  withMultipleRateLimits,
  type RateLimitOptions,
} from './rate-limit-middleware';

// ========================================
// VALIDATION MIDDLEWARE
// ========================================

export {
  withValidation,
  withValidationResult,
  withMultipleValidation,
  withConditionalValidation,
  withSanitization,
  withStringSanitization,
  validateData,
  type ValidationOptions,
  type ValidationResult,
} from './validation-middleware';

// ========================================
// COMPOSITE MIDDLEWARE HELPERS
// ========================================

/**
 * Compose multiple middleware functions
 */
export function compose<T extends unknown[], R>(
  ...middlewares: Array<(fn: (...args: T) => Promise<R>) => (...args: T) => Promise<R>>
) {
  return (fn: (...args: T) => Promise<R>) => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), fn);
  };
}

/**
 * Create a middleware pipeline
 */
export function createPipeline<T extends unknown[], R>(
  middlewares: Array<(fn: (...args: T) => Promise<R>) => (...args: T) => Promise<R>>
) {
  return (fn: (...args: T) => Promise<R>) => {
    return compose(...middlewares)(fn);
  };
}

// ========================================
// COMMON MIDDLEWARE COMBINATIONS
// ========================================

/**
 * Standard web app middleware stack
 * TODO: Implement missing middleware functions
 */
export function withWebAppDefaults<T extends unknown[], R>(
  _actionName: string,
  _rateLimitKey: string,
  _rateLimitConfig: { windowMs: number; maxRequests: number }
) {
  // Temporarily disabled until middleware functions are implemented
  return (fn: (...args: T) => Promise<R>) => fn;
  // return compose<T, R>(
  //   withLogging(actionName),
  //   withErrorHandling,
  //   withStringSanitization,
  //   withRateLimit(rateLimitKey, rateLimitConfig)
  // );
}

/**
 * Contact form middleware stack
 * TODO: Implement missing middleware functions
 */
export function withContactFormDefaults<T extends unknown[], R>(
  _actionName: string = 'contact-form'
) {
  // Temporarily disabled until middleware functions are implemented
  return (fn: (...args: T) => Promise<R>) => fn;
  // return compose<T, R>(
  //   withLogging(actionName),
  //   withErrorHandling,
  //   withStringSanitization,
  //   withContactFormRateLimit
  // );
}

/**
 * Newsletter middleware stack
 * TODO: Implement missing middleware functions
 */
export function withNewsletterDefaults<T extends unknown[], R>(
  _actionName: string = 'newsletter'
) {
  // Temporarily disabled until middleware functions are implemented
  return (fn: (...args: T) => Promise<R>) => fn;
  // return compose<T, R>(
  //   withLogging(actionName),
  //   withErrorHandling,
  //   withStringSanitization,
  //   withNewsletterRateLimit
  // );
}

/**
 * Analytics middleware stack
 * TODO: Implement missing middleware functions
 */
export function withAnalyticsDefaults<T extends unknown[], R>(
  _actionName: string = 'analytics'
) {
  // Temporarily disabled until middleware functions are implemented
  return (fn: (...args: T) => Promise<R>) => fn;
  // return compose<T, R>(
  //   withLogging(actionName),
  //   withErrorHandling,
  //   withAnalyticsRateLimit
  // );
}
