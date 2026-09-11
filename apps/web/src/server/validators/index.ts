/**
 * @file apps/web/src/server/validators/index.ts
 * @description Validation schema exports for the Web App server
 */

// ========================================
// CONTACT FORM VALIDATORS
// ========================================

export {
  ContactFormSchema,
  ContactSubmissionMetaSchema,
  LeadQualificationSchema,
  ContactFormResponseSchema,
  PartialContactFormSchema,
  InternalContactFormSchema,
  ContactFormStorageSchema,
  ContactFormApiSchema,
  validateContactForm,
  validateContactMeta,
  validateLeadQualification,
  emailDomainValidator,
  businessEmailValidator,
  internationalPhoneValidator,
  type ContactFormData,
  type ContactSubmissionMeta,
  type LeadQualification,
  type ContactFormResponse,
} from './contact-schemas';

// ========================================
// NEWSLETTER VALIDATORS
// ========================================

export {
  NewsletterSubscriptionSchema,
  NewsletterUnsubscribeSchema,
  NewsletterPreferenceSchema,
  NewsletterCampaignSchema,
  SubscriberSchema,
  BulkSubscriberImportSchema,
  NewsletterStorageSchema,
  NewsletterConfirmationSchema,
  validateNewsletterSubscription,
  validateNewsletterUnsubscribe,
  validateNewsletterPreferences,
  validateBulkSubscriberImport,
  whitelistedEmailValidator,
  corporateEmailValidator,
  type NewsletterSubscriptionData,
  type NewsletterUnsubscribeData,
  type NewsletterPreferenceData,
  type NewsletterCampaignData,
  type SubscriberData,
  type BulkSubscriberImportData,
} from './newsletter-schemas';

// ========================================
// ANALYTICS VALIDATORS
// ========================================

export {
  BaseAnalyticsEventSchema,
  PageViewEventSchema,
  ClickEventSchema,
  FormSubmissionEventSchema,
  ConversionEventSchema,
  ErrorEventSchema,
  AnalyticsEventSchema,
  CampaignTrackingSchema,
  LeadScoringEventSchema,
  PerformanceMetricsSchema,
  AnalyticsStorageSchema,
  AnalyticsExternalSchema,
  validateAnalyticsEvent,
  validateCampaignTracking,
  validatePerformanceMetrics,
  validateLeadScoringEvent,
  eventRateLimitValidator,
  type BaseAnalyticsEvent,
  type PageViewEvent,
  type ClickEvent,
  type FormSubmissionEvent,
  type ConversionEvent,
  type ErrorEvent,
  type AnalyticsEvent,
  type CampaignTracking,
  type LeadScoringEvent,
  type PerformanceMetrics,
} from './analytics-schemas';

// ========================================
// USER REGISTRATION VALIDATORS
// ========================================

export {
  PersonalInformationSchema,
  ContactInformationSchema,
  UsernamePasswordSchema,
  MarketingSchema,
  EmergencyContactSchema,
  UserRegistrationSchema,
  FlatUserRegistrationSchema,
  validateUserRegistration,
  transformToStructuredRegistration,
  type PersonalInformationData,
  type ContactInformationData,
  type UsernamePasswordData,
  type MarketingData,
  type EmergencyContactData,
  type UserRegistrationData,
  type FlatUserRegistrationData,
} from './user-registration-schemas';

// ========================================
// COMMON VALIDATORS
// ========================================

export {
  EmailSchema,
  PhoneSchema,
  UUIDSchema,
  URLSchema,
  SlugSchema,
  NameSchema,
  PasswordSchema,
  DateTimeSchema,
  DateSchema,
  TimeSchema,
  TimezoneSchema,
  CountryCodeSchema,
  LanguageCodeSchema,
  PostalCodeSchema,
  HTMLContentSchema,
  PlainTextSchema,
  MarkdownSchema,
  SEOMetadataSchema,
  OpenGraphSchema,
  PaginationSchema,
  SearchSchema,
  FileUploadSchema,
  ImageFileSchema,
  CSRFTokenSchema,
  APIKeySchema,
  JWTTokenSchema,
  nullable,
  optional,
  arrayOf,
  type Email,
  type Phone,
  type UUID,
  type URL,
  type Slug,
  type Name,
  type Password,
  type DateTime,
  type Date,
  type Time,
  type Timezone,
  type CountryCode,
  type LanguageCode,
  type PostalCode,
  type SEOMetadata,
  type OpenGraph,
  type Pagination,
  type Search,
  type FileUpload,
  type ImageFile,
} from './common-schemas';

// ========================================
// VALIDATION UTILITIES
// ========================================

import { z } from 'zod';
import type { ValidationError } from '../types/server-types';

/**
 * Generic validation function that returns a consistent format
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: boolean; data?: T; errors?: ValidationError[] } {
  try {
    const validatedData = schema.parse(data);
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: ValidationError[] = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));
      
      return {
        success: false,
        errors,
      };
    }
    
    return {
      success: false,
      errors: [{
        field: 'unknown',
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
      }],
    };
  }
}

/**
 * Validate multiple schemas at once
 */
export function validateMultipleSchemas<T1, T2>(
  schema1: z.ZodSchema<T1>,
  data1: unknown,
  schema2: z.ZodSchema<T2>,
  data2: unknown
): { 
  success: boolean; 
  data?: { data1: T1; data2: T2 }; 
  errors?: ValidationError[] 
} {
  const result1 = validateSchema(schema1, data1);
  const result2 = validateSchema(schema2, data2);
  
  const allErrors = [
    ...(result1.errors || []),
    ...(result2.errors || []),
  ];
  
  if (allErrors.length > 0) {
    return {
      success: false,
      errors: allErrors,
    };
  }
  
  return {
    success: true,
    data: {
      data1: result1.data!,
      data2: result2.data!,
    },
  };
}

/**
 * Create a partial version of any schema
 */
export function createPartialSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodObject<{ [K in keyof T]: z.ZodOptional<T[K]> }> {
  return schema.partial();
}

/**
 * Create a pick version of any schema
 * TODO: Fix TypeScript issues with complex generic constraints
 */
// export function createPickSchema<T extends z.ZodRawShape, K extends keyof T>(
//   schema: z.ZodObject<T>,
//   keys: K[]
// ): z.ZodObject<Pick<T, K>> {
//   return schema.pick(Object.fromEntries(keys.map(key => [key, true])) as Record<K, true>);
// }

/**
 * Create an omit version of any schema
 * TODO: Fix TypeScript issues with complex generic constraints
 */
// export function createOmitSchema<T extends z.ZodRawShape, K extends keyof T>(
//   schema: z.ZodObject<T>,
//   keys: K[]
// ): z.ZodObject<Omit<T, K>> {
//   return schema.omit(Object.fromEntries(keys.map(key => [key, true])) as Record<K, true>);
// }

// ========================================
// SCHEMA COMPOSITION HELPERS
// ========================================

/**
 * Merge two schemas together
 * TODO: Fix TypeScript issues with complex generic constraints
 */
// export function mergeSchemas<T extends z.ZodRawShape, U extends z.ZodRawShape>(
//   schema1: z.ZodObject<T>,
//   schema2: z.ZodObject<U>
// ): z.ZodObject<T & U> {
//   return schema1.merge(schema2);
// }

/**
 * Extend a schema with additional fields
 * TODO: Fix TypeScript issues with complex generic constraints
 */
// export function extendSchema<T extends z.ZodRawShape, U extends z.ZodRawShape>(
//   baseSchema: z.ZodObject<T>,
//   extension: U
// ): z.ZodObject<T & U> {
//   return baseSchema.extend(extension);
// }

/**
 * Create a discriminated union schema
 */
export function createDiscriminatedUnion<
  Discriminator extends string,
  Options extends readonly [z.ZodDiscriminatedUnionOption<Discriminator>, ...z.ZodDiscriminatedUnionOption<Discriminator>[]]
>(
  discriminator: Discriminator,
  options: Options
): z.ZodDiscriminatedUnion<Discriminator, Options> {
  return z.discriminatedUnion(discriminator, options);
}
