/**
 * @file apps/web/src/hooks/useAuth.ts
 * @description Custom hook for accessing authentication state and methods
 * Provides a simplified interface for components to interact with auth
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import type { UseAuthReturn, User, LoginCredentials } from '@/types/auth';
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
  const initials = user ? getInitials(user) : '';
  
  return {
    user,
    isAuthenticated,
    isLoading,
    displayName,
    initials,
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
 * Hook for logout functionality
 */
export function useLogout() {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    
    try {
      await logout();
    } catch (error) {
      // Logout should always succeed locally
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  }, [logout]);
  
  return {
    logout: handleLogout,
    isLoggingOut,
  };
}

/**
 * Hook for session management
 */
export function useSession() {
  const { user, isAuthenticated, refreshSession, checkAuthStatus } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    
    try {
      await refreshSession();
    } catch (error) {
      console.error('Session refresh failed:', error);
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshSession]);
  
  return {
    user,
    isAuthenticated,
    refreshSession: handleRefresh,
    checkAuthStatus,
    isRefreshing,
  };
}

/**
 * Hook for route protection logic
 */
export function useRouteProtection() {
  const { isAuthenticated, isInitialized, isLoading } = useAuth();
  
  return {
    isAuthenticated,
    isInitialized,
    isLoading,
    shouldRedirectToLogin: isInitialized && !isLoading && !isAuthenticated,
    shouldRedirectFromAuth: isInitialized && !isLoading && isAuthenticated,
    isCheckingAuth: !isInitialized || isLoading,
  };
}

/**
 * Hook for authentication events
 */
export function useAuthEvents() {
  const [events, setEvents] = useState<Array<{ type: string; data?: any; timestamp: Date }>>([]);
  
  useEffect(() => {
    const handleAuthEvent = (e: CustomEvent) => {
      const eventType = e.type.replace('auth:', '');
      setEvents(prev => [...prev.slice(-9), {
        type: eventType,
        data: e.detail,
        timestamp: new Date(),
      }]);
    };
    
    // Listen for all auth events
    const eventTypes = ['login_success', 'login_failure', 'logout', 'session_expired', 'session_refreshed'];
    
    eventTypes.forEach(type => {
      window.addEventListener(`auth:${type}`, handleAuthEvent as EventListener);
    });
    
    return () => {
      eventTypes.forEach(type => {
        window.removeEventListener(`auth:${type}`, handleAuthEvent as EventListener);
      });
    };
  }, []);
  
  return events;
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Get user initials for avatar display
 */
function getInitials(user: User): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  }
  
  if (user.username) {
    return user.username.substring(0, 2).toUpperCase();
  }
  
  return user.email.substring(0, 2).toUpperCase();
}

// ========================================
// PERMISSION HOOKS
// ========================================

/**
 * Hook for checking user permissions/roles
 */
export function usePermissions() {
  const { user, isAuthenticated } = useAuth();
  
  const hasRole = useCallback((role: string) => {
    return isAuthenticated && user?.role === role;
  }, [isAuthenticated, user?.role]);
  
  const hasAnyRole = useCallback((roles: string[]) => {
    return isAuthenticated && user?.role && roles.includes(user.role);
  }, [isAuthenticated, user?.role]);
  
  return {
    hasRole,
    hasAnyRole,
    userRole: user?.role,
    isCustomer: hasRole('customer'),
    isAdmin: hasRole('admin'),
    isInstructor: hasRole('instructor'),
  };
}

// ========================================
// EXPORTS
// ========================================

export default useAuth;
