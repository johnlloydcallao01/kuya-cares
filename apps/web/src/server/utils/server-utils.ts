/**
 * @file apps/web/src/server/utils/server-utils.ts
 * @description Common server-side utilities for the Web App
 */

import 'server-only';
import { headers } from 'next/headers';
import type { ServerActionResult, ServerError, ServerRequestContext } from '../types/server-types';

// ========================================
// REQUEST VALIDATION
// ========================================

/**
 * Validate and extract server request context
 */
export async function validateServerRequest(): Promise<ServerRequestContext> {
  const headersList = await headers();
  
  return {
    userAgent: headersList.get('user-agent') || undefined,
    ipAddress: headersList.get('x-forwarded-for') || 
               headersList.get('x-real-ip') || 
               'unknown',
    timestamp: new Date().toISOString(),
    requestId: globalThis.crypto.randomUUID(),
  };
}

/**
 * Sanitize user input to prevent XSS and other attacks
 */
export function sanitizeUserInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove basic HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 10000); // Limit length
}

/**
 * Format a standardized server response
 */
export function formatServerResponse<T>(
  success: boolean,
  data?: T,
  message?: string,
  error?: ServerError
): ServerActionResult<T> {
  return {
    success,
    data,
    message,
    error,
  };
}

/**
 * Handle server errors consistently
 */
export function handleServerError(
  error: unknown,
  defaultCode: string = 'INTERNAL_SERVER_ERROR'
): ServerActionResult<never> {
  console.error('Server error:', error);
  
  let serverError: ServerError;
  
  if (error instanceof Error) {
    serverError = {
      code: defaultCode,
      message: error.message,
      details: {
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId: globalThis.crypto.randomUUID(),
    };
  } else {
    serverError = {
      code: defaultCode,
      message: 'An unexpected error occurred',
      details: { error: String(error) },
      timestamp: new Date().toISOString(),
      requestId: globalThis.crypto.randomUUID(),
    };
  }
  
  return {
    success: false,
    error: serverError,
  };
}

// ========================================
// VALIDATION HELPERS
// ========================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate phone number format (basic)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-()]/g, ''));
}

// ========================================
// SECURITY HELPERS
// ========================================

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Hash a string using Web Crypto API
 */
export async function hashString(input: string): Promise<string> {
  const encoder = new globalThis.TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ========================================
// DATA HELPERS
// ========================================

/**
 * Parse JSON safely
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Delay execution (for rate limiting, etc.)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delayMs = baseDelay * Math.pow(2, attempt);
      await delay(delayMs);
    }
  }
  
  throw lastError!;
}
