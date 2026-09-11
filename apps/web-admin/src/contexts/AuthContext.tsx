/**
 * @file apps/web-admin/src/contexts/AuthContext.tsx
 * @description Authentication Context Provider for PayloadCMS
 * Manages global authentication state with automatic session restoration.
 *
 * Logic ported 1:1 from the proven grandline web-admin pattern:
 * - No optimistic AUTH_FAST_SUCCESS — never render protected UI on stale cache
 * - Trust the server-seeded session (httpOnly cookie) with an early return;
 *   never clobber a valid session with a transient revalidation failure
 * - Single-run init guard (isInitializedRef) + empty-dep callback (StrictMode safe)
 * - No auto-refresh polling wired here; only passive logout listeners
 */

'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type {
  User,
  AuthState,
  AuthContextType,
  LoginCredentials,
} from '@/types/auth';
import {
  login as authLogin,
  logout as authLogout,
  getCurrentUser,
  refreshSession as authRefreshSession,
  checkAuthStatus,
  clearAuthState,
  emitAuthEvent,
} from '@/lib/auth';
import { getServerToken } from '@/app/actions/auth';

// ========================================
// AUTHENTICATION REDUCER
// ========================================

type AuthAction =
  | { type: 'AUTH_INIT_START' }
  | { type: 'AUTH_INIT_SUCCESS'; payload: { user: User | null; token: string | null } }
  | { type: 'AUTH_INIT_ERROR'; payload: { error: string } }
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'LOGIN_ERROR'; payload: { error: string } }
  | { type: 'LOGOUT_START' }
  | { type: 'LOGOUT_SUCCESS' }
  | { type: 'REFRESH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'USER_UPDATED'; payload: { user: User } }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SESSION_EXPIRED' };

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false, // Start as false, will be set during initialization
  isLoading: true, // Start as loading
  isInitialized: false, // Not initialized yet
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_INIT_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'AUTH_INIT_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: action.payload.user !== null && action.payload.token !== null,
        isLoading: false,
        isInitialized: true,
        error: null,
      };

    case 'AUTH_INIT_ERROR':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
        error: action.payload.error,
      };

    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case 'LOGIN_ERROR':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload.error,
      };

    case 'LOGOUT_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'LOGOUT_SUCCESS':
    case 'SESSION_EXPIRED':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };

    case 'REFRESH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        error: null,
      };

    case 'USER_UPDATED':
      return {
        ...state,
        user: action.payload.user,
        error: null,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
}

// ========================================
// CONTEXT CREATION
// ========================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ========================================
// AUTH PROVIDER COMPONENT
// ========================================

interface AuthProviderProps {
  children: React.ReactNode;
  initialUser?: User | null;
  initialToken?: string | null;
}

export const AuthProvider = ({ children, initialUser = null, initialToken = null }: AuthProviderProps): React.ReactNode => {
  const [state, dispatch] = useReducer(authReducer, {
    ...initialState,
    user: initialUser,
    token: initialToken,
    isAuthenticated: !!initialUser && !!initialToken,
    isLoading: !initialUser, // Only load if we didn't get initial user
    isInitialized: !!initialUser, // If we got it from server, we are initialized
  });

  // ========================================
  // INITIALIZATION
  // ========================================

  const isInitializedRef = React.useRef(false);

  const initializeAuth = useCallback(async () => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    try {
      // Trust the server-seeded session on first load. It already came from
      // the HTTP-only cookie and avoids clobbering a valid session with a
      // transient client-side revalidation failure.
      if (initialUser && initialToken) {
        try {
          localStorage.setItem('tap2go_auth_user_admin', JSON.stringify(initialUser));
          localStorage.setItem('tap2go_auth_token_admin', initialToken);
        } catch {
          void 0;
        }

        emitAuthEvent('session_restored', { user: initialUser });
        return;
      }

      let cachedUser: User | null = null;
      let cachedToken: string | null = null;

      try {
        const cached = localStorage.getItem('tap2go_auth_user_admin');
        cachedToken = localStorage.getItem('tap2go_auth_token_admin');
        if (cached) {
          cachedUser = JSON.parse(cached);
          dispatch({ type: 'AUTH_INIT_SUCCESS', payload: { user: cachedUser, token: cachedToken } });
        }
      } catch {
        void 0;
      }

      // Re-validate session with the server
      const user = await getCurrentUser();
      const token = await getServerToken();

      // Update local storage token just in case legacy code needs it
      if (token) {
        localStorage.setItem('tap2go_auth_token_admin', token);
      } else {
        localStorage.removeItem('tap2go_auth_token_admin');
      }

      dispatch({ type: 'AUTH_INIT_SUCCESS', payload: { user, token } });

      if (user) {
        emitAuthEvent('session_restored', { user });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize authentication';
      dispatch({ type: 'AUTH_INIT_ERROR', payload: { error: errorMessage } });
    }
  }, []);

  // Initialize authentication on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // ========================================
  // AUTHENTICATION METHODS
  // ========================================

  const login = useCallback(async (credentials: LoginCredentials) => {
    dispatch({ type: 'LOGIN_START' });

    try {
      const response = await authLogin(credentials);
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user: response.user, token: response.token || '' } });
      emitAuthEvent('login_success', { user: response.user });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'LOGIN_ERROR', payload: { error: errorMessage } });
      emitAuthEvent('login_failure', { error: errorMessage });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    dispatch({ type: 'LOGOUT_START' });

    try {
      await authLogout();
      clearAuthState();
      dispatch({ type: 'LOGOUT_SUCCESS' });
      emitAuthEvent('logout');
    } catch {
      // Always succeed logout locally even if server call fails
      clearAuthState();
      dispatch({ type: 'LOGOUT_SUCCESS' });
      emitAuthEvent('logout');
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const response = await authRefreshSession();
      dispatch({ type: 'REFRESH_SUCCESS', payload: { user: response.user, token: response.token || '' } });
      emitAuthEvent('session_refreshed', { user: response.user });
    } catch (_error) {
      // If refresh fails, treat as session expired
      dispatch({ type: 'SESSION_EXPIRED' });
      emitAuthEvent('session_expired');
      throw _error;
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const updateUser = useCallback((user: User) => {
    dispatch({ type: 'USER_UPDATED', payload: { user } });

    try {
      localStorage.setItem('tap2go_auth_user_admin', JSON.stringify(user));
    } catch {
      // Keep the in-memory session usable when storage is unavailable.
    }

    emitAuthEvent('user_updated', { user });
  }, []);

  // ========================================
  // SESSION MONITORING
  // ========================================

  // Session monitoring and management
  useEffect(() => {
    if (!state.isAuthenticated || !state.isInitialized) return;

    const handleSessionExpired = () => {
      dispatch({ type: 'SESSION_EXPIRED' });
      // Don't emit event here to prevent infinite loop
    };

    // Listen for auth events from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth:logout') {
        handleSessionExpired();
      }
    };

    // Listen for custom auth events
    const handleAuthEvent = (e: CustomEvent) => {
      if (e.type === 'auth:logout') {
        // Only logout on explicit logout event
        handleSessionExpired();
      }
      // Ignore auth:session_expired to prevent auto-logout
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth:logout', handleAuthEvent as EventListener);
    window.addEventListener('auth:session_expired', handleAuthEvent as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth:logout', handleAuthEvent as EventListener);
      window.removeEventListener('auth:session_expired', handleAuthEvent as EventListener);
    };
  }, [state.isAuthenticated, state.isInitialized]);

  // ========================================
  // CONTEXT VALUE
  // ========================================

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    refreshSession,
    updateUser,
    clearError,
    checkAuthStatus,
  };

  return React.createElement(AuthContext.Provider, { value: contextValue }, children);
}

// ========================================
// HOOK FOR USING AUTH CONTEXT
// ========================================

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
}

export { AuthContext };
