/**
 * @file apps/web-driver/src/components/auth/PublicRoute.tsx
 * @description Public route component for authentication pages
 */

'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteProtection } from '@/hooks/useAuth';
import type { PublicRouteProps } from '@/types/auth';

// ========================================
// PUBLIC ROUTE COMPONENT
// ========================================

export const PublicRoute = ({
  children,
  redirectTo = '/dashboard'
}: PublicRouteProps): React.ReactNode => {
  const router = useRouter();
  const {
    isAuthenticated,
    isInitialized,
    isLoading,
  } = useRouteProtection();

  // Redirect authenticated users away from auth pages
  useEffect(() => {
    if (isAuthenticated && isInitialized && !isLoading) {
      // Small delay to ensure authentication state is fully settled
      const redirectTimer = setTimeout(() => {
        // Check if there's a stored redirect path
        const storedRedirect = sessionStorage.getItem('driver_auth_redirect');

        if (storedRedirect) {
          sessionStorage.removeItem('driver_auth_redirect');
          router.replace(storedRedirect);
        } else {
          router.replace(redirectTo);
        }
      }, 100);

      return () => clearTimeout(redirectTimer);
    }
  }, [isAuthenticated, isInitialized, isLoading, redirectTo, router]);

  // Don't render children if authenticated (will redirect)
  if (isAuthenticated) {
    return null;
  }

  // Render public content for unauthenticated users
  return <>{children}</>;
};
