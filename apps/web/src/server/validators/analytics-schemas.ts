/**
 * @file apps/web/src/server/validators/analytics-schemas.ts
 * @description Validation schemas for analytics tracking operations
 */

import { z } from 'zod';

// ========================================
// ANALYTICS EVENT SCHEMAS
// ========================================

/**
 * Base analytics event schema
 */
export const BaseAnalyticsEventSchema = z.object({
  eventName: z
    .string()
    .min(1, 'Event name is required')
    .max(100, 'Event name too long')
    .regex(/^[a-zA-Z0-9_]+$/, 'Event name can only contain letters, numbers, and underscores'),
  
  timestamp: z
    .string()
    .datetime()
    .optional()
    .default(() => new Date().toISOString()),
  
  sessionId: z
    .string()
    .uuid()
    .optional(),
  
  userId: z
    .string()
    .max(100, 'User ID too long')
    .optional(),
  
  properties: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .default({}),
  
  // Page context
  page: z.object({
    url: z.string().url(),
    title: z.string().max(200, 'Page title too long').optional(),
    referrer: z.string().url().optional(),
    path: z.string().max(500, 'Page path too long'),
  }),
  
  // User context
  user: z.object({
    userAgent: z.string().max(500, 'User agent too long').optional(),
    language: z.string().max(10, 'Language code too long').optional(),
    timezone: z.string().max(50, 'Timezone too long').optional(),
    screenResolution: z.string().regex(/^\d+x\d+$/).optional(),
  }).optional(),
});

/**
 * Page view event schema
 */
export const PageViewEventSchema = BaseAnalyticsEventSchema.extend({
  eventName: z.literal('page_view'),
  properties: z.object({
    category: z.string().max(50).optional(),
    section: z.string().max(50).optional(),
    loadTime: z.number().min(0).optional(),
    scrollDepth: z.number().min(0).max(100).optional(),
  }).optional(),
});

/**
 * Click event schema
 */
export const ClickEventSchema = BaseAnalyticsEventSchema.extend({
  eventName: z.literal('click'),
  properties: z.object({
    elementType: z.enum(['button', 'link', 'image', 'form', 'other']),
    elementText: z.string().max(200).optional(),
    elementId: z.string().max(100).optional(),
    elementClass: z.string().max(200).optional(),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }).optional(),
  }),
});

/**
 * Form submission event schema
 */
export const FormSubmissionEventSchema = BaseAnalyticsEventSchema.extend({
  eventName: z.literal('form_submission'),
  properties: z.object({
    formName: z.string().max(100),
    formType: z.enum(['contact', 'newsletter', 'quote', 'feedback', 'other']),
    fields: z.array(z.string()).optional(),
    completionTime: z.number().min(0).optional(),
    errors: z.array(z.string()).optional(),
  }),
});

/**
 * Conversion event schema
 */
export const ConversionEventSchema = BaseAnalyticsEventSchema.extend({
  eventName: z.literal('conversion'),
  properties: z.object({
    conversionType: z.enum(['lead', 'signup', 'purchase', 'download', 'demo_request']),
    value: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    campaignId: z.string().max(100).optional(),
    source: z.string().max(100).optional(),
    medium: z.string().max(100).optional(),
  }),
});

/**
 * Error event schema
 */
export const ErrorEventSchema = BaseAnalyticsEventSchema.extend({
  eventName: z.literal('error'),
  properties: z.object({
    errorType: z.enum(['javascript', 'network', 'validation', 'server', 'other']),
    errorMessage: z.string().max(500),
    errorStack: z.string().max(2000).optional(),
    errorCode: z.string().max(50).optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  }),
});

// ========================================
// MARKETING ANALYTICS SCHEMAS
// ========================================

/**
 * Campaign tracking schema
 */
export const CampaignTrackingSchema = z.object({
  campaignId: z.string().max(100),
  source: z.string().max(100),
  medium: z.string().max(100),
  term: z.string().max(100).optional(),
  content: z.string().max(100).optional(),
  timestamp: z.string().datetime(),
  userId: z.string().optional(),
  sessionId: z.string().uuid().optional(),
});

/**
 * Lead scoring event schema
 */
export const LeadScoringEventSchema = z.object({
  userId: z.string(),
  action: z.enum([
    'page_view',
    'form_submission',
    'email_open',
    'email_click',
    'download',
    'demo_request',
    'pricing_view'
  ]),
  score: z.number().min(0).max(100),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

// ========================================
// PERFORMANCE ANALYTICS SCHEMAS
// ========================================

/**
 * Performance metrics schema
 */
export const PerformanceMetricsSchema = z.object({
  url: z.string().url(),
  metrics: z.object({
    // Core Web Vitals
    lcp: z.number().min(0).optional(), // Largest Contentful Paint
    fid: z.number().min(0).optional(), // First Input Delay
    cls: z.number().min(0).optional(), // Cumulative Layout Shift
    
    // Other performance metrics
    ttfb: z.number().min(0).optional(), // Time to First Byte
    fcp: z.number().min(0).optional(),  // First Contentful Paint
    domContentLoaded: z.number().min(0).optional(),
    loadComplete: z.number().min(0).optional(),
  }),
  timestamp: z.string().datetime(),
  userAgent: z.string().optional(),
  connection: z.object({
    effectiveType: z.enum(['slow-2g', '2g', '3g', '4g']).optional(),
    downlink: z.number().optional(),
    rtt: z.number().optional(),
  }).optional(),
});

// ========================================
// UNION SCHEMAS
// ========================================

/**
 * All analytics events union schema
 */
export const AnalyticsEventSchema = z.discriminatedUnion('eventName', [
  PageViewEventSchema,
  ClickEventSchema,
  FormSubmissionEventSchema,
  ConversionEventSchema,
  ErrorEventSchema,
]);

// ========================================
// TYPE EXPORTS
// ========================================

export type BaseAnalyticsEvent = z.infer<typeof BaseAnalyticsEventSchema>;
export type PageViewEvent = z.infer<typeof PageViewEventSchema>;
export type ClickEvent = z.infer<typeof ClickEventSchema>;
export type FormSubmissionEvent = z.infer<typeof FormSubmissionEventSchema>;
export type ConversionEvent = z.infer<typeof ConversionEventSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;
export type CampaignTracking = z.infer<typeof CampaignTrackingSchema>;
export type LeadScoringEvent = z.infer<typeof LeadScoringEventSchema>;
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

// ========================================
// VALIDATION FUNCTIONS
// ========================================

/**
 * Validate analytics event data
 */
export function validateAnalyticsEvent(data: unknown) {
  return AnalyticsEventSchema.safeParse(data);
}

/**
 * Validate campaign tracking data
 */
export function validateCampaignTracking(data: unknown) {
  return CampaignTrackingSchema.safeParse(data);
}

/**
 * Validate performance metrics
 */
export function validatePerformanceMetrics(data: unknown) {
  return PerformanceMetricsSchema.safeParse(data);
}

/**
 * Validate lead scoring event
 */
export function validateLeadScoringEvent(data: unknown) {
  return LeadScoringEventSchema.safeParse(data);
}

// ========================================
// CUSTOM VALIDATORS
// ========================================

/**
 * Event rate limiting validator
 */
export const eventRateLimitValidator = z
  .object({
    eventName: z.string(),
    sessionId: z.string().optional(),
    timestamp: z.string().datetime(),
  })
  .refine(
    async (_data) => {
      // In a real implementation, check if this event type
      // has been sent too frequently from this session
      return true;
    },
    'Event rate limit exceeded'
  );

// ========================================
// SCHEMA TRANSFORMERS
// ========================================

/**
 * Transform analytics event for storage
 */
export const AnalyticsStorageSchema = AnalyticsEventSchema.transform((data) => ({
  ...data,
  id: crypto.randomUUID(),
  receivedAt: new Date().toISOString(),
  processed: false,
}));

/**
 * Transform analytics event for external services
 */
export const AnalyticsExternalSchema = AnalyticsEventSchema.transform((data) => ({
  event: data.eventName,
  timestamp: data.timestamp,
  properties: {
    ...data.properties,
    page_url: data.page.url,
    page_title: data.page.title,
    page_path: data.page.path,
    referrer: data.page.referrer,
    user_agent: data.user?.userAgent,
    language: data.user?.language,
    timezone: data.user?.timezone,
  },
  user_id: data.userId,
  session_id: data.sessionId,
}));
