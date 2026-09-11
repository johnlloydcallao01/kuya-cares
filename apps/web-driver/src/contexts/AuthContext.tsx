/**
 * @file apps/web-driver/src/contexts/AuthContext.tsx
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
  isLoading: true,
  isInitialized: false,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_INIT_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: !!action.payload.user,
        isLoading: false,
        isInitialized: true,
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
        error: 'Session expired. Please login again.',
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
    if (hasValidStoredToken()) {
      const cachedUserData = localStorage.getItem('driver_auth_user');
      if (cachedUserData) {
        try {
          const cachedUser = JSON.parse(cachedUserData) as User;
          if (cachedUser.role === 'driver') {
            dispatch({ type: 'AUTH_INIT_SUCCESS', payload: { user: cachedUser } });
            return;
          }
          clearAuthState();
        } catch {
          clearAuthState();
        }
      }

      try {
        const user = await getCurrentUser();
        dispatch({ type: 'AUTH_INIT_SUCCESS', payload: { user } });
      } catch {
        dispatch({ type: 'AUTH_INIT_SUCCESS', payload: { user: null } });
      }
    } else {
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
