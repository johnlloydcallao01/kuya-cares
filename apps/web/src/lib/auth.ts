/**
 * @file apps/web/src/lib/auth.ts
 * @description PayloadCMS Authentication Service for the customer web app.
 *
 * Logic ported 1:1 from the proven apps/web-admin pattern (lib/auth.ts):
 * - Trust the server-seeded session (httpOnly cookie), never clobber it with
 *   a transient client revalidation failure.
 * - `credentials: 'omit'` for cross-origin CMS calls — rely on the
 *   `Authorization: JWT <token>` header instead of conflicting cookies.
 * - `getServerUser()` returns null (never throws); only login/refresh throw.
 * - `getSessionInfo()` treats non-401/403 as valid to prevent redirect loops.
 * - No auto-refresh polling wired by default (see AuthContext).
 *
 * The 30-day session itself lives in the `kuyacares-token` httpOnly cookie set
 * by the server actions. localStorage keeps a client mirror (both the new
 * `kuyacares_auth_*` keys and the legacy `grandline_auth_*` keys that the
 * shared client-services and existing components already read).
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
// CONFIGURATION (server-action pattern, kuyacares endpoints)
// ========================================

function normalizeApiBaseUrl(raw?: string): string {
  const fallback = 'https://cms.kuyacares.com/api';
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

// Storage keys (new canonical + legacy mirrors for existing consumers)
const TOKEN_KEY = 'kuyacares_auth_token';
const EXPIRES_KEY = 'kuyacares_auth_expires';
const USER_KEY = 'kuyacares_auth_user';

// Legacy keys from the previous implementation — written alongside the new
// keys so the shared client-services and existing components (Header,
// SearchModal, wishlist-service etc.) that read `grandline_auth_*` keep working.
const LEGACY_TOKEN_KEY = 'grandline_auth_token';
const LEGACY_EXPIRES_KEY = 'grandline_auth_expires';
const LEGACY_USER_KEY = 'grandline_auth_user';

// Request Config — never send ambient cookies cross-origin to the CMS.
export const REQUEST_CONFIG: RequestInit = {
  credentials: 'omit',
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

    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw { ...(data as object), status: response.status };
    }

    return data as T;
  } catch (error) {
    if (!options.suppressErrorLog) {
      console.error(`Auth API Error [${endpoint}]:`, error);
    }
    throw error;
  }
}

// ========================================
// STORED SESSION MIRROR
// ========================================

const SESSION_DAYS = 30;
const SESSION_MILLIS = SESSION_DAYS * 24 * 60 * 60 * 1000;

function persistSessionMirror(token: string, user: User): void {
  if (typeof window === 'undefined') return;
  try {
    const expiresAt = Date.now() + SESSION_MILLIS;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRES_KEY, expiresAt.toString());
    // Legacy mirrors for existing consumers
    localStorage.setItem(LEGACY_USER_KEY, JSON.stringify(user));
    localStorage.setItem(LEGACY_TOKEN_KEY, token);
    localStorage.setItem(LEGACY_EXPIRES_KEY, expiresAt.toString());
  } catch {
    void 0;
  }
}

function persistUserMirror(user: User): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(LEGACY_USER_KEY, JSON.stringify(user));
  } catch {
    void 0;
  }
}

/**
 * Get the mirrored client token for direct CMS fetches (addresses, media, etc).
 * The httpOnly cookie remains the source of truth for server actions / BFF.
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY);
}

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

// ========================================
// CORE AUTHENTICATION FUNCTIONS
// ========================================

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    const response = await serverLogin(credentials);

    if (response.token && response.user) {
      persistSessionMirror(response.token, response.user);
    }

    return response;
  } catch (error: unknown) {
    // Pass through the human-readable messages raised by the server action.
    throw error instanceof Error ? error : new Error('Login failed');
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

    persistUserMirror(user);

    return user;
  } catch {
    clearAuthState();
    return null;
  }
}

export async function refreshSession(): Promise<AuthResponse> {
  try {
    const response = await serverRefresh();

    if (response.token && response.user) {
      persistSessionMirror(response.token, response.user);
    }

    return response;
  } catch (error: unknown) {
    clearAuthState();
    throw error instanceof Error ? error : new Error('Failed to refresh session');
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

/**
 * Legacy helper kept for compatibility. The authoritative check is the server
 * cookie via getServerUser(), not the mirrored localStorage expiry.
 */
export function hasValidStoredToken(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const storedToken = localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY);
  const storedExpires = localStorage.getItem(EXPIRES_KEY) ?? localStorage.getItem(LEGACY_EXPIRES_KEY);

  if (!storedToken || !storedExpires) {
    return false;
  }

  return Date.now() < parseInt(storedExpires, 10);
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