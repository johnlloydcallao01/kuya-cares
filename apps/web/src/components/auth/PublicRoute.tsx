/**
 * @file apps/web/src/components/auth/PublicRoute.tsx
 * @description Public route component for authentication pages
 * Redirects authenticated users away from auth pages (signin, register)
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
  redirectTo = '/'
}: PublicRouteProps): React.ReactNode => {
  const router = useRouter();
  const {
    isAuthenticated,
    isInitialized,
    isLoading,
    shouldRedirectFromAuth,
    isCheckingAuth
  } = useRouteProtection();

  // Redirect authenticated users away from auth pages
  useEffect(() => {
    if (isAuthenticated && isInitialized && !isLoading) {
      console.log('🔄 PUBLIC ROUTE: Redirecting authenticated user');

      // Small delay to ensure authentication state is fully settled
      const redirectTimer = setTimeout(() => {
        // Check if there's a stored redirect path
        const storedRedirect = sessionStorage.getItem('auth:redirectAfterLogin');

        if (storedRedirect) {
          console.log('🔄 REDIRECTING TO STORED PATH:', storedRedirect);
          sessionStorage.removeItem('auth:redirectAfterLogin');
          router.replace(storedRedirect as any);
        } else {
          console.log('🔄 REDIRECTING TO DEFAULT:', redirectTo);
          router.replace(redirectTo as any);
        }
      }, 100); // Small delay to ensure state is settled

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

// ========================================
// HOC VERSION
// ========================================

/**
 * Higher-order component version of PublicRoute
 * Usage: const PublicComponent = withPublicRoute(MyComponent);
 */
export function withPublicRoute<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    redirectTo?: string;
  }
) {
  const WrappedComponent = (props: P): React.ReactNode => {
    return (
      <PublicRoute redirectTo={options?.redirectTo}>
        {React.createElement(Component, props)}
      </PublicRoute>
    );
  };

  WrappedComponent.displayName = `withPublicRoute(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// ========================================
// GUEST ONLY COMPONENT
// ========================================

interface GuestOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

/**
 * Component that only renders for unauthenticated users
 * Similar to PublicRoute but without automatic redirection
 */
export const GuestOnly = ({ children, fallback, redirectTo }: GuestOnlyProps): React.ReactNode => {
  const { isAuthenticated } = useRouteProtection();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && redirectTo) {
      router.replace(redirectTo as any);
    }
  }, [isAuthenticated, redirectTo, router]);

  if (isAuthenticated) {
    return fallback || null;
  }

  return <>{children}</>;
};

// ========================================
// CONDITIONAL AUTH COMPONENTS
// ========================================

interface ConditionalAuthProps {
  children: React.ReactNode;
  showWhenAuthenticated?: boolean;
  fallback?: React.ReactNode;
}

/**
 * Conditionally render content based on authentication status
 * Useful for navbar items, buttons, etc.
 */
export const ConditionalAuth = ({
  children,
  showWhenAuthenticated = false,
  fallback
}: ConditionalAuthProps): React.ReactNode => {
  const { isAuthenticated } = useRouteProtection();

  const shouldShow = showWhenAuthenticated ? isAuthenticated : !isAuthenticated;

  return shouldShow ? <>{children}</> : (fallback || null);
}

// ========================================
// AUTH STATUS INDICATOR
// ========================================

interface AuthStatusIndicatorProps {
  className?: string;
}

/**
 * Visual indicator of authentication status
 * Useful for debugging or admin interfaces
 */
export const AuthStatusIndicator = ({ className = '' }: AuthStatusIndicatorProps): JSX.Element => {
  const { isAuthenticated, isCheckingAuth, isInitialized } = useRouteProtection();

  if (!isInitialized) {
    return (
      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ${className}`}>
        <div className="w-2 h-2 bg-gray-400 rounded-full mr-1 animate-pulse"></div>
        Initializing
      </div>
    );
  }

  if (isCheckingAuth) {
    return (
      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 ${className}`}>
        <div className="w-2 h-2 bg-yellow-400 rounded-full mr-1 animate-pulse"></div>
        Checking
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 ${className}`}>
        <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
        Authenticated
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 ${className}`}>
      <div className="w-2 h-2 bg-red-400 rounded-full mr-1"></div>
      Guest
    </div>
  );
}

// ========================================
// EXPORTS
// ========================================

export default PublicRoute;
