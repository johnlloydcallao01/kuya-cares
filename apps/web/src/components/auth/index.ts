/**
 * @file apps/web/src/components/auth/index.ts
 * @description Barrel exports for authentication components
 */

// Route Protection Components
export {
  ProtectedRoute,
  withAuth,
  RoleProtectedRoute,
  AuthGate,
  default as ProtectedRouteDefault
} from './ProtectedRoute';

export {
  PublicRoute,
  withPublicRoute,
  GuestOnly,
  ConditionalAuth,
  AuthStatusIndicator,
  default as PublicRouteDefault
} from './PublicRoute';

// User Profile Components
export {
  UserAvatar,
  UserInfo,
  LogoutButton,
  UserDropdown,
  CompactUserProfile,
  default as UserDropdownDefault
} from './UserProfile';

// Error Handling Components
export {
  AuthErrorBoundary,
  useAuthErrorBoundary,
  NetworkError,
  SessionExpired,
  default as AuthErrorBoundaryDefault
} from './AuthErrorBoundary';
