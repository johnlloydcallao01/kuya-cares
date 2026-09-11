/**
 * @file apps/web/src/contexts/AuthContext.tsx
 * @description Simplified Authentication Context Provider
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
  hasValidStoredToken,
} from '@/lib/auth';
import { 
  dataCache, 
  AddressService,
  MerchantClientService, 
  LocationBasedMerchantService, 
  LocationBasedProductCategoriesService 
} from '@encreasl/client-services';

// ========================================
// AUTHENTICATION REDUCER
// ========================================

type AuthAction =
  | { type: 'AUTH_INIT_SUCCESS'; payload: { user: User | null } }
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User } }
  | { type: 'LOGIN_ERROR'; payload: { error: string } }
  | { type: 'LOGOUT_SUCCESS' }
  | { type: 'REFRESH_SUCCESS'; payload: { user: User } }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SESSION_EXPIRED' };

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_INIT_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: action.payload.user !== null,
        isLoading: false,
        isInitialized: true,
        error: null,
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
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case 'LOGIN_ERROR':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload.error,
      };

    case 'LOGOUT_SUCCESS':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };

    case 'REFRESH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        error: null,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'SESSION_EXPIRED':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
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

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps): React.ReactNode => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // ========================================
  // SIMPLIFIED INITIALIZATION
  // ========================================

  const initializeAuth = useCallback(async () => {
    // Simple check: if we have a valid token, get the user
    if (hasValidStoredToken()) {
      // Try to get cached user first for instant display
      const cachedUserData = localStorage.getItem('grandline_auth_user');
      if (cachedUserData) {
        try {
          const cachedUser = JSON.parse(cachedUserData);
          dispatch({ type: 'AUTH_INIT_SUCCESS', payload: { user: cachedUser } });
          return; // Use cached data, no API call needed
        } catch (e) {
          // Invalid cached data, fall through to API call
        }
      }

      // No valid cached data, make single API call
      try {
        const user = await getCurrentUser();
        dispatch({ type: 'AUTH_INIT_SUCCESS', payload: { user } });
      } catch (error) {
        dispatch({ type: 'AUTH_INIT_SUCCESS', payload: { user: null } });
      }
    } else {
      // No token, user is not authenticated
      dispatch({ type: 'AUTH_INIT_SUCCESS', payload: { user: null } });
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
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user: response.user } });
      emitAuthEvent('login_success', { user: response.user });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'LOGIN_ERROR', payload: { error: errorMessage } });
      emitAuthEvent('login_failure', { error: errorMessage });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authLogout();
    } catch (error) {
      // Continue with logout even if API call fails
    }
    
    clearAuthState();
    dispatch({ type: 'LOGOUT_SUCCESS' });
    emitAuthEvent('logout');
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const response = await authRefreshSession();
      dispatch({ type: 'REFRESH_SUCCESS', payload: { user: response.user } });
      emitAuthEvent('session_refreshed', { user: response.user });
    } catch (error) {
      dispatch({ type: 'SESSION_EXPIRED' });
      emitAuthEvent('session_expired');
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // ========================================
  // SIMPLE EVENT HANDLING
  // ========================================

  useEffect(() => {
    const handleAuthEvent = (e: CustomEvent) => {
      if (e.type === 'auth:logout' || e.type === 'auth:session_expired') {
        dispatch({ type: 'SESSION_EXPIRED' });
      }
    };

    window.addEventListener('auth:logout', handleAuthEvent as EventListener);
    window.addEventListener('auth:session_expired', handleAuthEvent as EventListener);

    return () => {
      window.removeEventListener('auth:logout', handleAuthEvent as EventListener);
      window.removeEventListener('auth:session_expired', handleAuthEvent as EventListener);
    };
  }, []);

  // ========================================
  // CACHE INVALIDATION ON AUTH EVENTS
  // ========================================

  useEffect(() => {
    const clearUserDependentCaches = () => {
      try { dataCache.delete('current-customer-id'); } catch {}
      try { AddressService.clearCache(); } catch {}
      try { MerchantClientService.clearCache(); } catch {}
      try { LocationBasedMerchantService.clearCache(); } catch {}
      try { LocationBasedProductCategoriesService.clearCache(); } catch {}
    };

    const onLoginSuccess = () => { clearUserDependentCaches(); };
    const onLogout = () => { clearUserDependentCaches(); };
    const onSessionRefreshed = () => {
      try { dataCache.delete('current-customer-id'); } catch {}
    };

    window.addEventListener('auth:login_success', onLoginSuccess as EventListener);
    window.addEventListener('auth:logout', onLogout as EventListener);
    window.addEventListener('auth:session_refreshed', onSessionRefreshed as EventListener);

    return () => {
      window.removeEventListener('auth:login_success', onLoginSuccess as EventListener);
      window.removeEventListener('auth:logout', onLogout as EventListener);
      window.removeEventListener('auth:session_refreshed', onSessionRefreshed as EventListener);
    };
  }, []);

  // ========================================
  // CONTEXT VALUE
  // ========================================

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    refreshSession,
    clearError,
    checkAuthStatus,
  };

  return React.createElement(
    AuthContext.Provider,
    { value: contextValue },
    children
  );
};

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
