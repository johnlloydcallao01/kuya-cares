/**
 * @file apps/web/src/server/validators/common-schemas.ts
 * @description Common validation schemas shared across the web app
 */

import { z } from 'zod';

// ========================================
// PRIMITIVE VALIDATORS
// ========================================

/**
 * Email validation schema
 */
export const EmailSchema = z
  .string()
  .email('Invalid email address')
  .max(254, 'Email address too long')
  .transform(val => val.toLowerCase().trim());

/**
 * Phone number validation schema
 */
export const PhoneSchema = z
  .string()
  .regex(/^[+]?[1-9][\d\s\-()]{0,15}$/, 'Invalid phone number format')
  .transform(val => val.replace(/[\s\-()]/g, ''));

/**
 * UUID validation schema
 */
export const UUIDSchema = z
  .string()
  .uuid('Invalid UUID format');

/**
 * URL validation schema
 */
export const URLSchema = z
  .string()
  .url('Invalid URL format')
  .max(2048, 'URL too long');

/**
 * Slug validation schema
 */
export const SlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format')
  .min(1, 'Slug cannot be empty')
  .max(100, 'Slug too long');

/**
 * Name validation schema
 */
export const NameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name too long')
  .regex(/^[a-zA-Z\s'.-]+$/, 'Name contains invalid characters')
  .transform(val => val.trim());

/**
 * Password validation schema
 */
export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number');

// ========================================
// DATE AND TIME VALIDATORS
// ========================================

/**
 * ISO datetime validation schema
 */
export const DateTimeSchema = z
  .string()
  .datetime('Invalid datetime format');

/**
 * Date validation schema (YYYY-MM-DD)
 */
export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');

/**
 * Time validation schema (HH:MM)
 */
export const TimeSchema = z
  .string()
  .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)');

/**
 * Timezone validation schema
 */
export const TimezoneSchema = z
  .string()
  .regex(/^[A-Za-z_]+\/[A-Za-z_]+$/, 'Invalid timezone format');

// ========================================
// GEOGRAPHIC VALIDATORS
// ========================================

/**
 * Country code validation schema (ISO 3166-1 alpha-2)
 */
export const CountryCodeSchema = z
  .string()
  .length(2, 'Country code must be 2 characters')
  .regex(/^[A-Z]{2}$/, 'Country code must be uppercase letters');

/**
 * Language code validation schema (ISO 639-1)
 */
export const LanguageCodeSchema = z
  .string()
  .length(2, 'Language code must be 2 characters')
  .regex(/^[a-z]{2}$/, 'Language code must be lowercase letters');

/**
 * Postal code validation schema
 */
export const PostalCodeSchema = z
  .string()
  .min(3, 'Postal code too short')
  .max(10, 'Postal code too long')
  .regex(/^[A-Za-z0-9\s-]+$/, 'Invalid postal code format');

// ========================================
// CONTENT VALIDATORS
// ========================================

/**
 * HTML content validation schema
 */
export const HTMLContentSchema = z
  .string()
  .max(50000, 'Content too long')
  .refine(
    (val) => {
      // Basic HTML validation - no script tags
      return !/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(val);
    },
    'Script tags are not allowed'
  );

/**
 * Plain text content validation schema
 */
export const PlainTextSchema = z
  .string()
  .max(10000, 'Text too long')
  .transform(val => val.trim());

/**
 * Markdown content validation schema
 */
export const MarkdownSchema = z
  .string()
  .max(50000, 'Markdown content too long');

// ========================================
// METADATA VALIDATORS
// ========================================

/**
 * SEO metadata validation schema
 */
export const SEOMetadataSchema = z.object({
  title: z.string().min(1).max(60, 'Title too long'),
  description: z.string().min(1).max(160, 'Description too long'),
  keywords: z.array(z.string().max(50)).max(10, 'Too many keywords').optional(),
  canonicalUrl: URLSchema.optional(),
  noIndex: z.boolean().optional().default(false),
  noFollow: z.boolean().optional().default(false),
});

/**
 * Open Graph metadata validation schema
 */
export const OpenGraphSchema = z.object({
  title: z.string().max(95, 'OG title too long'),
  description: z.string().max(297, 'OG description too long'),
  image: URLSchema.optional(),
  imageAlt: z.string().max(100, 'Image alt text too long').optional(),
  type: z.enum(['website', 'article', 'product']).default('website'),
  siteName: z.string().max(50, 'Site name too long').optional(),
});

// ========================================
// PAGINATION VALIDATORS
// ========================================

/**
 * Pagination parameters validation schema
 */
export const PaginationSchema = z.object({
  page: z
    .number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .max(1000, 'Page number too high')
    .default(1),
  
  limit: z
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(10),
  
  sortBy: z
    .string()
    .max(50, 'Sort field name too long')
    .optional(),
  
  sortOrder: z
    .enum(['asc', 'desc'])
    .default('desc'),
});

/**
 * Search parameters validation schema
 */
export const SearchSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query cannot be empty')
    .max(200, 'Search query too long')
    .transform(val => val.trim()),
  
  filters: z
    .record(z.union([z.string(), z.array(z.string())]))
    .optional(),
  
  ...PaginationSchema.shape,
});

// ========================================
// FILE VALIDATORS
// ========================================

/**
 * File upload validation schema
 */
export const FileUploadSchema = z.object({
  filename: z
    .string()
    .min(1, 'Filename is required')
    .max(255, 'Filename too long')
    .regex(/^[^<>:"/\\|?*]+$/, 'Invalid filename characters'),
  
  mimeType: z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9!#$&_^-]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&_.^-]*$/, 'Invalid MIME type'),
  
  size: z
    .number()
    .int('File size must be an integer')
    .min(1, 'File cannot be empty')
    .max(10 * 1024 * 1024, 'File too large (max 10MB)'),
  
  checksum: z
    .string()
    .regex(/^[a-f0-9]{64}$/, 'Invalid SHA-256 checksum')
    .optional(),
});

/**
 * Image file validation schema
 */
export const ImageFileSchema = FileUploadSchema.extend({
  mimeType: z
    .string()
    .regex(/^image\/(jpeg|jpg|png|gif|webp)$/, 'Invalid image format'),
  
  dimensions: z.object({
    width: z.number().int().min(1).max(4096),
    height: z.number().int().min(1).max(4096),
  }).optional(),
});

// ========================================
// SECURITY VALIDATORS
// ========================================

/**
 * CSRF token validation schema
 */
export const CSRFTokenSchema = z
  .string()
  .min(32, 'CSRF token too short')
  .max(128, 'CSRF token too long')
  .regex(/^[a-zA-Z0-9+/=]+$/, 'Invalid CSRF token format');

/**
 * API key validation schema
 */
export const APIKeySchema = z
  .string()
  .min(32, 'API key too short')
  .max(128, 'API key too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid API key format');

/**
 * JWT token validation schema
 */
export const JWTTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, 'Invalid JWT format');

// ========================================
// TYPE EXPORTS
// ========================================

export type Email = z.infer<typeof EmailSchema>;
export type Phone = z.infer<typeof PhoneSchema>;
export type UUID = z.infer<typeof UUIDSchema>;
export type URL = z.infer<typeof URLSchema>;
export type Slug = z.infer<typeof SlugSchema>;
export type Name = z.infer<typeof NameSchema>;
export type Password = z.infer<typeof PasswordSchema>;
export type DateTime = z.infer<typeof DateTimeSchema>;
export type Date = z.infer<typeof DateSchema>;
export type Time = z.infer<typeof TimeSchema>;
export type Timezone = z.infer<typeof TimezoneSchema>;
export type CountryCode = z.infer<typeof CountryCodeSchema>;
export type LanguageCode = z.infer<typeof LanguageCodeSchema>;
export type PostalCode = z.infer<typeof PostalCodeSchema>;
export type SEOMetadata = z.infer<typeof SEOMetadataSchema>;
export type OpenGraph = z.infer<typeof OpenGraphSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type Search = z.infer<typeof SearchSchema>;
export type FileUpload = z.infer<typeof FileUploadSchema>;
export type ImageFile = z.infer<typeof ImageFileSchema>;

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Create a nullable version of any schema
 */
export function nullable<T extends z.ZodTypeAny>(schema: T) {
  return z.union([schema, z.null()]);
}

/**
 * Create an optional version of any schema
 */
export function optional<T extends z.ZodTypeAny>(schema: T) {
  return schema.optional();
}

/**
 * Create an array version of any schema
 */
export function arrayOf<T extends z.ZodTypeAny>(schema: T, min = 0, max = 100) {
  return z.array(schema).min(min).max(max);
}
