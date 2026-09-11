/**
 * @file apps/web/src/server/actions/contact-actions.ts
 * @description Server actions for handling contact form submissions
 */

'use server';

import 'server-only';

import type { ServerActionResult } from '../types/server-types';
import { LeadQualificationService } from '../services/lead-qualification-service';
import {
  ContactFormSchema,
  type ContactFormData
} from '../validators/contact-schemas';
import {
  withValidationResult
} from '../middleware';

// ========================================
// TYPES
// ========================================

export type ContactFormSubmission = {
  id: string;
  data: ContactFormData;
  submittedAt: string;
  ipAddress?: string;
  userAgent?: string;
  leadScore?: any;
};

// ========================================
// SERVER ACTIONS
// ========================================

/**
 * Submit contact form data with middleware pipeline
 */
const _submitContactForm = async (
  validatedData: ContactFormData
): Promise<ServerActionResult<ContactFormSubmission>> => {
  // Create submission record
  const submission: ContactFormSubmission = {
    id: globalThis.crypto.randomUUID(),
    data: validatedData,
    submittedAt: new Date().toISOString(),
  };

  // Qualify the lead using web-specific business logic
  const leadScore = await LeadQualificationService.qualifyLead(validatedData);
  submission.leadScore = leadScore;

  // TODO: Implement database save and email notifications
  console.log('Contact form submission:', submission);
  console.log('Lead qualification:', leadScore);



  return {
    success: true,
    data: submission,
    message: 'Contact form submitted successfully',
  };
};

/**
 * Public contact form submission action with validation
 */
export const submitContactForm = withValidationResult(ContactFormSchema)(
  async (validatedData: any): Promise<ServerActionResult<ContactFormSubmission>> => {
    // Type assertion to ensure the validated data matches our expected type
    const typedData = validatedData as ContactFormData;

    // Call the internal function
    return _submitContactForm(typedData);
  }
);

// ========================================
// ADDITIONAL ACTIONS
// ========================================

/**
 * Get contact form submission by ID (admin only)
 */
export const getContactSubmission = async (
  submissionId: string
): Promise<ServerActionResult<ContactFormSubmission | null>> => {
  // In a real implementation, fetch from database
  console.log('Fetching contact submission:', submissionId);

  return {
    success: true,
    data: null, // Placeholder
    message: 'Contact submission retrieved',
  };
};

/**
 * List contact form submissions with pagination (admin only)
 */
export const listContactSubmissions = async (
  filters?: { page?: number; limit?: number; status?: string }
): Promise<ServerActionResult<{ submissions: ContactFormSubmission[]; total: number }>> => {
  // In a real implementation, fetch from database with pagination
  console.log('Listing contact submissions with filters:', filters);

  return {
    success: true,
    data: {
      submissions: [],
      total: 0,
    },
    message: 'Contact submissions retrieved',
  };
};
