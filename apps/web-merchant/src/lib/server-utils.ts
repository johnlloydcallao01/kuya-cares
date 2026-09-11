/**
 * @file apps/web-merchant/src/lib/server-utils.ts
 * @description Server-side utilities for Payload CMS integration
 */

import { cookies, headers } from 'next/headers';
import { env } from './env';
import { sanitizeUser } from './sanitizeUser';

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
 * Get current vendor user from server context
 * This is a placeholder implementation - in production you would
 * extract the JWT token from headers and validate it with Payload CMS
 */
export async function getCurrentVendorUser(): Promise<PayloadUser | null> {
  try {
    const headersList = await headers();
    const authorization = headersList.get('authorization');
    const cookieToken = (await cookies()).get('tap2go-merchant-token')?.value;
    const token = authorization?.startsWith('JWT ')
      ? authorization.substring(4)
      : cookieToken;

    if (!token) {
      return null;
    }

    const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/users/me`, {
      headers: {
        'Authorization': `JWT ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const user = sanitizeUser(data.user);
    return user?.role === 'vendor' ? user : null;
  } catch (error) {
    console.error('Failed to get current vendor user:', error);
    return null;
  }
}

/**
 * Check if user has vendor privileges.
 * Consistent with client-side vendor-only access (see src/lib/auth.ts).
 */
export function isVendorUser(user: PayloadUser | null): boolean {
  if (!user) return false;
  return user.role === 'vendor';
}

/** Validate a server request for a vendor user. */
export async function validateVendorRequest(): Promise<ServerActionResult<PayloadUser>> {
  const user = await getCurrentVendorUser();
  
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

  if (!isVendorUser(user)) {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Vendor privileges required',
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
 * Log merchant actions (audit trail)
 */
export async function logMerchantAction(_action: AuditAction): Promise<void> {
  const _user = await getCurrentVendorUser();

  // In production, this would log to your audit system
  // Example: await auditLogger.log({
  //   ...action,
  //   userId: user?.id,
  //   timestamp: new Date().toISOString(),
  // });

  // In production, save to audit log table in Payload CMS
}
