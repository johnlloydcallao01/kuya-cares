/**
 * @file apps/web-admin/src/components/auth/index.ts
 * @description Barrel exports for authentication components
 */

export { ProtectedRoute, withAuth, withProtectedRoute } from './ProtectedRoute';
export { PublicRoute, withPublicRoute } from './PublicRoute';
export { AuthErrorBoundary, useAuthErrorBoundary, withAuthErrorBoundary } from './AuthErrorBoundary';

// Re-export types for convenience
export type { ProtectedRouteProps, PublicRouteProps } from '@/types/auth';
