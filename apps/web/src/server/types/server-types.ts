/**
 * @file apps/web/src/server/types/server-types.ts
 * @description Common server-side type definitions for the Web App
 */

import 'server-only';

// ========================================
// COMMON SERVER TYPES
// ========================================

/**
 * Standard server action result type
 */
export type ServerActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: ServerError;
  message?: string;
};

/**
 * Server error type with detailed information
 */
export type ServerError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
};

/**
 * Validation error type for form submissions
 */
export type ValidationError = {
  field: string;
  message: string;
  code: string;
};

/**
 * Server request context type
 */
export type ServerRequestContext = {
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: string;
  requestId: string;
};

/**
 * Rate limiting configuration
 */
export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
};

/**
 * Form submission data structure
 */
export type FormSubmissionData = {
  id: string;
  type: 'contact' | 'newsletter' | 'quote';
  data: Record<string, unknown>;
  submittedAt: string;
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Analytics event data structure
 */
export type AnalyticsEventData = {
  event: string;
  properties: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  timestamp: string;
};

/**
 * Web page metadata structure
 */
export type WebPageMetadata = {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  canonicalUrl?: string;
  breadcrumbs?: Array<{ name: string; path: string }>;
};
