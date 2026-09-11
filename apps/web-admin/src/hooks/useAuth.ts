/**
 * @file apps/web-admin/src/hooks/useAuth.ts
 * @description Custom hook for accessing authentication state and methods
 * Provides a simplified interface for components to interact with auth.
 *
 * Logic ported 1:1 from the proven grandline web-admin pattern — notably
 * useRouteProtection gates on `isInitialized && !isLoading` so protected UI
 * is never painted optimistically on a stale cache.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import type { UseAuthReturn, User, LoginCredentials } from '@/types/auth';
import { getUserDisplayName } from '@/lib/auth';

export function useAuth(): UseAuthReturn {
  const context = useAuthContext();

  return {
    ...context,
  };
}

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

export function useAuthActions() {
  const { login, logout, refreshSession, clearError } = useAuth();

  return {
    login,
    logout,
    refreshSession,
    clearError,
  };
}

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

export function useLogin() {
  const { login, isLoading, error, clearError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = useCallback(
    async (credentials: LoginCredentials) => {
      setIsSubmitting(true);
      clearError();
      try {
        await login(credentials);
      } finally {
        setIsSubmitting(false);
      }
    },
    [login, clearError],
  );

  return {
    login: handleLogin,
    isLoading: isLoading || isSubmitting,
    error,
    clearError,
  };
}

export function useLogout() {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);

    try {
      await logout();
    } catch (error) {
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

export function useAuthEvents() {
  const [events, setEvents] = useState<Array<{ type: string; data?: unknown; timestamp: Date }>>([]);

  useEffect(() => {
    const handleAuthEvent = (e: CustomEvent) => {
      const eventType = e.type.replace('auth:', '');
      setEvents((prev) => [
        ...prev.slice(-9),
        {
          type: eventType,
          data: e.detail,
          timestamp: new Date(),
        },
      ]);
    };

    const eventTypes = ['login_success', 'login_failure', 'logout', 'session_expired', 'session_refreshed'];

    eventTypes.forEach((type) => {
      window.addEventListener(`auth:${type}`, handleAuthEvent as EventListener);
    });

    return () => {
      eventTypes.forEach((type) => {
        window.removeEventListener(`auth:${type}`, handleAuthEvent as EventListener);
      });
    };
  }, []);

  return events;
}

export function usePermissions() {
  const { user, isAuthenticated } = useAuth();

  const hasRole = useCallback(
    (role: string) => {
      return isAuthenticated && user?.role === role;
    },
    [isAuthenticated, user?.role],
  );

  const hasAnyRole = useCallback(
    (roles: string[]) => {
      return isAuthenticated && user?.role != null && roles.includes(user.role);
    },
    [isAuthenticated, user?.role],
  );

  return {
    hasRole,
    hasAnyRole,
    userRole: user?.role,
    isTrainee: hasRole('trainee'),
    isAdmin: hasRole('admin'),
    isInstructor: hasRole('instructor'),
  };
}

function getInitials(user: User): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  }

  if (user.username) {
    return user.username.substring(0, 2).toUpperCase();
  }

  return user.email.substring(0, 2).toUpperCase();
}

export function getUserInitials(user: User | null): string {
  if (!user) return '';
  return getInitials(user);
}

export function getFullName(user: User | null): string {
  if (!user) return '';
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return fullName || user.email || '';
}

export { getInitials };

export default useAuth;
