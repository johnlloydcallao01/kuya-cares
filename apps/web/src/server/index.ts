/**
 * @file apps/web/src/server/index.ts
 * @description Server-side exports for the Web App
 * 
 * This file serves as the main entry point for all server-side functionality
 * specific to the web application. It re-exports server actions, utilities,
 * and services that are used throughout the web app.
 */

import 'server-only';

// ========================================
// SERVER ACTIONS
// ========================================

// Contact form server actions
export {
  submitContactForm,
  type ContactFormSubmission,
} from './actions/contact-actions';



// Analytics server actions
export {
  trackPageView,
  trackEvent,
  trackConversion,
} from './actions/analytics-actions';

// ========================================
// MIDDLEWARE
// ========================================



// Rate limiting middleware
export {
  withRateLimit,
  withAdvancedRateLimit,
  withRateLimitResult,
  withContactFormRateLimit,

  withAnalyticsRateLimit,
  withApiRateLimit,
  withIpRateLimit,
  withUserRateLimit,
  withMultipleRateLimits,
  type RateLimitOptions,
} from './middleware/rate-limit-middleware';

// Validation middleware
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
} from './middleware/validation-middleware';

// Composite middleware
export {
  compose,
  createPipeline,
  withWebAppDefaults,
  withContactFormDefaults,
  withNewsletterDefaults,
  withAnalyticsDefaults,
} from './middleware';

// ========================================
// VALIDATORS
// ========================================

// Contact form validators
export {
  ContactFormSchema,
  ContactSubmissionMetaSchema,
  LeadQualificationSchema,
  ContactFormResponseSchema,
  validateContactForm,
  validateContactMeta,
  validateLeadQualification,
  type ContactFormData,
  type ContactSubmissionMeta,
  type LeadQualification,
  type ContactFormResponse,
} from './validators/contact-schemas';

// Newsletter validators
export {
  NewsletterSubscriptionSchema,
  NewsletterUnsubscribeSchema,
  NewsletterPreferenceSchema,
  validateNewsletterSubscription,
  validateNewsletterUnsubscribe,
  validateNewsletterPreferences,
  type NewsletterSubscriptionData,
  type NewsletterUnsubscribeData,
  type NewsletterPreferenceData,
} from './validators/newsletter-schemas';

// Analytics validators
export {
  BaseAnalyticsEventSchema,
  PageViewEventSchema,
  ClickEventSchema,
  FormSubmissionEventSchema,
  ConversionEventSchema,
  ErrorEventSchema,
  AnalyticsEventSchema,
  validateAnalyticsEvent,
  validateCampaignTracking,
  validatePerformanceMetrics,
  type BaseAnalyticsEvent,
  type PageViewEvent,
  type ClickEvent,
  type FormSubmissionEvent,
  type ErrorEvent,
  type AnalyticsEvent,
} from './validators/analytics-schemas';

// Common validators
export {
  EmailSchema,
  PhoneSchema,
  UUIDSchema,
  URLSchema,
  SlugSchema,
  NameSchema,
  PasswordSchema,
  validateSchema,
  validateMultipleSchemas,
  type Email,
  type Phone,
  type UUID,
  type URL,
  type Slug,
  type Name,
  type Password,
} from './validators';

// ========================================
// SERVER UTILITIES
// ========================================

// Server-side utilities
export {
  validateServerRequest,
  sanitizeUserInput,
  formatServerResponse,
  handleServerError,
} from './utils/server-utils';

// Rate limiting utilities
export {
  checkRateLimit,
  createRateLimiter,
  type RateLimitConfig,
} from './utils/rate-limit';

// ========================================
// SERVER SERVICES
// ========================================

// Product category service
export {
  ProductCategoryService,
  getProductCategories,
  type ProductCategory,
  type ProductCategoryResponse,
} from './services/product-category-service';

// Merchant service
export {
  MerchantService,
  getMerchants,
  getMerchantCount,
  getMerchantById,
  type Merchant,
  type MerchantServiceOptions,
  type MerchantsResponse,
} from './services/merchant-service';

// Lead qualification service (web-specific business logic)
export {
  LeadQualificationService,
  type LeadScore,
  type LeadQualificationCriteria,
} from './services/lead-qualification-service';

// Marketing analytics service (web-specific analytics)
export {
  MarketingAnalyticsService,
  type MarketingAttribution,
  type ConversionFunnel,
} from './services/marketing-analytics-service';

// ========================================
// SERVER UTILITIES
// ========================================

// SEO utilities (app-specific metadata generation)
export {
  generateWebMetadata,
  generateWebStructuredData,
  generateWebBreadcrumbs,
  type WebSEOMetadata,
} from './utils/seo-utils';

// ========================================
// TYPE EXPORTS
// ========================================

// Re-export common server types
export type {
  ServerActionResult,
  ServerError,
  ValidationError,
} from './types/server-types';
