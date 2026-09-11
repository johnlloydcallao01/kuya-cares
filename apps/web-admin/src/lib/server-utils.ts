/**
 * @file apps/web-admin/src/lib/server-utils.ts
 * @description Server-side utilities for Payload CMS integration
 */

import { headers } from 'next/headers';
import { env } from './env';

// ========================================
// TYPES
// ========================================

export interface PayloadUser {
  id: number;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    timestamp: string;
  };
}

// ========================================
// AUTHENTICATION UTILITIES
// ========================================

/**
 * Get current admin user from server context
 * This is a placeholder implementation - in production you would
 * extract the JWT token from headers and validate it with Payload CMS
 */
export async function getCurrentAdminUser(): Promise<PayloadUser | null> {
  try {
    const headersList = await headers();
    const authorization = headersList.get('authorization');
    
    if (!authorization || !authorization.startsWith('JWT ')) {
      return null;
    }

    const token = authorization.substring(4);
    
    // In production, you would validate this token with Payload CMS
    // For now, return a mock user
    const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/users/me`, {
      headers: {
        'Authorization': `JWT ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error('Failed to get current admin user:', error);
    return null;
  }
}

/**
 * Check if user has admin privileges
 * Consistent with client-side admin-only access (see src/lib/auth.ts)
 */
export function isAdminUser(user: PayloadUser | null): boolean {
  if (!user) return false;
  return user.role === 'admin';
}

/**
 * Validate admin request
 */
export async function validateAdminRequest(): Promise<ServerActionResult<PayloadUser>> {
  const user = await getCurrentAdminUser();
  
  if (!user) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      },
    };
  }

  if (!isAdminUser(user)) {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin privileges required',
        timestamp: new Date().toISOString(),
      },
    };
  }

  return {
    success: true,
    data: user,
  };
}

// ========================================
// PLACEHOLDER FUNCTIONS
// ========================================

/**
 * Placeholder for custom user claims (Firebase replacement)
 * In Payload CMS, this would be handled through user roles and permissions
 */
export async function setCustomUserClaims(
  _userId: string,
  _claims: Record<string, unknown>
): Promise<void> {
  // In production, this would update user roles/permissions in Payload CMS
}

// Define notification message type
interface NotificationMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
  icon?: string;
  badge?: string;
}

/**
 * Placeholder for sending notifications (FCM replacement)
 * In production, you might use email notifications, webhooks, or other services
 */
export async function sendToTopic(
  _topic: string,
  _message: NotificationMessage
): Promise<void> {
  // In production, implement your notification system here
}

/**
 * Handle server action errors consistently
 */
export function handleServerError<T = never>(error: unknown): ServerActionResult<T> {
  console.error('Server action error:', error);

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create a server action wrapper with error handling
 */
export function withServerAction<T extends unknown[], R>(
  action: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<ServerActionResult<R>> => {
    try {
      const result = await action(...args);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return handleServerError(error);
    }
  };
}

// Define audit action type
interface AuditAction {
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Log admin actions (audit trail)
 */
export async function logAdminAction(_action: AuditAction): Promise<void> {
  const _user = await getCurrentAdminUser();

  // In production, this would log to your audit system
  // Example: await auditLogger.log({
  //   ...action,
  //   userId: user?.id,
  //   timestamp: new Date().toISOString(),
  // });

  // In production, save to audit log table in Payload CMS
}
