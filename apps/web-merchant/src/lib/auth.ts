/**
 * @file apps/web-merchant/src/lib/auth.ts
 * @description Authentication service restricted to CMS vendor users
 */

import { 
  User, 
  VendorUser,
  LoginCredentials, 
  AuthResponse, 
  PayloadAuthResponse, 
  PayloadMeResponse,
  SessionInfo,
  AuthErrorType,
  AuthErrorDetails
} from '@/types/auth';
import { serverLogin, serverLogout, getServerUser, serverRefresh } from '@/app/actions/auth';

// ========================================
// CONFIGURATION
// ========================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
const COLLECTION_SLUG = 'users';

// localStorage keys are scoped so merchant and admin sessions cannot collide.
const TOKEN_KEY = 'merchant_auth_token';
const EXPIRES_KEY = 'merchant_auth_expires';
const USER_KEY = 'merchant_auth_user';
const TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Request configuration for cookie-based authentication
const REQUEST_CONFIG: RequestInit = {
  credentials: 'include', // Essential for cookie-based auth
  headers: {
    'Content-Type': 'application/json',
  },
};

// ========================================
// ERROR HANDLING UTILITIES
// ========================================

export class AuthenticationError extends Error {
  public type: AuthErrorType;
  public field?: string;
  public retryable: boolean;

  constructor(type: AuthErrorType, message: string, field?: string, retryable = false) {
    super(message);
    this.name = 'AuthenticationError';
    this.type = type;
    this.field = field;
    this.retryable = retryable;
  }
}

function createAuthError(type: AuthErrorType, message: string, field?: string, retryable = false): AuthErrorDetails {
  return {
    type,
    message,
    field,
    retryable
  };
}

// Type guard functions for error handling
function isErrorWithName(error: unknown): error is { name: string } {
  return typeof error === 'object' && error !== null && 'name' in error;
}

function isErrorWithCode(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function isErrorWithStatus(error: unknown): error is { status: number } {
  return typeof error === 'object' && error !== null && 'status' in error;
}

function isErrorWithStatusCode(error: unknown): error is { statusCode: number } {
  return typeof error === 'object' && error !== null && 'statusCode' in error;
}

function isErrorWithMessage(error: unknown): error is { message: string } {
  return typeof error === 'object' && error !== null && 'message' in error;
}

function handleApiError(error: unknown): AuthErrorDetails {
  if (error instanceof AuthenticationError) {
    return createAuthError(error.type, error.message, error.field, error.retryable);
  }

  if ((isErrorWithName(error) && error.name === 'NetworkError') || (isErrorWithCode(error) && error.code === 'NETWORK_ERROR')) {
    return createAuthError('NETWORK_ERROR', 'Network connection failed. Please check your internet connection.', undefined, true);
  }

  if ((isErrorWithStatus(error) && error.status === 401) || (isErrorWithStatusCode(error) && error.statusCode === 401)) {
    return createAuthError('INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  if ((isErrorWithStatus(error) && error.status === 403) || (isErrorWithStatusCode(error) && error.statusCode === 403)) {
    return createAuthError('INVALID_CREDENTIALS', 'Access denied. Vendor access required.');
  }

  if ((isErrorWithStatus(error) && error.status === 429) || (isErrorWithStatusCode(error) && error.statusCode === 429)) {
    return createAuthError('ACCOUNT_LOCKED', 'Too many login attempts. Please try again later.', undefined, true);
  }

  const errorMessage = isErrorWithMessage(error) ? error.message : 'An unexpected error occurred.';
  return createAuthError('UNKNOWN_ERROR', errorMessage);
}

// ========================================
// API REQUEST UTILITIES
// ========================================

async function makeAuthRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}/${COLLECTION_SLUG}${endpoint}`;
  
  try {
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
      throw { ...data, status: response.status };
    }

    return data;
  } catch (error) {
    const authError = handleApiError(error);
    throw new AuthenticationError(authError.type, authError.message, authError.field, authError.retryable);
  }
}

// ========================================
// STORED SESSION HELPERS
// ========================================

/**
 * Check if a valid (non-expired) merchant token is stored
 * Mirrors apps/web hasValidStoredToken
 */
export function hasValidStoredToken(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem(TOKEN_KEY);
  const expires = localStorage.getItem(EXPIRES_KEY);
  if (!token || !expires) return false;
  return Date.now() < parseInt(expires, 10);
}

/**
 * Get the stored merchant JWT token (for Authorization headers on CMS API calls)
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Persist the merchant session in localStorage
 */
function storeAuthData(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRES_KEY, (Date.now() + TOKEN_LIFETIME_MS).toString());
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Get cached user from localStorage (fast session restore)
 */
export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as User;
    return user && typeof user === 'object' ? user : null;
  } catch {
    return null;
  }
}

/**
 * Check if stored token is expired
 */
function isTokenExpired(): boolean {
  const expires = localStorage.getItem(EXPIRES_KEY);
  if (!expires) return true;
  return Date.now() >= parseInt(expires, 10);
}

// ========================================
// ROLE VALIDATION
// ========================================

// Vendor user validation follows the exact role enum in apps/cms Users.
export function isVendorUser(user: User): user is VendorUser {
  return user.role === 'vendor';
}

// Validate merchant access
export function validateVendorAccess(user: User): void {
  if (!isVendorUser(user)) {
    throw new AuthenticationError(
      'ACCESS_DENIED',
      'Vendor access required. Only vendor users can access this application.',
      'role'
    );
  }
}

// ========================================
// CORE AUTHENTICATION FUNCTIONS
// ========================================

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    const response = await serverLogin(credentials);
    if (response.token) storeAuthData(response.token, response.user);
    return response;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    
    const authError = handleApiError(error);
    throw new AuthenticationError(authError.type, authError.message, authError.field, authError.retryable);
  }
}

export async function logout(): Promise<void> {
  try {
    await serverLogout();
  } catch (error) {
    console.error('Logout error:', error);
    // Continue with logout even if API call fails
  }
  clearAuthState();
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const user = await getServerUser();
    if (!user) {
      clearAuthState();
      return null;
    }
    if (typeof window !== 'undefined') localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      // Clear session state on auth failures
      if (error.type === 'INVALID_CREDENTIALS' || error.type === 'ACCESS_DENIED') {
        clearAuthState();
      }
      return null;
    }
    
    return null;
  }
}

export async function refreshSession(): Promise<User | null> {
  try {
    const response = await serverRefresh();
    if (response.token) storeAuthData(response.token, response.user);
    return response.user;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      if (error.type === 'SESSION_EXPIRED') {
        clearAuthState();
      }
      throw error;
    }
    throw new AuthenticationError('SESSION_EXPIRED', 'Session refresh failed.');
  }
}

export async function checkAuthStatus(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return user !== null && isVendorUser(user);
  } catch {
    return false;
  }
}

export async function getSessionInfo(): Promise<SessionInfo> {
  const user = await getCurrentUser();
  const expires = localStorage.getItem(EXPIRES_KEY);
  
  return {
    isValid: user !== null,
    user: user || undefined,
    expiresAt: expires ? new Date(parseInt(expires, 10)) : undefined,
  };
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

export function formatAuthError(error: AuthErrorDetails): string {
  switch (error.type) {
    case 'INVALID_CREDENTIALS':
      return 'Invalid email or password. Please check your credentials and try again.';

    case 'SESSION_EXPIRED':
      return 'Your session has expired. Please log in again.';
    case 'ACCOUNT_LOCKED':
      return 'Account temporarily locked due to multiple failed attempts. Please try again later.';
    case 'NETWORK_ERROR':
      return 'Network connection failed. Please check your internet connection and try again.';
    case 'VALIDATION_ERROR':
      return error.message || 'Please check your input and try again.';
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Get display name for a user (full name or email)
 */
export function getUserDisplayName(user: User): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.email;
}

// ========================================
// EVENT EMISSION
// ========================================

export function emitAuthEvent(event: string, data?: unknown): void {
  if (typeof window !== 'undefined') {
    const customEvent = new CustomEvent(`auth:${event}`, {
      detail: {
        event,
        data,
        timestamp: new Date().toISOString(),
      },
    });
    window.dispatchEvent(customEvent);
  }
}

// ========================================
// SESSION MONITORING
// ========================================

export function startSessionMonitoring(): () => void {
  let intervalId: NodeJS.Timeout;
  
  const checkSession = async () => {
    try {
      // Periodically validate with server
      const user = await getCurrentUser();
      if (!user) {
        emitAuthEvent('session_expired');
      }
    } catch (error) {
      console.log('Session check failed:', error);
      emitAuthEvent('session_expired');
    }
  };
  
  intervalId = setInterval(async () => {
    try {
      if (await checkAuthStatus()) {
        await refreshSession();
        emitAuthEvent('session_refreshed_auto');
      }
    } catch {
      emitAuthEvent('session_refresh_failed');
    }
  }, 25 * 60 * 1000);
  
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}

export function clearAuthState(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
  localStorage.removeItem(USER_KEY);
  emitAuthEvent('logout');
}

export { handleApiError, createAuthError };