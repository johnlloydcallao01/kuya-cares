/**
 * @file apps/web/src/server/middleware/validation-middleware.ts
 * @description Validation middleware for server actions
 */

import 'server-only';
import { z } from 'zod';
import type { ServerActionResult, ValidationError } from '../types/server-types';

// ========================================
// TYPES
// ========================================

export type ValidationOptions = {
  stripUnknown?: boolean;
  allowPartial?: boolean;
  customErrorMessage?: string;
  transformErrors?: (errors: z.ZodError) => ValidationError[];
};

export type ValidationResult<T> = {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
};

// ========================================
// VALIDATION UTILITIES
// ========================================

/**
 * Transform Zod errors to our ValidationError format
 */
function transformZodErrors(zodError: z.ZodError): ValidationError[] {
  return zodError.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

/**
 * Validate data against a Zod schema
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  options: ValidationOptions = {}
): ValidationResult<T> {
  try {
    // Use safeParse instead of parse with options for better compatibility
    const validatedData = schema.parse(data);
    
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = options.transformErrors 
        ? options.transformErrors(error)
        : transformZodErrors(error);
      
      return {
        success: false,
        errors,
      };
    }
    
    return {
      success: false,
      errors: [{
        field: 'unknown',
        message: options.customErrorMessage || 'Validation failed',
        code: 'VALIDATION_ERROR',
      }],
    };
  }
}

// ========================================
// VALIDATION MIDDLEWARE
// ========================================

/**
 * Basic validation middleware for server actions
 */
export function withValidation<T, Args extends unknown[], R>(
  schema: z.ZodSchema<T>,
  options: ValidationOptions = {}
) {
  return (fn: (validatedData: T, ...args: Args) => Promise<R>) => {
    return async (data: unknown, ...args: Args): Promise<R> => {
      const validation = validateData(schema, data, options);
      
      if (!validation.success) {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        (error as any).validationErrors = validation.errors;
        throw error;
      }
      
      return fn(validation.data!, ...args);
    };
  };
}

/**
 * Validation middleware that returns ServerActionResult
 */
export function withValidationResult<T, Args extends unknown[], R>(
  schema: z.ZodSchema<T>,
  options: ValidationOptions = {}
) {
  return (fn: (validatedData: T, ...args: Args) => Promise<ServerActionResult<R>>) => {
    return async (data: unknown, ...args: Args): Promise<ServerActionResult<R>> => {
      const validation = validateData(schema, data, options);
      
      if (!validation.success) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: options.customErrorMessage || 'Invalid input data',
            details: { errors: validation.errors },
            timestamp: new Date().toISOString(),
          },
        };
      }
      
      return fn(validation.data!, ...args);
    };
  };
}

/**
 * Multiple validation middleware for complex forms
 */
export function withMultipleValidation<T1, T2, Args extends unknown[], R>(
  schema1: z.ZodSchema<T1>,
  schema2: z.ZodSchema<T2>,
  options: ValidationOptions = {}
) {
  return (fn: (data1: T1, data2: T2, ...args: Args) => Promise<R>) => {
    return async (data1: unknown, data2: unknown, ...args: Args): Promise<R> => {
      const validation1 = validateData(schema1, data1, options);
      const validation2 = validateData(schema2, data2, options);
      
      const allErrors = [
        ...(validation1.errors || []),
        ...(validation2.errors || []),
      ];
      
      if (allErrors.length > 0) {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        (error as any).validationErrors = allErrors;
        throw error;
      }
      
      return fn(validation1.data!, validation2.data!, ...args);
    };
  };
}

/**
 * Conditional validation middleware
 */
export function withConditionalValidation<T, Args extends unknown[], R>(
  condition: (data: unknown, ...args: Args) => boolean,
  schema: z.ZodSchema<T>,
  options: ValidationOptions = {}
) {
  return (fn: (data: T | unknown, ...args: Args) => Promise<R>) => {
    return async (data: unknown, ...args: Args): Promise<R> => {
      if (condition(data, ...args)) {
        const validation = validateData(schema, data, options);
        
        if (!validation.success) {
          const error = new Error('Validation failed');
          error.name = 'ValidationError';
          (error as any).validationErrors = validation.errors;
          throw error;
        }
        
        return fn(validation.data!, ...args);
      }
      
      return fn(data, ...args);
    };
  };
}

// ========================================
// SANITIZATION MIDDLEWARE
// ========================================

/**
 * Input sanitization middleware
 */
export function withSanitization<T extends Record<string, unknown>, Args extends unknown[], R>(
  sanitizers: Partial<Record<keyof T, (value: any) => any>>
) {
  return (fn: (sanitizedData: T, ...args: Args) => Promise<R>) => {
    return async (data: T, ...args: Args): Promise<R> => {
      const sanitizedData = { ...data };
      
      for (const [key, sanitizer] of Object.entries(sanitizers)) {
        if (key in sanitizedData && sanitizer) {
          sanitizedData[key as keyof T] = sanitizer(sanitizedData[key as keyof T]);
        }
      }
      
      return fn(sanitizedData, ...args);
    };
  };
}

/**
 * String sanitization middleware
 */
export function withStringSanitization<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>
) {
  return async (...args: Args): Promise<R> => {
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'string') {
        return arg
          .trim()
          .replace(/[<>]/g, '') // Remove basic HTML tags
          .replace(/javascript:/gi, '') // Remove javascript: protocol
          .replace(/on\w+=/gi, '') // Remove event handlers
          .substring(0, 10000); // Limit length
      }
      
      if (typeof arg === 'object' && arg !== null) {
        return sanitizeObject(arg);
      }
      
      return arg;
    }) as Args;
    
    return fn(...sanitizedArgs);
  };
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = value
          .trim()
          .replace(/[<>]/g, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '')
          .substring(0, 10000);
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    
    return sanitized;
  }
  
  return obj;
}
