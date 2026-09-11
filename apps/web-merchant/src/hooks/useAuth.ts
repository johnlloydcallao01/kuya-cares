/**
 * @file apps/web-merchant/src/hooks/useAuth.ts
 * @description Authentication hooks for PayloadCMS
 * Provides convenient hooks for authentication state and actions
 */

'use client';

import { useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import type { User, LoginCredentials } from '@/types/auth';

// ========================================
// MAIN AUTH HOOK
// ========================================

/**
 * Main authentication hook
 * Provides access to all authentication state and methods
 */
export function useAuth() {
  return useAuthContext();
}

// ========================================
// USER HOOK
// ========================================

/**
 * Hook for accessing current user data
 */
export function useUser(): User | null {
  const { user } = useAuthContext();
  return user;
}

// ========================================
// AUTH ACTIONS HOOKS
// ========================================

/**
 * Hook for authentication actions
 */
export function useAuthActions() {
  const { login, logout, refreshSession, clearError } = useAuthContext();
  
  return {
    login,
    logout,
    refreshSession,
    clearError,
  };
}

// ========================================
// AUTH STATUS HOOKS
// ========================================

/**
 * Hook for authentication status
 */
export function useAuthStatus() {
  const { isAuthenticated, isLoading, isInitialized, error } = useAuthContext();
  
  return {
    isAuthenticated,
    isLoading,
    isInitialized,
    error,
  };
}

// ========================================
// SPECIFIC ACTION HOOKS
// ========================================

/**
 * Hook for login functionality
 */
export function useLogin() {
  const { login, isLoading, error } = useAuthContext();
  
  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    return await login(credentials);
  }, [login]);
  
  return {
    login: handleLogin,
    isLoading,
    error,
  };
}

/**
 * Hook for logout functionality
 */
export function useLogout() {
  const { logout, isLoading } = useAuthContext();
  
  const handleLogout = useCallback(async () => {
    return await logout();
  }, [logout]);
  
  return {
    logout: handleLogout,
    isLoading,
  };
}

// ========================================
// SESSION HOOKS
// ========================================

/**
 * Hook for session management
 */
export function useSession() {
  const { user, isAuthenticated, refreshSession, checkAuthStatus } = useAuthContext();
  
  const refresh = useCallback(async () => {
    return await refreshSession();
  }, [refreshSession]);
  
  const checkStatus = useCallback(async () => {
    return await checkAuthStatus();
  }, [checkAuthStatus]);
  
  return {
    user,
    isAuthenticated,
    refresh,
    checkStatus,
  };
}

// ========================================
// ROUTE PROTECTION HOOK
// ========================================

/**
 * Hook for route protection logic
 * Provides computed values for route protection decisions
 */
export function useRouteProtection() {
  const { isAuthenticated, isInitialized, isLoading } = useAuthContext();
  
  return {
    isAuthenticated,
    isInitialized,
    isLoading,
    // Should redirect to login if not authenticated and initialization is complete
    shouldRedirectToLogin: isInitialized && !isAuthenticated,
    // Should redirect from auth pages if already authenticated
    shouldRedirectFromAuth: isAuthenticated, // Allow redirect as soon as authenticated
    // Still checking authentication status - but not if we're already authenticated
    isCheckingAuth: !isAuthenticated && (!isInitialized || isLoading),
  };
}

// ========================================
// AUTH EVENTS HOOK
// ========================================

/**
 * Hook for listening to authentication events
 */
export function useAuthEvents() {
  const { user, isAuthenticated, error } = useAuthContext();
  
  return {
    user,
    isAuthenticated,
    error,
  };
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Get user initials from name or email
 */
export function getInitials(user: User | null): string {
  if (!user) return '';
  
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  if (fullName) {
    return fullName
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  
  if (user.email) {
    return user.email.charAt(0).toUpperCase();
  }
  
  return '';
}

/**
 * Get full name or fallback to email
 */
export function getFullName(user: User | null): string {
  if (!user) return '';
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return fullName || user.email || '';
}

/**
 * Get user initials (alias for getInitials)
 */
export function getUserInitials(user: User | null): string {
  return getInitials(user);
}

// ========================================
// PERMISSIONS HOOK
// ========================================

/**
 * Hook for vendor portal permissions
 */
export function usePermissions() {
  const { user, isAuthenticated } = useAuthContext();
  
  return {
    user,
    isAuthenticated,
    isVendor: isAuthenticated && user?.role === 'vendor',
    // Merchant portal access is restricted to the CMS vendor role.
    canAccess: (_resource: string) => isAuthenticated && user?.role === 'vendor',
    hasRole: (role: string) => isAuthenticated && user?.role === role,
    canManageUsers: false,
    canManageContent: isAuthenticated && user?.role === 'vendor',
    canViewAnalytics: isAuthenticated && user?.role === 'vendor',
    canManageSettings: isAuthenticated && user?.role === 'vendor',
  };
}
