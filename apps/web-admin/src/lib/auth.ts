/**
 * @file apps/web-admin/src/lib/auth.ts
 * @description PayloadCMS Authentication Service
 * Enterprise-grade authentication with HTTP-only cookies and 30-day sessions.
 *
 * Logic ported 1:1 from the proven grandline web-admin pattern:
 * - Trust the server-seeded session, never clobber it with transient client revalidation
 * - `credentials: 'omit'` — rely on Authorization header, never conflicting cookies
 * - `getServerUser()` returns null (never throws); only login/refresh throw
 * - `getSessionInfo()` treats non-401/403 as valid to prevent redirect loops
 * - No auto-refresh polling wired by default (see AuthContext)
 */

import type {
  User,
  AuthResponse,
  LoginCredentials,
  PayloadMeResponse,
  SessionInfo,
} from '@/types/auth';

import { serverLogin, serverLogout, getServerUser, serverRefresh } from '@/app/actions/auth';

// ========================================
// CONFIGURATION (grandline logic, tap2go endpoints)
// ========================================

function normalizeApiBaseUrl(raw?: string): string {
  const fallback = 'https://cms.tap2goph.com/api';
  const trimmed = (raw || '').trim();
  let base = trimmed || fallback;

  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }

  base = base.replace(/\/+$/, '');

  if (!/\/api$/i.test(base)) {
    base = `${base}/api`;
  }

  return base;
}

export const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);

export const COLLECTION_SLUG = 'users';

// Storage keys (tap2go equivalents of grandline_auth_*_admin)
const TOKEN_KEY = 'tap2go_auth_token_admin';
const EXPIRES_KEY = 'tap2go_auth_expires_admin';
const USER_KEY = 'tap2go_auth_user_admin';

// Legacy keys from the previous tap2go implementation — cleared on logout,
// read as fallback during migration so existing sessions are not orphaned.
const LEGACY_TOKEN_KEY = 'admin_auth_token';
const LEGACY_EXPIRES_KEY = 'admin_auth_expires';
const LEGACY_USER_KEY = 'admin_auth_user';

// Request Config — never send ambient cookies cross-origin to the CMS.
export const REQUEST_CONFIG: RequestInit = {
  credentials: 'omit', // Prevent sending conflicting cookies; rely on Authorization header
  headers: {
    'Content-Type': 'application/json',
  },
};

// ========================================
// API REQUEST UTILITIES
// ========================================

export async function makeAuthRequest<T>(
  endpoint: string,
  options: RequestInit & { suppressErrorLog?: boolean } = {},
): Promise<T> {
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
    if (!options.suppressErrorLog) {
      console.error(`Auth API Error [${endpoint}]:`, error);
    }
    throw error;
  }
}

// ========================================
// CORE AUTHENTICATION FUNCTIONS
// ========================================

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    const response = await serverLogin(credentials);

    try {
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      if (response.token) localStorage.setItem(TOKEN_KEY, response.token);
    } catch {
      void 0;
    }

    return response;
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : 'Login failed');
  }
}

export async function logout(): Promise<void> {
  try {
    await serverLogout();
  } finally {
    clearAuthState();
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const user = await getServerUser();

    if (!user) {
      clearAuthState();
      return null;
    }

    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      void 0;
    }

    return user;
  } catch {
    clearAuthState();
    return null;
  }
}

export async function refreshSession(): Promise<AuthResponse> {
  try {
    const response = await serverRefresh();

    try {
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      if (response.token) localStorage.setItem(TOKEN_KEY, response.token);
    } catch {
      void 0;
    }

    return response;
  } catch (error: unknown) {
    clearAuthState();
    throw new Error(error instanceof Error ? error.message : 'Failed to refresh session');
  }
}

export async function checkAuthStatus(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return user !== null;
  } catch {
    return false;
  }
}

// ========================================
// STORED SESSION HELPERS
// ========================================

/**
 * Legacy helper kept for compatibility. Nothing ever writes EXPIRES_KEY,
 * so this always returns false in practice (same as the reference pattern).
 * The authoritative check is the server cookie via getServerUser().
 */
export function hasValidStoredToken(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const storedToken = localStorage.getItem(TOKEN_KEY);
  const storedExpires = localStorage.getItem(EXPIRES_KEY);

  if (!storedToken || !storedExpires) {
    return false;
  }

  return Date.now() < parseInt(storedExpires, 10);
}

/**
 * Get the mirrored client token for direct CMS fetches (media library, etc).
 * The httpOnly cookie remains the source of truth for server actions / BFF.
 * Falls back to the legacy key during storage migration.
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY);
}

/**
 * Get cached user for fast session restore. Falls back to the legacy key
 * during storage migration.
 */
export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY) ?? localStorage.getItem(LEGACY_USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as User;
    return user && typeof user === 'object' ? user : null;
  } catch {
    return null;
  }
}

export async function getSessionInfo(): Promise<SessionInfo> {
  try {
    let headers: Record<string, string> | undefined;
    if (typeof window !== 'undefined') {
      const token = getStoredToken();
      if (token) headers = { Authorization: `JWT ${token}` };
    }
    const response = await makeAuthRequest<PayloadMeResponse>('/me', { headers });

    return {
      isValid: response.user !== null,
      user: response.user || undefined,
      expiresAt: response.exp ? new Date(response.exp * 1000) : undefined,
    };
  } catch (error: unknown) {
    const isAuthStatus = !!(error && typeof error === 'object' && 'status' in error);
    const status = isAuthStatus ? (error as { status: number }).status : undefined;

    if (status === 401 || status === 403) {
      return { isValid: false };
    }

    // Deliberate anti-logout-loop: transient/network errors keep the session.
    return { isValid: true };
  }
}

export function clearAuthState(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_EXPIRES_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
    sessionStorage.removeItem('auth:redirectAfterLogin');

    window.dispatchEvent(new CustomEvent('auth:logout'));
  }
}

export function isSessionExpired(exp?: number): boolean {
  if (!exp) return true;
  return Date.now() >= exp * 1000;
}

export function getTimeUntilExpiry(exp?: number): number {
  if (!exp) return 0;
  return Math.max(0, exp * 1000 - Date.now());
}

export function getUserDisplayName(user: User): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.username) {
    return user.username;
  }
  return user.email;
}

export function emitAuthEvent(event: string, data?: unknown): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(`auth:${event}`, { detail: data }));
  }
}

// ========================================
// SESSION MONITORING (defined, NOT auto-wired)
// ========================================

export function startSessionMonitoring(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const REFRESH_INTERVAL = 25 * 60 * 1000;

  const intervalId = setInterval(async () => {
    try {
      const isAuth = await checkAuthStatus();
      if (isAuth) {
        await refreshSession();
        emitAuthEvent('session_refreshed_auto');
      }
    } catch (error) {
      console.error('Auto session refresh failed:', error);
      emitAuthEvent('session_refresh_failed', { error });
    }
  }, REFRESH_INTERVAL);

  return () => {
    clearInterval(intervalId);
  };
}

export function monitorSessionExpiration(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const CHECK_INTERVAL = 5 * 60 * 1000;

  const intervalId = setInterval(async () => {
    try {
      const sessionInfo = await getSessionInfo();

      if (!sessionInfo.isValid) {
        console.warn('Session check failed, but keeping session active to prevent redirect loop.');
      } else if (sessionInfo.expiresAt) {
        const timeUntilExpiry = sessionInfo.expiresAt.getTime() - Date.now();

        if (timeUntilExpiry < 10 * 60 * 1000 && timeUntilExpiry > 0) {
          emitAuthEvent('session_expiring_soon', {
            expiresAt: sessionInfo.expiresAt,
            timeUntilExpiry,
          });
        }
      }
    } catch (error) {
      console.error('Session monitoring error:', error);
    }
  }, CHECK_INTERVAL);

  return () => {
    clearInterval(intervalId);
  };
}
