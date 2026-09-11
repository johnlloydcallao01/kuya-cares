/**
 * @file apps/web/src/server/validators/newsletter-schemas.ts
 * @description Validation schemas for newsletter operations
 */

import { z } from 'zod';

// ========================================
// NEWSLETTER SUBSCRIPTION SCHEMAS
// ========================================

/**
 * Newsletter subscription data validation schema
 */
export const NewsletterSubscriptionSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .max(254, 'Email address too long')
    .transform(val => val.toLowerCase().trim()),
  
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name too long')
    .optional()
    .transform(val => val?.trim()),
  
  lastName: z
    .string()
    .max(50, 'Last name too long')
    .optional()
    .transform(val => val?.trim()),
  
  preferences: z
    .array(z.enum([
      'weekly_digest',
      'product_updates',
      'marketing_tips',
      'case_studies',
      'industry_news',
      'special_offers'
    ]))
    .default(['weekly_digest']),

  source: z
    .string()
    .max(50, 'Source identifier too long')
    .default('website'),
  
  // GDPR consent
  gdprConsent: z
    .boolean()
    .refine(val => val === true, 'GDPR consent is required'),
  
  // Double opt-in confirmation
  doubleOptIn: z
    .boolean()
    .default(true),

  // Honeypot field for spam protection
  website: z
    .string()
    .max(0, 'Spam detected')
    .default(''),
});

/**
 * Newsletter unsubscription schema
 */
export const NewsletterUnsubscribeSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .transform(val => val.toLowerCase().trim()),
  
  token: z
    .string()
    .min(1, 'Unsubscribe token is required'),
  
  reason: z
    .enum([
      'too_frequent',
      'not_relevant',
      'never_subscribed',
      'technical_issues',
      'other'
    ])
    .optional(),
  
  feedback: z
    .string()
    .max(500, 'Feedback too long')
    .optional()
    .transform(val => val?.trim()),
});

/**
 * Newsletter preference update schema
 */
export const NewsletterPreferenceSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .transform(val => val.toLowerCase().trim()),
  
  token: z
    .string()
    .min(1, 'Authentication token is required'),
  
  preferences: z
    .array(z.enum([
      'weekly_digest',
      'product_updates',
      'marketing_tips',
      'case_studies',
      'industry_news',
      'special_offers'
    ]))
    .min(1, 'At least one preference must be selected'),
  
  frequency: z
    .enum(['daily', 'weekly', 'monthly'])
    .optional()
    .default('weekly'),
});

// ========================================
// NEWSLETTER CAMPAIGN SCHEMAS
// ========================================

/**
 * Newsletter campaign tracking schema
 */
export const NewsletterCampaignSchema = z.object({
  campaignId: z.string().uuid(),
  email: z.string().email(),
  action: z.enum(['sent', 'opened', 'clicked', 'bounced', 'unsubscribed']),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

// ========================================
// SUBSCRIBER MANAGEMENT SCHEMAS
// ========================================

/**
 * Subscriber data schema
 */
export const SubscriberSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  status: z.enum(['pending', 'active', 'unsubscribed', 'bounced']),
  preferences: z.array(z.string()),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  source: z.string(),
  subscribedAt: z.string().datetime(),
  confirmedAt: z.string().datetime().optional(),
  unsubscribedAt: z.string().datetime().optional(),
  lastEmailSent: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Bulk subscriber import schema
 */
export const BulkSubscriberImportSchema = z.object({
  subscribers: z.array(z.object({
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    preferences: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  })),
  source: z.string().default('bulk_import'),
  sendWelcomeEmail: z.boolean().default(true),
  requireDoubleOptIn: z.boolean().default(true),
});

// ========================================
// TYPE EXPORTS
// ========================================

export type NewsletterSubscriptionData = z.infer<typeof NewsletterSubscriptionSchema>;
export type NewsletterUnsubscribeData = z.infer<typeof NewsletterUnsubscribeSchema>;
export type NewsletterPreferenceData = z.infer<typeof NewsletterPreferenceSchema>;
export type NewsletterCampaignData = z.infer<typeof NewsletterCampaignSchema>;
export type SubscriberData = z.infer<typeof SubscriberSchema>;
export type BulkSubscriberImportData = z.infer<typeof BulkSubscriberImportSchema>;

// ========================================
// VALIDATION FUNCTIONS
// ========================================

/**
 * Validate newsletter subscription data
 */
export function validateNewsletterSubscription(data: unknown) {
  return NewsletterSubscriptionSchema.safeParse(data);
}

/**
 * Validate newsletter unsubscription data
 */
export function validateNewsletterUnsubscribe(data: unknown) {
  return NewsletterUnsubscribeSchema.safeParse(data);
}

/**
 * Validate newsletter preference update
 */
export function validateNewsletterPreferences(data: unknown) {
  return NewsletterPreferenceSchema.safeParse(data);
}

/**
 * Validate bulk subscriber import
 */
export function validateBulkSubscriberImport(data: unknown) {
  return BulkSubscriberImportSchema.safeParse(data);
}

// ========================================
// CUSTOM VALIDATORS
// ========================================

/**
 * Email domain whitelist validator
 */
export const whitelistedEmailValidator = z
  .string()
  .email()
  .refine(
    (email) => {
      const domain = email.split('@')[1];
      const allowedDomains = process.env.NEWSLETTER_ALLOWED_DOMAINS?.split(',') || [];
      return allowedDomains.length === 0 || allowedDomains.includes(domain);
    },
    'Email domain not allowed'
  );

/**
 * Corporate email validator for B2B newsletters
 */
export const corporateEmailValidator = z
  .string()
  .email()
  .refine(
    (email) => {
      const domain = email.split('@')[1];
      const personalDomains = [
        'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
        'aol.com', 'icloud.com', 'protonmail.com'
      ];
      return !personalDomains.includes(domain);
    },
    'Please use a corporate email address'
  );

// ========================================
// SCHEMA TRANSFORMERS
// ========================================

/**
 * Transform subscription data for storage
 */
export const NewsletterStorageSchema = NewsletterSubscriptionSchema.transform((data) => ({
  ...data,
  id: crypto.randomUUID(),
  status: 'pending' as const,
  subscribedAt: new Date().toISOString(),
  confirmationToken: crypto.randomUUID(),
  unsubscribeToken: crypto.randomUUID(),
}));

/**
 * Transform subscription data for confirmation email
 */
export const NewsletterConfirmationSchema = NewsletterSubscriptionSchema.transform((data) => ({
  email: data.email,
  firstName: data.firstName,
  preferences: data.preferences,
  confirmationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/newsletter/confirm`,
  unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/newsletter/unsubscribe`,
}));
