/**
 * @file apps/web-driver/src/components/auth/ProtectedRoute.tsx
 * @description Route protection component for authenticated pages
 */

'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteProtection } from '@/hooks/useAuth';
import type { ProtectedRouteProps } from '@/types/auth';

// ========================================
// PROTECTED ROUTE COMPONENT
// ========================================

export const ProtectedRoute = ({
  children,
  fallback,
  redirectTo = '/signin'
}: ProtectedRouteProps): React.ReactNode => {
  const router = useRouter();
  const {
    isAuthenticated,
    shouldRedirectToLogin,
    isCheckingAuth
  } = useRouteProtection();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (shouldRedirectToLogin) {
      // Store the current path for redirect after login
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== redirectTo) {
        sessionStorage.setItem('driver_auth_redirect', currentPath);
      }

      router.replace(redirectTo);
    }
  }, [shouldRedirectToLogin, redirectTo, router]);

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return fallback || (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render children if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Render protected content
  return <>{children}</>;
};
