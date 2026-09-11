/**
 * @file packages/client-services/src/validators/user-registration-schemas.ts
 * @description User registration validation schemas
 */

import { z } from 'zod';
import { EmailSchema, PhoneSchema, PasswordSchema, DateSchema } from './common-schemas';

// ========================================
// PERSONAL INFORMATION SCHEMA
// ========================================

export const PersonalInformationSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name too long')
    .regex(/^[a-zA-Z\s'.-]+$/, 'First name contains invalid characters')
    .transform(val => val.trim()),
  middleName: z
    .string()
    .max(100, 'Middle name too long')
    .regex(/^[a-zA-Z\s'.-]*$/, 'Middle name contains invalid characters')
    .optional()
    .transform(val => val?.trim()),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name too long')
    .regex(/^[a-zA-Z\s'.-]+$/, 'Last name contains invalid characters')
    .transform(val => val.trim()),
  nameExtension: z
    .string()
    .max(10, 'Name extension too long')
    .optional()
    .transform(val => val?.trim()),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  civilStatus: z.enum(['single', 'married', 'divorced', 'widowed', 'separated']),
  srn: z
    .string()
    .min(1, 'SRN is required')
    .max(50, 'SRN too long')
    .regex(/^[A-Z0-9-]+$/, 'SRN must contain only uppercase letters, numbers, and hyphens'),
  nationality: z
    .string()
    .min(1, 'Nationality is required')
    .max(100, 'Nationality too long'),
  birthDate: DateSchema.refine(
    (date) => {
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      return age >= 16 && age <= 100;
    },
    'Must be between 16 and 100 years old'
  ),
  placeOfBirth: z
    .string()
    .min(1, 'Place of birth is required')
    .max(200, 'Place of birth too long'),
  completeAddress: z
    .string()
    .min(10, 'Complete address is required')
    .max(500, 'Address too long'),
  // Add these missing fields to match web schema usage
  emergencyFirstName: z.string().optional(),
  emergencyMiddleName: z.string().optional(),
  emergencyLastName: z.string().optional(),
  emergencyContactNumber: z.string().optional(),
  emergencyRelationship: z.string().optional(),
  emergencyCompleteAddress: z.string().optional(),
});

// ========================================
// CONTACT INFORMATION SCHEMA
// ========================================

export const ContactInformationSchema = z.object({
  email: EmailSchema,
  phoneNumber: PhoneSchema,
});

// ========================================
// USERNAME & PASSWORD SCHEMA
// ========================================

export const UsernamePasswordSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  password: PasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// ========================================
// MARKETING SCHEMA
// ========================================
export const MarketingSchema = z.object({
    couponCode: z.string().optional(),
    referralSource: z.string().optional(),
    agreeToTerms: z.literal(true),
});

// Combined Schema
export const UserRegistrationSchema = PersonalInformationSchema
    .merge(ContactInformationSchema)
    .merge(UsernamePasswordSchema)
    .merge(MarketingSchema);

export type UserRegistrationData = z.infer<typeof UserRegistrationSchema>;
export type FlatUserRegistrationData = UserRegistrationData; // Alias for consistency

// Validation helper
export const validateUserRegistration = (data: unknown) => {
    return UserRegistrationSchema.safeParse(data);
};
