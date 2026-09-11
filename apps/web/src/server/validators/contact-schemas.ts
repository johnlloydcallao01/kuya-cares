/**
 * @file apps/web/src/server/validators/contact-schemas.ts
 * @description Validation schemas for contact form operations
 */

import { z } from 'zod';

// ========================================
// CONTACT FORM SCHEMAS
// ========================================

/**
 * Contact form data validation schema
 */
export const ContactFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s'.-]+$/, 'Name contains invalid characters'),
  
  email: z
    .string()
    .email('Invalid email address')
    .max(254, 'Email address too long'),
  
  company: z
    .string()
    .max(100, 'Company name too long')
    .optional()
    .transform(val => val?.trim() || undefined),
  
  phone: z
    .string()
    .regex(/^[+]?[1-9][\d\s\-()]{0,15}$/, 'Invalid phone number format')
    .optional()
    .transform(val => val?.replace(/[\s\-()]/g, '') || undefined),
  
  subject: z
    .string()
    .min(5, 'Subject must be at least 5 characters')
    .max(200, 'Subject must be less than 200 characters'),
  
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message must be less than 2000 characters'),
  
  source: z
    .string()
    .max(50, 'Source identifier too long')
    .default('website'),

  // Honeypot field for spam protection
  website: z
    .string()
    .max(0, 'Spam detected')
    .default(''),

  // GDPR consent
  gdprConsent: z
    .boolean()
    .refine(val => val === true, 'GDPR consent is required'),

  // Marketing consent (optional)
  marketingConsent: z
    .boolean()
    .default(false),
});

/**
 * Contact form submission metadata schema
 */
export const ContactSubmissionMetaSchema = z.object({
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  referrer: z.string().url().optional(),
  timestamp: z.string().datetime(),
  sessionId: z.string().uuid().optional(),
});

/**
 * Lead qualification data schema
 */
export const LeadQualificationSchema = z.object({
  score: z.number().min(0).max(100),
  category: z.enum(['hot', 'warm', 'cold', 'spam']),
  factors: z.array(z.object({
    name: z.string(),
    weight: z.number(),
    value: z.unknown(),
  })),
  confidence: z.number().min(0).max(1),
});

// ========================================
// CONTACT RESPONSE SCHEMAS
// ========================================

/**
 * Contact form response schema
 */
export const ContactFormResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['received', 'processing', 'completed', 'failed']),
  message: z.string(),
  estimatedResponseTime: z.string().optional(),
  referenceNumber: z.string().optional(),
});

// ========================================
// TYPE EXPORTS
// ========================================

// Explicit type definition to ensure non-optional fields with defaults
export type ContactFormData = {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  subject: string;
  message: string;
  source: string;
  website: string;
  gdprConsent: boolean;
  marketingConsent: boolean;
};
export type ContactSubmissionMeta = z.infer<typeof ContactSubmissionMetaSchema>;
export type LeadQualification = z.infer<typeof LeadQualificationSchema>;
export type ContactFormResponse = z.infer<typeof ContactFormResponseSchema>;

// ========================================
// VALIDATION FUNCTIONS
// ========================================

/**
 * Validate contact form data with custom error messages
 */
export function validateContactForm(data: unknown) {
  return ContactFormSchema.safeParse(data);
}

/**
 * Validate contact submission metadata
 */
export function validateContactMeta(data: unknown) {
  return ContactSubmissionMetaSchema.safeParse(data);
}

/**
 * Validate lead qualification data
 */
export function validateLeadQualification(data: unknown) {
  return LeadQualificationSchema.safeParse(data);
}

// ========================================
// PARTIAL SCHEMAS
// ========================================

/**
 * Partial contact form schema for updates
 */
export const PartialContactFormSchema = ContactFormSchema.partial();

/**
 * Contact form schema without GDPR (for internal use)
 */
export const InternalContactFormSchema = ContactFormSchema.omit({
  gdprConsent: true,
  marketingConsent: true,
  website: true,
});

// ========================================
// CUSTOM VALIDATORS
// ========================================

/**
 * Custom email domain validator
 */
export const emailDomainValidator = z
  .string()
  .email()
  .refine(
    (email) => {
      const domain = email.split('@')[1];
      const blockedDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
      return !blockedDomains.includes(domain);
    },
    'Temporary email addresses are not allowed'
  );

/**
 * Business email validator
 */
export const businessEmailValidator = z
  .string()
  .email()
  .refine(
    (email) => {
      const domain = email.split('@')[1];
      const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
      return !personalDomains.includes(domain);
    },
    'Please use a business email address'
  );

/**
 * Phone number with country code validator
 */
export const internationalPhoneValidator = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must include country code (+1234567890)');

// ========================================
// SCHEMA TRANSFORMERS
// ========================================

/**
 * Transform contact form data for storage
 */
export const ContactFormStorageSchema = ContactFormSchema.transform((data) => ({
  ...data,
  name: data.name.trim(),
  email: data.email.toLowerCase().trim(),
  company: data.company?.trim() || null,
  phone: data.phone?.replace(/[\s\-()]/g, '') || null,
  subject: data.subject.trim(),
  message: data.message.trim(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

/**
 * Transform contact form data for API response
 */
export const ContactFormApiSchema = ContactFormSchema.omit({
  website: true,
  gdprConsent: true,
}).transform((data) => ({
  ...data,
  id: crypto.randomUUID(),
  status: 'received' as const,
  submittedAt: new Date().toISOString(),
}));
