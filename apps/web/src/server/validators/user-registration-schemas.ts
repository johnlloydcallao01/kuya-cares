/**
 * @file apps/web/src/server/validators/user-registration-schemas.ts
 * @description User registration validation schemas for comprehensive signup form
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
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say'], {
    errorMap: () => ({ message: 'Please select a gender' })
  }),
  civilStatus: z.enum(['single', 'married', 'divorced', 'widowed', 'separated'], {
    errorMap: () => ({ message: 'Please select civil status' })
  }),
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
  couponCode: z
    .string()
    .max(50, 'Coupon code too long')
    .optional()
    .transform(val => val?.trim().toUpperCase()),
});

// ========================================
// EMERGENCY CONTACT SCHEMA
// ========================================

export const EmergencyContactSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Emergency contact first name is required')
    .max(100, 'Emergency contact first name too long')
    .regex(/^[a-zA-Z\s'.-]+$/, 'Emergency contact first name contains invalid characters')
    .transform(val => val.trim()),
  middleName: z
    .string()
    .max(100, 'Emergency contact middle name too long')
    .regex(/^[a-zA-Z\s'.-]*$/, 'Emergency contact middle name contains invalid characters')
    .optional()
    .transform(val => val?.trim()),
  lastName: z
    .string()
    .min(1, 'Emergency contact last name is required')
    .max(100, 'Emergency contact last name too long')
    .regex(/^[a-zA-Z\s'.-]+$/, 'Emergency contact last name contains invalid characters')
    .transform(val => val.trim()),
  contactNumber: PhoneSchema,
  relationship: z
    .string()
    .min(1, 'Relationship is required')
    .max(50, 'Relationship too long'),
  completeAddress: z
    .string()
    .min(10, 'Emergency contact address is required')
    .max(500, 'Address too long'),
});

// ========================================
// COMPREHENSIVE REGISTRATION SCHEMA
// ========================================

export const UserRegistrationSchema = z.object({
  personalInformation: PersonalInformationSchema,
  contactInformation: ContactInformationSchema,
  usernamePassword: UsernamePasswordSchema,
  marketing: MarketingSchema,
  emergencyContact: EmergencyContactSchema,
  agreeToTerms: z
    .boolean()
    .refine(val => val === true, 'You must agree to the terms and conditions'),
});

// ========================================
// FLATTENED REGISTRATION SCHEMA
// ========================================
// For easier form handling, we also provide a flattened version

export const FlatUserRegistrationSchema = z.object({
  // Personal Information
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
  
  // Contact Information
  email: EmailSchema,
  phoneNumber: PhoneSchema,
  
  // Username & Password
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  password: PasswordSchema,
  confirmPassword: z.string(),
  
  // Marketing
  couponCode: z
    .string()
    .max(50, 'Coupon code too long')
    .optional()
    .transform(val => val?.trim().toUpperCase()),
  
  // Emergency Contact
  emergencyFirstName: z
    .string()
    .min(1, 'Emergency contact first name is required')
    .max(100, 'Emergency contact first name too long')
    .regex(/^[a-zA-Z\s'.-]+$/, 'Emergency contact first name contains invalid characters')
    .transform(val => val.trim()),
  emergencyMiddleName: z
    .string()
    .max(100, 'Emergency contact middle name too long')
    .regex(/^[a-zA-Z\s'.-]*$/, 'Emergency contact middle name contains invalid characters')
    .optional()
    .transform(val => val?.trim()),
  emergencyLastName: z
    .string()
    .min(1, 'Emergency contact last name is required')
    .max(100, 'Emergency contact last name too long')
    .regex(/^[a-zA-Z\s'.-]+$/, 'Emergency contact last name contains invalid characters')
    .transform(val => val.trim()),
  emergencyContactNumber: PhoneSchema,
  emergencyRelationship: z
    .string()
    .min(1, 'Relationship is required')
    .max(50, 'Relationship too long'),
  emergencyCompleteAddress: z
    .string()
    .min(10, 'Emergency contact address is required')
    .max(500, 'Address too long'),
  
  // Terms
  agreeToTerms: z
    .boolean()
    .refine(val => val === true, 'You must agree to the terms and conditions'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// ========================================
// TYPE EXPORTS
// ========================================

export type PersonalInformationData = z.infer<typeof PersonalInformationSchema>;
export type ContactInformationData = z.infer<typeof ContactInformationSchema>;
export type UsernamePasswordData = z.infer<typeof UsernamePasswordSchema>;
export type MarketingData = z.infer<typeof MarketingSchema>;
export type EmergencyContactData = z.infer<typeof EmergencyContactSchema>;
export type UserRegistrationData = z.infer<typeof UserRegistrationSchema>;
export type FlatUserRegistrationData = z.infer<typeof FlatUserRegistrationSchema>;

// ========================================
// VALIDATION HELPERS
// ========================================

/**
 * Validate user registration data
 */
export function validateUserRegistration(data: unknown) {
  return FlatUserRegistrationSchema.safeParse(data);
}

/**
 * Transform flat registration data to structured format
 */
export function transformToStructuredRegistration(data: any): UserRegistrationData {
  return {
    personalInformation: {
      firstName: data.firstName,
      middleName: data.middleName,
      lastName: data.lastName,
      nameExtension: data.nameExtension,
      gender: data.gender,
      civilStatus: data.civilStatus,
      srn: data.srn,
      nationality: data.nationality,
      birthDate: data.birthDate,
      placeOfBirth: data.placeOfBirth,
      completeAddress: data.completeAddress,
    },
    contactInformation: {
      email: data.email,
      phoneNumber: data.phoneNumber,
    },
    usernamePassword: {
      username: data.username,
      password: data.password,
      confirmPassword: data.confirmPassword,
    },
    marketing: {
      couponCode: data.couponCode,
    },
    emergencyContact: {
      firstName: data.emergencyFirstName,
      middleName: data.emergencyMiddleName,
      lastName: data.emergencyLastName,
      contactNumber: data.emergencyContactNumber,
      relationship: data.emergencyRelationship,
      completeAddress: data.emergencyCompleteAddress,
    },
    agreeToTerms: data.agreeToTerms,
  };
}
