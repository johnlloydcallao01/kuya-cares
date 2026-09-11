/**
 * @file apps/web/src/lib/auth.ts
 * @description Simplified PayloadCMS Authentication Service
 */

import type {
  User,
  AuthResponse,
  LoginCredentials,
  PayloadAuthResponse,
  PayloadMeResponse,
  SessionInfo,
} from '@/types/auth';

// ========================================
// CONFIGURATION
// ========================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
const COLLECTION_SLUG = 'users';

const REQUEST_CONFIG: RequestInit = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
};

// ========================================
// API UTILITIES
// ========================================

async function makeAuthRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}/${COLLECTION_SLUG}${endpoint}`;
  
  const response = await fetch(url, {
    ...REQUEST_CONFIG,
    ...options,
    headers: {
      ...REQUEST_CONFIG.headers,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    // Only retry 5xx server errors, not auth errors (401, 403)
    if (response.status >= 500) {
      throw { ...data, status: response.status, retryable: true };
    }
    throw { ...data, status: response.status, retryable: false };
  }

  return data;
}

// Simple retry for server errors only
async function retryServerErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Only retry once for 5xx errors
    if (error.retryable && error.status >= 500) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await operation();
    }
    throw error;
  }
}

// ========================================
// AUTHENTICATION FUNCTIONS
// ========================================

/**
 * Login user with email and password
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  clearAuthState();

  try {
    const response = await retryServerErrors(async () => {
      return await makeAuthRequest<PayloadAuthResponse>('/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
    });

    // Check if user has customer role
    if (response.user.role !== 'customer') {
      throw new Error('Access denied. Only customers can access this application.');
    }

    // Store token for persistent authentication
    if (response.token) {
      localStorage.setItem('grandline_auth_token', response.token);
      const expirationTime = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
      localStorage.setItem('grandline_auth_expires', expirationTime.toString());
      localStorage.setItem('grandline_auth_user', JSON.stringify(response.user));
    }

    return {
      message: response.message,
      user: response.user,
      token: response.token,
      exp: response.exp,
    };
  } catch (error: any) {
    if (error.status === 401) {
      throw new Error('Invalid email or password.');
    }
    if (error.status === 423) {
      throw new Error('Account is temporarily locked. Please try again later.');
    }
    if (error.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }
    throw new Error(error.message || 'Login failed. Please try again.');
  }
}

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
  try {
    await makeAuthRequest('/logout', { method: 'POST' });
  } catch (error) {
    // Continue with logout even if API call fails
  }
  
  clearAuthState();
  emitAuthEvent('logout');
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  const token = localStorage.getItem('grandline_auth_token');
  if (!token || isTokenExpired()) {
    return null;
  }

  try {
    const response = await makeAuthRequest<PayloadMeResponse>('/me');
    
    if (response.user?.role !== 'customer') {
      clearAuthState();
      return null;
    }

    // Update cached user data
    localStorage.setItem('grandline_auth_user', JSON.stringify(response.user));
    return response.user;
  } catch (error: any) {
    if (error.status === 401) {
      clearAuthState();
    }
    return null;
  }
}

/**
 * Refresh session token
 */
export async function refreshSession(): Promise<AuthResponse> {
  const token = localStorage.getItem('grandline_auth_token');
  if (!token) {
    throw new Error('No active session to refresh');
  }

  try {
    const response = await makeAuthRequest<PayloadAuthResponse>('/refresh-token', {
      method: 'POST',
    });

    if (response.user?.role !== 'customer') {
      clearAuthState();
      throw new Error('Access denied. Only customers can access this application.');
    }

    // Update stored token and user data
    if (response.token) {
      localStorage.setItem('grandline_auth_token', response.token);
      const expirationTime = Date.now() + (30 * 24 * 60 * 60 * 1000);
      localStorage.setItem('grandline_auth_expires', expirationTime.toString());
      localStorage.setItem('grandline_auth_user', JSON.stringify(response.user));
    }

    emitAuthEvent('session_refreshed', response.user);

    return {
      message: response.message,
      user: response.user,
      token: response.token,
      exp: response.exp,
    };
  } catch (error: any) {
    if (error.status === 401) {
      clearAuthState();
    }
    throw error;
  }
}

/**
 * Check if user is authenticated
 */
export async function checkAuthStatus(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * Check if stored token exists and is not expired
 */
export function hasValidStoredToken(): boolean {
  const token = localStorage.getItem('grandline_auth_token');
  const expires = localStorage.getItem('grandline_auth_expires');
  
  if (!token || !expires) return false;
  
  return Date.now() < parseInt(expires);
}

/**
 * Get session information
 */
export async function getSessionInfo(): Promise<SessionInfo> {
  const user = await getCurrentUser();
  const expires = localStorage.getItem('grandline_auth_expires');
  
  return {
    isValid: user !== null,
    user: user || undefined,
    expiresAt: expires ? new Date(parseInt(expires)) : undefined,
  };
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

export function clearAuthState(): void {
  localStorage.removeItem('grandline_auth_token');
  localStorage.removeItem('grandline_auth_expires');
  localStorage.removeItem('grandline_auth_user');
}

function isTokenExpired(): boolean {
  const expires = localStorage.getItem('grandline_auth_expires');
  if (!expires) return true;
  return Date.now() >= parseInt(expires);
}

export function getUserDisplayName(user: User): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.email;
}

export function emitAuthEvent(event: string, data?: any): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(`auth:${event}`, { detail: data }));
  }
}
