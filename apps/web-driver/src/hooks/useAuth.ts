/**
 * @file apps/web-driver/src/hooks/useAuth.ts
 * @description Custom hook for accessing authentication state and methods
 */

'use client';

import { useCallback, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import type { UseAuthReturn, LoginCredentials } from '@/types/auth';
import { getUserDisplayName } from '@/lib/auth';

// ========================================
// MAIN AUTH HOOK
// ========================================

export function useAuth(): UseAuthReturn {
  const context = useAuthContext();
  
  return {
    ...context,
  };
}

// ========================================
// SPECIALIZED AUTH HOOKS
// ========================================

/**
 * Hook for getting current user information
 */
export function useUser() {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  const displayName = user ? getUserDisplayName(user) : '';
  
  return {
    user,
    isAuthenticated,
    isLoading,
    displayName,
  };
}

/**
 * Hook for authentication actions
 */
export function useAuthActions() {
  const { login, logout, refreshSession, clearError } = useAuth();
  
  return {
    login,
    logout,
    refreshSession,
    clearError,
  };
}

/**
 * Hook for authentication status
 */
export function useAuthStatus() {
  const { isAuthenticated, isLoading, isInitialized, error } = useAuth();
  
  return {
    isAuthenticated,
    isLoading,
    isInitialized,
    error,
    isReady: isInitialized && !isLoading,
  };
}

/**
 * Hook for login functionality with enhanced error handling
 */
export function useLogin() {
  const { login, isLoading, error, clearError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    setIsSubmitting(true);
    clearError();
    
    try {
      await login(credentials);
    } catch (error) {
      // Error is already handled by the context
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [login, clearError]);
  
  return {
    login: handleLogin,
    isLoading: isLoading || isSubmitting,
    error,
    clearError,
  };
}

/**
 * Hook for route protection logic
 */
export function useRouteProtection() {
  const { isAuthenticated, isInitialized, isLoading } = useAuth();
  
  // Logic for redirecting unauthenticated users
  const shouldRedirectToLogin = isInitialized && !isLoading && !isAuthenticated;
  
  // Logic for redirecting authenticated users (e.g. from login page)
  const shouldRedirectFromAuth = isInitialized && !isLoading && isAuthenticated;
  
  return {
    isAuthenticated,
    isInitialized,
    isLoading,
    shouldRedirectToLogin,
    shouldRedirectFromAuth,
    isCheckingAuth: !isInitialized || isLoading,
  };
}
