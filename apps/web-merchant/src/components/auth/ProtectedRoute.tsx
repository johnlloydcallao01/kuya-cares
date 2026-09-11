/**
 * @file apps/web-merchant/src/components/auth/ProtectedRoute.tsx
 * @description Protected route component for vendor-only access
 */

'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteProtection } from '@/hooks/useAuth';
import { ProtectedRouteProps } from '@/types/auth';

/**
 * ProtectedRoute ensures only authenticated vendor users can access wrapped content.
 * The auth service rejects every non-vendor role before this component renders.
 */
export function ProtectedRoute({ 
  children, 
  fallback,
  redirectTo = '/signin' 
}: ProtectedRouteProps) {
  const router = useRouter();
  const {
    shouldRedirectToLogin,
    isCheckingAuth
  } = useRouteProtection();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (shouldRedirectToLogin) {
      // Store the current path for redirect after login
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== redirectTo) {
        sessionStorage.setItem('auth:redirectAfterLogin', currentPath);
      }

      router.replace(redirectTo);
    }
  }, [shouldRedirectToLogin, redirectTo, router]);

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return fallback || null;
  }

  // Don't render anything if we should redirect
  if (shouldRedirectToLogin) {
    return null;
  }

  // No additional role validation needed; auth.ts validates the CMS vendor role.

  // Render children if user is authenticated
  return <>{children}</>;
}

/**
 * Higher-order component version of ProtectedRoute
 */
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ProtectedRouteProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ProtectedRoute fallback={options?.fallback} redirectTo={options?.redirectTo}>
      <Component {...props} />
    </ProtectedRoute>
  );

  WrappedComponent.displayName = `withProtectedRoute(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

export default ProtectedRoute;