/**
 * @file packages/client-services/src/validators/common-schemas.ts
 * @description Common validation schemas shared across apps
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
