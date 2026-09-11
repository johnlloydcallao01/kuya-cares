/**
 * @file apps/web-admin/src/components/auth/PublicRoute.tsx
 * @description Public route component that redirects authenticated admin users
 * Based on apps/web PublicRoute but adapted for admin-only access
 */

'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteProtection } from '@/hooks/useAuth';
import { PublicRouteProps } from '@/types/auth';

/**
 * PublicRoute component that redirects authenticated users away from public pages
 * Used for login, register, and other auth-related pages
 */
export function PublicRoute({ 
  children, 
  redirectTo = '/' 
}: PublicRouteProps) {
  const router = useRouter();
  const { shouldRedirectFromAuth } = useRouteProtection();

  // Immediate redirect for authenticated users
  useEffect(() => {
    if (shouldRedirectFromAuth) {
      const redirectPath = sessionStorage.getItem('auth:redirectAfterLogin') || redirectTo;
      sessionStorage.removeItem('auth:redirectAfterLogin');
      router.replace(redirectPath);
    }
  }, [shouldRedirectFromAuth, redirectTo, router]);

  // Don't render anything if we should redirect
  if (shouldRedirectFromAuth) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Higher-order component version of PublicRoute
 */
export function withPublicRoute<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<PublicRouteProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <PublicRoute {...options}>
      <Component {...props} />
    </PublicRoute>
  );

  WrappedComponent.displayName = `withPublicRoute(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

export default PublicRoute;