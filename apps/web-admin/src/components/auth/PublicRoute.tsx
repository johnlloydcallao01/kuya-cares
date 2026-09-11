/**
 * @file apps/web-admin/src/components/auth/PublicRoute.tsx
 * @description Public route component for authentication pages
 * Redirects authenticated users away from auth pages (signin).
 *
 * Reference logic: only navigate once `isAuthenticated && isInitialized &&
 * !isLoading`, with a short delay so the auth state settles. Hide the form
 * immediately when authenticated to avoid a flash of the login UI.
 */

'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteProtection } from '@/hooks/useAuth';
import type { PublicRouteProps } from '@/types/auth';

export const PublicRoute = ({ children, redirectTo = '/' }: PublicRouteProps): React.ReactNode => {
  const router = useRouter();
  const { isAuthenticated, isInitialized, isLoading } = useRouteProtection();

  useEffect(() => {
    if (isAuthenticated && isInitialized && !isLoading) {
      const redirectTimer = setTimeout(() => {
        const storedRedirect = sessionStorage.getItem('auth:redirectAfterLogin');

        if (storedRedirect) {
          sessionStorage.removeItem('auth:redirectAfterLogin');
          router.replace(storedRedirect as never);
        } else {
          router.replace(redirectTo as never);
        }
      }, 100);

      return () => clearTimeout(redirectTimer);
    }
  }, [isAuthenticated, isInitialized, isLoading, redirectTo, router]);

  if (isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

/**
 * Higher-order component version of PublicRoute
 */
export function withPublicRoute<P extends object>(Component: React.ComponentType<P>, options?: Omit<PublicRouteProps, 'children'>) {
  const WrappedComponent = (props: P): React.ReactNode => (
    <PublicRoute {...options}>{React.createElement(Component, props)}</PublicRoute>
  );

  WrappedComponent.displayName = `withPublicRoute(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

export default PublicRoute;
