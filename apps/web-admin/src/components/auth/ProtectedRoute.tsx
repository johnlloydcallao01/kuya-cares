/**
 * @file apps/web-admin/src/components/auth/ProtectedRoute.tsx
 * @description Route protection component for authenticated pages
 * Redirects unauthenticated users to signin page.
 *
 * Reference logic: hold a "Checking authentication..." spinner while
 * `!isInitialized || isLoading` and never render protected children on a
 * stale cache. Only redirect once init has settled.
 */

'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteProtection } from '@/hooks/useAuth';
import type { ProtectedRouteProps } from '@/types/auth';

export const ProtectedRoute = ({
  children,
  fallback,
  redirectTo = '/signin',
}: ProtectedRouteProps): React.ReactNode => {
  const router = useRouter();
  const { isAuthenticated, shouldRedirectToLogin, isCheckingAuth } = useRouteProtection();

  useEffect(() => {
    if (shouldRedirectToLogin) {
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== redirectTo) {
        sessionStorage.setItem('auth:redirectAfterLogin', currentPath);
      }

      router.replace(redirectTo as never);
    }
  }, [shouldRedirectToLogin, redirectTo, router]);

  if (isCheckingAuth) {
    return (
      fallback || (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Checking authentication...</p>
          </div>
        </div>
      )
    );
  }

  if (!isAuthenticated) {
    return fallback || null;
  }

  return <>{children}</>;
};

/**
 * Higher-order component version of ProtectedRoute
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: React.ReactNode;
    redirectTo?: string;
  },
) {
  const WrappedComponent = (props: P): React.ReactNode => {
    return (
      <ProtectedRoute fallback={options?.fallback} redirectTo={options?.redirectTo}>
        {React.createElement(Component, props)}
      </ProtectedRoute>
    );
  };

  WrappedComponent.displayName = `withAuth(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/** Backwards-compatible alias (previous tap2go name). */
export const withProtectedRoute = withAuth;

export default ProtectedRoute;
